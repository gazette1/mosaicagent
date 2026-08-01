/**
 * Eval #2 (LLM as judge) + #3 (rubric scoring) + #8 (human review calibration).
 *
 * The judge runs on a DIFFERENT VENDOR than every generator in the pipeline
 * (Anthropic judging Kimi and OpenAI output). A judge sharing a vendor with the
 * generator inherits its blind spots and quietly grades its own homework.
 *
 * The judge scores per dimension, never a single blended number, because one
 * score hides which part got worse. And every judgment is written to a
 * calibration sheet so a human can grade the judge: a judge nobody checks
 * drifts.
 *
 * Usage: node eval/judge.js <deal-output-dir>   (after npm run build)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const { callJson } = require(path.join(REPO, 'dist', 'llm', 'client'));

const RUBRIC = `You are grading an automated commercial real estate underwriting output.
You are an independent reviewer. The pipeline that produced this is not yours; do not assume it is correct.

Score each dimension 0-5 and justify in one sentence with a specific reference to the text:

- grounding: Is every number traceable to a cited source document? Penalize any figure that appears without provenance. 5 = every figure sourced, 0 = free-floating numbers.
- calibration: Does stated confidence match evidence quality? Penalize confident claims built on marketing documents, and penalize hedging on well-evidenced figures.
- judgment_boundary: Does it stop at analysis and leave the credit decision to a human? Penalize any language that renders a final approval, and penalize failure to name what a human must decide.
- red_tape: Does it surface deal-structure risk (approvals, consents, litigation, receivables, fee overhangs) rather than only numbers?
- honesty: Does it name gaps and disagreements plainly instead of papering over them? Penalize false completeness.

Respond with a single JSON object:
{"scores":{"grounding":n,"calibration":n,"judgment_boundary":n,"red_tape":n,"honesty":n},
 "justifications":{"grounding":"...","calibration":"...","judgment_boundary":"...","red_tape":"...","honesty":"..."},
 "worst_dimension":"...","one_fix":"the single highest-value improvement"}`;

async function judgeArtifact(label, text) {
  const { data, usage } = await callJson(
    'judge', RUBRIC,
    `Grade this ${label}:\n\n${text.substring(0, 30000)}`,
    'underwriting_judgment', {}, 1500
  );
  return { label, ...data, usage: { model: usage.model, cost: usage.estCostUsd } };
}

async function main() {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node eval/judge.js <deal outputs dir>');
    process.exit(1);
  }

  const targets = [
    ['memo', path.join(dir, 'memo.md')],
    ['lender package narrative', path.join(dir, 'narrative.md')],
  ].filter(([, p]) => fs.existsSync(p));

  if (!targets.length) { console.error('No memo.md or narrative.md found in', dir); process.exit(1); }

  const judgments = [];
  for (const [label, p] of targets) {
    try {
      const j = await judgeArtifact(label, fs.readFileSync(p, 'utf-8'));
      judgments.push(j);
      const s = j.scores || {};
      const avg = Object.values(s).reduce((a, b) => a + b, 0) / (Object.keys(s).length || 1);
      console.log(`\n${label.toUpperCase()}  (judge: ${j.usage.model}, $${(j.usage.cost || 0).toFixed(4)})`);
      for (const [dim, val] of Object.entries(s)) {
        console.log(`  ${dim.padEnd(20)} ${val}/5   ${(j.justifications?.[dim] || '').substring(0, 92)}`);
      }
      console.log(`  ${'AVERAGE'.padEnd(20)} ${avg.toFixed(2)}/5`);
      console.log(`  weakest: ${j.worst_dimension}`);
      console.log(`  one fix: ${j.one_fix}`);
    } catch (e) {
      console.log(`${label}: judge failed: ${String(e.message).substring(0, 160)}`);
    }
  }

  // Calibration sheet: eval #8. A human grades the judge here, and disagreement
  // is the signal that the rubric or the judge model needs work.
  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const rec = { timestamp: new Date().toISOString(), dealDir: dir, judgments, humanReview: { agreesWithJudge: null, humanScores: {}, notes: '' } };
  fs.writeFileSync(path.join(outDir, 'judge-latest.json'), JSON.stringify(rec, null, 2));

  const sheet = path.join(outDir, 'human-calibration.jsonl');
  fs.appendFileSync(sheet, JSON.stringify(rec) + '\n');
  console.log(`\nJudgment written to eval/results/judge-latest.json`);
  console.log(`Calibration queue: eval/results/human-calibration.jsonl (fill humanReview to grade the judge)`);
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1); });
