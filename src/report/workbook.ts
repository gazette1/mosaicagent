/**
 * Workbook Generator v2: deal.json -> institutional underwriting model.
 *
 * Modeled on Mosaic's own reference models (Myrtle Beach Radisson hotel
 * model / Harborside credit model / Lottsford scenarios): an Assumptions
 * sheet is the single source of truth and every other sheet computes off it
 * by cross-sheet formula.
 *
 * Sheets: Executive Summary | Assumptions | Sources & Uses | Debt Sizing |
 *         Pro Forma (10yr) | Stabilized P&L | Sensitivity | Scenarios |
 *         Macro Scenarios | Audit
 *
 * On top of the reference shape, this generator keeps Mosaic's governance
 * edge: every extracted input carries source + confidence, defaulted inputs
 * are amber levers, DSCR cells color reactively, and the Audit sheet lists
 * sources, structure flags, and the audit log.
 */

import * as path from 'path';
import { Deal, TrackedNumber } from '../core/schemas';
import { ASSET_TYPE_CRITERIA, DEFAULT_STRESSES } from '../core/doctrine';
import { getMarketConfig } from '../core/market-config';
import { ArchitectDesign } from './model-architect';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

const MONEY = '#,##0';
const PCT = '0.00%';
const X = '0.00"x"';

const NAVY = 'FF1A5C9E';
const NAVY_DARK = 'FF123F6D';
const GOOD = 'FF2E7D32';
const WARN = 'FFB26A00';
const BAD = 'FFC62828';
const LEVER = 'FFFFF2CC';
const ZEBRA = 'FFF3F6FA';
const WHITE = 'FFFFFFFF';
const THIN = { style: 'thin' as const, color: { argb: 'FFB9C4D0' } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ws = any;

function fillCell(cell: { fill?: unknown }, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function bandRow(ws: Ws, rowNumber: number, cols: number, argb = NAVY): void {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getRow(rowNumber).getCell(c);
    fillCell(cell, argb);
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
  }
}

function boxTable(ws: Ws, fromRow: number, toRow: number, cols: number, zebra = true): void {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
      if (zebra && r % 2 === 0 && !cell.fill) fillCell(cell, ZEBRA);
    }
  }
}

/** Wrap long-text columns so nothing renders cut off. */
function wrapCol(ws: Ws, cols: number[], fromRow: number, toRow: number): void {
  for (let r = fromRow; r <= toRow; r++) {
    for (const c of cols) {
      ws.getRow(r).getCell(c).alignment = { wrapText: true, vertical: 'top' };
    }
  }
}

function dscrConditional(ws: Ws, ref: string): void {
  ws.addConditionalFormatting({
    ref,
    rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: ['1.15'], priority: 1,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BAD } }, font: { color: { argb: WHITE }, bold: true } } },
      { type: 'cellIs', operator: 'between', formulae: ['1.15', '1.25'], priority: 2,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: WARN } }, font: { color: { argb: WHITE }, bold: true } } },
      { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: ['1.25'], priority: 3,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: GOOD } }, font: { color: { argb: WHITE }, bold: true } } },
    ],
  });
}

const VERDICT_COLORS: Record<string, string> = { KILL: BAD, CHASE: GOOD, STRUCTURE: WARN, DELEGATE: WARN };

// Column letters for the 10-year pro forma (B..K)
const YCOLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

export async function buildDealWorkbook(deal: Deal, outDir: string, design?: ArchitectDesign): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mosaic Capital Solutions';

  const market = getMarketConfig();
  const assetDefaults = ASSET_TYPE_CRITERIA[deal.assetType];
  const hotel = deal.extracted.hotel;
  const notes = deal.extracted.notes ?? [];
  const note = (f: string) => notes.find(n => n.field === f)?.extractedValue;
  const noteNum = (f: string) => { const v = note(f); return v !== undefined && !isNaN(Number(v)) ? Number(v) : null; };

  const price = deal.askingPrice?.value ?? null;
  const noiExtracted = deal.extracted.t12?.noi?.value ?? null;
  const capex = deal.assumptions.capexTotal?.value ?? 0;
  const keys = hotel?.keys?.value ?? noteNum('keys') ?? noteNum('totalUnits') ?? null;
  const isHotel = deal.assetType === 'hotel' && keys !== null;
  const stabOcc = hotel?.occupancy?.value ?? (1 - assetDefaults.defaultVacancy);
  const occIsDefault = !hotel?.occupancy;
  const adr = hotel?.adr?.value ?? null;
  const loanExtracted = noteNum('loanRequest');
  const capRate = deal.assumptions.entryCap?.value ?? assetDefaults.defaultCaps.exit;

  // ==========================================================================
  // ASSUMPTIONS: single source of truth. Cols: A label | B value | C source | D conf
  // ==========================================================================
  const as = wb.addWorksheet('Assumptions');
  as.columns = [{ width: 32 }, { width: 16 }, { width: 46 }, { width: 8 }];
  const A: Record<string, number> = {}; // key -> row number
  const src = (tv?: TrackedNumber | null, fb = 'lever / default') => tv?.sourceId ?? fb;
  const cf = (tv?: TrackedNumber | null, fb = '') => (tv?.confidence !== undefined ? tv.confidence.toFixed(2) : fb);

  let lever: number[] = [];
  const addA = (key: string, label: string, value: number | string | { formula: string } | null, source = '', conf = '', numFmt?: string, isLever = false): number => {
    const row = as.addRow([label, value ?? 'TBD', source, conf]);
    A[key] = row.number;
    if (numFmt) row.getCell(2).numFmt = numFmt;
    if (isLever) lever.push(row.number);
    return row.number;
  };
  const band = (label: string) => { const r = as.addRow([label]); bandRow(as, r.number, 4); };
  const $A = (key: string) => `Assumptions!$B$${A[key]}`;

  as.addRow([`${deal.name.toUpperCase()} - UNDERWRITING MODEL`]).font = { bold: true, size: 14, color: { argb: NAVY } };
  as.addRow([`${deal.assetType.toUpperCase()} | ${deal.location?.address ?? ''} | machine-assembled ${new Date().toISOString().substring(0, 10)}`]).font = { color: { argb: 'FF6B7A8C' } };
  as.addRow([]);

  band('CAPITAL COSTS');
  addA('price', 'Acquisition Price', price, src(deal.askingPrice, 'MISSING - request'), cf(deal.askingPrice), MONEY, price === null);
  addA('capex', 'Capital Plan / PIP', capex, src(deal.assumptions.capexTotal, capex ? '' : 'none extracted'), cf(deal.assumptions.capexTotal), MONEY, !deal.assumptions.capexTotal);
  addA('ffe', 'FF&E Budget', 0, 'lever', '', MONEY, true);
  addA('closing', 'Closing / Fees (1.5% of loan)', { formula: `B${A['price'] ? 0 : 0}` }, '', '', MONEY); // placeholder, fixed below
  addA('tpc', 'TOTAL PROJECT COST', { formula: '' }, 'computed', '', MONEY);
  as.addRow([]);

  band('OPERATIONS');
  addA('keys', isHotel ? 'Keys' : 'Units / Size Basis', keys, hotel?.keys ? src(hotel.keys) : note('keys') ? 'extracted' : 'MISSING', cf(hotel?.keys), undefined, keys === null);
  if (isHotel) {
    addA('nights', 'Available Room Nights', { formula: `B${A['keys']}*365` }, 'computed', '');
    addA('stabOcc', 'Stabilized Occupancy', stabOcc, occIsDefault ? 'doctrine default' : src(hotel?.occupancy), cf(hotel?.occupancy), PCT, occIsDefault);
    addA('adr', 'Stabilized ADR', adr, src(hotel?.adr, adr === null ? 'MISSING - request' : ''), cf(hotel?.adr), MONEY, adr === null);
  } else {
    addA('baseNoi', 'Base NOI (T12 or proxy)', noiExtracted, src(deal.extracted.t12?.noi, 'MISSING - request'), cf(deal.extracted.t12?.noi), MONEY, noiExtracted === null);
  }
  as.addRow([]);

  band('CAPITAL STACK');
  addA('loan', 'Senior Loan', loanExtracted ?? { formula: `B${A['tpc']}*${DEFAULT_STRESSES.conservativeLtv}` },
    loanExtracted ? 'extracted loanRequest' : `lever: ${DEFAULT_STRESSES.conservativeLtv * 100}% of TPC`, '', MONEY, !loanExtracted);
  addA('equity', 'Total Equity Required', { formula: `B${A['tpc']}-B${A['loan']}` }, 'computed', '', MONEY);
  as.addRow([]);

  band('LOAN TERMS');
  addA('index', `Index Rate (${market.index}, as of ${market.asOf})`, market.indexRate, 'config/market.json - REFRESH', '', '0.00%');
  addA('spread', 'Spread (bps)', market.bridgeSpreadBps, 'config/market.json', '', undefined, true);
  addA('allin', 'All-In Rate', { formula: `B${A['index']}+B${A['spread']}/10000` }, 'computed', '', '0.00%');
  addA('irM', 'Interest Reserve (months)', 6, 'lever', '', undefined, true);
  addA('amort', 'Amortization (years)', 30, 'lever', '', undefined, true);
  addA('permRate', 'Permanent Rate', market.permRate, 'config/market.json', '', '0.00%');
  as.addRow([]);

  band('GROWTH & RAMP');
  if (isHotel) {
    addA('y1occ', 'Year 1 Occupancy', { formula: `B${A['stabOcc']}*0.8` }, 'lever: 80% of stabilized', '', PCT, true);
    addA('occG', 'Occupancy Growth (pts/yr)', 0.03, 'lever', '', PCT, true);
    addA('adrG', 'ADR Growth (annual)', 0.02, 'lever', '', PCT, true);
  } else {
    addA('noiG', 'NOI Growth (annual)', 0.025, 'lever', '', PCT, true);
  }
  as.addRow([]);

  if (isHotel) {
    band('EXPENSE RATIOS (reference-model defaults, all levers)');
    addA('fbPct', 'F&B Revenue (% of rooms)', 0.15, 'lever', '', PCT, true);
    addA('othPct', 'Other Revenue (% of rooms)', 0.05, 'lever', '', PCT, true);
    addA('roomsX', 'Rooms Expense (% rooms rev)', 0.22, 'lever', '', PCT, true);
    addA('fbX', 'F&B Expense (% F&B rev)', 0.65, 'lever', '', PCT, true);
    addA('agX', 'A&G (% total rev)', 0.09, 'lever', '', PCT, true);
    addA('smX', 'S&M (% total rev)', 0.07, 'lever', '', PCT, true);
    addA('utilX', 'Utilities/R&M/Other (% total rev)', 0.11, 'lever', '', PCT, true);
    addA('ffeX', 'FF&E Reserve (% total rev)', 0.04, 'lever', '', PCT, true);
    as.addRow([]);
  }

  band('EXIT & TAKEOUT');
  addA('cap', 'Exit / Valuation Cap Rate', capRate, deal.assumptions.entryCap ? src(deal.assumptions.entryCap) : 'doctrine default', cf(deal.assumptions.entryCap), PCT, !deal.assumptions.entryCap);
  addA('permLtv', 'Permanent LTV', 0.65, 'lever', '', PCT, true);
  addA('minDscr', 'Min Perm DSCR', 1.30, 'lever', '', X, true);
  addA('minDy', 'Min Debt Yield', 0.10, 'lever', '', PCT, true);

  // Fix the two placeholder formulas now that rows are known
  as.getCell(`B${A['closing']}`).value = { formula: `B${A['loan']}*0.015` };
  as.getCell(`B${A['tpc']}`).value = { formula: `B${A['price']}+B${A['capex']}+B${A['ffe']}+B${A['closing']}` };

  // K3 architect overrides: value replaced, rationale in the source column,
  // amber so the analyst sees which inputs came from model judgment
  for (const o of design?.overrides ?? []) {
    const row = A[o.lever];
    if (!row) continue;
    as.getCell(`B${row}`).value = o.value; // replaces formula cells too (e.g. stated all-in rate)
    as.getCell(`C${row}`).value = `K3 proposed: ${o.rationale}`;
    if (!lever.includes(row)) lever.push(row);
  }

  for (const r of lever) fillCell(as.getRow(r).getCell(2), LEVER);
  boxTable(as, 4, as.rowCount, 4, false);
  wrapCol(as, [1, 3], 4, as.rowCount);

  // ==========================================================================
  // PRO FORMA: 10 years
  // ==========================================================================
  const pf = wb.addWorksheet('Pro Forma');
  pf.columns = [{ width: 26 }, ...YCOLS.map(() => ({ width: 13 }))];
  pf.addRow(['10-YEAR PRO FORMA']).font = { bold: true, size: 13, color: { argb: NAVY } };
  pf.addRow([]);
  const hdr = pf.addRow(['Year', ...YCOLS.map((_, i) => `Year ${i + 1}`)]);
  bandRow(pf, hdr.number, 11);

  const P: Record<string, number> = {};
  const addP = (key: string, label: string, formulas: (string | number)[], numFmt?: string): number => {
    const row = pf.addRow([label, ...formulas.map(f => (typeof f === 'string' ? { formula: f } : f))]);
    P[key] = row.number;
    if (numFmt) YCOLS.forEach(c => (pf.getCell(`${c}${row.number}`).numFmt = numFmt));
    return row.number;
  };

  let noiRow: number;
  if (isHotel) {
    const occR = addP('occ', 'Occupancy', YCOLS.map((c, i) =>
      i === 0 ? `${$A('y1occ')}` : `MIN(${$A('stabOcc')},${YCOLS[i - 1]}${P['occ'] ?? 0}+${$A('occG')})`), PCT);
    // occ self-reference: rebuild formulas now that row known
    YCOLS.forEach((c, i) => {
      pf.getCell(`${c}${occR}`).value = i === 0
        ? { formula: `${$A('y1occ')}` }
        : { formula: `MIN(${$A('stabOcc')},${YCOLS[i - 1]}${occR}+${$A('occG')})` };
    });
    const adrR = addP('adr', 'ADR', YCOLS.map((c, i) => i === 0 ? `${$A('adr')}` : `${YCOLS[i - 1]}0*(1+${$A('adrG')})`), MONEY);
    YCOLS.forEach((c, i) => {
      pf.getCell(`${c}${adrR}`).value = i === 0 ? { formula: `${$A('adr')}` } : { formula: `${YCOLS[i - 1]}${adrR}*(1+${$A('adrG')})` };
    });
    addP('revpar', 'RevPAR', YCOLS.map(c => `${c}${occR}*${c}${adrR}`), MONEY);
    addP('rooms', 'Rooms Revenue', YCOLS.map(c => `${c}${P['revpar']}*${$A('nights')}`), MONEY);
    addP('fb', 'F&B Revenue', YCOLS.map(c => `${c}${P['rooms']}*${$A('fbPct')}`), MONEY);
    addP('oth', 'Other Revenue', YCOLS.map(c => `${c}${P['rooms']}*${$A('othPct')}`), MONEY);
    addP('rev', 'TOTAL REVENUE', YCOLS.map(c => `SUM(${c}${P['rooms']}:${c}${P['oth']})`), MONEY);
    addP('roomsX', 'Rooms Expense', YCOLS.map(c => `${c}${P['rooms']}*${$A('roomsX')}`), MONEY);
    addP('fbX', 'F&B Expense', YCOLS.map(c => `${c}${P['fb']}*${$A('fbX')}`), MONEY);
    addP('agX', 'A&G Expense', YCOLS.map(c => `${c}${P['rev']}*${$A('agX')}`), MONEY);
    addP('smX', 'S&M Expense', YCOLS.map(c => `${c}${P['rev']}*${$A('smX')}`), MONEY);
    addP('utilX', 'Utilities/R&M/Other', YCOLS.map(c => `${c}${P['rev']}*${$A('utilX')}`), MONEY);
    addP('opex', 'Total Operating Expenses', YCOLS.map(c => `SUM(${c}${P['roomsX']}:${c}${P['utilX']})`), MONEY);
    addP('gop', 'GROSS OPERATING PROFIT', YCOLS.map(c => `${c}${P['rev']}-${c}${P['opex']}`), MONEY);
    addP('ffe', 'FF&E Reserve', YCOLS.map(c => `${c}${P['rev']}*${$A('ffeX')}`), MONEY);
    noiRow = addP('noi', 'NET OPERATING INCOME', YCOLS.map(c => `${c}${P['gop']}-${c}${P['ffe']}`), MONEY);
    addP('margin', 'NOI Margin %', YCOLS.map(c => `IF(${c}${P['rev']}=0,"n/a",${c}${P['noi']}/${c}${P['rev']})`), PCT);
  } else {
    noiRow = addP('noi', 'NET OPERATING INCOME', YCOLS.map((c, i) =>
      i === 0 ? `${$A('baseNoi')}` : `${YCOLS[i - 1]}0*(1+${$A('noiG')})`), MONEY);
    YCOLS.forEach((c, i) => {
      pf.getCell(`${c}${noiRow}`).value = i === 0 ? { formula: `${$A('baseNoi')}` } : { formula: `${YCOLS[i - 1]}${noiRow}*(1+${$A('noiG')})` };
    });
  }
  pf.addRow([]);
  const dsRow = addP('ds', 'Debt Service (amortizing)', YCOLS.map(() => `'Debt Sizing'!$B$14`), MONEY);
  const dscrRow = addP('dscr', 'DSCR', YCOLS.map(c => `IF(${c}${dsRow}=0,"n/a",${c}${noiRow}/${c}${dsRow})`), X);
  addP('cf', 'Cash Flow After DS', YCOLS.map(c => `${c}${noiRow}-${c}${dsRow}`), MONEY);
  boxTable(pf, hdr.number + 1, pf.rowCount, 11, false);
  dscrConditional(pf, `B${dscrRow}:K${dscrRow}`);
  pf.views = [{ state: 'frozen', xSplit: 1, ySplit: hdr.number }];

  const stabCol = 'F'; // Year 5 = stabilized reference year

  // ==========================================================================
  // STABILIZED P&L (Year 5) + valuation
  // ==========================================================================
  const st = wb.addWorksheet('Stabilized P&L');
  st.columns = [{ width: 32 }, { width: 16 }, { width: 40 }];
  st.addRow(['STABILIZED YEAR (YEAR 5)']).font = { bold: true, size: 13, color: { argb: NAVY } };
  st.addRow([]);
  const S: Record<string, number> = {};
  const addS = (key: string, label: string, formula: string | number, notee = '', numFmt = MONEY) => {
    const r = st.addRow([label, typeof formula === 'string' ? { formula } : formula, notee]);
    S[key] = r.number;
    r.getCell(2).numFmt = numFmt;
  };
  if (isHotel) {
    addS('rev', 'Total Revenue', `'Pro Forma'!${stabCol}${P['rev']}`);
    addS('gop', 'Gross Operating Profit', `'Pro Forma'!${stabCol}${P['gop']}`);
    addS('ffe', 'FF&E Reserve', `'Pro Forma'!${stabCol}${P['ffe']}`);
  }
  addS('noi', 'STABILIZED NOI', `'Pro Forma'!${stabCol}${noiRow}`);
  st.addRow([]);
  const vBand = st.addRow(['VALUATION & TAKEOUT']); bandRow(st, vBand.number, 3);
  addS('value', 'Stabilized Value (NOI / cap)', `B${S['noi']}/${$A('cap')}`, 'cap rate on Assumptions');
  addS('refi', 'Refi Proceeds at Perm LTV', `B${S['value']}*${$A('permLtv')}`);
  addS('payoff', 'Bridge Payoff (loan + reserve)', `'Debt Sizing'!B8`);
  addS('excess', 'Excess / (Gap) at Refi', `B${S['refi']}-B${S['payoff']}`);
  boxTable(st, 3, st.rowCount, 3, false);
  wrapCol(st, [3], 3, st.rowCount);

  // ==========================================================================
  // DEBT SIZING
  // ==========================================================================
  const dz = wb.addWorksheet('Debt Sizing');
  dz.columns = [{ width: 34 }, { width: 16 }, { width: 44 }];
  dz.addRow(['DEBT SIZING']).font = { bold: true, size: 13, color: { argb: NAVY } };
  const cBand = dz.addRow(['BRIDGE / CONSTRUCTION']); bandRow(dz, cBand.number, 3);
  dz.addRow(['Base Loan Amount', { formula: `${$A('loan')}` }, 'Assumptions']);                       // B3
  dz.addRow(['Monthly Interest', { formula: `B3*${$A('allin')}/12` }, '']);                            // B4
  dz.addRow(['Interest Reserve (months)', { formula: `${$A('irM')}` }, 'lever on Assumptions']);       // B5
  dz.addRow(['Total Interest Reserve', { formula: 'B4*B5' }, '']);                                     // B6
  dz.addRow([]);                                                                                      // 7
  dz.addRow(['Total Loan (w/ Reserve)', { formula: 'B3+B6' }, '']);                                    // B8
  const sBand = dz.addRow(['STABILIZED COVERAGE']); bandRow(dz, sBand.number, 3);                      // 9
  dz.addRow(['Stabilized NOI (Year 5)', { formula: `'Stabilized P&L'!B${S['noi']}` }, '']);            // B10
  dz.addRow(['Loan Constant (perm rate, amort)', { formula: `(${$A('permRate')}/12*POWER(1+${$A('permRate')}/12,${$A('amort')}*12))/(POWER(1+${$A('permRate')}/12,${$A('amort')}*12)-1)*12` }, '']); // B11
  dz.addRow(['Annual Interest (bridge, IO)', { formula: `B3*${$A('allin')}` }, '']);                   // B12
  dz.addRow([]);                                                                                      // 13
  dz.addRow(['Annual Debt Service (perm)', { formula: 'B3*B11' }, 'used by Pro Forma DSCR row']);      // B14
  dz.addRow(['DSCR (stabilized, perm DS)', { formula: 'IF(B14=0,"n/a",B10/B14)' }, '']);               // B15
  dz.addRow(['DSCR (bridge IO)', { formula: 'IF(B12=0,"n/a",B10/B12)' }, '']);                         // B16
  const tBand = dz.addRow(['PERMANENT TAKEOUT SIZING']); bandRow(dz, tBand.number, 3);                 // 17
  dz.addRow(['Sized by Min DSCR', { formula: `B10/${$A('minDscr')}/B11` }, '']);                       // B18
  dz.addRow(['Sized by Perm LTV', { formula: `'Stabilized P&L'!B${S['value']}*${$A('permLtv')}` }, '']); // B19
  dz.addRow(['Sized by Min Debt Yield', { formula: `B10/${$A('minDy')}` }, '']);                       // B20
  dz.addRow(['MAX PERM LOAN (min of three)', { formula: 'MIN(B18:B20)' }, 'binding constraint wins']); // B21
  dz.addRow(['Bridge Coverage at Takeout', { formula: 'B21-B8' }, 'negative = refi gap']);             // B22
  ['B3', 'B4', 'B6', 'B8', 'B10', 'B12', 'B14', 'B18', 'B19', 'B20', 'B21', 'B22'].forEach(c => (dz.getCell(c).numFmt = MONEY));
  dz.getCell('B11').numFmt = '0.00%';
  dz.getCell('B15').numFmt = X; dz.getCell('B16').numFmt = X;
  dscrConditional(dz, 'B15'); dscrConditional(dz, 'B16');
  boxTable(dz, 2, dz.rowCount, 3, false);
  wrapCol(dz, [3], 2, dz.rowCount);

  // ==========================================================================
  // SOURCES & USES
  // ==========================================================================
  const su = wb.addWorksheet('Sources & Uses');
  su.columns = [{ width: 34 }, { width: 16 }, { width: 40 }];
  su.addRow(['SOURCES & USES OF FUNDS']).font = { bold: true, size: 13, color: { argb: NAVY } };
  const uBand = su.addRow(['USES']); bandRow(su, uBand.number, 3);
  su.addRow(['Acquisition Price', { formula: `${$A('price')}` }, '']);            // B3
  su.addRow(['Capital Plan / PIP', { formula: `${$A('capex')}` }, '']);           // B4
  su.addRow(['FF&E', { formula: `${$A('ffe')}` }, '']);                           // B5
  su.addRow(['Closing / Fees', { formula: `${$A('closing')}` }, '']);             // B6
  su.addRow(['Interest Reserve', { formula: `'Debt Sizing'!B6` }, '']);           // B7
  su.addRow(['TOTAL USES', { formula: 'SUM(B3:B7)' }, '']);                       // B8
  const sBand2 = su.addRow(['SOURCES']); bandRow(su, sBand2.number, 3);           // 9
  su.addRow(['Senior Loan (w/ Reserve)', { formula: `'Debt Sizing'!B8` }, '']);   // B10
  su.addRow(['Sponsor Equity', { formula: 'B8-B10' }, 'plug']);                   // B11
  su.addRow(['TOTAL SOURCES', { formula: 'SUM(B10:B11)' }, '']);                  // B12
  su.addRow(['Balance Check (must be 0)', { formula: 'B12-B8' }, '']);            // B13
  ['B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B10', 'B11', 'B12', 'B13'].forEach(c => (su.getCell(c).numFmt = MONEY));
  boxTable(su, 2, su.rowCount, 3, false);
  wrapCol(su, [3], 2, su.rowCount);

  // ==========================================================================
  // SENSITIVITY: DSCR (rate x NOI) and Value (cap x NOI)
  // ==========================================================================
  const sn = wb.addWorksheet('Sensitivity');
  sn.columns = [{ width: 26 }, ...Array(5).fill({ width: 14 })];
  sn.addRow(['DSCR SENSITIVITY (perm rate delta x NOI delta)']).font = { bold: true, color: { argb: NAVY } };
  const rateDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const noiDeltas = [-0.15, -0.10, -0.05, 0, 0.05];
  const h1 = sn.addRow(['NOI \\ Rate', ...rateDeltas.map(r => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`)]);
  bandRow(sn, h1.number, 6);
  for (const nd of noiDeltas) {
    const r = sn.addRow([`NOI ${nd >= 0 ? '+' : ''}${(nd * 100).toFixed(0)}%`, ...rateDeltas.map(rd => ({
      formula: `('Debt Sizing'!$B$10*(1+${nd}))/('Debt Sizing'!$B$3*((${$A('permRate')}+${rd})/12*POWER(1+(${$A('permRate')}+${rd})/12,${$A('amort')}*12))/(POWER(1+(${$A('permRate')}+${rd})/12,${$A('amort')}*12)-1)*12)`,
    }))]);
    for (let c = 2; c <= 6; c++) sn.getRow(r.number).getCell(c).numFmt = X;
  }
  dscrConditional(sn, `B${h1.number + 1}:F${h1.number + noiDeltas.length}`);
  sn.addRow([]);
  sn.addRow(['VALUE SENSITIVITY (cap delta x NOI delta)']).font = { bold: true, color: { argb: NAVY } };
  const capDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const h2 = sn.addRow(['NOI \\ Cap', ...capDeltas.map(cd => `${cd >= 0 ? '+' : ''}${(cd * 100).toFixed(1)}%`)]);
  bandRow(sn, h2.number, 6);
  for (const nd of noiDeltas) {
    const r = sn.addRow([`NOI ${nd >= 0 ? '+' : ''}${(nd * 100).toFixed(0)}%`, ...capDeltas.map(cd => ({
      formula: `('Debt Sizing'!$B$10*(1+${nd}))/(${$A('cap')}+${cd})`,
    }))]);
    for (let c = 2; c <= 6; c++) sn.getRow(r.number).getCell(c).numFmt = MONEY;
  }
  boxTable(sn, 2, sn.rowCount, 6, false);

  // ==========================================================================
  // SCENARIOS (A/B) + MACRO SCENARIOS (kept from v1, re-referenced)
  // ==========================================================================
  const sc = wb.addWorksheet('Scenarios');
  sc.columns = [{ width: 30 }, { width: 18 }, { width: 18 }, { width: 52 }];
  const sch = sc.addRow(['', 'A: As Presented', 'B: Mosaic Adjusted', 'Note']); bandRow(sc, sch.number, 4);
  sc.addRow(['Stabilized NOI', { formula: `'Stabilized P&L'!B${S['noi']}` }, { formula: `B2*(1-${DEFAULT_STRESSES.noiHaircut})` }, `B = A x (1 - ${DEFAULT_STRESSES.noiHaircut * 100}% doctrine haircut)`]);
  sc.addRow(['Debt Service (perm)', { formula: `'Debt Sizing'!B14` }, { formula: `'Debt Sizing'!B14` }, 'Same facility both scenarios']);
  sc.addRow(['DSCR', { formula: 'IF(B3=0,"n/a",B2/B3)' }, { formula: 'IF(C3=0,"n/a",C2/C3)' }, '']);
  sc.addRow(['Debt Yield', { formula: `IF('Debt Sizing'!B3=0,"n/a",B2/'Debt Sizing'!B3)` }, { formula: `IF('Debt Sizing'!B3=0,"n/a",C2/'Debt Sizing'!B3)` }, '']);
  sc.addRow(['Read', { formula: 'IF(B4<1.15,"FAILS 1.15x floor",IF(B4<1.25,"THIN","CLEARS"))' }, { formula: 'IF(C4<1.15,"FAILS 1.15x floor",IF(C4<1.25,"THIN","CLEARS"))' }, 'A screen, not a decision']);
  ['B2', 'C2', 'B3', 'C3'].forEach(c => (sc.getCell(c).numFmt = MONEY));
  ['B4', 'C4'].forEach(c => (sc.getCell(c).numFmt = X));
  ['B5', 'C5'].forEach(c => (sc.getCell(c).numFmt = PCT));
  dscrConditional(sc, 'B4:C4');
  boxTable(sc, 2, 6, 4);
  wrapCol(sc, [1, 4], 2, 6);

  const mc = wb.addWorksheet('Macro Scenarios');
  mc.columns = [{ width: 26 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 48 }];
  const mch = mc.addRow(['Scenario', 'Rate D (bps)', 'NOI D (%)', 'Exit Cap D (bps)', 'DSCR', 'Debt Yield', 'Exit LTV', 'Read']);
  bandRow(mc, mch.number, 8);
  // Deal-specific scenarios from the K3 architect when present; generic set
  // otherwise. Delta cells stay levers either way.
  const MACROS: [string, number, number, number][] = design?.scenarios?.length
    ? design.scenarios.map(s => [s.name, s.rateDeltaBps, s.noiDeltaPct, s.capDeltaBps] as [string, number, number, number])
    : [
        ['Base (perm)', 0, 0, 0],
        ['Rate shock +200', 200, 0, 0],
        ['Recession', 50, -15, 50],
        ['Stagflation', 150, -10, 75],
        ['Refi market freeze', 100, 0, 150],
      ];
  MACROS.forEach((m, i) => {
    const r = i + 2;
    mc.addRow([
      m[0], m[1], m[2], m[3],
      { formula: `IF('Debt Sizing'!$B$3=0,"n/a",('Scenarios'!$C$2*(1+C${r}/100))/('Debt Sizing'!$B$3*(${$A('permRate')}+B${r}/10000)))` },
      { formula: `IF('Debt Sizing'!$B$3=0,"n/a",('Scenarios'!$C$2*(1+C${r}/100))/'Debt Sizing'!$B$3)` },
      { formula: `IF(('Scenarios'!$C$2*(1+C${r}/100))=0,"n/a",'Debt Sizing'!$B$3/(('Scenarios'!$C$2*(1+C${r}/100))/(${$A('cap')}+D${r}/10000)))` },
      { formula: `IF(E${r}<1.15,"FAILS floor",IF(E${r}<1.25,"THIN","OK"))` },
    ]);
    ['B', 'C', 'D'].forEach(c => fillCell(mc.getCell(`${c}${r}`), LEVER));
    mc.getCell(`E${r}`).numFmt = X; mc.getCell(`F${r}`).numFmt = PCT; mc.getCell(`G${r}`).numFmt = PCT;
    if (design?.scenarios?.length) mc.getCell(`H${r}`).note = undefined;
  });
  const mcLast = 1 + MACROS.length;
  dscrConditional(mc, `E2:E${mcLast}`);
  boxTable(mc, 2, mcLast, 8, false);
  if (design?.scenarios?.length) {
    mc.addRow([]);
    mc.addRow(['Scenarios designed by Kimi K3 from this deal\'s structure flags; deltas are levers.']);
    design.scenarios.forEach(sd => {
      const r = mc.addRow([sd.name, '', '', '', '', '', '', sd.rationale]);
      wrapCol(mc, [1, 8], r.number, r.number);
    });
  }

  // ==========================================================================
  // OBLIGATIONS SCHEDULE (K3-designed: earnouts, deferred fees, seller notes)
  // ==========================================================================
  let ob: Ws | null = null;
  if (design?.obligations?.length) {
    ob = wb.addWorksheet('Obligations');
    ob.columns = [{ width: 34 }, ...Array(5).fill({ width: 14 }), { width: 44 }];
    ob.addRow(['OBLIGATIONS PAID FROM CASH FLOW (K3-designed, amounts from documents)']).font = { bold: true, color: { argb: NAVY } };
    const oh = ob.addRow(['Obligation', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Rationale']);
    bandRow(ob, oh.number, 7);
    const firstDataRow = oh.number + 1;
    for (const o of design.obligations) {
      const r = ob.addRow([o.label, ...o.annualAmounts, o.rationale]);
      for (let c = 2; c <= 6; c++) { r.getCell(c).numFmt = MONEY; fillCell(r.getCell(c), LEVER); }
    }
    const lastDataRow = ob.rowCount;
    const tot = ob.addRow(['TOTAL OBLIGATIONS', ...['B', 'C', 'D', 'E', 'F'].map(c => ({ formula: `SUM(${c}${firstDataRow}:${c}${lastDataRow})` })), '']);
    const cfRow = ob.addRow(['CF After DS (Pro Forma)', ...['B', 'C', 'D', 'E', 'F'].map(c => ({ formula: `'Pro Forma'!${c}${P['cf']}` })), '']);
    const netRow = ob.addRow(['NET CF AFTER OBLIGATIONS', ...['B', 'C', 'D', 'E', 'F'].map(c => ({ formula: `${c}${cfRow.number}-${c}${tot.number}` })), 'negative = obligations not coverable']);
    [tot.number, cfRow.number, netRow.number].forEach(rn => { for (let c = 2; c <= 6; c++) ob.getRow(rn).getCell(c).numFmt = MONEY; });
    ob.addConditionalFormatting({
      ref: `B${netRow.number}:F${netRow.number}`,
      rules: [
        { type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 1,
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BAD } }, font: { color: { argb: WHITE }, bold: true } } },
        { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: ['0'], priority: 2,
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: GOOD } }, font: { color: { argb: WHITE }, bold: true } } },
      ],
    });
    boxTable(ob, oh.number + 1, ob.rowCount, 7, false);
    wrapCol(ob, [1, 7], oh.number + 1, ob.rowCount);
  }

  // ==========================================================================
  // EXECUTIVE SUMMARY
  // ==========================================================================
  const ex = wb.addWorksheet('Executive Summary');
  ex.columns = [{ width: 34 }, { width: 18 }, { width: 44 }];
  ex.addRow([`EXECUTIVE SUMMARY - ${deal.name.toUpperCase()}`]).font = { bold: true, size: 14, color: { argb: NAVY } };
  ex.addRow([`${deal.assetType.toUpperCase()} | ${deal.location?.address ?? ''}`]).font = { color: { argb: 'FF6B7A8C' } };
  ex.addRow([]);
  const tb = ex.addRow(['TRANSACTION']); bandRow(ex, tb.number, 3);
  ex.addRow(['Total Project Cost', { formula: `${$A('tpc')}` }, '']);
  ex.addRow(['Senior Loan (w/ Reserve)', { formula: `'Debt Sizing'!B8` }, '']);
  ex.addRow(['Sponsor Equity', { formula: `'Sources & Uses'!B11` }, '']);
  const lb = ex.addRow(['COVERAGE & TAKEOUT']); bandRow(ex, lb.number, 3);
  ex.addRow(['All-In Bridge Rate', { formula: `${$A('allin')}` }, `${market.index} + spread, config-driven`]);
  ex.addRow(['Stabilized DSCR (perm)', { formula: `'Debt Sizing'!B15` }, '']);
  ex.addRow(['Max Perm Loan (min of three)', { formula: `'Debt Sizing'!B21` }, '']);
  ex.addRow(['Refi Excess / (Gap)', { formula: `'Debt Sizing'!B22` }, '']);
  const vb = ex.addRow(['STABILIZED & VALUATION']); bandRow(ex, vb.number, 3);
  if (isHotel) {
    ex.addRow(['Stabilized Occupancy / ADR', { formula: `'Pro Forma'!${stabCol}${P['occ']}` }, '']);
    ex.getCell(`B${ex.rowCount}`).numFmt = PCT;
  }
  ex.addRow(['Stabilized NOI (Y5)', { formula: `'Stabilized P&L'!B${S['noi']}` }, '']);
  ex.addRow(['Stabilized Value', { formula: `'Stabilized P&L'!B${S['value']}` }, '']);
  const gb = ex.addRow(['GOVERNANCE']); bandRow(ex, gb.number, 3);
  if (deal.underwriting.screen) {
    const v = deal.underwriting.screen.verdict;
    const r = ex.addRow(['Screen Verdict', v, `risk ${deal.underwriting.screen.riskScore}/5, confidence ${Math.round((deal.underwriting.screen.confidenceSummary?.overall ?? 0) * 100)}%`]);
    fillCell(r.getCell(2), VERDICT_COLORS[v] ?? WARN);
    r.getCell(2).font = { bold: true, color: { argb: WHITE } };
  }
  const claimCount = (deal.extracted.claims ?? []).length;
  const conflictCount = (deal.extracted.conflicts ?? []).length;
  if (claimCount) {
    ex.addRow(['Claims adjudicated', `${claimCount} from ${new Set((deal.extracted.claims ?? []).map(c => c.filename)).size} documents`, conflictCount ? `${conflictCount} unresolved disagreement(s): see Provenance` : 'no material disagreements']);
  }
  const injCount = (deal.extracted.injections ?? []).length;
  if (injCount) {
    const r = ex.addRow(['Document integrity', `${injCount} injection attempt(s)`, 'content ignored as data; see Audit']);
    fillCell(r.getCell(2), BAD); r.getCell(2).font = { bold: true, color: { argb: WHITE } };
  }
  const sfCount = notes.filter(n => n.field === 'structureFlag').length;
  const sfSerious = notes.filter(n => n.field === 'structureFlag' && /^SERIOUS/.test(n.extractedValue)).length;
  ex.addRow(['Structure Flags', `${sfCount} (${sfSerious} serious)`, 'full list on Audit sheet']);
  ex.addRow(['Amber cells', 'levers / defaults', 'analyst-editable or unverified inputs']);
  if (design) {
    ex.addRow(['Model design', 'Kimi K3 architect', `${design.overrides.length} overrides, ${design.scenarios.length} scenarios, ${design.obligations.length} obligations`]);
    for (const n of design.modelNotes.slice(0, 4)) ex.addRow(['', '', n]);
  }
  ['B5', 'B6', 'B7', 'B11', 'B12', 'B15', 'B16'].forEach(c => { try { ex.getCell(c).numFmt = MONEY; } catch { /* noop */ } });
  ex.getCell('B9').numFmt = '0.00%';
  ex.getCell('B10').numFmt = X;
  dscrConditional(ex, 'B10');
  boxTable(ex, 4, ex.rowCount, 3, false);
  wrapCol(ex, [3], 4, ex.rowCount);

  // ==========================================================================
  // PROVENANCE: the claims ledger, and why each winner won. This is the sheet
  // that shows the system adjudicating sources rather than scraping them.
  // ==========================================================================
  const claims = (deal.extracted.claims ?? []) as { field: string; value: number | string; confidence: number; quote: string; filename: string; docClass: string; authority: number; docDate: string | null; extractor: string; derived?: boolean }[];
  let pv: Ws | null = null;
  if (claims.length) {
    pv = wb.addWorksheet('Provenance');
    pv.columns = [{ width: 16 }, { width: 16 }, { width: 20 }, { width: 9 }, { width: 11 }, { width: 7 }, { width: 30 }, { width: 40 }];
    pv.addRow(['CLAIMS LEDGER: every value any document asserted, and who won']).font = { bold: true, size: 12, color: { argb: NAVY } };
    pv.addRow(['Resolution order: document authority, then stated-over-derived, then amendment, then date, then read confidence.']).font = { color: { argb: 'FF6B7A8C' } };
    const ph = pv.addRow(['Field', 'Value', 'Document class', 'Authority', 'Date', 'Conf', 'Source file', 'Evidence']);
    bandRow(pv, ph.number, 8);

    // Winner per field, by the same rule the resolver used
    const byField = new Map<string, typeof claims>();
    for (const c of claims) {
      if (!byField.has(c.field)) byField.set(c.field, []);
      byField.get(c.field)!.push(c);
    }
    const first = ph.number + 1;
    for (const [field, list] of [...byField.entries()].sort()) {
      const sorted = [...list].sort((a, b) =>
        b.authority - a.authority ||
        (a.derived ? 1 : 0) - (b.derived ? 1 : 0) ||
        String(b.docDate ?? '').localeCompare(String(a.docDate ?? '')) ||
        b.confidence - a.confidence);
      sorted.forEach((c, i) => {
        const r = pv!.addRow([
          i === 0 ? field : '',
          typeof c.value === 'number' ? c.value : String(c.value).substring(0, 40),
          c.docClass + (c.derived ? ' (derived)' : ''),
          c.authority,
          c.docDate ?? '',
          c.confidence,
          c.filename,
          String(c.quote ?? '').substring(0, 160),
        ]);
        if (i === 0) {
          fillCell(r.getCell(1), GOOD); r.getCell(1).font = { bold: true, color: { argb: WHITE } };
          fillCell(r.getCell(2), 'FFE8F3E9');
        } else {
          r.font = { color: { argb: 'FF8A8A8A' }, strike: true };
        }
        if (typeof c.value === 'number' && Math.abs(c.value) >= 1000) r.getCell(2).numFmt = MONEY;
        wrapCol(pv!, [7, 8], r.number, r.number);
      });
    }
    boxTable(pv, first, pv.rowCount, 8, false);
    pv.views = [{ state: 'frozen', ySplit: ph.number }];

    // Conflicts: the most valuable rows in the workbook
    const conflicts = deal.extracted.conflicts ?? [];
    if (conflicts.length) {
      pv.addRow([]);
      const ch = pv.addRow(['SOURCE DISAGREEMENTS REQUIRING HUMAN ADJUDICATION']);
      bandRow(pv, ch.number, 8, BAD);
      for (const c of conflicts) {
        const r = pv.addRow([c.severity.toUpperCase(), c.field, `${c.spreadPct ?? ''}% spread`, '', '', '', c.message, c.claims.map(x => `${x.value} (${x.docClass})`).join('  vs  ')]);
        fillCell(r.getCell(1), c.severity === 'material' ? BAD : WARN);
        r.getCell(1).font = { bold: true, color: { argb: WHITE } };
        wrapCol(pv, [7, 8], r.number, r.number);
      }
    }
  }

  // ==========================================================================
  // AUDIT
  // ==========================================================================
  const au = wb.addWorksheet('Audit');
  au.columns = [{ width: 22 }, { width: 8 }, { width: 62 }, { width: 46 }];
  const wrapCols = (rowNum: number, cols: number[]) => {
    for (const c of cols) au.getRow(rowNum).getCell(c).alignment = { wrapText: true, vertical: 'top' };
  };
  const ab1 = au.addRow(['SOURCES']); bandRow(au, ab1.number, 4);
  for (const s of deal.sources) {
    const r = au.addRow([s.id, '', s.filename ?? '', s.kind]);
    wrapCols(r.number, [3]);
  }
  const ab2 = au.addRow(['STRUCTURE FLAGS', 'Conf', 'Flag and detail (full text)', 'Evidence quote']); bandRow(au, ab2.number, 4);
  for (const n of notes.filter(n => n.field === 'structureFlag')) {
    const severity = (n.extractedValue.match(/^([A-Z]+):/) ?? [])[1] ?? '';
    // Full text, never truncated; wrapping handles length
    const r = au.addRow([severity, n.confidence.toFixed(2), n.extractedValue.replace(/^[A-Z]+:\s*/, ''), (n.rawText ?? '').replace(/^"|"$/g, '')]);
    wrapCols(r.number, [3, 4]);
    if (severity === 'SERIOUS') { fillCell(r.getCell(1), BAD); r.getCell(1).font = { bold: true, color: { argb: WHITE } }; }
    else if (severity === 'CAUTION') { fillCell(r.getCell(1), WARN); r.getCell(1).font = { bold: true, color: { argb: WHITE } }; }
  }
  const ab3 = au.addRow(['AUDIT LOG (last 50)']); bandRow(au, ab3.number, 4);
  for (const entry of deal.auditLog.slice(-50)) {
    const r = au.addRow([entry.timestamp, '', entry.action, JSON.stringify(entry.details).substring(0, 300)]);
    wrapCols(r.number, [4]);
  }
  boxTable(au, 2, au.rowCount, 4, false);

  // Order + tabs
  ex.orderNo = 0; as.orderNo = 1; su.orderNo = 2; dz.orderNo = 3; pf.orderNo = 4;
  st.orderNo = 5; sn.orderNo = 6; sc.orderNo = 7; mc.orderNo = 8;
  if (ob) ob.orderNo = 9;
  if (pv) pv.orderNo = 10;
  au.orderNo = 11;
  const tab = (ws: Ws, argb: string) => (ws.properties.tabColor = { argb });
  tab(ex, NAVY_DARK); tab(as, WARN); tab(su, NAVY); tab(dz, NAVY_DARK); tab(pf, NAVY);
  tab(st, NAVY); tab(sn, 'FF8A8A8A'); tab(sc, GOOD); tab(mc, WARN); tab(au, 'FF8A8A8A');
  if (ob) tab(ob, BAD);
  if (pv) tab(pv, GOOD);

  const outPath = path.join(outDir, 'package.xlsx');
  await wb.xlsx.writeFile(outPath);
  return outPath;
}
