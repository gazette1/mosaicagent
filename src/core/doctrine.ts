/**
 * Mosaic Investment Doctrine
 * Encodes the growth-phase acquisition strategy and underwriting rules
 */

import { AssetType } from './schemas';
import { getBridgeRate, getMarketConfig } from './market-config';

// ============================================================================
// Wedge Assets (Day 1 Focus)
// ============================================================================

export const WEDGE_ASSET_TYPES: AssetType[] = ['industrial', 'retail', 'multifamily'];

export const ASSET_TYPE_CRITERIA: Record<AssetType, {
  description: string;
  unitRange?: { min: number; max: number };
  idealProfile: string[];
  redFlags: string[];
  defaultCaps: { entry: number; exit: number };
  defaultVacancy: number;
  defaultExpenseRatio: number;
}> = {
  industrial: {
    description: 'Industrial flex',
    idealProfile: [
      'Multi-tenant flex/light industrial',
      'Strong infill location',
      'Below-market rents with upside',
      'Minimal deferred maintenance',
    ],
    redFlags: [
      'Single-tenant dependency',
      'Environmental concerns',
      'Specialized use limiting tenant pool',
      'Excess land carrying cost',
    ],
    defaultCaps: { entry: 0.065, exit: 0.072 },
    defaultVacancy: 0.10,
    defaultExpenseRatio: 0.30,
  },
  retail: {
    description: 'Neighborhood retail (NNN-ish)',
    idealProfile: [
      'Necessity-based tenants',
      'Dense infill trade area',
      'NNN or modified gross leases',
      'Limited landlord responsibilities',
    ],
    redFlags: [
      'Anchor tenant > 40% of revenue',
      'Fashion/discretionary tenant mix',
      'Co-tenancy clauses',
      'Percentage rent dependency',
    ],
    defaultCaps: { entry: 0.070, exit: 0.077 },
    defaultVacancy: 0.08,
    defaultExpenseRatio: 0.25,
  },
  multifamily: {
    description: 'Small multifamily (10-75 units)',
    unitRange: { min: 10, max: 75 },
    idealProfile: [
      'Value-add potential (rents below market)',
      'Stable occupancy history',
      'Unit mix appropriate for market',
      'Limited deferred maintenance',
    ],
    redFlags: [
      'Rent control exposure',
      'High turnover history',
      'Significant deferred maintenance',
      'Problem tenant concentration',
    ],
    defaultCaps: { entry: 0.055, exit: 0.062 },
    defaultVacancy: 0.07,
    defaultExpenseRatio: 0.45,
  },
  hotel: {
    description: 'Hospitality (keys x occupancy x ADR, not rent rolls)',
    idealProfile: [
      'Branded or brand-convertible (franchise support, key money potential)',
      'Irreplaceable location (oceanfront, CBD, airport)',
      'Below-market basis vs appraisal or replacement cost',
      'Clear bridge-to-perm or condo-conversion exit',
    ],
    redFlags: [
      'Unflagged independent with no conversion path',
      'PIP scope unpriced or > 40% of basis',
      'Single-season market with < 50% annual occupancy',
      'Deferred maintenance on life-safety systems',
    ],
    defaultCaps: { entry: 0.085, exit: 0.0925 },
    defaultVacancy: 0.30, // 1 - stabilized occupancy ~70%
    defaultExpenseRatio: 0.62, // full-service departmental expense load
  },
  lihtc: {
    description: 'LIHTC affordable housing (Section 42)',
    idealProfile: [
      'Credits placed and stabilized, or clean 9%/4% allocation path',
      'HAP contract or deep waiting list supporting occupancy',
      'Experienced LIHTC sponsor with compliance track record',
      'Clear Year-15 strategy (resyndication, qualified contract, preservation buyer)',
    ],
    redFlags: [
      'Compliance-period recapture risk (Section 42 violations)',
      'Expiring LURA or unclear Year-15 exit',
      'Deferred developer fee dependency in the cash flow',
      'Thin DSCR against restricted rents with rising opex',
    ],
    defaultCaps: { entry: 0.0575, exit: 0.065 },
    defaultVacancy: 0.04, // waitlist-backed occupancy runs high
    defaultExpenseRatio: 0.52, // compliance and regulatory load on top of ops
  },
  other: {
    description: 'Non-core asset type',
    idealProfile: ['Evaluate on case-by-case basis'],
    redFlags: ['Outside core competency'],
    defaultCaps: { entry: 0.075, exit: 0.085 },
    defaultVacancy: 0.12,
    defaultExpenseRatio: 0.40,
  },
};

// ============================================================================
// Strategy Options
// ============================================================================

export const STRATEGY_OPTIONS = {
  OPERATE_REFI: {
    name: 'Operate → Refinance',
    description: 'Stabilize, push rents, refinance to return capital',
    targetHold: '3-5 years',
    exitStrategy: 'Cash-out refinance, continue to hold',
  },
  OPERATE_SELL: {
    name: 'Operate → Sell',
    description: 'Stabilize, push rents, sell to institutional buyer',
    targetHold: '3-5 years',
    exitStrategy: 'Sale to private or institutional buyer',
  },
  LIGHT_REPOSITION: {
    name: 'Light Reposition → Recap',
    description: 'Minor improvements, remerchandise, bring in partner',
    targetHold: '2-4 years',
    exitStrategy: 'Recapitalization or sale',
  },
};

// ============================================================================
// Kill Criteria
// ============================================================================

export interface KillCriterion {
  id: string;
  name: string;
  description: string;
  severity: 'hard' | 'soft';
  check: (metrics: Record<string, number | undefined>) => { triggered: boolean; reason: string };
  dataNeededToOverturn: string;
}

export const KILL_CRITERIA: KillCriterion[] = [
  {
    id: 'DSCR_TOO_LOW',
    name: 'No Margin for Error',
    description: 'DSCR < 1.15x at realistic debt terms',
    severity: 'hard',
    check: (metrics) => {
      const dscr = metrics['stressedDscr'];
      if (dscr === undefined) {
        return { triggered: false, reason: 'DSCR not calculable - insufficient data' };
      }
      return {
        triggered: dscr < 1.15,
        reason: dscr < 1.15 
          ? `Stressed DSCR of ${dscr.toFixed(2)}x provides insufficient debt coverage cushion`
          : `Stressed DSCR of ${dscr.toFixed(2)}x meets minimum threshold`,
      };
    },
    dataNeededToOverturn: 'Verified NOI with audited financials, or confirmed lower-rate financing',
  },
  {
    id: 'SINGLE_POINT_FAILURE',
    name: 'Single-Point Failure Risk',
    description: 'Single tenant/revenue source represents >50% of income',
    severity: 'hard',
    check: (metrics) => {
      const largestTenantPct = metrics['largestTenantPct'];
      if (largestTenantPct === undefined) {
        return { triggered: false, reason: 'Tenant concentration not calculable' };
      }
      return {
        triggered: largestTenantPct > 0.50,
        reason: largestTenantPct > 0.50
          ? `Largest tenant represents ${(largestTenantPct * 100).toFixed(0)}% of revenue - binary risk`
          : `Largest tenant at ${(largestTenantPct * 100).toFixed(0)}% - acceptable concentration`,
      };
    },
    dataNeededToOverturn: 'Credit analysis of major tenant, lease term review, replacement tenant market study',
  },
  {
    id: 'UNCLEAR_INCOME',
    name: 'Unclear/Unverifiable Income',
    description: 'Cannot verify income with reasonable confidence',
    severity: 'hard',
    check: (metrics) => {
      const noiConfidence = metrics['noiConfidence'];
      if (noiConfidence === undefined) {
        return { triggered: true, reason: 'No NOI data available' };
      }
      return {
        triggered: noiConfidence < 0.5,
        reason: noiConfidence < 0.5
          ? `NOI confidence of ${(noiConfidence * 100).toFixed(0)}% too low to underwrite`
          : `NOI confidence of ${(noiConfidence * 100).toFixed(0)}% - acceptable`,
      };
    },
    dataNeededToOverturn: 'T12 operating statement, bank statements, rent roll with lease abstracts',
  },
  {
    id: 'CAPEX_UNQUANTIFIABLE',
    name: 'CapEx Cannot Be Priced',
    description: 'Capital requirements unclear or highly uncertain',
    severity: 'soft',
    check: (metrics) => {
      const capexConfidence = metrics['capexConfidence'];
      if (capexConfidence === undefined) {
        return { triggered: true, reason: 'No CapEx estimate available' };
      }
      return {
        triggered: capexConfidence < 0.4,
        reason: capexConfidence < 0.4
          ? `CapEx confidence of ${(capexConfidence * 100).toFixed(0)}% creates unquantifiable risk`
          : `CapEx confidence of ${(capexConfidence * 100).toFixed(0)}% - acceptable`,
      };
    },
    dataNeededToOverturn: 'Property condition report, contractor estimates, reserve schedule',
  },
  {
    id: 'CAP_RATE_COMPRESSION_REQUIRED',
    name: 'Exit Depends on Cap Rate Compression',
    description: 'Returns require exit cap below entry cap',
    severity: 'hard',
    check: (metrics) => {
      const entryCap = metrics['entryCap'];
      const exitCap = metrics['exitCap'];
      if (entryCap === undefined || exitCap === undefined) {
        return { triggered: false, reason: 'Cannot assess cap rate relationship' };
      }
      return {
        triggered: exitCap < entryCap,
        reason: exitCap < entryCap
          ? `Exit cap (${(exitCap * 100).toFixed(1)}%) below entry (${(entryCap * 100).toFixed(1)}%) - speculative`
          : `Exit cap (${(exitCap * 100).toFixed(1)}%) appropriately stressed vs entry (${(entryCap * 100).toFixed(1)}%)`,
      };
    },
    dataNeededToOverturn: 'Compelling NOI growth story with verified rent comps and lease-up plan',
  },
];

// ============================================================================
// Default Stress Assumptions
// ============================================================================

export const DEFAULT_STRESSES = {
  exitCapSpread: 0.0075, // +75 bps vs entry
  interestRateStress: 0.0175, // +150-200 bps, use midpoint
  noiHaircut: 0.10, // -10%
  vacancyShock: 0.05, // +5%
  conservativeLtv: 0.60, // 60% LTV for debt sizing
  baseInterestRate: 0.075, // 7.5% base rate assumption
};

// Adaptive adjustments when data quality is low
export const ADAPTIVE_ADJUSTMENTS = {
  lowConfidenceThreshold: 0.6,
  noiHaircutAdditional: 0.05, // +5% when low confidence
  exitCapAdditional: 0.0025, // +25 bps
  interestRateAdditional: 0.005, // +50 bps
  riskScoreAdjustment: 1, // Worsen by 1 notch
};

// ============================================================================
// Risk Score Scale
// ============================================================================

export const RISK_SCORE_DESCRIPTIONS: Record<number, { label: string; description: string }> = {
  1: {
    label: 'Asymmetric Upside / Protected Downside',
    description: 'Exceptional risk-adjusted opportunity with multiple paths to success',
  },
  2: {
    label: 'Acceptable Risk / Clear Mitigants',
    description: 'Standard deal with well-understood risks and clear mitigation strategies',
  },
  3: {
    label: 'Execution-Dependent',
    description: 'Default growth zone - success depends on execution quality',
  },
  4: {
    label: 'Speculative / Requires Edge',
    description: 'Requires special expertise, partner, or information advantage',
  },
  5: {
    label: 'Binary / Avoid',
    description: 'Unacceptable risk profile - too many ways to lose',
  },
};

// ============================================================================
// Source Priority (for conflict resolution)
// ============================================================================

export const SOURCE_PRIORITY: Record<string, number> = {
  't12_csv': 1, // Primary financial statements
  'rentroll_csv': 2, // Rent roll
  'xlsx_model': 3, // Sponsor model workbook
  'om_text': 4, // Offering memorandum
  'pdf': 4, // PDF documents (OM/appraisal/memo tier)
  'docx': 4, // Word memos and packages (same tier)
  'image': 4, // Image documents via OCR/vision (same trust tier as PDF)
  'email': 5, // Broker email
  'manual': 6, // Manual entry
  'computed': 7, // Calculated value
};

export function getSourcePriority(kind: string): number {
  return SOURCE_PRIORITY[kind] ?? 10;
}

// ============================================================================
// Execution Drag Red Flags
// ============================================================================

export const EXECUTION_DRAG_FLAGS = [
  'Significant deferred maintenance',
  'Active litigation',
  'Environmental remediation needed',
  'Zoning non-conformity',
  'Rent control jurisdiction',
  'Complex tenant situations',
  'Title issues',
  'Survey discrepancies',
  'Permit or certificate of occupancy issues',
  'Union labor requirements',
];

// ============================================================================
// Market Rate Proxies
// ============================================================================

export function getMarketRateProxy(): number {
  // Market-indexed: index + bridge spread from config/market.json.
  // Never a hardcoded number; refresh the config before routing packages.
  return getBridgeRate();
}

export function getStressedRate(): number {
  return getMarketRateProxy() + DEFAULT_STRESSES.interestRateStress;
}

export function describeMarketRate(): string {
  const c = getMarketConfig();
  return `${c.index} + ${c.bridgeSpreadBps}bps (as of ${c.asOf})`;
}
