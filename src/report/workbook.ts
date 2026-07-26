/**
 * Workbook Generator
 * deal.json -> multi-sheet XLSX with live formulas.
 *
 * Layout contract (evals assert against this):
 *   Inputs   - every tracked value: field / value / unit / source / confidence
 *   Summary  - deal facts + key metrics, formulas referencing Inputs
 *   Pro Forma- hotel: keys x occ x ADR build; other: NOI-based
 *   Debt     - index + spread rate build from market config, DS, DSCR, debt yield
 *   Sensitivity - DSCR grid, rate deltas x NOI deltas, all formulas
 *   Audit    - sources and audit log
 *
 * The workbook is the deliverable; deal.json stays the canonical data store.
 */

import * as path from 'path';
import { Deal, TrackedNumber } from '../core/schemas';
import { ASSET_TYPE_CRITERIA, DEFAULT_STRESSES } from '../core/doctrine';
import { getMarketConfig } from '../core/market-config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

const MONEY = '#,##0';
const PCT = '0.00%';
const X = '0.00"x"';

interface InputRef {
  addr: string; // e.g. Inputs!$B$4
  row: number;
}

export async function buildDealWorkbook(deal: Deal, outDir: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mosaic Capital Solutions';

  // ==========================================================================
  // Inputs sheet: single source of truth inside the workbook
  // ==========================================================================
  const inp = wb.addWorksheet('Inputs');
  inp.columns = [{ width: 26 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 46 }];
  inp.addRow(['Field', 'Value', 'Unit', 'Source', 'Confidence', 'Rationale / Formula']).font = { bold: true };

  const refs: Record<string, InputRef> = {};
  const addInput = (field: string, tv: TrackedNumber | undefined, fallback?: number): InputRef | null => {
    const value = tv?.value ?? fallback;
    if (value === undefined || value === null) return null;
    const row = inp.addRow([
      field,
      value,
      tv?.unit ?? '',
      tv?.sourceId ?? (fallback !== undefined ? 'default' : ''),
      tv?.confidence ?? (fallback !== undefined ? 0.4 : ''),
      tv?.formula ?? tv?.rationale ?? (tv?.isProxy ? `PROXY: ${tv.proxyMethod ?? ''}` : ''),
    ]);
    const ref = { addr: `Inputs!$B$${row.number}`, row: row.number };
    refs[field] = ref;
    return ref;
  };

  const assetDefaults = ASSET_TYPE_CRITERIA[deal.assetType];
  const market = getMarketConfig();
  const hotel = deal.extracted.hotel;
  const noiTv = deal.extracted.t12?.noi;

  addInput('askingPrice', deal.askingPrice);
  addInput('noi', noiTv);
  addInput('keys', hotel?.keys);
  // Occupancy defaults to stabilized (1 - doctrine vacancy) when unextracted,
  // marked source=default so the gap is visible in the Inputs sheet
  addInput('occupancy', hotel?.occupancy, deal.assetType === 'hotel' && hotel?.keys ? 1 - assetDefaults.defaultVacancy : undefined);
  addInput('adr', hotel?.adr);
  addInput('ancillaryRevenue', hotel?.ancillaryRevenue, hotel ? 0 : undefined);
  addInput('expenseRatio', undefined, assetDefaults.defaultExpenseRatio);
  addInput('indexRate', undefined, market.indexRate);
  addInput('spreadBps', undefined, market.bridgeSpreadBps);
  addInput('ltv', deal.assumptions.ltv, DEFAULT_STRESSES.conservativeLtv);
  addInput('exitCapSpread', undefined, DEFAULT_STRESSES.exitCapSpread);
  addInput('noiHaircut', deal.assumptions.noiHaircut, DEFAULT_STRESSES.noiHaircut);
  addInput('exitCapBase', deal.assumptions.exitCap, assetDefaults.defaultCaps.exit);
  addInput('loanAmount', deal.assumptions.capexTotal ? undefined : undefined); // placeholder ordering
  inp.getColumn(5).numFmt = '0.00';

  const isHotel = deal.assetType === 'hotel' && refs['keys'] && refs['occupancy'] && refs['adr'];

  // ==========================================================================
  // Pro Forma
  // ==========================================================================
  const pf = wb.addWorksheet('Pro Forma');
  pf.columns = [{ width: 30 }, { width: 18 }, { width: 46 }];
  pf.addRow(['Line', 'Value', 'Formula']).font = { bold: true };

  let noiAddr: string;
  if (isHotel) {
    pf.addRow(['Keys', { formula: refs['keys'].addr }, 'Inputs']);
    pf.addRow(['Occupancy', { formula: refs['occupancy'].addr }, 'Inputs']);
    pf.addRow(['ADR', { formula: refs['adr'].addr }, 'Inputs']);
    pf.addRow(['RevPAR', { formula: 'B3*B4' }, '= occupancy x ADR']);
    pf.addRow(['Rooms Revenue', { formula: 'B2*365*B3*B4' }, '= keys x 365 x occ x ADR']);
    pf.addRow(['Ancillary Revenue', { formula: refs['ancillaryRevenue'] ? refs['ancillaryRevenue'].addr : '0' }, 'Inputs']);
    pf.addRow(['Total Revenue', { formula: 'B6+B7' }, '= rooms + ancillary']);
    pf.addRow(['Expense Ratio', { formula: refs['expenseRatio'].addr }, `${deal.assetType} default`]);
    pf.addRow(['Operating Expenses', { formula: 'B8*B9' }, '= revenue x expense ratio']);
    pf.addRow(['NOI', { formula: 'B8-B10' }, '= revenue - expenses']);
    noiAddr = "'Pro Forma'!$B$11";
    pf.getCell('B3').numFmt = PCT;
    pf.getCell('B9').numFmt = PCT;
    ['B5', 'B6', 'B7', 'B8', 'B10', 'B11'].forEach(c => (pf.getCell(c).numFmt = MONEY));
  } else {
    pf.addRow(['NOI (from statements)', { formula: refs['noi'] ? refs['noi'].addr : '0' }, 'Inputs (T12 or proxy)']);
    noiAddr = "'Pro Forma'!$B$2";
    pf.getCell('B2').numFmt = MONEY;
  }

  // ==========================================================================
  // Debt
  // ==========================================================================
  const dt = wb.addWorksheet('Debt');
  dt.columns = [{ width: 30 }, { width: 18 }, { width: 50 }];
  dt.addRow(['Line', 'Value', 'Note']).font = { bold: true };
  dt.addRow(['Index Rate', { formula: refs['indexRate'].addr }, `${market.index} as of ${market.asOf}. Refresh before routing`]);
  dt.addRow(['Spread (bps)', { formula: refs['spreadBps'].addr }, 'Bridge market quote range, config/market.json']);
  dt.addRow(['All-in Rate', { formula: 'B2+B3/10000' }, '= index + spread']);
  dt.addRow(['Stress (+bps)', DEFAULT_STRESSES.interestRateStress, 'Doctrine stress']);
  dt.addRow(['Stressed Rate', { formula: 'B4+B5' }, '= all-in + stress']);
  if (refs['askingPrice']) {
    dt.addRow(['Basis (price)', { formula: refs['askingPrice'].addr }, 'Inputs']);
    dt.addRow(['LTV', { formula: refs['ltv'].addr }, 'Assumption or conservative default']);
    dt.addRow(['Loan Amount', { formula: 'B7*B8' }, '= basis x LTV']);
  } else {
    dt.addRow(['Basis (price)', 0, 'MISSING: no price extracted']);
    dt.addRow(['LTV', { formula: refs['ltv'].addr }, '']);
    dt.addRow(['Loan Amount', 0, 'Cannot size without basis']);
  }
  dt.addRow(['Annual Debt Service (IO)', { formula: 'B9*B6' }, '= loan x stressed rate (IO, bridge convention)']);
  dt.addRow(['NOI', { formula: noiAddr }, 'Pro Forma']);
  dt.addRow(['DSCR (stressed, IO)', { formula: 'IF(B10=0,"n/a",B11/B10)' }, '= NOI / IO debt service']);
  dt.addRow(['Debt Yield', { formula: 'IF(B9=0,"n/a",B11/B9)' }, '= NOI / loan']);
  dt.addRow(['Amortization (years)', 30, 'Amortizing alternative / perm convention']);
  dt.addRow(['Loan Constant', { formula: '(B6/12*POWER(1+B6/12,B14*12))/(POWER(1+B6/12,B14*12)-1)*12' }, 'Monthly payment constant, annualized, at stressed rate']);
  dt.addRow(['Annual Debt Service (amortizing)', { formula: 'B9*B15' }, '= loan x constant']);
  dt.addRow(['DSCR (stressed, amortizing)', { formula: 'IF(B16=0,"n/a",B11/B16)' }, '= NOI / amortizing debt service']);
  ['B7', 'B9', 'B10', 'B11', 'B16'].forEach(c => (dt.getCell(c).numFmt = MONEY));
  ['B2', 'B4', 'B5', 'B6', 'B8', 'B13', 'B15'].forEach(c => (dt.getCell(c).numFmt = PCT));
  dt.getCell('B12').numFmt = X;
  dt.getCell('B17').numFmt = X;

  // ==========================================================================
  // Scenarios: A (as presented) vs B (Mosaic adjusted) — Schema v2.0.
  // The agent assembles; the analyst moves the levers and makes the call.
  // ==========================================================================
  const LEVER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3A3000' } };
  const sc = wb.addWorksheet('Scenarios');
  sc.columns = [{ width: 30 }, { width: 18 }, { width: 18 }, { width: 52 }];
  sc.addRow(['', 'A: As Presented', 'B: Mosaic Adjusted', 'Note']).font = { bold: true };
  sc.addRow(['NOI', { formula: noiAddr }, { formula: 'B2*(1-B3_HAIRCUT)'.replace('B3_HAIRCUT', refs['noiHaircut'].addr) }, 'B = A x (1 - haircut lever). Haircut lives on Inputs']);
  sc.addRow(['Debt Service (stressed IO)', { formula: 'Debt!B10' }, { formula: 'Debt!B10' }, 'Same facility both scenarios']);
  sc.addRow(['DSCR', { formula: 'IF(B3=0,"n/a",B2/B3)' }, { formula: 'IF(C3=0,"n/a",C2/C3)' }, '= NOI / debt service']);
  sc.addRow(['Debt Yield', { formula: 'IF(Debt!B9=0,"n/a",B2/Debt!B9)' }, { formula: 'IF(Debt!B9=0,"n/a",C2/Debt!B9)' }, '= NOI / loan']);
  sc.addRow(['Read', { formula: 'IF(B4<1.15,"FAILS 1.15x floor",IF(B4<1.25,"THIN","CLEARS"))' }, { formula: 'IF(C4<1.15,"FAILS 1.15x floor",IF(C4<1.25,"THIN","CLEARS"))' }, 'Doctrine floor 1.15x; covenant convention 1.25x']);
  sc.addRow([]);
  sc.addRow(['The Read row is a screen, not a decision. The credit call stays with the analyst.', '', '', '']);
  ['B2', 'C2', 'B3', 'C3'].forEach(c => (sc.getCell(c).numFmt = MONEY));
  ['B4', 'C4'].forEach(c => (sc.getCell(c).numFmt = X));
  ['B5', 'C5'].forEach(c => (sc.getCell(c).numFmt = PCT));

  // ==========================================================================
  // Macro Scenarios: named events, lever cells the analyst edits directly
  // ==========================================================================
  const mc = wb.addWorksheet('Macro Scenarios');
  mc.columns = [{ width: 26 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 26 }];
  mc.addRow(['Scenario', 'Rate D (bps)', 'NOI D (%)', 'Exit Cap D (bps)', 'DSCR', 'Debt Yield', 'Exit LTV', 'Read']).font = { bold: true };
  const MACROS: [string, number, number, number][] = [
    ['Base (stressed)', 0, 0, 0],
    ['Rate shock +200', 200, 0, 0],
    ['Recession', 50, -15, 50],
    ['Stagflation', 150, -10, 75],
    ['Refi market freeze', 100, 0, 150],
  ];
  MACROS.forEach((m, i) => {
    const r = i + 2;
    mc.addRow([
      m[0], m[1], m[2], m[3],
      { formula: `IF(Debt!$B$9=0,"n/a",('Scenarios'!$C$2*(1+C${r}/100))/(Debt!$B$9*(Debt!$B$6+B${r}/10000)))` },
      { formula: `IF(Debt!$B$9=0,"n/a",('Scenarios'!$C$2*(1+C${r}/100))/Debt!$B$9)` },
      { formula: `IF(('Scenarios'!$C$2*(1+C${r}/100))=0,"n/a",Debt!$B$9/(('Scenarios'!$C$2*(1+C${r}/100))/(${refs['exitCapBase'].addr}+D${r}/10000)))` },
      { formula: `IF(E${r}<1.15,"FAILS floor",IF(E${r}<1.25,"THIN","OK"))` },
    ]);
    // Delta cells are levers: analyst-editable, marked
    ['B', 'C', 'D'].forEach(c => (mc.getCell(`${c}${r}`).fill = LEVER_FILL));
    mc.getCell(`E${r}`).numFmt = X;
    mc.getCell(`F${r}`).numFmt = PCT;
    mc.getCell(`G${r}`).numFmt = PCT;
  });
  mc.addRow([]);
  mc.addRow(['Shaded cells are levers: edit the deltas and every formula recomputes. Base NOI is Scenario B (Mosaic adjusted).', '', '', '', '', '', '', '']);
  const sn = wb.addWorksheet('Sensitivity');
  sn.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }];
  sn.addRow(['DSCR', 'Rate -100bps', 'Rate +0', 'Rate +100bps']).font = { bold: true };
  const noiDeltas = [-0.10, 0, 0.10];
  const rateDeltas = [-0.01, 0, 0.01];
  noiDeltas.forEach((nd, i) => {
    const row: (string | { formula: string })[] = [`NOI ${nd >= 0 ? '+' : ''}${(nd * 100).toFixed(0)}%`];
    rateDeltas.forEach(rd => {
      row.push({ formula: `IF(Debt!$B$9=0,"n/a",(Debt!$B$11*${1 + nd})/(Debt!$B$9*(Debt!$B$6+${rd})))` });
    });
    const r = sn.addRow(row);
    ['B', 'C', 'D'].forEach(c => (sn.getCell(`${c}${r.number}`).numFmt = X));
    void i;
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 32 }, { width: 20 }, { width: 40 }];
  sum.addRow([deal.name.toUpperCase(), '', '']).font = { bold: true, size: 14 };
  sum.addRow([`${deal.assetType} | ${deal.location?.address ?? ''}`, '', '']);
  sum.addRow([]);
  sum.addRow(['Metric', 'Value', 'Source']).font = { bold: true };
  if (refs['askingPrice']) sum.addRow(['Basis / Price', { formula: refs['askingPrice'].addr }, 'Inputs']);
  sum.addRow(['NOI', { formula: noiAddr }, 'Pro Forma']);
  sum.addRow(['All-in Rate', { formula: 'Debt!B4' }, `${market.index} + ${market.bridgeSpreadBps}bps`]);
  sum.addRow(['Loan Amount', { formula: 'Debt!B9' }, 'Debt']);
  sum.addRow(['Stressed DSCR', { formula: 'Debt!B12' }, 'Debt']);
  sum.addRow(['Debt Yield', { formula: 'Debt!B13' }, 'Debt']);
  if (deal.underwriting.screen) {
    sum.addRow(['Screen Verdict', deal.underwriting.screen.verdict, `Risk ${deal.underwriting.screen.riskScore}/5`]);
    sum.addRow(['Overall Confidence', deal.underwriting.screen.confidenceSummary.overall, 'Confidence engine']);
  }
  sum.eachRow((row: { number: number }) => void row);

  // Move Summary first for readability
  // (exceljs orders by creation; reorder via worksheet.orderNo)
  sum.orderNo = 0;
  inp.orderNo = 1;
  pf.orderNo = 2;
  dt.orderNo = 3;
  sc.orderNo = 4;
  mc.orderNo = 5;
  sn.orderNo = 6;

  // ==========================================================================
  // Audit
  // ==========================================================================
  const au = wb.addWorksheet('Audit');
  au.columns = [{ width: 22 }, { width: 18 }, { width: 60 }];
  au.addRow(['Sources', '', '']).font = { bold: true };
  for (const s of deal.sources) {
    au.addRow([s.id, s.kind, s.filename ?? '']);
  }
  au.addRow([]);
  au.addRow(['Audit Log', '', '']).font = { bold: true };
  for (const entry of deal.auditLog.slice(-50)) {
    au.addRow([entry.timestamp, entry.action, JSON.stringify(entry.details).substring(0, 200)]);
  }

  const outPath = path.join(outDir, 'package.xlsx');
  await wb.xlsx.writeFile(outPath);
  return outPath;
}
