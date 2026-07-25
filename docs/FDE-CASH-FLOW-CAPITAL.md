# Phase 7 Prep: Forward-Deployed Engineer Motion at Cash Flow Capital

Cash Flow Capital LLC (cashflowcapitalllc.com), New York. Capital markets firm
financing CRE nationwide through institutional, HNW, and direct syndicated
discretionary funds. Their site advertises AI-enabled pricing infrastructure
and publishes zero intake requirements, which means their standards are only
learnable through the relationship. That is the moat.

The meetings are Russ's. This document is the discovery instrument.

## Discovery question set

### Intake
1. What does a submission look like today (email package, portal, data room)?
2. What is the minimum document set before an analyst opens the file?
3. What share of submissions arrive incomplete, and what happens then?
4. Which formats slow you down the most (scanned PDFs, sponsor spreadsheets, photos of rent rolls)?

### Underwriting standards
5. Sizing constraints by product: max LTC, max LTV, min DSCR, min debt yield, and which one binds most often.
6. Index and spread conventions today: which index, what spread ranges by asset class and risk tier.
7. Stress conventions: what rate shock, NOI haircut, exit cap spread do you apply.
8. Hospitality specifics: how do you underwrite ramp (occupancy/ADR trajectory), PIP risk, franchise support.
9. What kills a deal in the first five minutes.

### Data and ETL
10. What system holds deal data (LOS, spreadsheets, CRM), and what gets re-keyed by hand.
11. Which fields does the credit committee actually look at, in what format.
12. What third-party pulls do you run (appraisal, STR, credit, background) and when.
13. Where do errors get caught today, and what class of error slips through.

### Output shape
14. Show me the last package that closed fast: what made it easy.
15. Show me one that dragged: what was missing or wrong.
16. If a broker package arrived pre-formatted to your model, what tabs and fields would it need for an analyst to skip re-keying entirely.

### Commercial
17. Volume: submissions per month, hit rate to term sheet, to close.
18. Who owns process improvement internally (the FDE counterpart).
19. Would faster-to-decision packages change which brokers you prioritize.

## What we deliver back

Their answers become `config/lender-templates/cash-flow-capital.json`:
sizing constraints, stress conventions, required fields, tab layout. The
workbook generator reads it and every package arrives pre-shaped to their
consumption. Same play repeats per lender; the template library is the product.
