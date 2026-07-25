/**
 * Phase 5 batch run: every deal folder in C:\Real Estate through the pipeline.
 * Explicit manifest (no silent selection): each deal lists the files chosen
 * and the files dropped with reasons. Results land in eval/results/ and a
 * markdown report.
 *
 * Usage: node eval/batch-run.js   (after npm run build)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CLI = path.join(REPO, 'dist', 'cli', 'index.js');
const RE = 'C:/Real Estate';

const MANIFEST = [
  {
    name: 'Sandcastle Myrtle Beach', type: 'hotel', location: 'Myrtle Beach, SC',
    files: [
      [`${RE}/Sandcastle Hotel - Myrtle Beach/Myrtle_Beach_Radisson_Bridge_Financing_Memo.md`, 'om_text'],
      [`${RE}/Sandcastle Hotel - Myrtle Beach/Myrtle Beach Radisson_Hotel_Underwriting_Model.xlsx`, 'xlsx_model'],
      [`${RE}/SandCastle Hotel/Appraisal 22-NY-454_Sandcastle South Beach - Final.pdf`, 'pdf'],
    ],
    dropped: ['DOCX memos (no docx extractor yet)', 'PIP budget PDF (scanned image risk)'],
  },
  {
    name: 'Radisson Meinhard Station', type: 'hotel', location: 'Port Wentworth, GA',
    files: [
      [`${RE}/Radisson - Meinhard Station (Savannah)/Radisson 140-Key Underwriting Model.xlsx`, 'xlsx_model'],
      [`${RE}/Radisson - Meinhard Station (Savannah)/Copy of RADISSON HOTEL FEASIBILITY STUDY - SPURRIER CONSULTING - December 2024.pdf`, 'pdf'],
    ],
    dropped: ['Executive summary DOCX (no docx extractor)', 'site plans (drawings, no text value)'],
    missingOk: true,
  },
  {
    name: 'Indigo Hotel', type: 'hotel', location: 'unknown',
    files: [[`${RE}/Indigo Hotel/November 2025 External.xlsx`, 'xlsx_model']],
    dropped: [],
  },
  {
    name: 'VA Clinic Paducah', type: 'other', location: 'Paducah, KY',
    files: [[`${RE}/Case Studies 2026/Va Clinic Paducah KY/OM - KY-Paducah - 2620 Perkins Creek Dr.pdf`, 'pdf']],
    dropped: [],
  },
  {
    name: '175 Rich-Lex Dr', type: 'other', location: 'Lexington, SC',
    files: [[`${RE}/Case Studies 2026/175 Rich-Lex Dr/175 Rich Lex Dr Teaser OM.pdf`, 'pdf']],
    dropped: [],
  },
  {
    name: '4516 E County Rd 130 Midland', type: 'industrial', location: 'Midland, TX',
    files: [[`${RE}/Case Studies 2026/4516 E County Rd 130 Midland TX 79706/4516 E County Rd 130 Midland TX 79706 Brochure updated.pdf`, 'pdf']],
    dropped: [],
  },
  {
    name: '5890 I-10 Industrial Pkwy Theodore', type: 'industrial', location: 'Theodore, AL',
    files: [[`${RE}/Case Studies 2026/5890 I 10 Industrial Pkwy S, Theodore, AL 36582 _ Crexi.com/5890 I 10 Industrial Pkwy S, Theodore, AL 36582 _ Crexi.com.pdf`, 'pdf']],
    dropped: [],
  },
  {
    name: '1100 N Chester', type: 'retail', location: 'unknown',
    files: [[`${RE}/Case Studies 2026/1100 N Chester/1100-N-Chester-Fully-Leased-Brochure.pdf`, 'pdf']],
    dropped: [],
  },
  {
    name: 'DC Maryland Vacant Portfolio', type: 'other', location: 'DC / MD',
    files: [[`${RE}/DC & Maryland Properties/Vacant Property List (as of 3_11_2025).xlsx`, 'xlsx_model']],
    dropped: [],
  },
  {
    name: 'Telfair South Ocean Front', type: 'hotel', location: 'Myrtle Beach, SC',
    files: [[`${RE}/Telfair & Other Development Projects/22-360512.12_Phase_I_Report_-_South_Ocean_Front_Resort,_Myrtle_Beach,_SC_061622.pdf`, 'pdf']],
    dropped: ['Perplexity prompt DOCX (not a deal document)'],
  },
];

function run(args) {
  return execFileSync('node', [CLI, ...args], { cwd: REPO, encoding: 'utf-8', timeout: 300000 });
}

function main() {
  const results = [];
  for (const deal of MANIFEST) {
    const r = { name: deal.name, type: deal.type, ingested: 0, dropped: deal.dropped, errors: [] };
    console.log(`\n=== ${deal.name} (${deal.type}) ===`);
    try {
      const out = run(['new', '--name', deal.name, '--type', deal.type, '--location', deal.location]);
      r.dealId = (out.match(/Created deal: (\S+)/) || [])[1];
      for (const [file, kind] of deal.files) {
        if (!fs.existsSync(file)) {
          r.errors.push(`missing file: ${path.basename(file)}`);
          continue;
        }
        try {
          run(['ingest', '--deal', r.dealId, '--file', file, '--kind', kind]);
          r.ingested++;
          console.log(`  ingested [${kind}] ${path.basename(file)}`);
        } catch (e) {
          r.errors.push(`ingest failed ${path.basename(file)}: ${(e.message || '').substring(0, 100)}`);
        }
      }
      try {
        run(['screen', '--deal', r.dealId]);
        const screen = JSON.parse(fs.readFileSync(path.join(REPO, 'deals', r.dealId, 'outputs', 'screen.json'), 'utf-8'));
        r.verdict = screen.verdict;
        r.riskScore = screen.riskScore;
        r.confidence = screen.confidenceSummary?.overall;
        r.dscr = screen.keyMetrics?.stressedDscr?.value?.value ?? null;
        r.noi = screen.keyMetrics?.noi?.value?.value ?? null;
      } catch (e) {
        r.errors.push(`screen failed: ${(e.message || '').substring(0, 100)}`);
      }
      try {
        run(['workbook', '--deal', r.dealId]);
        r.workbook = fs.existsSync(path.join(REPO, 'deals', r.dealId, 'outputs', 'package.xlsx'));
      } catch (e) {
        r.workbook = false;
        r.errors.push(`workbook failed: ${(e.message || '').substring(0, 100)}`);
      }
      const dj = JSON.parse(fs.readFileSync(path.join(REPO, 'deals', r.dealId, 'deal.json'), 'utf-8'));
      r.fieldsExtracted = (dj.extracted.notes || []).length;
      r.price = dj.askingPrice?.value ?? null;
      r.noi = r.noi ?? dj.extracted.t12?.noi?.value ?? null;
    } catch (e) {
      r.errors.push(`deal failed: ${(e.message || '').substring(0, 120)}`);
    }
    results.push(r);
    console.log(`  verdict=${r.verdict ?? 'n/a'} dscr=${r.dscr?.toFixed?.(2) ?? 'n/a'} fields=${r.fieldsExtracted ?? 0} workbook=${r.workbook ? 'yes' : 'no'} errors=${r.errors.length}`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    screened: results.filter(r => r.verdict).length,
    workbooks: results.filter(r => r.workbook).length,
    results,
  };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'batch-latest.json'), JSON.stringify(report, null, 2));

  const md = [
    '# Batch Run Report',
    `Run: ${report.timestamp}  |  Deals: ${report.total}  |  Screened: ${report.screened}  |  Workbooks: ${report.workbooks}`,
    '',
    '| Deal | Type | Files | Fields | Price | NOI | DSCR | Verdict | Conf | Workbook | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...results.map(r => `| ${r.name} | ${r.type} | ${r.ingested} | ${r.fieldsExtracted ?? 0} | ${r.price ? (r.price / 1e6).toFixed(1) + 'MM' : '-'} | ${r.noi ? (r.noi / 1e6).toFixed(2) + 'MM' : '-'} | ${r.dscr ? r.dscr.toFixed(2) + 'x' : '-'} | ${r.verdict ?? '-'} | ${r.confidence ? (r.confidence * 100).toFixed(0) + '%' : '-'} | ${r.workbook ? 'yes' : 'no'} | ${r.errors.join('; ') || '-'} |`),
    '',
    '## Dropped files (no silent caps)',
    ...results.flatMap(r => r.dropped.length ? [`- ${r.name}: ${r.dropped.join('; ')}`] : []),
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, 'results', 'batch-report.md'), md);
  console.log('\nReport: eval/results/batch-report.md');
}

main();
