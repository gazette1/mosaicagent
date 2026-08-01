/**
 * The full eval stack, one command: `npm run eval:all`
 *
 * Ten methods, and an honest statement of which are OFFLINE (they tell you it
 * works) versus ONLINE (they tell you it still works). Online methods need
 * live traffic; this repo has none yet, so those are reported as staged rather
 * than quietly counted as passing.
 *
 *   1  golden set        offline   run-evals.js
 *   2  llm as judge      offline   judge.js       (independent vendor)
 *   3  rubric scoring    offline   judge.js + run-evals.js
 *   4  trajectory        offline   run-evals.js   (audit-log assertions)
 *   5  tool unit tests   offline   npm test
 *   6  regression        offline   run-evals.js   (history diff)
 *   7  a/b in prod       ONLINE    staged: needs live traffic
 *   8  human review      offline   judge.js writes the calibration queue
 *   9  shadow run        offline   shadow.js      (cross-provider diff)
 *  10  red team          offline   redteam.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const results = [];

function step(id, name, kind, fn) {
  const t0 = Date.now();
  let status = 'pass', detail = '';
  try {
    detail = (fn() || '').toString().trim().split('\n').slice(-1)[0].substring(0, 100);
  } catch (e) {
    status = 'fail';
    detail = String(e.stdout || e.message || e).trim().split('\n').slice(-1)[0].substring(0, 100);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  results.push({ id, name, kind, status, detail, secs });
  console.log(`${String(id).padStart(2)}. ${status === 'pass' ? 'PASS' : 'FAIL'}  ${name.padEnd(18)} ${secs}s  ${detail}`);
}

const run = (script, args = []) => execFileSync('node', [path.join(__dirname, script), ...args], { cwd: REPO, encoding: 'utf-8', timeout: 900000 });

console.log('MOSAIC EVAL STACK\n');

step(5, 'tool unit tests', 'offline', () => execFileSync('npm', ['test'], { cwd: REPO, encoding: 'utf-8', shell: true, timeout: 300000 }));
step(1, 'golden set', 'offline', () => run('run-evals.js'));
step(10, 'red team', 'offline', () => run('redteam.js'));

// Judge, human-review queue, and shadow need a generated artifact and API keys
const dealsDir = path.join(REPO, 'deals');
const withMemo = fs.existsSync(dealsDir)
  ? fs.readdirSync(dealsDir).map(d => path.join(dealsDir, d, 'outputs')).find(o => fs.existsSync(path.join(o, 'memo.md')))
  : null;

if (withMemo) {
  step(2, 'llm as judge', 'offline', () => run('judge.js', [withMemo]));
} else {
  results.push({ id: 2, name: 'llm as judge', kind: 'offline', status: 'skip', detail: 'no memo artifact; run mosaic memo first', secs: '0' });
  console.log(' 2. SKIP  llm as judge      0s  no memo artifact to grade');
}

step(9, 'shadow run', 'offline', () => run('shadow.js'));

// Methods 3, 4, 6 are assertions inside the runs above, reported for honesty
for (const [id, name, where] of [[3, 'rubric scoring', 'inside judge + golden set'], [4, 'trajectory', 'inside golden set'], [6, 'regression', 'inside golden set (history diff)']]) {
  results.push({ id, name, kind: 'offline', status: 'covered', detail: where, secs: '0' });
  console.log(`${String(id).padStart(2)}. COVERED ${name.padEnd(17)} ${where}`);
}
for (const [id, name, why] of [[7, 'a/b in prod', 'needs live traffic; harness ready in shadow.js'], [8, 'human review', 'queue written by judge.js; awaits a human']]) {
  results.push({ id, name, kind: 'online', status: 'staged', detail: why, secs: '0' });
  console.log(`${String(id).padStart(2)}. STAGED  ${name.padEnd(17)} ${why}`);
}

const pass = results.filter(r => r.status === 'pass').length;
const fail = results.filter(r => r.status === 'fail').length;
console.log(`\n${pass} passed, ${fail} failed, ${results.filter(r => r.status === 'staged').length} staged (need live traffic)`);

const outDir = path.join(__dirname, 'results');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'eval-stack-latest.json'), JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
console.log('Report: eval/results/eval-stack-latest.json');
process.exit(fail > 0 ? 1 : 0);
