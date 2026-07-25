# Mosaic Underwriting CLI

A local-first command-line tool for real estate deal underwriting. Built for growth-phase acquisitions with a focus on industrial flex, neighborhood retail, and small multifamily assets.

## Features

- **Two-Speed Underwriting**: Quick screening (Kill/Chase/Structure/Delegate) and full deep-dive analysis
- **Confidence Tracking**: Every number includes source, formula, and confidence score
- **Adaptive Stress Testing**: Lower data quality = wider stress assumptions
- **Complete Audit Trail**: Never invents numbers, always traces to source
- **Multiple Input Formats**: CSV rent rolls, T12 statements, broker emails, OM text
- **Investment Committee Ready**: Generates markdown reports and IC memos

## Installation

```bash
# Clone or copy the repository
cd mosaic-underwriting

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Quick Start

```bash
# Create a new deal
npm run mosaic -- new --name "123 Commerce Way" --type industrial

# Ingest source files
npm run mosaic -- ingest --deal <deal_id> --file examples/sample-rentroll.csv --kind rentroll_csv
npm run mosaic -- ingest --deal <deal_id> --file examples/sample-t12.csv --kind t12_csv
npm run mosaic -- ingest --deal <deal_id> --file examples/sample-broker-email.txt --kind email

# Run quick screening
npm run mosaic -- screen --deal <deal_id>

# Run full deep dive
npm run mosaic -- deepdive --deal <deal_id>
```

## Commands

### `mosaic new`

Create a new deal folder.

```bash
npm run mosaic -- new --name "<deal name>" --type <industrial|retail|multifamily|other> [--location "<address>"]
```

**Options:**
- `-n, --name <name>` (required): Deal name
- `-t, --type <type>` (required): Asset type
- `-l, --location <location>`: Property address

**Example:**
```bash
npm run mosaic -- new --name "123 Commerce Way" --type industrial --location "Phoenix, AZ"
```

### `mosaic list`

List all deals.

```bash
npm run mosaic -- list
```

### `mosaic ingest`

Import and parse a source file.

```bash
npm run mosaic -- ingest --deal <deal_id> --file <path> --kind <email|om_text|rentroll_csv|t12_csv>
```

**Options:**
- `-d, --deal <dealId>` (required): Deal ID
- `-f, --file <path>` (required): Path to source file
- `-k, --kind <kind>` (required): File type

**Supported file kinds:**
- `rentroll_csv`: Rent roll spreadsheet (CSV)
- `t12_csv`: Trailing 12-month operating statement (CSV)
- `email`: Broker email (plain text)
- `om_text`: Offering memorandum text

### `mosaic screen`

Run Phase 1 screening analysis.

```bash
npm run mosaic -- screen --deal <deal_id>
```

**Outputs:**
- `outputs/screen.md` - Human-readable screening report
- `outputs/screen.json` - Structured screening data

**Verdicts:**
- **KILL**: Deal has fatal flaws, document why
- **CHASE**: Pursue aggressively, meets criteria
- **STRUCTURE**: Interesting but needs creative structuring
- **DELEGATE**: Insufficient data to decide

### `mosaic deepdive`

Run Phase 2 full analysis.

```bash
npm run mosaic -- deepdive --deal <deal_id>
```

**Outputs:**
- `outputs/ic_memo.md` - Investment committee memo
- `outputs/deepdive.json` - Full analysis data
- `outputs/model.csv` - Cash flow model
- `outputs/sensitivity.csv` - Sensitivity analysis grid

### `mosaic info`

Show deal details and status.

```bash
npm run mosaic -- info --deal <deal_id>
```

## Complete Walkthrough

### 1. Create a Deal

```bash
$ npm run mosaic -- new --name "123 Commerce Way" --type industrial --location "Phoenix, AZ"

✓ Created deal: 123-commerce-way-lx8k2m
  Name: 123 Commerce Way
  Type: industrial
  Location: Phoenix, AZ
  Folder: deals/123-commerce-way-lx8k2m/

Next steps:
  mosaic ingest --deal 123-commerce-way-lx8k2m --file <path> --kind <email|om_text|rentroll_csv|t12_csv>
```

### 2. Ingest the Rent Roll

```bash
$ npm run mosaic -- ingest --deal 123-commerce-way-lx8k2m --file examples/sample-rentroll.csv --kind rentroll_csv

✓ Added source: src-1-lx8k3n
  Kind: rentroll_csv
  File: sample-rentroll.csv
  Parsing rent roll...
  ✓ Extracted 10 units
  ✓ Occupancy: 80.0% (confidence: 0.90)
  ✓ Gross Rent: $408,000/yr
  No T12 found - estimating NOI from rent roll...
  ✓ Estimated NOI: $285,600/yr (proxy, confidence: 0.60)

✓ Deal updated: deals/123-commerce-way-lx8k2m/deal.json
```

### 3. Ingest the T12 (Improves Confidence)

```bash
$ npm run mosaic -- ingest --deal 123-commerce-way-lx8k2m --file examples/sample-t12.csv --kind t12_csv

✓ Added source: src-2-lx8k4p
  Kind: t12_csv
  File: sample-t12.csv
  Parsing T12 operating statement...
  ✓ Revenue items: 4
  ✓ Expense items: 8
  ✓ NOI: $304,600/yr (confidence: 0.85)

✓ Deal updated: deals/123-commerce-way-lx8k2m/deal.json
```

### 4. Ingest Broker Email (Gets Price)

```bash
$ npm run mosaic -- ingest --deal 123-commerce-way-lx8k2m --file examples/sample-broker-email.txt --kind email

✓ Added source: src-3-lx8k5q
  Kind: email
  File: sample-broker-email.txt
  Parsing broker email...
  ✓ Extracted 4 data points
    - askingPrice: 4250000 (confidence: 0.85)
    - noi: 304600 (confidence: 0.80)
    - capRate: 0.0717 (confidence: 0.75)
    - occupancy: 0.84 (confidence: 0.70)

✓ Deal updated: deals/123-commerce-way-lx8k2m/deal.json
```

### 5. Run Screening

```bash
$ npm run mosaic -- screen --deal 123-commerce-way-lx8k2m

Screening: 123 Commerce Way
────────────────────────────────────────────────────────────

VERDICT: CHASE
Risk Score: 2/5

Key Metrics:
  NOI: $304,600 (conf: 0.85)
  Entry Cap: 7.17%
  Stressed DSCR: 1.32x
  Exit Value: $3,856,962

Outputs:
  deals/123-commerce-way-lx8k2m/outputs/screen.md
  deals/123-commerce-way-lx8k2m/outputs/screen.json
```

### 6. Run Deep Dive

```bash
$ npm run mosaic -- deepdive --deal 123-commerce-way-lx8k2m

Deep Dive: 123 Commerce Way
────────────────────────────────────────────────────────────

Investment Thesis:
  Industrial flex in Phoenix at 7.17% entry cap with path to value through
  lease-up of vacant suites. Stressed returns support 1.8x equity multiple
  with clear exit options.

Projected Returns:
  Equity Multiple: 1.82x
  Cash-on-Cash: 8.2%
  IRR (approx): 14.6%

Strategy Options:
  1. Operate & Refi
  2. Operate & Sell
  3. Light Reposition

Outputs:
  deals/123-commerce-way-lx8k2m/outputs/ic_memo.md
  deals/123-commerce-way-lx8k2m/outputs/deepdive.json
  deals/123-commerce-way-lx8k2m/outputs/model.csv
  deals/123-commerce-way-lx8k2m/outputs/sensitivity.csv
```

## Deal Folder Structure

```
deals/
└── 123-commerce-way-lx8k2m/
    ├── deal.json           # Master deal file with all data
    ├── inputs/             # Copied source files
    │   ├── sample-rentroll.csv
    │   ├── sample-t12.csv
    │   └── sample-broker-email.txt
    └── outputs/            # Generated reports
        ├── screen.md
        ├── screen.json
        ├── ic_memo.md
        ├── deepdive.json
        ├── model.csv
        └── sensitivity.csv
```

## Underwriting Doctrine

### Kill Criteria (Hard Stops)

1. **DSCR < 1.15x** at realistic debt assumptions
2. **Single-point failure** - one tenant/revenue source > 50%
3. **Unclear/unverifiable income** - confidence < 0.5 on NOI
4. **Capex risk cannot be priced** - unknown major repairs needed
5. **Exit requires cap compression** - must sell at tighter cap to make returns

### Default Stress Assumptions

| Stress | Base | Low Confidence |
|--------|------|----------------|
| Exit Cap | Entry + 75bps | Entry + 100bps |
| Interest Rate | Market + 175bps | Market + 225bps |
| NOI Haircut | -10% | -15% |
| Vacancy Shock | +5% | +5% |

### Risk Score Scale

| Score | Description | Action |
|-------|-------------|--------|
| 1 | Asymmetric upside / Protected downside | Aggressive pursuit |
| 2 | Acceptable risk / Clear mitigants | Standard pursuit |
| 3 | Execution-dependent | Careful underwriting |
| 4 | Speculative / Requires edge | Only with partner/edge |
| 5 | Binary / Avoid | Pass unless restructured |

### Adaptive Underwriting

When data confidence is low (< 0.6):
- NOI haircut increases by 5%
- Exit cap widens by 25bps
- Interest rate stress increases by 50bps
- Risk score automatically increases by 1 notch

## Source Priority

When inputs conflict, the system resolves using this priority:

1. **T12 CSV** (actual financials)
2. **Rent Roll CSV** (tenant data)
3. **OM Text** (marketing materials)
4. **Email** (broker communications)
5. **Manual** (user input)
6. **Computed** (calculated values)

## Confidence Scoring

Every metric includes a confidence score (0-1):

- **0.9+**: Direct from audited financials
- **0.8-0.9**: From primary documents (T12, rent roll)
- **0.6-0.8**: From marketing materials or emails
- **0.4-0.6**: Estimated/proxy values
- **< 0.4**: Low confidence, triggers adaptive stress

## Development

```bash
# Build
npm run build

# Run in development (uses ts-node)
npm run dev -- <command>

# Clean build
npm run rebuild
```

## Project Structure

```
src/
├── cli/           # Command-line interface
│   └── index.ts   # CLI entry point
├── core/          # Core schemas and logic
│   ├── schemas.ts # Zod schemas for all data types
│   ├── doctrine.ts # Investment doctrine encoding
│   ├── confidence.ts # Confidence assessment
│   └── audit.ts   # Audit trail management
├── ingest/        # Data ingestion
│   ├── parsers.ts # CSV/XLSX parsing
│   ├── rentroll-normalizer.ts
│   ├── t12-normalizer.ts
│   └── text-parser.ts
├── underwrite/    # Underwriting engines
│   ├── screen.ts  # Phase 1 screening
│   └── deepdive.ts # Phase 2 deep dive
├── report/        # Report generation
│   ├── screen-report.ts
│   └── ic-memo.ts
└── storage/       # File system operations
    └── deal-storage.ts
```

## License

MIT

## Contributing

This is an internal tool for Mosaic. Contact the team for contribution guidelines.
