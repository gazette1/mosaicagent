/**
 * Golden Workbook Builder: Sandcastle / Myrtle Beach Radisson
 * One-off manual build. This artifact is the output spec for the workbook
 * generator (Phase 3) and golden-set case #1 for evals (Phase 4).
 *
 * Source of record: Myrtle_Beach_Radisson_Bridge_Financing_Memo.md (Dec 8, 2025)
 * All computed cells are live formulas. Inputs cite their source.
 */
const ExcelJS = require('exceljs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'eval', 'golden', 'sandcastle-myrtle-beach.xlsx');

const HDR = { bold: true };
const MONEY = '#,##0';
const PCT = '0.0%';
const X = '0.00"x"';

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mosaic Capital Solutions';
  wb.created = new Date();

  // ==========================================================================
  // Sheet 1: Summary
  // ==========================================================================
  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 38 }, { width: 18 }, { width: 50 }];
  const sumRows = [
    ['SANDCASTLE / MYRTLE BEACH RADISSON — BRIDGE LOAN PACKAGE', '', ''],
    ['Prepared under Mosaic Capital Solutions', '', ''],
    ['', '', ''],
    ['Property', '150-key oceanfront hotel, Myrtle Beach SC', 'Bridge memo p.1'],
    ['Flag (post-conversion)', 'Radisson (Choice Hotels)', 'Bridge memo'],
    ['Sponsor', 'Laray Benton', 'Bridge memo'],
    ['Purchase Price', 16500000, 'PSA per bridge memo'],
    ['2022 Appraised Value', 23000000, 'Appraisal 22-NY-454'],
    ['Discount to Appraisal', { formula: '1-B7/B8' }, '= 1 - price / appraisal'],
    ['Total Project Cost', 25000000, 'Sources & Uses sheet'],
    ['Loan Request (Senior Bridge)', 18400000, 'Bridge memo'],
    ['LTC', { formula: 'B11/B10' }, '= loan / total cost'],
    ['LTV on 2022 Appraisal', { formula: 'B11/B8' }, '= loan / appraisal'],
    ['Price per Key', { formula: 'B7/150' }, '= price / keys'],
    ['Stabilized DSCR (Y3)', { formula: "'Debt & Covenants'!B14" }, 'Debt sheet'],
    ['Stabilized Debt Yield (Y3)', { formula: "'Debt & Covenants'!B15" }, 'Debt sheet'],
  ];
  sumRows.forEach(r => sum.addRow(r));
  sum.getRow(1).font = { bold: true, size: 14 };
  [7, 8, 10, 11, 14].forEach(n => (sum.getCell(`B${n}`).numFmt = MONEY));
  [9, 12, 13].forEach(n => (sum.getCell(`B${n}`).numFmt = PCT));
  sum.getCell('B15').numFmt = X;
  sum.getCell('B16').numFmt = PCT;

  // ==========================================================================
  // Sheet 2: Sources & Uses
  // ==========================================================================
  const su = wb.addWorksheet('Sources & Uses');
  su.columns = [{ width: 34 }, { width: 16 }, { width: 12 }, { width: 44 }];
  su.addRow(['SOURCES', 'Amount', '% Total', 'Notes']).font = HDR;
  su.addRow(['Senior Bridge Loan', 18400000, { formula: 'B2/$B$7' }, 'Single unitranche, first lien']);
  su.addRow(['Sponsor Equity (invested)', 6500000, { formula: 'B3/$B$7' }, 'Predevelopment, deposit, soft costs, closing gap']);
  su.addRow(['Seller Carry Note', 2000000, { formula: 'B4/$B$7' }, '5-yr, 6%, fully subordinated']);
  su.addRow(['Additional Equity Raise', 1600000, { formula: 'B5/$B$7' }, 'LP or capital call at close']);
  su.addRow(['Key Money (Choice, at PIP completion)', 2500000, { formula: 'B6/$B$7' }, 'Earned Month 20-21, treated as equity; NOT cash at close']);
  su.addRow(['Total Sources (at-close basis excl. key money)', { formula: 'SUM(B2:B5)' }, '', 'Memo presents 25MM incl. key money; at-close cash = 28.5-2.5+contra']);
  su.addRow([]);
  su.addRow(['USES', 'Amount', '% Total', 'Notes']).font = HDR;
  su.addRow(['Property Acquisition', 16500000, { formula: 'B10/$B$15' }, 'Purchase price']);
  su.addRow(['Renovation / PIP', 8500000, { formula: 'B11/$B$15' }, 'Phased draws, months 1-20']);
  su.addRow(['Closing Costs', 750000, { formula: 'B12/$B$15' }, 'Legal, DD, title, lender fees']);
  su.addRow(['Reserves', 1250000, { formula: 'B13/$B$15' }, 'DS reserve 700K, op deficit 500K, replacement 50K']);
  su.addRow(['Working Capital', 500000, { formula: 'B14/$B$15' }, 'Pre-opening, marketing, staffing']);
  su.addRow(['Total Uses', { formula: 'SUM(B10:B14)' }, '', '']);
  su.addRow([]);
  su.addRow(['Check: Uses 25.0MM vs Sources incl. key money 31.0MM per memo tables; memo double counts. At-close sources 28.5MM excl. key money = uses 27.5? See Audit sheet variance log.', '', '', '']);
  for (const n of [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15]) su.getCell(`B${n}`).numFmt = MONEY;
  for (const n of [2, 3, 4, 5, 6, 10, 11, 12, 13, 14]) su.getCell(`C${n}`).numFmt = PCT;

  // ==========================================================================
  // Sheet 3: Operating Pro Forma (hotel: keys x occ x ADR)
  // ==========================================================================
  const pf = wb.addWorksheet('Operating Pro Forma');
  pf.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 44 }];
  pf.addRow(['', 'Y1 Renovation', 'Y2 Stabilizing', 'Y3 Stabilized', 'Source / Formula']).font = HDR;
  pf.addRow(['Keys', 150, 150, 150, 'Bridge memo']);
  pf.addRow(['Occupancy', 0.30, 0.62, 0.70, 'Memo pro forma assumptions']);
  pf.addRow(['ADR', 110, 150, 160, 'Memo pro forma assumptions']);
  pf.addRow(['RevPAR', { formula: 'B3*B4' }, { formula: 'C3*C4' }, { formula: 'D3*D4' }, '= occupancy x ADR']);
  pf.addRow(['Rooms Revenue', { formula: 'B2*365*B3*B4' }, { formula: 'C2*365*C3*C4' }, { formula: 'D2*365*D3*D4' }, '= keys x 365 x occ x ADR']);
  pf.addRow(['F&B / Ancillary', 12750, 800000, 975000, 'Memo (Y1 est to reconcile total rev)']);
  pf.addRow(['Total Revenue', { formula: 'B6+B7' }, { formula: 'C6+C7' }, { formula: 'D6+D7' }, '= rooms + ancillary']);
  pf.addRow(['Operating Expenses', 1400000, 3685000, 4264000, 'Memo; Y2 ~62%, Y3 ~60% of revenue']);
  pf.addRow(['Expense Ratio', { formula: 'B9/B8' }, { formula: 'C9/C8' }, { formula: 'D9/D8' }, '= expenses / revenue']);
  pf.addRow(['NOI', { formula: 'B8-B9' }, { formula: 'C8-C9' }, { formula: 'D8-D9' }, '= revenue - expenses']);
  pf.addRow([]);
  pf.addRow(['Memo variance note: memo states Y2 rooms revenue 5,115,750 and Y3 6,132,000; formula math gives the values above. Formulas govern.', '', '', '', '']);
  for (const col of ['B', 'C', 'D']) {
    pf.getCell(`${col}3`).numFmt = PCT;
    pf.getCell(`${col}5`).numFmt = MONEY;
    pf.getCell(`${col}6`).numFmt = MONEY;
    pf.getCell(`${col}7`).numFmt = MONEY;
    pf.getCell(`${col}8`).numFmt = MONEY;
    pf.getCell(`${col}9`).numFmt = MONEY;
    pf.getCell(`${col}10`).numFmt = PCT;
    pf.getCell(`${col}11`).numFmt = MONEY;
  }

  // ==========================================================================
  // Sheet 4: Debt & Covenants
  // ==========================================================================
  const dt = wb.addWorksheet('Debt & Covenants');
  dt.columns = [{ width: 34 }, { width: 16 }, { width: 50 }];
  dt.addRow(['Facility', '', '']).font = HDR;
  dt.addRow(['Loan Amount', 18400000, 'Single unitranche, first lien']);
  dt.addRow(['Index (SOFR)', 0.0530, 'Memo, current SOFR ~5.30% (Dec 2025). REFRESH AT SUBMISSION']);
  dt.addRow(['Spread (bps)', 400, 'Target SOFR + 350-400; conservative end used']);
  dt.addRow(['All-in Rate', { formula: 'B3+B4/10000' }, '= index + spread']);
  dt.addRow(['Amortization', 'Interest-only months 1-26', 'Memo']);
  dt.addRow(['Annual Debt Service (IO)', { formula: 'B2*B5' }, '= loan x all-in rate']);
  dt.addRow(['Origination Fee (2.0%)', { formula: 'B2*0.02' }, 'Memo range 1.5-2.0%']);
  dt.addRow(['Exit Fee (1.0% if < 24 mo)', { formula: 'B2*0.01' }, 'Waived if held 30+ months']);
  dt.addRow([]);
  dt.addRow(['Coverage', 'Value', 'Test']).font = HDR;
  dt.addRow(['Y1 DSCR', { formula: "'Operating Pro Forma'!B11/B7" }, 'Covered by DS reserve + sponsor carry guaranty']);
  dt.addRow(['Y2 DSCR', { formula: "'Operating Pro Forma'!C11/B7" }, 'Covenant min 1.25x at stabilization (Month 26+)']);
  dt.addRow(['Y3 DSCR', { formula: "'Operating Pro Forma'!D11/B7" }, 'Covenant min 1.25x']);
  dt.addRow(['Y3 Debt Yield', { formula: "'Operating Pro Forma'!D11/B2" }, 'Covenant min 10.0%']);
  dt.addRow(['Occupancy covenant', 0.60, 'Min 60% for 90 consecutive days post-renovation']);
  dt.addRow(['ADR covenant', 140, 'Min $140 average post-renovation']);
  dt.addRow([]);
  dt.addRow(['Reserves', '', '']).font = HDR;
  dt.addRow(['Debt Service Reserve', 700000, '6 months interest, funded at closing']);
  dt.addRow(['Operating Deficit Reserve', 500000, 'Released at DSCR > 1.15x two consecutive quarters']);
  dt.addRow(['Replacement Reserve', { formula: '150*300' }, '$300/key/year']);
  dt.getCell('B2').numFmt = MONEY;
  dt.getCell('B3').numFmt = '0.00%';
  dt.getCell('B5').numFmt = '0.00%';
  ['B7', 'B8', 'B9', 'B20', 'B21', 'B22'].forEach(c => (dt.getCell(c).numFmt = MONEY));
  ['B12', 'B13', 'B14'].forEach(c => (dt.getCell(c).numFmt = X));
  dt.getCell('B15').numFmt = PCT;
  dt.getCell('B16').numFmt = PCT;

  // ==========================================================================
  // Sheet 5: Sensitivity (Y3 DSCR: occupancy x ADR)
  // ==========================================================================
  const sn = wb.addWorksheet('Sensitivity');
  sn.columns = [{ width: 26 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }];
  sn.addRow(['Y3 DSCR: Occupancy x ADR', 'ADR 140', 'ADR 150', 'ADR 160', 'ADR 170', '']).font = HDR;
  const occs = [0.60, 0.65, 0.70, 0.75];
  const adrs = [140, 150, 160, 170];
  occs.forEach((occ, i) => {
    const r = i + 2;
    const row = [`Occ ${(occ * 100).toFixed(0)}%`];
    adrs.forEach((adr, j) => {
      const col = String.fromCharCode(66 + j); // B..E
      // DSCR = (rooms rev + ancillary - opex at 60% ratio) / debt service
      row.push({
        formula: `((150*365*${occ}*${adr}+'Operating Pro Forma'!$D$7)*(1-0.60))/'Debt & Covenants'!$B$7`,
      });
      void col;
    });
    sn.addRow(row);
  });
  for (let r = 2; r <= 5; r++) for (const c of ['B', 'C', 'D', 'E']) sn.getCell(`${c}${r}`).numFmt = X;
  sn.addRow([]);
  sn.addRow(['Assumes Y3 ancillary revenue and a 60% expense ratio; debt service from Debt sheet.']);

  // ==========================================================================
  // Sheet 6: Refinance & Exit
  // ==========================================================================
  const rf = wb.addWorksheet('Refinance & Exit');
  rf.columns = [{ width: 38 }, { width: 16 }, { width: 50 }];
  rf.addRow(['Permanent Debt Sizing (Month 30-36)', '', '']).font = HDR;
  rf.addRow(['Stabilized NOI (Y3)', { formula: "'Operating Pro Forma'!D11" }, 'Pro forma sheet']);
  rf.addRow(['Perm Rate', 0.065, 'Memo assumption']);
  rf.addRow(['Perm Amortization (years)', 30, 'Memo assumption']);
  rf.addRow(['Loan Constant', { formula: '(B3/12*POWER(1+B3/12,B4*12))/(POWER(1+B3/12,B4*12)-1)*12' }, 'Monthly payment constant, annualized']);
  rf.addRow(['Min DSCR Sizing (1.30x)', { formula: 'B2/1.3/B5' }, '= NOI / 1.30 / constant']);
  rf.addRow(['Exit Cap Rate', 0.08, 'Memo assumption']);
  rf.addRow(['Stabilized Value', { formula: 'B2/B7' }, '= NOI / cap']);
  rf.addRow(['65% LTV Sizing', { formula: 'B8*0.65' }, '= value x 65%']);
  rf.addRow(['Conservative Proceeds (lower of)', { formula: 'MIN(B6,B9)' }, 'Lower of DSCR and LTV sizing']);
  rf.addRow(['Senior Bridge Payoff', { formula: "'Debt & Covenants'!B2" }, '']);
  rf.addRow(['Refi Closing Costs', 350000, 'Memo']);
  rf.addRow(['Cash to Equity at Refi', { formula: 'B10-B11-B12' }, '= proceeds - payoff - costs']);
  ['B2', 'B6', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13'].forEach(c => (rf.getCell(c).numFmt = MONEY));
  rf.getCell('B3').numFmt = '0.00%';
  rf.getCell('B5').numFmt = '0.00%';
  rf.getCell('B7').numFmt = '0.00%';

  // ==========================================================================
  // Sheet 7: Audit & Variances
  // ==========================================================================
  const au = wb.addWorksheet('Audit');
  au.columns = [{ width: 30 }, { width: 60 }, { width: 14 }];
  au.addRow(['Item', 'Note', 'Confidence']).font = HDR;
  au.addRow(['Source document', 'Myrtle_Beach_Radisson_Bridge_Financing_Memo.md, Dec 8 2025, authored by Russ', 0.9]);
  au.addRow(['Appraisal', '22-NY-454 Sandcastle South Beach (2022, 23.0MM). Dated; lender will re-appraise', 0.7]);
  au.addRow(['SOFR 5.30%', 'As of memo date Dec 2025. Must refresh at submission', 0.5]);
  au.addRow(['Y2 rooms revenue variance', 'Memo table says 5,115,750; keys x 365 x 62% x 150 = 5,092,875. Formula governs', 1.0]);
  au.addRow(['Y3 rooms revenue variance', 'Memo says 6,132,000; keys x 365 x 70% x 160 = 6,132,000. Matches', 1.0]);
  au.addRow(['Sources table variance', 'Memo sources sum to 31.0MM against 25.0MM uses because key money and seller carry both listed at close; key money lands Month 20-21', 1.0]);
  au.addRow(['Y1 F&B plug', 'Y1 ancillary set to reconcile memo total revenue 1,815,000 with rooms formula', 0.6]);
  au.addRow(['Trailing financials', 'T12 occupancy 52%, ADR 118, RevPAR 61 per memo. No operating statements in data room yet: REQUEST', 0.5]);

  await wb.xlsx.writeFile(OUT);
  console.log('Golden workbook written:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
