# Eval Harness

Nine-method stack (design decision 2026-07-25) and implementation status:

| # | Method | Status | Where |
|---|---|---|---|
| 1 | Golden set | LIVE | `run-evals.js`: industrial-samples + sandcastle-hotel, fixed cases, run on every change |
| 2 | Tool unit tests | LIVE | `npm test`, `src/tests/tools.test.ts`, fixtures only, no model in the loop |
| 3 | Regression suite | LIVE | every run diffs against the previous entry in `results/history.jsonl`; dashboard flags REGRESSION |
| 4 | Rubric scoring | LIVE | one number per dimension: correctness, completeness, consistency, cost. Weighted to a case score |
| 5 | Trajectory eval | LIVE (basic) | audit-log assertions: sources ingested before screening, no untracked numbers |
| 6 | LLM as judge | PENDING | needs an API key. Scores narrative sections against the rubric once generation exists |
| 7 | Human review | PENDING | sample of packages graded by Russ; calibrates the judge when it arrives |
| 8 | Shadow run | PENDING | requires live traffic (Michael's deal flow) |
| 9 | A/B in prod | PENDING | requires live traffic and a second variant |

## Commands

```bash
npm test        # tool unit tests
npm run eval    # golden set + rubric + regression, writes results/ and dashboard/
```

Dashboard: open `eval/dashboard/report.html` (self-contained) or `index.html` (reads `results.js`).

## Golden set rules

- Cases are never edited to make a run pass.
- A golden expectation changes only when the methodology intentionally changes,
  with the reason documented in the runner next to the check (see the
  2026-07-25 note: hardcoded 7.5% replaced by market SOFR+400, which correctly
  flipped the toy industrial case from CHASE to KILL).
- The Sandcastle golden workbook (`golden/sandcastle-myrtle-beach.xlsx`) is the
  output-shape contract; the runner asserts the generator matches its layout.
