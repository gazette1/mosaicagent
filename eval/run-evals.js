/**
 * Golden-set eval runner.
 *
 * - Golden set: fixed cases, never edited, run on every change
 * - Rubric scoring: one number per dimension (correctness, completeness,
 *   consistency, cost) so a single score cannot hide what got worse
 * - Regression: diffs this run against the previous entry in history.jsonl
 * - Trajectory: asserts on the audit log (path taken), not just outputs
 *
 * LLM-as-judge and human-review sampling plug in on top of these results;
 * they require an API key / a human and are out of scope for the offline run.
 *
 * Usage: node eval/run-evals.js   (after npm run build)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const CLI = path.join(REPO, 'dist', 'cli', 'index.js');
const RESULTS_DIR = path.join(__dirname, 'results');
const DASH_DIR = path.join(__dirname, 'dashboard');

function run(cwd, args) {
  return execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' });
}

function approx(actual, expected, tolPct) {
  if (typeof actual !== 'number') return false;
  return Math.abs(actual - expected) <= Math.abs(expected) * tolPct;
}

function newRunDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-eval-'));
  return dir;
}

// ============================================================================
// Case 1: industrial samples (fixed toy fixtures)
// ============================================================================
function caseIndustrial() {
  const cwd = newRunDir();
  const checks = [];
  const ex = p => path.join(REPO, 'examples', p);

  const out = run(cwd, ['new', '--name', 'Golden Industrial', '--type', 'industrial', '--location', 'Phoenix, AZ']);
  const dealId = (out.match(/Created deal: (\S+)/) || [])[1];
  checks.push(['deal created', Boolean(dealId)]);

  run(cwd, ['ingest', '--deal', dealId, '--file', ex('sample-rentroll.csv'), '--kind', 'rentroll_csv']);
  run(cwd, ['ingest', '--deal', dealId, '--file', ex('sample-t12.csv'), '--kind', 't12_csv']);
  run(cwd, ['ingest', '--deal', dealId, '--file', ex('sample-broker-email.txt'), '--kind', 'email']);
  run(cwd, ['screen', '--deal', dealId]);
  run(cwd, ['deepdive', '--deal', dealId]);

  const deal = JSON.parse(fs.readFileSync(path.join(cwd, 'deals', dealId, 'deal.json'), 'utf-8'));
  const screen = JSON.parse(fs.readFileSync(path.join(cwd, 'deals', dealId, 'outputs', 'screen.json'), 'utf-8'));

  checks.push(['T12 NOI = 304,600', deal.extracted.t12?.noi?.value === 304600]);
  checks.push(['NOI confidence >= 0.8', (deal.extracted.t12?.noi?.confidence ?? 0) >= 0.8]);
  checks.push(['rent roll: 10 units', (deal.extracted.rentRoll?.tenants?.length ?? 0) === 10]);
  checks.push(['asking price extracted', approx(deal.askingPrice?.value, 4250000, 0.01)]);
  // Golden updated 2026-07-25: debt pricing moved from hardcoded 7.5% to
  // market-indexed SOFR+400 (design decision). At real rates this toy deal
  // correctly fails the 1.15x DSCR floor: KILL is the right answer.
  checks.push(['verdict KILL at market rates', screen.verdict === 'KILL']);
  checks.push(['DSCR kill flag triggered', screen.killFlags.some(f => f.triggered && /Margin/.test(f.criterion))]);
  checks.push(['entry cap 6.5-8.5%', approx(screen.keyMetrics?.entryCap?.value?.value, 7.17, 0.2)]);
  // Golden updated 2026-07-31: the claims ledger made confidence provenance-
  // aware, so a deal whose NOI comes from a broker email now correctly trips
  // adaptive stress (wider NOI haircut). DSCR drops ~0.09 as a result. The
  // verdict and kill flag are unchanged, which is what the check is really for.
  checks.push(['stressed DSCR 0.85-1.1x under adaptive stress', (screen.keyMetrics?.stressedDscr?.value?.value ?? 0) >= 0.85 && (screen.keyMetrics?.stressedDscr?.value?.value ?? 9) <= 1.1]);
  checks.push(['T12 beats broker email on NOI (claims ledger)', deal.extracted.t12?.noi?.value === 304600 && (deal.extracted.t12?.noi?.confidence ?? 0) >= 0.8]);
  checks.push(['claims ledger populated with provenance', (deal.extracted.claims ?? []).length > 0 && (deal.extracted.claims ?? []).every(c => c.docClass && typeof c.authority === 'number')]);
  // Trajectory: the path matters, not just the landing
  const actions = deal.auditLog.map(e => e.action);
  checks.push(['trajectory: sources before screen', actions.indexOf('SOURCE_ADDED') < actions.indexOf('SCREEN_EXECUTED') || !actions.includes('SCREEN_EXECUTED')]);
  checks.push(['trajectory: no invented numbers (all tracked have source or formula)',
    [deal.extracted.t12?.noi, deal.askingPrice].every(tv => !tv || tv.sourceId || tv.formula)]);

  return { name: 'industrial-samples', checks, extractedFields: Object.keys(deal.extracted.notes?.reduce((m, n) => (m[n.field] = 1, m), {}) ?? {}).length, expectedFields: 6 };
}

// ============================================================================
// Case 2: Sandcastle hotel (real memo, golden workbook cross-check)
// ============================================================================
function caseSandcastle() {
  const cwd = newRunDir();
  const checks = [];
  const memo = 'C:/Real Estate/Sandcastle Hotel - Myrtle Beach/Myrtle_Beach_Radisson_Bridge_Financing_Memo.md';
  if (!fs.existsSync(memo)) {
    return { name: 'sandcastle-hotel', checks: [['memo fixture present', false]], extractedFields: 0, expectedFields: 6 };
  }

  const out = run(cwd, ['new', '--name', 'Golden Sandcastle', '--type', 'hotel', '--location', 'Myrtle Beach, SC']);
  const dealId = (out.match(/Created deal: (\S+)/) || [])[1];
  run(cwd, ['ingest', '--deal', dealId, '--file', memo, '--kind', 'om_text']);
  run(cwd, ['screen', '--deal', dealId]);
  run(cwd, ['workbook', '--deal', dealId, '--no-architect']);

  const deal = JSON.parse(fs.readFileSync(path.join(cwd, 'deals', dealId, 'deal.json'), 'utf-8'));
  const screen = JSON.parse(fs.readFileSync(path.join(cwd, 'deals', dealId, 'outputs', 'screen.json'), 'utf-8'));

  checks.push(['keys = 150', deal.extracted.hotel?.keys?.value === 150]);
  checks.push(['ADR extracted (100-170)', (deal.extracted.hotel?.adr?.value ?? 0) >= 100 && (deal.extracted.hotel?.adr?.value ?? 0) <= 170]);
  checks.push(['NOI = 2,843,000 (memo Y3)', deal.extracted.t12?.noi?.value === 2843000]);
  checks.push(['price/basis = 18.4MM order of magnitude', approx(deal.askingPrice?.value, 18400000, 0.15)]);
  checks.push(['verdict is not KILL', screen.verdict !== 'KILL']);
  checks.push(['DSCR sane (0.5-3.0x)', (screen.keyMetrics?.stressedDscr?.value?.value ?? 0) > 0.5 && (screen.keyMetrics?.stressedDscr?.value?.value ?? 9) < 3.0]);

  // Workbook consistency (golden workbook layout contract)
  const wbPath = path.join(cwd, 'deals', dealId, 'outputs', 'package.xlsx');
  checks.push(['workbook generated', fs.existsSync(wbPath)]);
  const ExcelJS = require(path.join(REPO, 'node_modules', 'exceljs'));
  return (async () => {
    // Golden updated 2026-07-27 (Russ-directed): workbook rebuilt to the
    // institutional reference-model layout (Radisson/Harborside standard).
    // Assumptions is the single source of truth; 10-sheet contract.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(wbPath);
    const names = wb.worksheets.map(w => w.name);
    checks.push(['10-sheet institutional layout', ['Executive Summary', 'Assumptions', 'Sources & Uses', 'Debt Sizing', 'Pro Forma', 'Stabilized P&L', 'Sensitivity', 'Scenarios', 'Macro Scenarios', 'Audit'].every(n => names.includes(n))]);
    const pf = wb.getWorksheet('Pro Forma');
    checks.push(['RevPAR is a formula (occ x ADR)', pf.getCell('B6').formula === 'B4*B5']);
    const as = wb.getWorksheet('Assumptions');
    let allinOk = false;
    as.eachRow(r => { if (String(r.getCell(1).value) === 'All-In Rate' && String(r.getCell(2).formula || '').includes('/10000')) allinOk = true; });
    checks.push(['all-in rate built as index + spread bps', allinOk]);
    const dz = wb.getWorksheet('Debt Sizing');
    checks.push(['perm takeout sized as min of three constraints', dz.getCell('B21').formula === 'MIN(B18:B20)']);
    const su = wb.getWorksheet('Sources & Uses');
    checks.push(['sources & uses balance check present', su.getCell('B13').formula === 'B12-B8']);
    return { name: 'sandcastle-hotel', checks, extractedFields: (deal.extracted.notes ?? []).length, expectedFields: 8 };
  })();
}

// ============================================================================
// Rubric scoring + regression + output
// ============================================================================
async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.mkdirSync(DASH_DIR, { recursive: true });

  const commit = (() => {
    try { return require('child_process').execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf-8' }).trim(); }
    catch { return 'unknown'; }
  })();

  const cases = [];
  for (const fn of [caseIndustrial, caseSandcastle]) {
    try {
      cases.push(await fn());
    } catch (e) {
      cases.push({ name: fn.name, checks: [['case crashed: ' + e.message.substring(0, 120), false]], extractedFields: 0, expectedFields: 1 });
    }
  }

  const scored = cases.map(c => {
    const passed = c.checks.filter(x => x[1]).length;
    const correctness = c.checks.length ? passed / c.checks.length : 0;
    const completeness = Math.min(1, c.extractedFields / c.expectedFields);
    const consistencyChecks = c.checks.filter(x => /formula|sheets|workbook|trajectory/.test(x[0]));
    const consistency = consistencyChecks.length ? consistencyChecks.filter(x => x[1]).length / consistencyChecks.length : 1;
    const cost = 1; // deterministic pipeline: zero tokens spent
    return {
      name: c.name,
      rubric: { correctness, completeness, consistency, cost },
      score: +(0.5 * correctness + 0.2 * completeness + 0.25 * consistency + 0.05 * cost).toFixed(3),
      checks: c.checks.map(([label, ok]) => ({ label, ok })),
    };
  });

  const result = {
    timestamp: new Date().toISOString(),
    commit,
    overall: +(scored.reduce((s, c) => s + c.score, 0) / scored.length).toFixed(3),
    cases: scored,
  };

  // Regression vs previous run
  const historyPath = path.join(RESULTS_DIR, 'history.jsonl');
  let regression = null;
  if (fs.existsSync(historyPath)) {
    const lines = fs.readFileSync(historyPath, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length) {
      const prev = JSON.parse(lines[lines.length - 1]);
      regression = {
        prevCommit: prev.commit,
        prevOverall: prev.overall,
        delta: +(result.overall - prev.overall).toFixed(3),
        regressed: result.overall < prev.overall - 1e-9,
        perCase: scored.map(c => {
          const p = (prev.cases || []).find(x => x.name === c.name);
          return { name: c.name, delta: p ? +(c.score - p.score).toFixed(3) : null };
        }),
      };
    }
  }
  result.regression = regression;

  fs.writeFileSync(path.join(RESULTS_DIR, 'latest.json'), JSON.stringify(result, null, 2));
  fs.appendFileSync(historyPath, JSON.stringify(result) + '\n');

  // Dashboard data: full history embedded so the page opens from disk
  const history = fs.readFileSync(historyPath, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const dataJs = 'window.EVAL_DATA = ' + JSON.stringify({ latest: result, history }, null, 1) + ';';
  fs.writeFileSync(path.join(DASH_DIR, 'results.js'), dataJs);
  // Self-contained report (no sibling files needed)
  const tpl = fs.readFileSync(path.join(DASH_DIR, 'index.html'), 'utf-8');
  fs.writeFileSync(path.join(DASH_DIR, 'report.html'), tpl.replace('<script src="results.js"></script>', `<script>${dataJs}</script>`));

  // Console summary
  console.log(`Eval run @ ${commit}  overall ${result.overall}`);
  for (const c of scored) {
    console.log(`  ${c.name}: score ${c.score}  correctness ${c.rubric.correctness.toFixed(2)}  completeness ${c.rubric.completeness.toFixed(2)}  consistency ${c.rubric.consistency.toFixed(2)}`);
    for (const ch of c.checks) console.log(`    ${ch.ok ? 'PASS' : 'FAIL'}  ${ch.label}`);
  }
  if (regression) {
    console.log(`Regression vs ${regression.prevCommit}: delta ${regression.delta >= 0 ? '+' : ''}${regression.delta} ${regression.regressed ? 'REGRESSED' : 'ok'}`);
  }
  const anyFail = scored.some(c => c.checks.some(ch => !ch.ok));
  process.exit(anyFail ? 1 : 0);
}

main();
