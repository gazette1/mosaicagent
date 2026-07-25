/**
 * Deep Dive (Phase 2) Underwriting
 * Full model, IC memo, sensitivities
 */

import {
  Deal,
  DeepDiveOutput,
  CashflowYear,
  DebtSizing,
  Returns,
  SensitivityCell,
  StrategyOption,
  DiligenceItem,
  TrackedNumber,
  tracked,
} from '../core/schemas';
import {
  DEFAULT_STRESSES,
  ASSET_TYPE_CRITERIA,
  STRATEGY_OPTIONS,
  getMarketRateProxy,
} from '../core/doctrine';
import { assessDealConfidence, shouldApplyAdaptiveStress } from '../core/confidence';
import { auditDeepDiveExecuted, auditProxyApplied } from '../core/audit';
import { estimateNoiFromRentRoll } from '../ingest/t12-normalizer';

// ============================================================================
// Deep dive analysis
// ============================================================================

export function deepDiveDeal(deal: Deal): DeepDiveOutput {
  const now = new Date().toISOString();
  const confidence = assessDealConfidence(deal);
  const applyAdaptiveStress = shouldApplyAdaptiveStress(confidence);
  const assetDefaults = ASSET_TYPE_CRITERIA[deal.assetType];
  
  const metricsComputed: string[] = [];
  
  // ============================================================================
  // Get core inputs
  // ============================================================================
  
  // NOI
  let baseNoi: number;
  let noiConfidence: number;
  let noiIsProxy = false;
  
  if (deal.extracted.t12?.noi) {
    baseNoi = deal.extracted.t12.noi.value;
    noiConfidence = deal.extracted.t12.noi.confidence;
  } else if (deal.extracted.rentRoll?.effectiveGrossRent) {
    const estimated = estimateNoiFromRentRoll(
      deal.extracted.rentRoll.effectiveGrossRent.value,
      deal.assetType,
      'computed'
    );
    baseNoi = estimated.value;
    noiConfidence = estimated.confidence;
    noiIsProxy = true;
  } else {
    throw new Error('Cannot perform deep dive: No income data available');
  }
  
  // Price
  const askingPrice = deal.askingPrice?.value;
  if (!askingPrice) {
    throw new Error('Cannot perform deep dive: No asking price available');
  }
  
  // Assumptions
  const holdPeriod = deal.assumptions.holdPeriodYears?.value ?? 5;
  const noiGrowth = 0.02; // 2% annual NOI growth assumption
  const entryCap = baseNoi / askingPrice;
  const exitCapSpread = applyAdaptiveStress 
    ? DEFAULT_STRESSES.exitCapSpread + 0.0025 
    : DEFAULT_STRESSES.exitCapSpread;
  const exitCap = entryCap + exitCapSpread;
  
  // Debt assumptions
  const ltv = deal.assumptions.ltv?.value ?? DEFAULT_STRESSES.conservativeLtv;
  const baseRate = deal.assumptions.interestRate?.value ?? getMarketRateProxy();
  const stressedRate = baseRate + (applyAdaptiveStress ? 0.02 : DEFAULT_STRESSES.interestRateStress);
  
  metricsComputed.push('noi', 'entryCap', 'exitCap', 'holdPeriod');
  
  // ============================================================================
  // Generate cashflows
  // ============================================================================
  
  const cashflows: CashflowYear[] = [];
  const loanAmount = askingPrice * ltv;
  const annualDebtService = loanAmount * stressedRate; // IO assumption
  const equityInvested = askingPrice - loanAmount;
  
  let cumulativeNoi = 0;
  
  for (let year = 1; year <= holdPeriod; year++) {
    const yearNoi = baseNoi * Math.pow(1 + noiGrowth, year - 1);
    const cfBeforeDebt = yearNoi;
    const cfAfterDebt = yearNoi - annualDebtService;
    const dscr = yearNoi / annualDebtService;
    
    cumulativeNoi += yearNoi;
    
    cashflows.push({
      year,
      noi: tracked(yearNoi, noiConfidence - 0.05 * (year - 1), {
        formula: `baseNoi * (1 + ${(noiGrowth * 100).toFixed(1)}%)^${year - 1}`,
        unit: 'USD/year',
      }),
      debtService: tracked(annualDebtService, 0.85, {
        formula: 'loanAmount * interestRate (IO)',
        unit: 'USD/year',
        isProxy: true,
      }),
      cashFlowBeforeDebt: tracked(cfBeforeDebt, noiConfidence - 0.05 * (year - 1), {
        formula: 'NOI (no capex reserve modeled)',
        unit: 'USD/year',
      }),
      cashFlowAfterDebt: tracked(cfAfterDebt, noiConfidence - 0.1 * (year - 1), {
        formula: 'NOI - debtService',
        unit: 'USD/year',
      }),
      dscr: tracked(dscr, noiConfidence - 0.05 * (year - 1), {
        formula: 'NOI / debtService',
        unit: 'x',
      }),
    });
  }
  
  metricsComputed.push('cashflows', 'debtService', 'dscr');
  
  // ============================================================================
  // Exit value
  // ============================================================================
  
  const exitYearNoi = baseNoi * Math.pow(1 + noiGrowth, holdPeriod - 1);
  const exitValueNum = exitYearNoi / exitCap;
  const exitValue = tracked(exitValueNum, noiConfidence - 0.2, {
    formula: `exitYearNOI / exitCap (${(exitCap * 100).toFixed(2)}%)`,
    unit: 'USD',
    rationale: `Year ${holdPeriod} NOI divided by exit cap of ${(exitCap * 100).toFixed(2)}%`,
  });
  
  metricsComputed.push('exitValue');
  
  // ============================================================================
  // Debt sizing summary
  // ============================================================================
  
  const debtSizing: DebtSizing = {
    loanAmount: tracked(loanAmount, 0.8, { unit: 'USD' }),
    ltv: tracked(ltv * 100, 0.9, { unit: '%' }),
    interestRate: tracked(stressedRate * 100, 0.7, { 
      unit: '%', 
      isProxy: true,
      rationale: 'Stressed rate assumption',
    }),
    annualDebtService: tracked(annualDebtService, 0.75, { 
      unit: 'USD/year',
      formula: 'loanAmount * interestRate (IO)',
    }),
    dscr: tracked(baseNoi / annualDebtService, noiConfidence, {
      formula: 'Year 1 NOI / debtService',
      unit: 'x',
    }),
    isProxy: true,
    proxyNotes: 'Interest-only debt assumption at stressed rate. Actual terms may vary.',
  };
  
  metricsComputed.push('debtSizing');
  
  // ============================================================================
  // Returns calculation
  // ============================================================================
  
  // Simplified returns (no complex IRR calculation without a library)
  const totalCashFlow = cashflows.reduce((sum, cf) => sum + (cf.cashFlowAfterDebt?.value || 0), 0);
  const netExitProceeds = exitValueNum - loanAmount;
  const totalReturn = totalCashFlow + netExitProceeds;
  const equityMultiple = totalReturn / equityInvested;
  const avgAnnualCashFlow = totalCashFlow / holdPeriod;
  const cashOnCash = (avgAnnualCashFlow / equityInvested) * 100;
  
  // Approximate IRR using simplified method
  const approximateLeveredIrr = approximateIRR(equityInvested, cashflows.map(cf => cf.cashFlowAfterDebt?.value || 0), netExitProceeds);
  const approximateUnleveredIrr = approximateIRR(askingPrice, cashflows.map(cf => cf.noi.value), exitValueNum);
  
  const returns: Returns = {
    equityMultiple: tracked(equityMultiple, 0.7, {
      formula: 'totalReturn / equityInvested',
      unit: 'x',
    }),
    cashOnCash: tracked(cashOnCash, 0.7, {
      formula: '(avgAnnualCashFlow / equityInvested) * 100',
      unit: '%',
    }),
    totalProfit: tracked(totalReturn - equityInvested, 0.6, {
      formula: 'totalReturn - equityInvested',
      unit: 'USD',
    }),
    leveredIRR: tracked(approximateLeveredIrr * 100, 0.5, {
      formula: 'approximation based on cash flows',
      unit: '%',
      rationale: 'Simplified IRR calculation',
    }),
    unleveredIRR: tracked(approximateUnleveredIrr * 100, 0.5, {
      formula: 'approximation based on unlevered cash flows',
      unit: '%',
    }),
  };
  
  metricsComputed.push('returns', 'equityMultiple', 'cashOnCash', 'IRR');
  
  // ============================================================================
  // Sensitivity analysis
  // ============================================================================
  
  const sensitivities: SensitivityCell[] = [];
  const rateDeltas = [-0.01, 0, 0.01]; // -100, 0, +100 bps
  const noiDeltas = [-0.05, 0, 0.05]; // -5%, 0%, +5%
  
  for (const rateDelta of rateDeltas) {
    for (const noiDelta of noiDeltas) {
      const sensitivityRate = stressedRate + rateDelta;
      const sensitivityNoi = baseNoi * (1 + noiDelta);
      const sensitivityDebtService = loanAmount * sensitivityRate;
      const sensitivityDscr = sensitivityNoi / sensitivityDebtService;
      
      sensitivities.push({
        rowVar: 'Interest Rate',
        rowValue: (stressedRate + rateDelta) * 100,
        colVar: 'NOI Change',
        colValue: noiDelta * 100,
        resultMetric: 'DSCR',
        resultValue: sensitivityDscr,
      });
      
      // Also add exit value sensitivity
      const sensitivityExitNoi = sensitivityNoi * Math.pow(1 + noiGrowth, holdPeriod - 1);
      const sensitivityExitValue = sensitivityExitNoi / exitCap;
      
      sensitivities.push({
        rowVar: 'NOI Change',
        rowValue: noiDelta * 100,
        colVar: 'Exit Cap',
        colValue: exitCap * 100,
        resultMetric: 'Exit Value ($M)',
        resultValue: sensitivityExitValue / 1_000_000,
      });
    }
  }
  
  metricsComputed.push('sensitivities');
  
  // ============================================================================
  // Strategy options
  // ============================================================================
  
  const strategyOptions: StrategyOption[] = [];
  
  // Operate & Refi
  strategyOptions.push({
    name: STRATEGY_OPTIONS.OPERATE_REFI.name,
    description: STRATEGY_OPTIONS.OPERATE_REFI.description,
    businessPlan: [
      'Stabilize operations and push rents to market',
      'Reduce expenses through operational improvements',
      'Complete minor CapEx to support rent growth',
      'Refinance in Year 2-3 to return equity',
    ],
    targetHold: STRATEGY_OPTIONS.OPERATE_REFI.targetHold,
    exitStrategy: STRATEGY_OPTIONS.OPERATE_REFI.exitStrategy,
    keyRisks: [
      'Rent growth slower than projected',
      'Interest rates rise further limiting refi proceeds',
      'Market cap rate expansion',
    ],
    keyMitigants: [
      'Conservative underwriting with stressed NOI',
      'Low LTV provides cushion for rate movements',
      'Focus on cash flow vs appreciation',
    ],
    confidenceLevel: confidence.overall >= 0.7 ? 'high' : 'medium',
  });
  
  // Operate & Sell
  strategyOptions.push({
    name: STRATEGY_OPTIONS.OPERATE_SELL.name,
    description: STRATEGY_OPTIONS.OPERATE_SELL.description,
    businessPlan: [
      'Stabilize and maximize NOI',
      'Create institutional-quality asset',
      'Market to larger buyers at lower cap rate',
    ],
    targetHold: STRATEGY_OPTIONS.OPERATE_SELL.targetHold,
    exitStrategy: STRATEGY_OPTIONS.OPERATE_SELL.exitStrategy,
    keyRisks: [
      'Exit depends on favorable market conditions',
      'Buyer pool may be limited',
      'Cap rate compression may not materialize',
    ],
    keyMitigants: [
      'Multiple exit paths provide flexibility',
      'NOI growth provides value regardless of cap rates',
      'Conservative exit cap assumption in underwriting',
    ],
    confidenceLevel: 'medium',
  });
  
  // Light Reposition (if applicable)
  if (deal.assumptions.capexTotal || deal.assumptions.capexPerUnit) {
    strategyOptions.push({
      name: STRATEGY_OPTIONS.LIGHT_REPOSITION.name,
      description: STRATEGY_OPTIONS.LIGHT_REPOSITION.description,
      businessPlan: [
        'Execute targeted capital improvements',
        'Remerchandise tenant mix if applicable',
        'Demonstrate value creation to attract recap partner',
      ],
      targetHold: STRATEGY_OPTIONS.LIGHT_REPOSITION.targetHold,
      exitStrategy: STRATEGY_OPTIONS.LIGHT_REPOSITION.exitStrategy,
      keyRisks: [
        'CapEx cost overruns',
        'Execution timeline slippage',
        'Lease-up risk during transition',
      ],
      keyMitigants: [
        'Detailed CapEx budget with contingency',
        'Experienced property management',
        'Phased renovation approach',
      ],
      confidenceLevel: confidence.byCategory['capex'] >= 0.6 ? 'medium' : 'low',
    });
  }
  
  metricsComputed.push('strategyOptions');
  
  // ============================================================================
  // Diligence checklist
  // ============================================================================
  
  const diligenceChecklist: DiligenceItem[] = generateDiligenceChecklist(deal);
  metricsComputed.push('diligenceChecklist');
  
  // ============================================================================
  // Key risks
  // ============================================================================
  
  const keyRisks: DeepDiveOutput['keyRisks'] = [
    {
      risk: 'Interest rate risk',
      likelihood: 'medium',
      impact: 'high',
      mitigant: 'Conservative debt sizing with stressed rate assumptions',
    },
    {
      risk: 'NOI underperformance',
      likelihood: noiIsProxy ? 'medium' : 'low',
      impact: 'high',
      mitigant: 'Stressed NOI haircut applied; verify with T12',
    },
    {
      risk: 'Cap rate expansion on exit',
      likelihood: 'medium',
      impact: 'medium',
      mitigant: 'Exit cap spread of +75bps provides cushion',
    },
    {
      risk: 'Tenant rollover / vacancy',
      likelihood: deal.assetType === 'retail' ? 'medium' : 'low',
      impact: 'medium',
      mitigant: 'Review lease expiration schedule and tenant credit',
    },
  ];
  
  // Add asset-specific risks
  if (deal.assetType === 'multifamily') {
    keyRisks.push({
      risk: 'Rent control / regulatory risk',
      likelihood: 'low',
      impact: 'high',
      mitigant: 'Verify local regulations during diligence',
    });
  }
  
  if (deal.assetType === 'industrial') {
    keyRisks.push({
      risk: 'Environmental contamination',
      likelihood: 'medium',
      impact: 'high',
      mitigant: 'Phase I ESA required; Phase II if warranted',
    });
  }
  
  metricsComputed.push('keyRisks');
  
  // ============================================================================
  // Generate thesis
  // ============================================================================
  
  const thesis = generateThesis(deal, entryCap, returns, confidence);
  metricsComputed.push('thesis');
  
  // ============================================================================
  // Audit and return
  // ============================================================================
  
  auditDeepDiveExecuted(deal, metricsComputed, confidence.overall);
  
  return {
    thesis,
    cashflows,
    exitValue,
    debtSizing,
    returns,
    sensitivities,
    strategyOptions,
    diligenceChecklist,
    keyRisks,
    executedAt: now,
  };
}

// ============================================================================
// Helper: Approximate IRR (simplified)
// ============================================================================

function approximateIRR(initialInvestment: number, cashFlows: number[], terminalValue: number): number {
  // Simple approximation using average return method
  const totalCashFlow = cashFlows.reduce((a, b) => a + b, 0);
  const totalReturn = totalCashFlow + terminalValue;
  const years = cashFlows.length;
  
  // Approximate using geometric mean return
  const multiple = totalReturn / initialInvestment;
  const approximateIrr = Math.pow(multiple, 1 / years) - 1;
  
  return Math.max(0, approximateIrr);
}

// ============================================================================
// Helper: Generate thesis
// ============================================================================

function generateThesis(
  deal: Deal, 
  entryCap: number, 
  returns: Returns,
  confidence: { overall: number }
): string {
  const assetDefaults = ASSET_TYPE_CRITERIA[deal.assetType];
  const capRateAssessment = entryCap >= assetDefaults.defaultCaps.entry ? 'attractive' : 'tight';
  const returnsAssessment = (returns.equityMultiple?.value || 0) >= 1.5 ? 'solid' : 'modest';
  const confidenceNote = confidence.overall >= 0.7 
    ? 'Data quality supports underwriting.'
    : 'Data quality requires verification during diligence.';
  
  return `${deal.name} is a ${deal.assetType} acquisition opportunity at a ${capRateAssessment} ${(entryCap * 100).toFixed(2)}% going-in cap rate. ` +
    `The base case projects ${returnsAssessment} returns with a ${returns.equityMultiple?.value.toFixed(2)}x equity multiple. ` +
    `${confidenceNote} ` +
    `Primary value creation through operational improvements and rent growth. ` +
    `Multiple exit paths available: refinance, sale, or recapitalization.`;
}

// ============================================================================
// Helper: Generate diligence checklist
// ============================================================================

function generateDiligenceChecklist(deal: Deal): DiligenceItem[] {
  const items: DiligenceItem[] = [
    // Universal items
    {
      category: 'Financial',
      item: 'Verify T12 operating statement with bank statements',
      priority: 'critical',
      status: deal.extracted.t12 ? 'pending' : 'pending',
    },
    {
      category: 'Financial',
      item: 'Review rent roll and lease abstracts',
      priority: 'critical',
      status: deal.extracted.rentRoll ? 'pending' : 'pending',
    },
    {
      category: 'Financial',
      item: 'Confirm current occupancy and pending move-outs',
      priority: 'critical',
      status: 'pending',
    },
    {
      category: 'Financial',
      item: 'Review accounts receivable aging',
      priority: 'important',
      status: 'pending',
    },
    {
      category: 'Legal',
      item: 'Title commitment and survey review',
      priority: 'critical',
      status: 'pending',
    },
    {
      category: 'Legal',
      item: 'Review service contracts (assumable/terminable)',
      priority: 'important',
      status: 'pending',
    },
    {
      category: 'Physical',
      item: 'Property condition assessment (PCA)',
      priority: 'critical',
      status: 'pending',
    },
    {
      category: 'Physical',
      item: 'Phase I Environmental Site Assessment',
      priority: 'critical',
      status: 'pending',
    },
    {
      category: 'Market',
      item: 'Rent comparables analysis',
      priority: 'important',
      status: 'pending',
    },
    {
      category: 'Market',
      item: 'Sales comparables / cap rate survey',
      priority: 'important',
      status: 'pending',
    },
  ];
  
  // Asset type specific items
  if (deal.assetType === 'multifamily') {
    items.push(
      {
        category: 'Legal',
        item: 'Rent control / stabilization verification',
        priority: 'critical',
        status: 'pending',
      },
      {
        category: 'Physical',
        item: 'Unit interior inspection (sample)',
        priority: 'important',
        status: 'pending',
      },
      {
        category: 'Operational',
        item: 'Review utility billing arrangements',
        priority: 'standard',
        status: 'pending',
      }
    );
  }
  
  if (deal.assetType === 'retail') {
    items.push(
      {
        category: 'Legal',
        item: 'Review co-tenancy and exclusivity clauses',
        priority: 'critical',
        status: 'pending',
      },
      {
        category: 'Financial',
        item: 'Tenant sales reports (if percentage rent)',
        priority: 'important',
        status: 'pending',
      },
      {
        category: 'Market',
        item: 'Trade area demographic analysis',
        priority: 'standard',
        status: 'pending',
      }
    );
  }
  
  if (deal.assetType === 'industrial') {
    items.push(
      {
        category: 'Physical',
        item: 'Clear height / loading verification',
        priority: 'important',
        status: 'pending',
      },
      {
        category: 'Legal',
        item: 'Verify permitted uses / zoning',
        priority: 'important',
        status: 'pending',
      },
      {
        category: 'Physical',
        item: 'Environmental due diligence (Phase II if flagged)',
        priority: 'critical',
        status: 'pending',
      }
    );
  }
  
  return items;
}
