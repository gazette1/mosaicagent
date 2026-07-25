/**
 * Market Config
 * Debt pricing is market-indexed (index + spread), never hardcoded.
 * config/market.json is the single place rates live; refresh before routing
 * any package. Falls back to conservative defaults if the file is missing.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MarketConfig {
  asOf: string;
  index: string;
  indexRate: number; // decimal, e.g. 0.053
  bridgeSpreadBps: number; // e.g. 400
  bridgeSpreadRangeBps: [number, number];
  permRate: number;
  notes?: string;
}

const FALLBACK: MarketConfig = {
  asOf: 'fallback',
  index: 'SOFR',
  indexRate: 0.053,
  bridgeSpreadBps: 400,
  bridgeSpreadRangeBps: [350, 450],
  permRate: 0.065,
  notes: 'Fallback defaults; config/market.json not found',
};

let cached: MarketConfig | null = null;

export function getMarketConfig(): MarketConfig {
  if (cached) return cached;
  const candidates = [
    path.join(process.cwd(), 'config', 'market.json'),
    path.join(__dirname, '..', '..', 'config', 'market.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cached = { ...FALLBACK, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
        return cached!;
      }
    } catch {
      // fall through to fallback
    }
  }
  cached = FALLBACK;
  return cached;
}

/** All-in bridge rate: index + spread */
export function getBridgeRate(): number {
  const c = getMarketConfig();
  return c.indexRate + c.bridgeSpreadBps / 10000;
}

export function getPermRate(): number {
  return getMarketConfig().permRate;
}

export function describeBridgePricing(): string {
  const c = getMarketConfig();
  return `${c.index} ${(c.indexRate * 100).toFixed(2)}% + ${c.bridgeSpreadBps}bps = ${(getBridgeRate() * 100).toFixed(2)}% (as of ${c.asOf})`;
}
