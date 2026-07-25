/**
 * CSV and XLSX Parsing Utilities
 */

import * as Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  errors: string[];
  rawRowCount: number;
}

// ============================================================================
// Parse CSV file
// ============================================================================

export function parseCSV(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseCSVContent(content);
}

export function parseCSVContent(content: string): ParseResult {
  const errors: string[] = [];
  
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    transform: (value: string) => value.trim(),
  });
  
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      errors.push(`Row ${err.row}: ${err.message}`);
    }
  }
  
  const headers = result.meta.fields || [];
  const rows: ParsedRow[] = (result.data as Record<string, string>[]).map(row => {
    const parsed: ParsedRow = {};
    for (const key of Object.keys(row)) {
      if (key === '__parsed_extra') continue; // PapaParse overflow cells for ragged rows
      const value = row[key];
      // Try to parse as number
      const num = parseNumber(value);
      parsed[key] = num !== null ? num : (value || null);
    }
    return parsed;
  });
  
  return {
    headers,
    rows,
    errors,
    rawRowCount: result.data.length,
  };
}

// ============================================================================
// Parse XLSX file (export to CSV first in real use, but handle if needed)
// ============================================================================

export function parseXLSX(filePath: string, sheetName?: string): ParseResult {
  // Import xlsx dynamically to keep it optional
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx');
  
  const workbook = XLSX.readFile(filePath);
  const sheet = sheetName 
    ? workbook.Sheets[sheetName] 
    : workbook.Sheets[workbook.SheetNames[0]];
  
  if (!sheet) {
    return {
      headers: [],
      rows: [],
      errors: [`Sheet "${sheetName || 'default'}" not found`],
      rawRowCount: 0,
    };
  }
  
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return parseCSVContent(csv);
}

// ============================================================================
// Number parsing with handling for currency, percentages, etc.
// ============================================================================

export function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // Guard against non-string values (e.g. PapaParse __parsed_extra arrays)
  if (typeof value !== 'string') {
    return null;
  }

  // Remove currency symbols, commas, whitespace
  let cleaned = value.replace(/[$,\s]/g, '');
  
  // Handle percentages
  const isPercent = cleaned.endsWith('%');
  if (isPercent) {
    cleaned = cleaned.slice(0, -1);
  }
  
  // Handle parentheses for negatives: (100) -> -100
  const isParenNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isParenNegative) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    return null;
  }
  
  // Convert percentage to decimal if it was a percent
  return isPercent ? num / 100 : num;
}

// ============================================================================
// Detect file type
// ============================================================================

export function detectFileType(filePath: string): 'csv' | 'xlsx' | 'unknown' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx';
  return 'unknown';
}

// ============================================================================
// Smart parse (auto-detect type)
// ============================================================================

export function smartParse(filePath: string): ParseResult {
  const fileType = detectFileType(filePath);
  
  switch (fileType) {
    case 'csv':
      return parseCSV(filePath);
    case 'xlsx':
      return parseXLSX(filePath);
    default:
      return {
        headers: [],
        rows: [],
        errors: [`Unsupported file type: ${path.extname(filePath)}`],
        rawRowCount: 0,
      };
  }
}

// ============================================================================
// Column name matching (fuzzy)
// ============================================================================

const COLUMN_ALIASES: Record<string, string[]> = {
  unit: ['unit', 'unit_#', 'unit_number', 'unit_no', 'suite', 'space'],
  tenant: ['tenant', 'tenant_name', 'lessee', 'occupant', 'company'],
  sqft: ['sqft', 'sf', 'square_feet', 'sq_ft', 'rsf', 'usf', 'nra', 'size'],
  monthly_rent: ['monthly_rent', 'rent', 'monthly', 'current_rent', 'base_rent'],
  annual_rent: ['annual_rent', 'yearly_rent', 'annual', 'annual_base_rent'],
  lease_start: ['lease_start', 'start', 'start_date', 'commencement', 'commence'],
  lease_end: ['lease_end', 'end', 'end_date', 'expiration', 'expire', 'expiry'],
  rent_per_sf: ['rent_per_sf', 'psf', 'rent_psf', 'per_sf', '$/sf'],
  category: ['category', 'type', 'account', 'line_item', 'description'],
  amount: ['amount', 'total', 'value', 'annual', 'ytd'],
  vacancy: ['vacancy', 'vacant', 'unoccupied'],
};

export function matchColumn(header: string, targetType: string): boolean {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const aliases = COLUMN_ALIASES[targetType] || [targetType];
  return aliases.some(alias => {
    const normalizedAlias = alias.replace(/[^a-z0-9]/g, '_');
    return normalized === normalizedAlias || normalized.includes(normalizedAlias);
  });
}

export function findColumn(headers: string[], targetType: string): string | null {
  for (const header of headers) {
    if (matchColumn(header, targetType)) {
      return header;
    }
  }
  return null;
}
