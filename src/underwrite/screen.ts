/**
 * Screen (Phase 1) Underwriting
 * Quick decision-making pass: Kill / Chase / Structure / Delegate
 */

import {
  Deal,
  ScreenOutput,
  KeyMetric,
  KillFlag,
  TrackedNumber,
  tracked,
  Verdict,
} from '../core/schemas';
import {
  KILL_CRITERIA,
  DEFAULT_STRESSES,
  ADAPTIVE_ADJUSTMENTS,
  RISK_SCORE_DESCRIPTIONS,
  ASSET_TYPE_CRITERIA,
  getMarketRateProxy,
  getStressedRate,
} from '../core/doctrine';
import {
  assessDealConfidence,
  shouldApplyAdaptiveStress,
  ConfidenceAssessment,
} from '../core/confidence';
import {
  auditStressApplied,
  auditAdaptiveAdjustment,
  auditKillFlagTriggered,
  auditScreenExecuted,
  auditProxyApplied,
} from '../core/audit';
import { estimateNoiFromRentRoll } from '../ingest/t12-normalizer';

// ============================================================================
// Screen a deal
// ============================================================================

export interface ScreenResult {
  output: ScreenOutput;
  metrics: Record<string, number | undefined>;
}

export function screenDeal(deal: Deal): ScreenResult {
  const adaptiveAdjustments: string[] = [];
  const now = new Date().toISOString();
  
  // Assess data confidence
  const confidence = assessDealConfidence(deal);
  const applyAdaptiveStress = shouldApplyAdaptiveStress(confidence);
  
  // Get asset type defaults
  const assetDefaults = ASSET_TYPE_CRITERIA[deal.assetType];
  
  // Calculate stresses (potentially widened for low confidence)
  let noiHaircut = DEFAULT_STRESSES.noiHaircut;
  let exitCapSpread = DEFAULT_STRESSES.exitCapSpread;
  let interestRateStress = DEFAULT_STRESSES.interestRateStress;
  
  if (applyAdaptiveStress) {
    noiHaircut += ADAPTIVE_ADJUSTMENTS.noiHaircutAdditional;
    exitCapSpread += ADAPTIVE_ADJUSTMENTS.exitCapAdditional;
    interestRateStress += ADAPTIVE_ADJUSTMENTS.interestRateAdditional;
    
    adaptiveAdjustments.push(`NOI haircut widened to ${(noiHaircut * 100).toFixed(0)}% due to data uncertainty`);
    adaptiveAdjustments.push(`Exit cap spread widened to +${(exitCapSpread * 100).toFixed(0)} bps`);
    adaptiveAdjustments.push(`Interest rate stress widened to +${(interestRateStress * 100).toFixed(0)} bps`);
    
    auditAdaptiveAdjustment(deal, 'NOI_HAIRCUT', 'Low data confidence', DEFAULT_STRESSES.noiHaircut, noiHaircut);
    auditAdaptiveAdjustment(deal, 'EXIT_CAP_SPREAD', 'Low data confidence', DEFAULT_STRESSES.exitCapSpread, exitCapSpread);
  }
  
  // ============================================================================
  // Calculate core metrics
  // ============================================================================
  
  // Get or estimate NOI
  let noi: TrackedNumber | undefined;
  let noiSource = 'unknown';
  
  if (deal.extracted.t12?.noi) {
    noi = deal.extracted.t12.noi;
    noiSource = 't12';
  } else if (deal.extracted.rentRoll?.effectiveGrossRent) {
    // Estimate NOI from rent roll
    noi = estimateNoiFromRentRoll(
      deal.extracted.rentRoll.effectiveGrossRent.value,
      deal.assetType,
      'computed'
    );
    noiSource = 'rent_roll_estimate';
    auditProxyApplied(deal, 'NOI', noi.value, 'expense_ratio_proxy', 
      `Estimated from rent roll using ${deal.assetType} expense ratio`);
  }
  
  // Get price
  const askingPrice = deal.askingPrice;
  
  // Calculate entry cap
  let entryCap: TrackedNumber | undefined;
  if (noi && askingPrice) {
    const entryCapValue = noi.value / askingPrice.value;
    entryCap = tracked(entryCapValue, Math.min(noi.confidence, askingPrice.confidence), {
      formula: 'NOI / askingPrice',
      inputsUsed: ['noi', 'askingPrice'],
    });
  } else if (deal.assumptions.entryCap) {
    entryCap = deal.assumptions.entryCap;
  }
  
  // Calculate exit cap
  let exitCap: TrackedNumber | undefined;
  if (entryCap) {
    const exitCapValue = entryCap.value + exitCapSpread;
    exitCap = tracked(exitCapValue, entryCap.confidence - 0.1, {
      formula: `entryCap + ${(exitCapSpread * 100).toFixed(0)}bps`,
      inputsUsed: ['entryCap'],
      rationale: 'Conservative exit cap assumption',
    });
    auditStressApplied(deal, 'EXIT_CAP', entryCap.value, exitCapValue, exitCapSpread);
  } else {
    // Use asset type default
    exitCap = tracked(assetDefaults.defaultCaps.exit, 0.5, {
      isProxy: true,
      proxyMethod: 'asset_type_default',
      rationale: `Default exit cap for ${deal.assetType}`,
    });
    auditProxyApplied(deal, 'EXIT_CAP', exitCap.value, 'asset_type_default', 
      `Using default for ${deal.assetType}`);
  }
  
  // Calculate stressed NOI
  let stressedNoi: TrackedNumber | undefined;
  if (noi) {
    const stressedNoiValue = noi.value * (1 - noiHaircut);
    stressedNoi = tracked(stressedNoiValue, noi.confidence - 0.1, {
      formula: `NOI * (1 - ${(noiHaircut * 100).toFixed(0)}%)`,
      inputsUsed: ['noi', 'noiHaircut'],
      rationale: 'Stressed NOI for downside scenario',
    });
    auditStressApplied(deal, 'STRESSED_NOI', noi.value, stressedNoiValue, noiHaircut);
  }
  
  // Calculate debt sizing (proxy if no loan terms)
  const ltv = deal.assumptions.ltv?.value ?? DEFAULT_STRESSES.conservativeLtv;
  const interestRate = (deal.assumptions.interestRate?.value ?? getMarketRateProxy()) + interestRateStress;
  
  let loanAmount: number | undefined;
  let annualDebtService: number | undefined;
  let stressedDscr: number | undefined;
  let debtServiceIsProxy = true;
  
  if (askingPrice) {
    loanAmount = askingPrice.value * ltv;
    // Interest-only debt service
    annualDebtService = loanAmount * interestRate;
    
    if (stressedNoi) {
      stressedDscr = stressedNoi.value / annualDebtService;
    }
    
    debtServiceIsProxy = !deal.assumptions.interestRate;
    if (debtServiceIsProxy) {
      auditProxyApplied(deal, 'DEBT_SERVICE', annualDebtService, 'io_proxy',
        `Interest-only at ${(interestRate * 100).toFixed(2)}% on ${(ltv * 100).toFixed(0)}% LTV`);
    }
  }
  
  // Calculate exit value
  let exitValue: TrackedNumber | undefined;
  if (stressedNoi && exitCap) {
    const exitValueNum = stressedNoi.value / exitCap.value;
    exitValue = tracked(exitValueNum, Math.min(stressedNoi.confidence, exitCap.confidence), {
      formula: 'stressedNOI / exitCap',
      inputsUsed: ['stressedNoi', 'exitCap'],
    });
  }
  
  // Calculate largest tenant concentration
  let largestTenantPct: number | undefined;
  if (deal.extracted.rentRoll && deal.extracted.rentRoll.tenants.length > 0) {
    const tenants = deal.extracted.rentRoll.tenants.filter(t => !t.isVacant && t.annualRent);
    const totalRent = tenants.reduce((sum, t) => sum + (t.annualRent?.value || 0), 0);
    if (totalRent > 0) {
      const maxRent = Math.max(...tenants.map(t => t.annualRent?.value || 0));
      largestTenantPct = maxRent / totalRent;
    }
  }
  
  // ============================================================================
  // Collect metrics for kill criteria
  // ============================================================================
  
  const metrics: Record<string, number | undefined> = {
    stressedDscr,
    largestTenantPct,
    noiConfidence: noi?.confidence,
    capexConfidence: deal.assumptions.capexTotal?.confidence ?? 
                     deal.assumptions.capexPerUnit?.confidence,
    entryCap: entryCap?.value,
    exitCap: exitCap?.value,
  };
  
  // ============================================================================
  // Evaluate kill criteria
  // ============================================================================
  
  const killFlags: KillFlag[] = [];
  let hardKillTriggered = false;
  
  for (const criterion of KILL_CRITERIA) {
    const result = criterion.check(metrics);
    const flag: KillFlag = {
      criterion: criterion.name,
      triggered: result.triggered,
      reason: result.reason,
      severity: criterion.severity,
      dataNeededToOverturn: result.triggered ? criterion.dataNeededToOverturn : undefined,
    };
    killFlags.push(flag);
    
    if (result.triggered) {
      auditKillFlagTriggered(deal, criterion.id, result.reason, criterion.severity);
      if (criterion.severity === 'hard') {
        hardKillTriggered = true;
      }
    }
  }
  
  // ============================================================================
  // Determine verdict and risk score
  // ============================================================================
  
  let verdict: Verdict;
  let riskScore: number;
  let riskScoreRationale: string;
  
  const triggeredHardKills = killFlags.filter(f => f.triggered && f.severity === 'hard');
  const triggeredSoftKills = killFlags.filter(f => f.triggered && f.severity === 'soft');
  
  if (hardKillTriggered) {
    verdict = 'KILL';
    riskScore = 5;
    riskScoreRationale = `Hard kill criteria triggered: ${triggeredHardKills.map(k => k.criterion).join(', ')}`;
  } else if (triggeredSoftKills.length >= 2) {
    verdict = 'STRUCTURE';
    riskScore = 4;
    riskScoreRationale = `Multiple soft concerns: ${triggeredSoftKills.map(k => k.criterion).join(', ')}. May be salvageable with creative structure.`;
  } else if (triggeredSoftKills.length === 1) {
    verdict = 'CHASE';
    riskScore = 3;
    riskScoreRationale = `Single concern (${triggeredSoftKills[0].criterion}) is manageable. Worth pursuing with due diligence focus.`;
  } else if (confidence.overall >= 0.7) {
    verdict = 'CHASE';
    riskScore = confidence.overall >= 0.85 ? 2 : 3;
    riskScoreRationale = 'No kill criteria triggered. Good data quality supports underwriting.';
  } else {
    verdict = 'DELEGATE';
    riskScore = 3;
    riskScoreRationale = 'Data quality insufficient for confident decision. Needs more information before committing resources.';
  }
  
  // Apply adaptive risk score adjustment
  if (applyAdaptiveStress && riskScore < 5) {
    riskScore = Math.min(5, riskScore + ADAPTIVE_ADJUSTMENTS.riskScoreAdjustment);
    riskScoreRationale += ' Risk score adjusted +1 for data uncertainty.';
    adaptiveAdjustments.push('Risk score worsened by 1 notch due to data gaps');
  }
  
  // ============================================================================
  // Build key metrics for output
  // ============================================================================
  
  const keyMetrics: Record<string, KeyMetric> = {};
  
  if (noi) {
    keyMetrics['noi'] = {
      name: 'Net Operating Income',
      value: noi,
      benchmark: noiSource === 't12' ? 'T12 Actual' : 'Estimated from rent roll',
      assessment: noi.confidence >= 0.8 ? 'good' : noi.confidence >= 0.6 ? 'acceptable' : 'concerning',
    };
  }
  
  if (entryCap) {
    keyMetrics['entryCap'] = {
      name: 'Entry Cap Rate',
      value: tracked(entryCap.value * 100, entryCap.confidence, { unit: '%' }),
      benchmark: `Asset type range: ${(assetDefaults.defaultCaps.entry * 100).toFixed(1)}% - ${(assetDefaults.defaultCaps.exit * 100).toFixed(1)}%`,
      assessment: entryCap.value >= assetDefaults.defaultCaps.entry ? 'good' : 'concerning',
    };
  }
  
  if (stressedDscr !== undefined) {
    keyMetrics['stressedDscr'] = {
      name: 'Stressed DSCR',
      value: tracked(stressedDscr, noi?.confidence ?? 0.5, { 
        unit: 'x',
        isProxy: debtServiceIsProxy,
        proxyMethod: debtServiceIsProxy ? 'IO debt at stressed rate' : undefined,
      }),
      benchmark: 'Minimum: 1.15x',
      assessment: stressedDscr >= 1.25 ? 'good' : stressedDscr >= 1.15 ? 'acceptable' : 'critical',
    };
  }
  
  if (exitValue) {
    keyMetrics['exitValue'] = {
      name: 'Stressed Exit Value',
      value: exitValue,
      assessment: (askingPrice && exitValue.value >= askingPrice.value) ? 'good' : 'concerning',
    };
  }
  
  if (loanAmount !== undefined && askingPrice) {
    keyMetrics['ltv'] = {
      name: 'LTV (Proxy)',
      value: tracked(ltv * 100, 0.8, { 
        unit: '%',
        isProxy: true,
        rationale: 'Conservative assumption for screening',
      }),
      benchmark: 'Conservative: 60%',
      assessment: 'acceptable',
    };
  }
  
  // ============================================================================
  // Owner-occupancy override
  //
  // An owner-occupied asset has little or no third-party property NOI by
  // design: the income basis is the occupant / guarantor's business cash
  // flow, which is deliberately OUTSIDE this asset agent's scope (guarantor
  // analysis is a separate agent). Killing such a deal for "unverifiable
  // income" is the wrong answer; the right answer is DELEGATE with an
  // explicit routing reason. Only applies when unverifiable income is the
  // sole hard kill: real hard kills (DSCR, cap compression) still kill.
  // ============================================================================

  const ownerOccupied = (deal.extracted.notes ?? []).some(
    n => /owner[\s-]?occup/i.test(n.rawText ?? '') || /owner[\s-]?occup/i.test(n.extractedValue ?? '')
  );
  const hardKills = killFlags.filter(f => f.triggered && f.severity === 'hard');
  if (
    verdict === 'KILL' &&
    ownerOccupied &&
    hardKills.length === 1 &&
    hardKills[0].criterion === 'Unclear/Unverifiable Income'
  ) {
    verdict = 'DELEGATE';
    riskScore = 3;
    riskScoreRationale =
      'Owner-occupied asset: property-level NOI is structurally thin because the occupant is the sponsor. ' +
      'The income basis is guarantor business cash flow, which is outside this asset agent\'s scope. ' +
      'Route to guarantor analysis before any credit conclusion.';
  }

  // ============================================================================
  // Build output
  // ============================================================================

  const output: ScreenOutput = {
    verdict,
    riskScore,
    riskScoreRationale,
    killFlags,
    keyMetrics,
    confidenceSummary: confidence,
    adaptiveAdjustments: adaptiveAdjustments.length > 0 ? adaptiveAdjustments : undefined,
    executedAt: now,
  };
  
  auditScreenExecuted(deal, verdict, riskScore, confidence.overall);
  
  return { output, metrics };
}

// ============================================================================
// Get risk score description
// ============================================================================

export function getRiskScoreDescription(score: number): { label: string; description: string } {
  return RISK_SCORE_DESCRIPTIONS[score] || { label: 'Unknown', description: '' };
}
