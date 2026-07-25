/**
 * T12 (Trailing 12 Month) Operating Statement Normalizer
 * Parses and normalizes financial data into canonical format
 */

import { T12, T12LineItem, TrackedNumber, tracked } from '../core/schemas';
import { ParseResult, findColumn, parseNumber } from './parsers';

// ============================================================================
// Standard expense categories
// ============================================================================

const REVENUE_KEYWORDS = [
  'revenue', 'income', 'rent', 'rental', 'parking', 'laundry', 
  'storage', 'other income', 'misc income', 'cam', 'reimbursement',
  'recovery', 'late fee', 'application fee', 'pet fee',
];

const EXPENSE_KEYWORDS = [
  'expense', 'cost', 'tax', 'insurance', 'utility', 'utilities',
  'maintenance', 'repair', 'management', 'payroll', 'salary',
  'marketing', 'legal', 'professional', 'administrative', 'admin',
  'contract', 'landscaping', 'security', 'trash', 'water', 'electric',
  'gas', 'sewer', 'cleaning', 'janitorial', 'supplies', 'reserve',
];

const NOI_KEYWORDS = ['noi', 'net operating income', 'net income'];
const TOTAL_REVENUE_KEYWORDS = ['total revenue', 'gross revenue', 'total income', 'effective gross'];
const TOTAL_EXPENSE_KEYWORDS = ['total expense', 'total operating', 'operating expense'];

// ============================================================================
// Categorize a line item
// ============================================================================

type LineCategory = 'revenue' | 'expense' | 'noi' | 'total_revenue' | 'total_expense' | 'unknown';

function categorizeLineItem(description: string): LineCategory {
  const lower = description.toLowerCase();
  
  // Check for totals/NOI first
  if (NOI_KEYWORDS.some(k => lower.includes(k))) return 'noi';
  if (TOTAL_REVENUE_KEYWORDS.some(k => lower.includes(k))) return 'total_revenue';
  if (TOTAL_EXPENSE_KEYWORDS.some(k => lower.includes(k))) return 'total_expense';
  
  // Check for revenue
  if (REVENUE_KEYWORDS.some(k => lower.includes(k))) return 'revenue';
  
  // Check for expense
  if (EXPENSE_KEYWORDS.some(k => lower.includes(k))) return 'expense';
  
  return 'unknown';
}

// ============================================================================
// Normalize T12 from parsed CSV
// ============================================================================

export interface T12NormalizationResult {
  t12: T12;
  warnings: string[];
  unmappedRows: string[];
}

export function normalizeT12(
  parsed: ParseResult,
  sourceId: string
): T12NormalizationResult {
  const warnings: string[] = [];
  const unmappedRows: string[] = [];
  
  // Find column mappings
  const categoryCol = findColumn(parsed.headers, 'category') || 
                      findColumn(parsed.headers, 'description') ||
                      parsed.headers[0]; // Fallback to first column
                      
  const amountCol = findColumn(parsed.headers, 'amount') ||
                    findColumn(parsed.headers, 'annual') ||
                    findColumn(parsed.headers, 'total') ||
                    parsed.headers.find(h => h.includes('12') || h.includes('annual')) ||
                    parsed.headers[1]; // Fallback to second column
  
  if (!categoryCol) {
    warnings.push('Could not identify category/description column');
  }
  if (!amountCol) {
    warnings.push('Could not identify amount column');
  }
  
  const revenue: T12LineItem[] = [];
  const expenses: T12LineItem[] = [];
  
  let extractedNoi: number | null = null;
  let extractedTotalRevenue: number | null = null;
  let extractedTotalExpenses: number | null = null;
  
  // Process each row
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const rowNum = i + 2;
    
    const description = categoryCol ? String(row[categoryCol] || '') : '';
    const amount = amountCol ? parseNumber(row[amountCol]) : null;
    
    if (!description || amount === null) {
      continue; // Skip empty rows
    }
    
    const category = categorizeLineItem(description);
    
    if (category === 'noi') {
      extractedNoi = amount;
      continue;
    }
    
    if (category === 'total_revenue') {
      extractedTotalRevenue = amount;
      continue;
    }
    
    if (category === 'total_expense') {
      extractedTotalExpenses = amount;
      continue;
    }
    
    const lineItem: T12LineItem = {
      category: description,
      annual: tracked(amount, 0.85, {
        sourceId,
        unit: 'USD/year',
        rationale: `From T12 row ${rowNum}`,
      }),
    };
    
    // Add monthly calculation
    lineItem.monthly = tracked(amount / 12, 0.85, {
      sourceId,
      unit: 'USD/month',
      formula: 'annual / 12',
    });
    
    if (category === 'revenue') {
      revenue.push(lineItem);
    } else if (category === 'expense') {
      expenses.push(lineItem);
    } else {
      unmappedRows.push(`Row ${rowNum}: "${description}" - could not categorize`);
    }
  }
  
  // Calculate totals
  const calculatedTotalRevenue = revenue.reduce((sum, item) => sum + item.annual.value, 0);
  const calculatedTotalExpenses = expenses.reduce((sum, item) => sum + item.annual.value, 0);
  const calculatedNoi = calculatedTotalRevenue - calculatedTotalExpenses;
  
  // Use extracted values if available, otherwise calculated
  const finalTotalRevenue = extractedTotalRevenue ?? calculatedTotalRevenue;
  const finalTotalExpenses = extractedTotalExpenses ?? calculatedTotalExpenses;
  const finalNoi = extractedNoi ?? (finalTotalRevenue - finalTotalExpenses);
  
  // Check for discrepancies
  if (extractedTotalRevenue !== null && Math.abs(extractedTotalRevenue - calculatedTotalRevenue) > 100) {
    warnings.push(`Revenue discrepancy: stated ${extractedTotalRevenue.toLocaleString()} vs calculated ${calculatedTotalRevenue.toLocaleString()}`);
  }
  if (extractedTotalExpenses !== null && Math.abs(extractedTotalExpenses - calculatedTotalExpenses) > 100) {
    warnings.push(`Expense discrepancy: stated ${extractedTotalExpenses.toLocaleString()} vs calculated ${calculatedTotalExpenses.toLocaleString()}`);
  }
  if (extractedNoi !== null && Math.abs(extractedNoi - calculatedNoi) > 100) {
    warnings.push(`NOI discrepancy: stated ${extractedNoi.toLocaleString()} vs calculated ${calculatedNoi.toLocaleString()}`);
  }
  
  // Determine confidence based on data quality
  const baseConfidence = 0.85;
  const revenueConfidence = extractedTotalRevenue !== null ? baseConfidence : baseConfidence - 0.1;
  const expenseConfidence = extractedTotalExpenses !== null ? baseConfidence : baseConfidence - 0.1;
  const noiConfidence = extractedNoi !== null ? baseConfidence : Math.min(revenueConfidence, expenseConfidence) - 0.05;
  
  // Build T12
  const t12: T12 = {
    sourceId,
    revenue,
    expenses,
    grossRevenue: tracked(finalTotalRevenue, revenueConfidence, {
      sourceId,
      unit: 'USD/year',
      formula: extractedTotalRevenue !== null ? 'from_statement' : 'sum(revenue)',
      rationale: extractedTotalRevenue !== null 
        ? 'Total from statement' 
        : 'Calculated from line items',
    }),
    totalExpenses: tracked(finalTotalExpenses, expenseConfidence, {
      sourceId,
      unit: 'USD/year',
      formula: extractedTotalExpenses !== null ? 'from_statement' : 'sum(expenses)',
      rationale: extractedTotalExpenses !== null 
        ? 'Total from statement' 
        : 'Calculated from line items',
    }),
    noi: tracked(finalNoi, noiConfidence, {
      sourceId,
      unit: 'USD/year',
      formula: extractedNoi !== null ? 'from_statement' : 'grossRevenue - totalExpenses',
      rationale: extractedNoi !== null 
        ? 'NOI from statement' 
        : 'Calculated: revenue minus expenses',
    }),
  };
  
  // Calculate effective gross income (same as gross revenue for now)
  t12.effectiveGrossIncome = tracked(finalTotalRevenue, revenueConfidence - 0.05, {
    sourceId,
    unit: 'USD/year',
    rationale: 'Assumed equal to gross revenue (no vacancy adjustment in T12)',
  });
  
  // Calculate expense ratio
  if (finalTotalRevenue > 0) {
    t12.expenseRatio = tracked(finalTotalExpenses / finalTotalRevenue, expenseConfidence - 0.05, {
      sourceId,
      formula: 'totalExpenses / grossRevenue',
    });
  }
  
  // Add warnings for data issues
  if (revenue.length === 0) {
    warnings.push('No revenue line items identified');
  }
  if (expenses.length === 0) {
    warnings.push('No expense line items identified');
  }
  if (finalNoi < 0) {
    warnings.push('Negative NOI - verify expense data');
  }
  
  return {
    t12,
    warnings,
    unmappedRows,
  };
}

// ============================================================================
// Estimate NOI from rent roll when T12 not available
// ============================================================================

export function estimateNoiFromRentRoll(
  annualRent: number,
  assetType: string,
  sourceId: string
): TrackedNumber {
  // Use asset-type appropriate expense ratios
  const expenseRatios: Record<string, number> = {
    industrial: 0.30,
    retail: 0.25,
    multifamily: 0.45,
    other: 0.40,
  };
  
  const expenseRatio = expenseRatios[assetType] || 0.40;
  const estimatedNoi = annualRent * (1 - expenseRatio);
  
  return tracked(estimatedNoi, 0.5, {
    sourceId,
    unit: 'USD/year',
    formula: `rent_roll_income * (1 - ${(expenseRatio * 100).toFixed(0)}% expense_ratio)`,
    isProxy: true,
    proxyMethod: `${assetType}_expense_ratio_proxy`,
    rationale: `Estimated using typical ${(expenseRatio * 100).toFixed(0)}% expense ratio for ${assetType}. Actual T12 needed for accuracy.`,
  });
}
