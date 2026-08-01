/**
 * Eval #9 (shadow run) + #7 (A/B) + #6 (regression), offline form.
 *
 * A shadow run sends the same real input to a candidate configuration whose
 * output nobody sees, then diffs it against production. Here "production" is
 * the routed extraction model and "candidate" is the shadow tier (a different
 * vendor), so the comparison answers the question that actually matters before
 * a model swap: would this have changed any deal's answer?
 *
 * Agreement is measured on the numbers a credit decision turns on, not on
 * string equality of prose, because two correct extractions phrase quotes
 * differently and that is not a regression.
 *
 * Usage: node eval/shadow.js            (uses the standard fixture set)
 *        node eval/shadow.js <file...>  (specific documents)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const { callJson, getModelsConfig } = require(path.join(REPO, 'dist', 'llm', 'client'));
const { setPolicy } = require(path.join(REPO, 'dist', 'llm', 'gateway'));

// Shadow runs are a batch job nobody is waiting on: raise the cap deliberately.
setPolicy({ perRunCapUsd: 10, perDealCapUsd: 5 });

const FIELDS = ['askingPrice', 'noi', 'capRate', 'occupancy', 'adr', 'keys', 'totalSF', 'loanRequest', 'capexTotal'];

const SYSTEM = `You extract commercial real estate deal facts from documents.
Only report values explicitly present. Never estimate. Omit absent fields.
askingPrice is the purchase price, NOT a loan amount. loanRequest is debt requested.
occupancy and capRate as decimals. Dollar amounts as plain numbers.
Respond with a single JSON object: {"fields":{"<name>":{"value":number|string,"confidence":0-1}}}.
Allowed names: ${FIELDS.join(', ')}.`;

const DEFAULT_FIXTURES = [
  'C:/Real Estate/_LOOM Deal Room/01 Bridge Financing Memo.md',
  'C:/Real Estate/Case Studies 2026/1193 Fulton Ave/1193_Fulton_Underwriting_Scenario_A_Earnout.docx',
].filter(p => fs.existsSync(p));

async function extractWith(role, text) {
  const t0 = Date.now();
  const { data, usage } = await callJson(role, SYSTEM,
    `Extract deal facts:\n\n${text.substring(0, 40000)}`, 'shadow_extract', {}, 1200);
  return { fields: data.fields || {}, usage, ms: Date.now() - t0 };
}

/** Numeric agreement within tolerance; presence agreement for everything else. */
function compare(prod, cand) {
  const rows = [];
  const names = new Set([...Object.keys(prod), ...Object.keys(cand)]);
  for (const n of names) {
    const a = prod[n]?.value, b = cand[n]?.value;
    let verdict;
    if (a === undefined) verdict = 'candidate-only';
    else if (b === undefined) verdict = 'production-only';
    else if (typeof a === 'number' && typeof b === 'number') {
      const denom = Math.max(Math.abs(a), Math.abs(b), 1);
      verdict = Math.abs(a - b) / denom <= 0.01 ? 'agree' : 'DISAGREE';
    } else verdict = String(a).trim() === String(b).trim() ? 'agree' : 'DISAGREE';
    rows.push({ field: n, production: a, candidate: b, verdict });
  }
  return rows;
}

async function main() {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FIXTURES;
  if (!files.length) { console.error('No fixtures found.'); process.exit(1); }

  const cfg = getModelsConfig();
  console.log(`production: ${cfg.routing.extraction}    candidate(shadow): ${cfg.routing.shadow}\n`);

  const report = [];
  for (const f of files) {
    let text = '';
    try {
      if (/\.docx$/i.test(f)) {
        const { extractDocxText } = require(path.join(REPO, 'dist', 'ingest', 'docx-extractor'));
        text = await extractDocxText(f);
      } else {
        text = fs.readFileSync(f, 'utf-8');
      }
    } catch (e) { console.log(`skip ${path.basename(f)}: ${e.message}`); continue; }

    let prod, cand;
    try { prod = await extractWith('extraction', text); } catch (e) { console.log(`production failed: ${e.message}`); continue; }
    try { cand = await extractWith('shadow', text); } catch (e) { console.log(`candidate failed: ${e.message}`); continue; }

    const rows = compare(prod.fields, cand.fields);
    const agree = rows.filter(r => r.verdict === 'agree').length;
    const disagree = rows.filter(r => r.verdict === 'DISAGREE');

    console.log(`${path.basename(f)}`);
    console.log(`  agreement ${agree}/${rows.length}   prod ${prod.ms}ms $${prod.usage.estCostUsd.toFixed(4)}   cand ${cand.ms}ms $${cand.usage.estCostUsd.toFixed(4)}`);
    for (const r of rows.filter(r => r.verdict !== 'agree')) {
      console.log(`    ${r.verdict.padEnd(16)} ${r.field}: production=${r.production} candidate=${r.candidate}`);
    }
    report.push({ file: path.basename(f), agree, total: rows.length, disagreements: disagree, rows,
      prod: { model: prod.usage.model, ms: prod.ms, cost: prod.usage.estCostUsd },
      cand: { model: cand.usage.model, ms: cand.ms, cost: cand.usage.estCostUsd } });
  }

  const totals = report.reduce((a, r) => ({ agree: a.agree + r.agree, total: a.total + r.total }), { agree: 0, total: 0 });
  const rate = totals.total ? (totals.agree / totals.total) : 0;
  console.log(`\nShadow agreement: ${totals.agree}/${totals.total} (${(rate * 100).toFixed(0)}%)`);
  console.log(rate >= 0.9
    ? 'Candidate tracks production closely enough to consider promoting.'
    : 'Candidate diverges materially. Do not promote without reading every disagreement above.');

  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'shadow-latest.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), production: cfg.routing.extraction, candidate: cfg.routing.shadow, agreementRate: rate, report }, null, 2));
  console.log('Report: eval/results/shadow-latest.json');
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1); });
