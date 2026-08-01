/**
 * Core Schemas for Mosaic Underwriting
 * All data structures with confidence tracking and source references
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export const AssetTypeSchema = z.enum(['industrial', 'retail', 'multifamily', 'hotel', 'lihtc', 'other']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const SourceKindSchema = z.enum(['email', 'om_text', 'rentroll_csv', 't12_csv', 'pdf', 'xlsx_model', 'image', 'docx', 'doc', 'pptx', 'manual', 'computed']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const VerdictSchema = z.enum(['KILL', 'CHASE', 'STRUCTURE', 'DELEGATE']);
export type Verdict = z.infer<typeof VerdictSchema>;

// ============================================================================
// Source Tracking
// ============================================================================

export const SourceSchema = z.object({
  id: z.string(),
  kind: SourceKindSchema,
  filename: z.string().optional(),
  importedAt: z.string(), // ISO datetime
  rawContent: z.string().optional(), // Store original for audit
  notes: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

// ============================================================================
// Confidence-Tracked Value
// A wrapper for any value that needs audit trail
// ============================================================================

export const TrackedValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    unit: z.string().optional(),
    sourceId: z.string().optional(),
    confidence: z.number().min(0).max(1),
    rationale: z.string().optional(),
    formula: z.string().optional(),
    inputsUsed: z.array(z.string()).optional(),
    isProxy: z.boolean().optional(),
    proxyMethod: z.string().optional(),
  });

export const TrackedNumberSchema = TrackedValueSchema(z.number());
export type TrackedNumber = z.infer<typeof TrackedNumberSchema>;

export const TrackedStringSchema = TrackedValueSchema(z.string());
export type TrackedString = z.infer<typeof TrackedStringSchema>;

export const TrackedBooleanSchema = TrackedValueSchema(z.boolean());
export type TrackedBoolean = z.infer<typeof TrackedBooleanSchema>;

// ============================================================================
// Rent Roll
// ============================================================================

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  unit: z.string().optional(),
  squareFeet: TrackedNumberSchema.optional(),
  monthlyRent: TrackedNumberSchema.optional(),
  annualRent: TrackedNumberSchema.optional(),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  isVacant: z.boolean().optional(),
  isMonthToMonth: z.boolean().optional(),
  rentPerSF: TrackedNumberSchema.optional(),
  notes: z.string().optional(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const RentRollSchema = z.object({
  sourceId: z.string(),
  asOfDate: z.string().optional(),
  tenants: z.array(TenantSchema),
  totalUnits: TrackedNumberSchema.optional(),
  occupiedUnits: TrackedNumberSchema.optional(),
  vacantUnits: TrackedNumberSchema.optional(),
  occupancyRate: TrackedNumberSchema.optional(),
  totalSF: TrackedNumberSchema.optional(),
  grossPotentialRent: TrackedNumberSchema.optional(),
  effectiveGrossRent: TrackedNumberSchema.optional(),
  avgRentPerUnit: TrackedNumberSchema.optional(),
  avgRentPerSF: TrackedNumberSchema.optional(),
});
export type RentRoll = z.infer<typeof RentRollSchema>;

// ============================================================================
// T12 (Trailing 12 Month Operating Statement)
// ============================================================================

export const T12LineItemSchema = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  annual: TrackedNumberSchema,
  monthly: TrackedNumberSchema.optional(),
  perUnit: TrackedNumberSchema.optional(),
  perSF: TrackedNumberSchema.optional(),
  notes: z.string().optional(),
});
export type T12LineItem = z.infer<typeof T12LineItemSchema>;

export const T12Schema = z.object({
  sourceId: z.string(),
  periodEnd: z.string().optional(),
  revenue: z.array(T12LineItemSchema),
  expenses: z.array(T12LineItemSchema),
  grossRevenue: TrackedNumberSchema.optional(),
  effectiveGrossIncome: TrackedNumberSchema.optional(),
  totalExpenses: TrackedNumberSchema.optional(),
  noi: TrackedNumberSchema.optional(),
  expenseRatio: TrackedNumberSchema.optional(),
});
export type T12 = z.infer<typeof T12Schema>;

// ============================================================================
// Hotel Metrics (hospitality assets underwrite off keys x occupancy x ADR,
// not rent rolls)
// ============================================================================

export const HotelMetricsSchema = z.object({
  sourceId: z.string(),
  periodLabel: z.string().optional(), // e.g. 'T12', 'Y3 stabilized pro forma'
  keys: TrackedNumberSchema.optional(),
  occupancy: TrackedNumberSchema.optional(), // decimal
  adr: TrackedNumberSchema.optional(), // USD
  revpar: TrackedNumberSchema.optional(), // USD; occupancy x ADR when computed
  roomsRevenue: TrackedNumberSchema.optional(),
  ancillaryRevenue: TrackedNumberSchema.optional(), // F&B, parking, resort fees
  totalRevenue: TrackedNumberSchema.optional(),
  operatingExpenses: TrackedNumberSchema.optional(),
  noi: TrackedNumberSchema.optional(),
  pipBudget: TrackedNumberSchema.optional(),
});
export type HotelMetrics = z.infer<typeof HotelMetricsSchema>;

// ============================================================================
// Claims ledger: every extracted value with document provenance, so the
// resolver can rank by authority and date rather than arrival order.
// ============================================================================

export const ClaimSchema = z.object({
  field: z.string(),
  value: z.union([z.number(), z.string()]),
  confidence: z.number(),
  quote: z.string(),
  sourceId: z.string(),
  filename: z.string(),
  docClass: z.string(),
  authority: z.number(),
  docDate: z.string().nullable(),
  amendmentRank: z.number(),
  extractor: z.enum(['deterministic', 'llm', 'ocr', 'manual']),
  derived: z.boolean().optional(),
});
export type ClaimRecord = z.infer<typeof ClaimSchema>;

export const ConflictSchema = z.object({
  field: z.string(),
  severity: z.enum(['material', 'minor']),
  spreadPct: z.number().nullable(),
  message: z.string(),
  claims: z.array(z.object({
    value: z.union([z.number(), z.string()]),
    filename: z.string(),
    docClass: z.string(),
    authority: z.number(),
    docDate: z.string().nullable(),
  })),
});
export type ConflictRecord = z.infer<typeof ConflictSchema>;

// ============================================================================
// Extracted Notes (from emails, OMs)
// ============================================================================

export const ExtractedNoteSchema = z.object({
  sourceId: z.string(),
  field: z.string(),
  extractedValue: z.string(),
  confidence: z.number().min(0).max(1),
  rawText: z.string().optional(),
});
export type ExtractedNote = z.infer<typeof ExtractedNoteSchema>;

// ============================================================================
// Assumptions
// ============================================================================

export const AssumptionsSchema = z.object({
  entryCap: TrackedNumberSchema.optional(),
  exitCap: TrackedNumberSchema.optional(),
  interestRate: TrackedNumberSchema.optional(),
  loanTermYears: TrackedNumberSchema.optional(),
  amortizationYears: TrackedNumberSchema.optional(),
  ltv: TrackedNumberSchema.optional(),
  noiHaircut: TrackedNumberSchema.optional(),
  vacancyShock: TrackedNumberSchema.optional(),
  capexTotal: TrackedNumberSchema.optional(),
  capexPerUnit: TrackedNumberSchema.optional(),
  capexPerSF: TrackedNumberSchema.optional(),
  holdPeriodYears: TrackedNumberSchema.optional(),
  managementFee: TrackedNumberSchema.optional(),
  replacementReserves: TrackedNumberSchema.optional(),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

// ============================================================================
// Kill Flags
// ============================================================================

export const KillFlagSchema = z.object({
  criterion: z.string(),
  triggered: z.boolean(),
  reason: z.string(),
  severity: z.enum(['hard', 'soft']),
  dataNeededToOverturn: z.string().optional(),
  sourceRefs: z.array(z.string()).optional(),
});
export type KillFlag = z.infer<typeof KillFlagSchema>;

// ============================================================================
// Screen Output
// ============================================================================

export const KeyMetricSchema = z.object({
  name: z.string(),
  value: TrackedNumberSchema,
  benchmark: z.string().optional(),
  assessment: z.enum(['good', 'acceptable', 'concerning', 'critical', 'unknown']).optional(),
});
export type KeyMetric = z.infer<typeof KeyMetricSchema>;

export const ScreenOutputSchema = z.object({
  verdict: VerdictSchema,
  riskScore: z.number().min(1).max(5),
  riskScoreRationale: z.string(),
  killFlags: z.array(KillFlagSchema),
  keyMetrics: z.record(z.string(), KeyMetricSchema),
  confidenceSummary: z.object({
    overall: z.number().min(0).max(1),
    byCategory: z.record(z.string(), z.number()),
    criticalGaps: z.array(z.string()),
    dataRequests: z.array(z.string()),
  }),
  adaptiveAdjustments: z.array(z.string()).optional(),
  executedAt: z.string(),
});
export type ScreenOutput = z.infer<typeof ScreenOutputSchema>;

// ============================================================================
// Deep Dive Output
// ============================================================================

export const CashflowYearSchema = z.object({
  year: z.number(),
  noi: TrackedNumberSchema,
  debtService: TrackedNumberSchema.optional(),
  cashFlowBeforeDebt: TrackedNumberSchema.optional(),
  cashFlowAfterDebt: TrackedNumberSchema.optional(),
  dscr: TrackedNumberSchema.optional(),
});
export type CashflowYear = z.infer<typeof CashflowYearSchema>;

export const DebtSizingSchema = z.object({
  loanAmount: TrackedNumberSchema,
  ltv: TrackedNumberSchema,
  interestRate: TrackedNumberSchema,
  annualDebtService: TrackedNumberSchema,
  dscr: TrackedNumberSchema,
  isProxy: z.boolean(),
  proxyNotes: z.string().optional(),
});
export type DebtSizing = z.infer<typeof DebtSizingSchema>;

export const ReturnsSchema = z.object({
  unleveredIRR: TrackedNumberSchema.optional(),
  leveredIRR: TrackedNumberSchema.optional(),
  equityMultiple: TrackedNumberSchema.optional(),
  cashOnCash: TrackedNumberSchema.optional(),
  totalProfit: TrackedNumberSchema.optional(),
});
export type Returns = z.infer<typeof ReturnsSchema>;

export const SensitivityCellSchema = z.object({
  rowVar: z.string(),
  rowValue: z.number(),
  colVar: z.string(),
  colValue: z.number(),
  resultMetric: z.string(),
  resultValue: z.number(),
});
export type SensitivityCell = z.infer<typeof SensitivityCellSchema>;

export const StrategyOptionSchema = z.object({
  name: z.string(),
  description: z.string(),
  businessPlan: z.array(z.string()),
  targetHold: z.string(),
  exitStrategy: z.string(),
  keyRisks: z.array(z.string()),
  keyMitigants: z.array(z.string()),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
});
export type StrategyOption = z.infer<typeof StrategyOptionSchema>;

export const DiligenceItemSchema = z.object({
  category: z.string(),
  item: z.string(),
  priority: z.enum(['critical', 'important', 'standard']),
  status: z.enum(['pending', 'in_progress', 'complete', 'blocked']),
  notes: z.string().optional(),
});
export type DiligenceItem = z.infer<typeof DiligenceItemSchema>;

export const DeepDiveOutputSchema = z.object({
  thesis: z.string(),
  cashflows: z.array(CashflowYearSchema),
  exitValue: TrackedNumberSchema.optional(),
  debtSizing: DebtSizingSchema.optional(),
  returns: ReturnsSchema.optional(),
  sensitivities: z.array(SensitivityCellSchema),
  strategyOptions: z.array(StrategyOptionSchema),
  diligenceChecklist: z.array(DiligenceItemSchema),
  keyRisks: z.array(z.object({
    risk: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    mitigant: z.string().optional(),
  })),
  executedAt: z.string(),
});
export type DeepDiveOutput = z.infer<typeof DeepDiveOutputSchema>;

// ============================================================================
// Audit Log
// ============================================================================

export const AuditLogEntrySchema = z.object({
  timestamp: z.string(),
  action: z.string(),
  details: z.record(z.string(), z.unknown()),
  sourceId: z.string().optional(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ============================================================================
// Main Deal Schema
// ============================================================================

export const DealSchema = z.object({
  dealId: z.string(),
  name: z.string(),
  assetType: AssetTypeSchema,
  location: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    market: z.string().optional(),
    submarket: z.string().optional(),
  }).optional(),
  askingPrice: TrackedNumberSchema.optional(),
  totalUnits: TrackedNumberSchema.optional(),
  totalSF: TrackedNumberSchema.optional(),
  yearBuilt: TrackedNumberSchema.optional(),
  sources: z.array(SourceSchema),
  extracted: z.object({
    rentRoll: RentRollSchema.optional(),
    t12: T12Schema.optional(),
    hotel: HotelMetricsSchema.optional(),
    notes: z.array(ExtractedNoteSchema),
    /** Every claim ever made about this deal, with provenance. Append-only. */
    claims: z.array(ClaimSchema).optional(),
    /** Field-level disagreements between sources, for human adjudication. */
    conflicts: z.array(ConflictSchema).optional(),
    /** Injection attempts found in supplied documents. */
    injections: z.array(z.object({
      sourceId: z.string(), filename: z.string(), pattern: z.string(), excerpt: z.string(),
    })).optional(),
  }),
  assumptions: AssumptionsSchema,
  underwriting: z.object({
    screen: ScreenOutputSchema.optional(),
    deepdive: DeepDiveOutputSchema.optional(),
  }),
  auditLog: z.array(AuditLogEntrySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Deal = z.infer<typeof DealSchema>;

// ============================================================================
// Helper to create empty deal
// ============================================================================

export function createEmptyDeal(dealId: string, name: string, assetType: AssetType): Deal {
  const now = new Date().toISOString();
  return {
    dealId,
    name,
    assetType,
    sources: [],
    extracted: {
      notes: [],
    },
    assumptions: {},
    underwriting: {},
    auditLog: [{
      timestamp: now,
      action: 'DEAL_CREATED',
      details: { name, assetType },
    }],
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Helper to create tracked value
// ============================================================================

export function tracked(
  value: number,
  confidence: number,
  options: Partial<Omit<TrackedNumber, 'value' | 'confidence'>> = {}
): TrackedNumber {
  return {
    value,
    confidence,
    ...options,
  };
}
