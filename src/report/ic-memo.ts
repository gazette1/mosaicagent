/**
 * IC Memo Report Generator
 * Produces investment committee-style memo
 */

import { Deal, DeepDiveOutput, CashflowYear, StrategyOption, DiligenceItem } from '../core/schemas';
import { RISK_SCORE_DESCRIPTIONS, ASSET_TYPE_CRITERIA } from '../core/doctrine';

// ============================================================================
// Generate IC memo
// ============================================================================

export function generateICMemo(deal: Deal, deepdive: DeepDiveOutput, screen?: Deal['underwriting']['screen']): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# Investment Committee Memo`);
  lines.push('');
  lines.push(`## ${deal.name}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Executive Summary
  lines.push('### Executive Summary');
  lines.push('');
  lines.push(`**Asset Type:** ${deal.assetType.charAt(0).toUpperCase() + deal.assetType.slice(1)}`);
  if (deal.location?.address) {
    lines.push(`**Location:** ${deal.location.address}${deal.location.city ? `, ${deal.location.city}` : ''}${deal.location.state ? `, ${deal.location.state}` : ''}`);
  }
  if (deal.askingPrice) {
    lines.push(`**Asking Price:** ${formatCurrency(deal.askingPrice.value)}`);
  }
  if (deal.totalUnits) {
    lines.push(`**Units:** ${deal.totalUnits.value}`);
  }
  if (deal.totalSF) {
    lines.push(`**Square Feet:** ${deal.totalSF.value.toLocaleString()} SF`);
  }
  lines.push('');
  
  // Verdict summary if screen available
  if (screen) {
    const riskDesc = RISK_SCORE_DESCRIPTIONS[screen.riskScore];
    lines.push(`**Screen Verdict:** ${screen.verdict} (Risk Score: ${screen.riskScore}/5 — ${riskDesc?.label || ''})`);
    lines.push('');
  }
  
  lines.push(`**Analysis Date:** ${new Date(deepdive.executedAt).toLocaleDateString()}`);
  lines.push('');
  
  // Investment Thesis
  lines.push('---');
  lines.push('');
  lines.push('### Investment Thesis');
  lines.push('');
  lines.push(deepdive.thesis);
  lines.push('');
  
  // Business Plan Options
  lines.push('---');
  lines.push('');
  lines.push('### Business Plan Options');
  lines.push('');
  
  for (let i = 0; i < deepdive.strategyOptions.length; i++) {
    const strategy = deepdive.strategyOptions[i];
    const confidenceIcon = strategy.confidenceLevel === 'high' ? '🟢' : 
                           strategy.confidenceLevel === 'medium' ? '🟡' : '🔴';
    
    lines.push(`#### Option ${i + 1}: ${strategy.name} ${confidenceIcon}`);
    lines.push('');
    lines.push(`*${strategy.description}*`);
    lines.push('');
    lines.push(`**Target Hold:** ${strategy.targetHold}`);
    lines.push(`**Exit Strategy:** ${strategy.exitStrategy}`);
    lines.push('');
    lines.push('**Execution Plan:**');
    for (const step of strategy.businessPlan) {
      lines.push(`1. ${step}`);
    }
    lines.push('');
    
    lines.push('**Key Risks:**');
    for (const risk of strategy.keyRisks) {
      lines.push(`- ${risk}`);
    }
    lines.push('');
    
    lines.push('**Mitigants:**');
    for (const mitigant of strategy.keyMitigants) {
      lines.push(`- ${mitigant}`);
    }
    lines.push('');
  }
  
  // Key Risks Summary
  lines.push('---');
  lines.push('');
  lines.push('### Key Risks & Mitigants');
  lines.push('');
  lines.push('| Risk | Likelihood | Impact | Mitigant |');
  lines.push('|------|------------|--------|----------|');
  
  for (const risk of deepdive.keyRisks) {
    const likelihoodIcon = risk.likelihood === 'low' ? '🟢' : risk.likelihood === 'medium' ? '🟡' : '🔴';
    const impactIcon = risk.impact === 'low' ? '🟢' : risk.impact === 'medium' ? '🟡' : '🔴';
    lines.push(`| ${risk.risk} | ${likelihoodIcon} ${capitalize(risk.likelihood)} | ${impactIcon} ${capitalize(risk.impact)} | ${risk.mitigant || 'N/A'} |`);
  }
  lines.push('');
  
  // Underwriting Snapshot
  lines.push('---');
  lines.push('');
  lines.push('### Underwriting Snapshot');
  lines.push('');
  
  // Investment basis
  lines.push('#### Investment Basis');
  lines.push('');
  if (deal.askingPrice) {
    lines.push(`- **Purchase Price:** ${formatCurrency(deal.askingPrice.value)} (Confidence: ${(deal.askingPrice.confidence * 100).toFixed(0)}%)`);
  }
  if (deepdive.debtSizing) {
    lines.push(`- **Loan Amount:** ${formatCurrency(deepdive.debtSizing.loanAmount.value)} (${deepdive.debtSizing.ltv.value.toFixed(0)}% LTV)`);
    lines.push(`- **Equity Required:** ${formatCurrency(deal.askingPrice!.value - deepdive.debtSizing.loanAmount.value)}`);
    if (deepdive.debtSizing.isProxy) {
      lines.push(`  - *Note: Debt sizing is a proxy. ${deepdive.debtSizing.proxyNotes}*`);
    }
  }
  lines.push('');
  
  // Returns summary
  if (deepdive.returns) {
    lines.push('#### Projected Returns');
    lines.push('');
    if (deepdive.returns.equityMultiple) {
      lines.push(`- **Equity Multiple:** ${deepdive.returns.equityMultiple.value.toFixed(2)}x`);
    }
    if (deepdive.returns.leveredIRR) {
      lines.push(`- **Levered IRR:** ${deepdive.returns.leveredIRR.value.toFixed(1)}%`);
    }
    if (deepdive.returns.unleveredIRR) {
      lines.push(`- **Unlevered IRR:** ${deepdive.returns.unleveredIRR.value.toFixed(1)}%`);
    }
    if (deepdive.returns.cashOnCash) {
      lines.push(`- **Avg. Cash-on-Cash:** ${deepdive.returns.cashOnCash.value.toFixed(1)}%`);
    }
    if (deepdive.returns.totalProfit) {
      lines.push(`- **Total Profit:** ${formatCurrency(deepdive.returns.totalProfit.value)}`);
    }
    lines.push('');
    lines.push('*Returns are based on simplified assumptions. Actual results may vary.*');
    lines.push('');
  }
  
  // Cashflow projection
  lines.push('#### Cashflow Projection');
  lines.push('');
  lines.push('| Year | NOI | Debt Service | Cash Flow | DSCR |');
  lines.push('|------|-----|--------------|-----------|------|');
  
  for (const cf of deepdive.cashflows) {
    const noiStr = formatCurrency(cf.noi.value);
    const dsStr = cf.debtService ? formatCurrency(cf.debtService.value) : 'N/A';
    const cfStr = cf.cashFlowAfterDebt ? formatCurrency(cf.cashFlowAfterDebt.value) : 'N/A';
    const dscrStr = cf.dscr ? `${cf.dscr.value.toFixed(2)}x` : 'N/A';
    lines.push(`| ${cf.year} | ${noiStr} | ${dsStr} | ${cfStr} | ${dscrStr} |`);
  }
  lines.push('');
  
  // Exit value
  if (deepdive.exitValue) {
    lines.push(`**Projected Exit Value:** ${formatCurrency(deepdive.exitValue.value)}`);
    if (deepdive.exitValue.rationale) {
      lines.push(`*${deepdive.exitValue.rationale}*`);
    }
    lines.push('');
  }
  
  // Sensitivity Analysis
  lines.push('---');
  lines.push('');
  lines.push('### Sensitivity Analysis');
  lines.push('');
  
  // Group sensitivities by metric
  const dscrSensitivities = deepdive.sensitivities.filter(s => s.resultMetric === 'DSCR');
  const exitSensitivities = deepdive.sensitivities.filter(s => s.resultMetric === 'Exit Value ($M)');
  
  if (dscrSensitivities.length > 0) {
    lines.push('#### DSCR Sensitivity (Rate vs NOI Change)');
    lines.push('');
    lines.push(generateSensitivityTable(dscrSensitivities, 'rowValue', 'colValue', 'resultValue', '%', '%', '.2f'));
    lines.push('');
  }
  
  // Diligence Checklist
  lines.push('---');
  lines.push('');
  lines.push('### Due Diligence Checklist');
  lines.push('');
  
  const byCategory: Record<string, DiligenceItem[]> = groupBy(deepdive.diligenceChecklist, 'category');
  
  for (const [category, items] of Object.entries(byCategory)) {
    lines.push(`#### ${category}`);
    lines.push('');
    for (const item of items as DiligenceItem[]) {
      const priorityIcon = item.priority === 'critical' ? '🔴' : 
                           item.priority === 'important' ? '🟡' : '⚪';
      const statusIcon = item.status === 'complete' ? '✅' : 
                         item.status === 'in_progress' ? '🔄' : 
                         item.status === 'blocked' ? '🚫' : '⬜';
      lines.push(`- ${statusIcon} ${priorityIcon} ${item.item}`);
    }
    lines.push('');
  }
  
  // Sources
  lines.push('---');
  lines.push('');
  lines.push('### Data Sources');
  lines.push('');
  for (const source of deal.sources) {
    const confNote = source.kind === 't12_csv' ? '(Primary)' : 
                     source.kind === 'rentroll_csv' ? '(Primary)' : '(Supporting)';
    lines.push(`- **${source.id}:** ${source.kind} ${confNote}${source.filename ? ` — ${source.filename}` : ''}`);
  }
  lines.push('');
  
  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This memo was generated by the Mosaic Underwriting System. All projections are estimates based on available data and should be verified during due diligence.*');
  lines.push('');
  lines.push(`*Deal ID: ${deal.dealId}*`);
  
  return lines.join('\n');
}

// ============================================================================
// Helper functions
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function generateSensitivityTable(
  data: Array<{ rowValue: number; colValue: number; resultValue: number }>,
  rowKey: string,
  colKey: string,
  valueKey: string,
  rowUnit: string,
  colUnit: string,
  valueFormat: string
): string {
  // Get unique row and column values
  const rowValues = [...new Set(data.map(d => d.rowValue))].sort((a, b) => a - b);
  const colValues = [...new Set(data.map(d => d.colValue))].sort((a, b) => a - b);
  
  // Create lookup
  const lookup: Record<string, number> = {};
  for (const d of data) {
    lookup[`${d.rowValue},${d.colValue}`] = d.resultValue;
  }
  
  // Build table
  const lines: string[] = [];
  
  // Header
  const headerCells = ['Rate \\ NOI', ...colValues.map(c => `${c.toFixed(0)}${colUnit}`)];
  lines.push(`| ${headerCells.join(' | ')} |`);
  lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
  
  // Rows
  for (const rv of rowValues) {
    const cells = [`${rv.toFixed(1)}${rowUnit}`];
    for (const cv of colValues) {
      const val = lookup[`${rv},${cv}`];
      cells.push(val !== undefined ? val.toFixed(2) : 'N/A');
    }
    lines.push(`| ${cells.join(' | ')} |`);
  }
  
  return lines.join('\n');
}
