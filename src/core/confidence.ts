/**
 * Confidence Scoring System
 * Calculates and aggregates confidence levels across the deal
 */

import { Deal, TrackedNumber, SourceKind } from './schemas';
import { getSourcePriority } from './doctrine';

// ============================================================================
// Confidence Categories
// ============================================================================

export interface ConfidenceAssessment {
  overall: number;
  byCategory: Record<string, number>;
  criticalGaps: string[];
  dataRequests: string[];
}

// ============================================================================
// Weight factors for different data categories
// ============================================================================

const CATEGORY_WEIGHTS: Record<string, number> = {
  pricing: 0.20,
  income: 0.30,
  expenses: 0.15,
  occupancy: 0.15,
  capex: 0.10,
  market: 0.10,
};

// ============================================================================
// Calculate confidence for a tracked value
// ============================================================================

export function getValueConfidence(value: TrackedNumber | undefined): number {
  if (!value) return 0;
  return value.confidence;
}

// ============================================================================
// Combine multiple confidence scores
// ============================================================================

export function combineConfidence(scores: number[], weights?: number[]): number {
  if (scores.length === 0) return 0;
  
  const effectiveWeights = weights || scores.map(() => 1 / scores.length);
  const totalWeight = effectiveWeights.reduce((a, b) => a + b, 0);
  
  let weightedSum = 0;
  for (let i = 0; i < scores.length; i++) {
    weightedSum += scores[i] * (effectiveWeights[i] / totalWeight);
  }
  
  return weightedSum;
}

// ============================================================================
// Assess deal confidence
// ============================================================================

export function assessDealConfidence(deal: Deal): ConfidenceAssessment {
  const byCategory: Record<string, number> = {};
  const criticalGaps: string[] = [];
  const dataRequests: string[] = [];

  // Pricing confidence
  const priceConf = getValueConfidence(deal.askingPrice);
  byCategory['pricing'] = priceConf;
  if (priceConf === 0) {
    criticalGaps.push('Asking price unknown');
    dataRequests.push('Confirm asking price or price guidance');
  } else if (priceConf < 0.7) {
    dataRequests.push('Verify asking price with broker');
  }

  // Income confidence
  const incomeScores: number[] = [];
  
  if (deal.extracted.t12?.noi) {
    incomeScores.push(deal.extracted.t12.noi.confidence);
  }
  if (deal.extracted.rentRoll?.effectiveGrossRent) {
    incomeScores.push(deal.extracted.rentRoll.effectiveGrossRent.confidence);
  }
  if (deal.extracted.t12?.grossRevenue) {
    incomeScores.push(deal.extracted.t12.grossRevenue.confidence);
  }

  if (incomeScores.length > 0) {
    byCategory['income'] = Math.max(...incomeScores); // Use best available
  } else {
    byCategory['income'] = 0;
    criticalGaps.push('No income data available');
    dataRequests.push('Request T12 operating statement');
    dataRequests.push('Request current rent roll');
  }

  // Expense confidence
  if (deal.extracted.t12?.totalExpenses) {
    byCategory['expenses'] = deal.extracted.t12.totalExpenses.confidence;
  } else {
    byCategory['expenses'] = 0;
    if (!criticalGaps.includes('No income data available')) {
      dataRequests.push('Request detailed expense breakdown');
    }
  }

  // Occupancy confidence
  if (deal.extracted.rentRoll?.occupancyRate) {
    byCategory['occupancy'] = deal.extracted.rentRoll.occupancyRate.confidence;
  } else {
    byCategory['occupancy'] = 0;
    dataRequests.push('Request current occupancy details');
  }

  // CapEx confidence
  if (deal.assumptions.capexTotal || deal.assumptions.capexPerUnit) {
    const capexConf = Math.max(
      getValueConfidence(deal.assumptions.capexTotal),
      getValueConfidence(deal.assumptions.capexPerUnit)
    );
    byCategory['capex'] = capexConf;
  } else {
    byCategory['capex'] = 0;
    dataRequests.push('Request property condition report or CapEx estimate');
  }

  // Market confidence (basic - based on whether we have comps)
  // For now, use a conservative default
  byCategory['market'] = 0.5;
  dataRequests.push('Request market rent comps');
  dataRequests.push('Request recent sale comps');

  // Calculate overall
  const categories = Object.keys(CATEGORY_WEIGHTS);
  const scores = categories.map(cat => byCategory[cat] || 0);
  const weights = categories.map(cat => CATEGORY_WEIGHTS[cat]);
  const overall = combineConfidence(scores, weights);

  // Add critical gaps for very low confidence areas
  if (byCategory['income'] < 0.5 && !criticalGaps.includes('No income data available')) {
    criticalGaps.push('Income data unreliable');
  }

  return {
    overall,
    byCategory,
    criticalGaps: [...new Set(criticalGaps)],
    dataRequests: [...new Set(dataRequests)],
  };
}

// ============================================================================
// Source-based confidence adjustment
// ============================================================================

export function adjustConfidenceBySource(baseConfidence: number, sourceKind: SourceKind): number {
  const adjustments: Record<SourceKind, number> = {
    't12_csv': 0, // No adjustment - most reliable
    'rentroll_csv': -0.05,
    'xlsx_model': -0.10, // Sponsor model: structured but sponsor-authored
    'om_text': -0.15,
    'pdf': -0.15, // Marketing/appraisal PDFs: same trust tier as OM text
    'docx': -0.15, // Memos and packages: OM tier
    'doc': -0.15, // Legacy Word: same tier as docx, the format says nothing about trust
    'pptx': -0.20, // Decks: advocacy, and slide text loses its labels easily
    'image': -0.20, // OCR/vision reads: slightly below native text
    'email': -0.25,
    'manual': -0.10,
    'computed': -0.05,
  };
  
  return Math.max(0, Math.min(1, baseConfidence + (adjustments[sourceKind] || 0)));
}

// ============================================================================
// Conflict resolution
// ============================================================================

export interface ConflictResolution {
  selectedValue: number;
  selectedSourceId: string;
  selectedConfidence: number;
  alternativeValues: Array<{
    value: number;
    sourceId: string;
    confidence: number;
    reason: string;
  }>;
  resolutionMethod: string;
}

export function resolveConflict(
  values: Array<{ value: number; sourceId: string; sourceKind: SourceKind; confidence: number }>
): ConflictResolution {
  if (values.length === 0) {
    throw new Error('Cannot resolve conflict with no values');
  }
  
  if (values.length === 1) {
    return {
      selectedValue: values[0].value,
      selectedSourceId: values[0].sourceId,
      selectedConfidence: values[0].confidence,
      alternativeValues: [],
      resolutionMethod: 'single_source',
    };
  }

  // Sort by priority (lower is better), then by confidence
  const sorted = [...values].sort((a, b) => {
    const priorityDiff = getSourcePriority(a.sourceKind) - getSourcePriority(b.sourceKind);
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence; // Higher confidence wins within same priority
  });

  const selected = sorted[0];
  const alternatives = sorted.slice(1).map(v => ({
    value: v.value,
    sourceId: v.sourceId,
    confidence: v.confidence,
    reason: `Lower priority source (${v.sourceKind}) or lower confidence`,
  }));

  return {
    selectedValue: selected.value,
    selectedSourceId: selected.sourceId,
    selectedConfidence: selected.confidence,
    alternativeValues: alternatives,
    resolutionMethod: 'source_priority_then_confidence',
  };
}

// ============================================================================
// Determine if adaptive stress should be applied
// ============================================================================

export function shouldApplyAdaptiveStress(confidence: ConfidenceAssessment): boolean {
  return confidence.overall < 0.6 || 
         confidence.byCategory['income'] < 0.6 ||
         confidence.criticalGaps.length > 0;
}

// ============================================================================
// Format confidence for display
// ============================================================================

export function formatConfidence(confidence: number): string {
  if (confidence >= 0.8) return `${(confidence * 100).toFixed(0)}% (High)`;
  if (confidence >= 0.6) return `${(confidence * 100).toFixed(0)}% (Medium)`;
  if (confidence >= 0.4) return `${(confidence * 100).toFixed(0)}% (Low)`;
  return `${(confidence * 100).toFixed(0)}% (Very Low)`;
}
