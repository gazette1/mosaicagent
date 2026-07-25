# Tokenomics

## Current cost profile

The pipeline as built spends **zero tokens**. Extraction is regex plus sanity
ranges, math is code, the workbook is formulas. Every batch-run package cost
$0.00 in model spend. That is the baseline to protect.

## Where models enter (and only there)

| Step | Model tier | Why |
|---|---|---|
| Document extraction (messy PDFs, DOCX, scanned OMs) | Small (Haiku-class) | Regex hit rate on brochures is low (see batch report: 0-8 fields on thin PDFs). Structured-output extraction against the deal schema is a small-model job |
| Narrative draft sections (deal story, variance explanations) | Frontier only if judgment required | 60-70% of a package is mechanical (PBS audit finding); the mechanical part stays code |
| LLM-as-judge scoring | Small-to-mid | Scores against the written rubric; calibrated by human review |

Everything else stays deterministic: parsing, normalization, debt math, DSCR,
sensitivity, workbook generation, QC checks, scorecard population.

## The eight levers mapped to this architecture

1. **Prompt caching.** System prompt + deal schema + extraction instructions are
   identical across every extraction call. Cache them; pay incremental tokens
   only for the document text.
2. **Model routing.** Extraction and formatting to a small model; the frontier
   model is reserved for narrative judgment sections, if ever. Never route math.
3. **Skip the model entirely.** Already the default. Sanity ranges, multiplier
   parsing, formula workbooks: all code. Keep the burden of proof on ADDING a
   model call, not removing one.
4. **Early exit.** Extraction loop stops when required schema fields are filled
   with confidence above threshold; do not re-extract what deterministic
   patterns already got. Screen before deepdive: KILL verdicts skip everything
   downstream.
5. **Retry budget.** Two extraction attempts per document, then flag for human.
   The audit log records attempts.
6. **Tool result cache.** Grab-once principle: a parsed PDF's text is stored in
   the source record (rawContent) at ingest; downstream steps reread the parse,
   never the PDF. Third-party enrichment results get cached in the deal store
   keyed by query.
7. **Batch what is patient.** Eval runs, backfills over the fixture library,
   and portfolio-wide re-screens run as overnight batch (the batch runner
   already works this way). Use the Batch API when LLM extraction lands: 50%
   discount, nobody is waiting.
8. **Cap the output.** Every model call returns JSON against a schema
   (extraction fields, judge scores). No prose except the narrative sections a
   human reads, and those have length budgets.

## Cost model at scale (when LLM extraction lands)

Assumptions: Haiku-class extraction, ~50K input tokens per document set
(memo + OM + model dump), ~2K output (JSON), 3 documents per deal.

- Extraction per deal: ~150K in / 6K out, small model, cached instructions.
  Order of $0.05-0.15 per deal at current small-model pricing.
- Narrative draft (if frontier): ~20K in / 3K out. Order of $0.30-0.60.
- Judge pass: small model, ~10K in / 1K out. Under $0.05.
- **Per-package model cost target: under $1.** The deliverable prices in the
  hundreds-to-thousands range as a service. Token cost is noise if and only if
  the deterministic-first discipline holds.

Verify against live pricing before quoting anyone (models and prices move).
