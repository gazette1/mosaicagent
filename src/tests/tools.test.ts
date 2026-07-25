/**
 * Tool unit tests: each tool alone, fixtures only, no model in the loop.
 * "Most agent bugs are tool bugs wearing a costume."
 */

import { test } from 'node:test';
import * as assert from 'node:assert';
import { parseNumber, matchColumn, parseCSVContent } from '../ingest/parsers';
import { extractFromText } from '../ingest/text-parser';
import { getMarketConfig, getBridgeRate } from '../core/market-config';
import { ASSET_TYPE_CRITERIA, getMarketRateProxy, SOURCE_PRIORITY } from '../core/doctrine';

// ============================================================================
// parseNumber
// ============================================================================

test('parseNumber: currency strings', () => {
  assert.strictEqual(parseNumber('$1,250,000'), 1250000);
  assert.strictEqual(parseNumber('(100)'), -100);
  assert.strictEqual(parseNumber('7.5%'), 0.075);
  assert.strictEqual(parseNumber(''), null);
  assert.strictEqual(parseNumber(null), null);
});

test('parseNumber: non-string values do not crash (PapaParse __parsed_extra)', () => {
  assert.strictEqual(parseNumber(['a', 'b'] as unknown as string), null);
  assert.strictEqual(parseNumber({} as unknown as string), null);
  assert.strictEqual(parseNumber(42), 42);
});

test('parseCSVContent: ragged rows do not crash', () => {
  const csv = 'a,b\n1,2,3,4\n5,6';
  const result = parseCSVContent(csv);
  assert.strictEqual(result.rows.length, 2);
  assert.ok(!('__parsed_extra' in result.rows[0]));
});

// ============================================================================
// extractFromText
// ============================================================================

test('extract: MM multiplier applies from full match context', () => {
  const r = extractFromText('The asking price is $18.4MM for the property.', 's1');
  assert.strictEqual(r.extractedValues['askingPrice']?.value, 18400000);
});

test('extract: full-figure prices parse', () => {
  const r = extractFromText('Asking Price: $4,250,000', 's1');
  assert.strictEqual(r.extractedValues['askingPrice']?.value, 4250000);
});

test('extract: sanity range discards year-as-occupancy collisions', () => {
  const r = extractFromText('occupied through 2021', 's1');
  assert.strictEqual(r.extractedValues['occupancy'], undefined);
});

test('extract: hotel fields (keys, ADR, RevPAR, occupancy)', () => {
  const r = extractFromText(
    '150-key oceanfront hotel. Current ADR: $118. RevPAR: $61. Occupancy (Trailing 12): 52%',
    's1'
  );
  assert.strictEqual(r.extractedValues['keys']?.value, 150);
  assert.strictEqual(r.extractedValues['adr']?.value, 118);
  assert.strictEqual(r.extractedValues['revpar']?.value, 61);
  assert.strictEqual(r.extractedValues['occupancy']?.value, 0.52);
});

// ============================================================================
// Column matching
// ============================================================================

test('matchColumn: fuzzy aliases', () => {
  assert.ok(matchColumn('Unit #', 'unit'));
  assert.ok(matchColumn('Sq Ft', 'sqft'));
  assert.ok(matchColumn('Base Rent', 'monthly_rent'));
  assert.ok(!matchColumn('Tenant Name', 'sqft'));
});

// ============================================================================
// Market config / doctrine
// ============================================================================

test('market config: rate is index + spread, never hardcoded', () => {
  const c = getMarketConfig();
  assert.ok(c.indexRate > 0 && c.indexRate < 0.15);
  assert.ok(c.bridgeSpreadBps >= 100 && c.bridgeSpreadBps <= 1000);
  assert.ok(Math.abs(getBridgeRate() - (c.indexRate + c.bridgeSpreadBps / 10000)) < 1e-9);
  assert.strictEqual(getMarketRateProxy(), getBridgeRate());
});

test('doctrine: hotel asset criteria exist', () => {
  const h = ASSET_TYPE_CRITERIA['hotel'];
  assert.ok(h);
  assert.ok(h.defaultExpenseRatio > 0.5 && h.defaultExpenseRatio < 0.75);
});

// ============================================================================
// Debt math
// ============================================================================

import { loanConstant, annualDebtService, sizeLoanToDscr } from '../core/debt-math';

test('debt math: loan constant and debt service', () => {
  // 6.5% 30-year: constant ~7.58%
  const c = loanConstant(0.065, 30);
  assert.ok(c > 0.0755 && c < 0.0762, `constant ${c}`);
  // IO debt service
  assert.strictEqual(annualDebtService(18400000, 0.093, null), 18400000 * 0.093);
  // Amortizing exceeds IO at same rate
  assert.ok(annualDebtService(18400000, 0.093, 30) > 18400000 * 0.093);
  // Sizing round-trips: loan sized to 1.30x produces DSCR 1.30x
  const loan = sizeLoanToDscr(2843000, 1.3, 0.065, 30);
  const dscr = 2843000 / annualDebtService(loan, 0.065, 30);
  assert.ok(Math.abs(dscr - 1.3) < 0.001, `dscr ${dscr}`);
});

test('doctrine: source priority ranks statements above marketing', () => {
  assert.ok(SOURCE_PRIORITY['t12_csv'] < SOURCE_PRIORITY['om_text']);
  assert.ok(SOURCE_PRIORITY['xlsx_model'] < SOURCE_PRIORITY['email']);
  assert.ok(SOURCE_PRIORITY['pdf'] <= SOURCE_PRIORITY['email']);
});
