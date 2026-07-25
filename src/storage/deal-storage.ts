/**
 * Deal Storage Module
 * Handles file system operations for deal folders
 */

import * as fs from 'fs';
import * as path from 'path';
import { Deal, DealSchema, AssetType, Source, ScreenOutput, DeepDiveOutput } from '../core/schemas';
import { addAuditEntry, createDealCreatedEntry, createSourceAddedEntry } from '../core/audit';

// Default deals directory (relative to CWD)
const DEALS_DIR = 'deals';

/**
 * Generate a unique deal ID from name
 */
export function generateDealId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
  const timestamp = Date.now().toString(36);
  return `${slug}-${timestamp}`;
}

/**
 * Get the path to a deal folder
 */
export function getDealPath(dealId: string, baseDir?: string): string {
  const dealsDir = baseDir || path.join(process.cwd(), DEALS_DIR);
  return path.join(dealsDir, dealId);
}

/**
 * Get path to deal.json file
 */
export function getDealJsonPath(dealId: string, baseDir?: string): string {
  return path.join(getDealPath(dealId, baseDir), 'deal.json');
}

/**
 * Get path to inputs folder
 */
export function getInputsPath(dealId: string, baseDir?: string): string {
  return path.join(getDealPath(dealId, baseDir), 'inputs');
}

/**
 * Get path to outputs folder
 */
export function getOutputsPath(dealId: string, baseDir?: string): string {
  return path.join(getDealPath(dealId, baseDir), 'outputs');
}

/**
 * Check if a deal exists
 */
export function dealExists(dealId: string, baseDir?: string): boolean {
  const dealJsonPath = getDealJsonPath(dealId, baseDir);
  return fs.existsSync(dealJsonPath);
}

/**
 * Create a new deal folder structure
 */
export function createDeal(
  name: string, 
  assetType: AssetType,
  location?: string,
  baseDir?: string
): Deal {
  const dealId = generateDealId(name);
  const dealPath = getDealPath(dealId, baseDir);
  
  // Create folder structure
  fs.mkdirSync(dealPath, { recursive: true });
  fs.mkdirSync(path.join(dealPath, 'inputs'), { recursive: true });
  fs.mkdirSync(path.join(dealPath, 'outputs'), { recursive: true });
  
  // Initialize deal object
  const now = new Date().toISOString();
  const deal: Deal = {
    dealId,
    name,
    assetType,
    location: location ? { address: location } : undefined,
    sources: [],
    extracted: { notes: [] },
    assumptions: {},
    underwriting: {},
    auditLog: [],
    createdAt: now,
    updatedAt: now
  };
  
  // Add creation audit entry
  addAuditEntry(deal, createDealCreatedEntry({ name, assetType, location }));
  
  // Save initial deal.json
  saveDeal(deal, baseDir);
  
  return deal;
}

/**
 * Load a deal from disk
 */
export function loadDeal(dealId: string, baseDir?: string): Deal {
  const dealJsonPath = getDealJsonPath(dealId, baseDir);
  
  if (!fs.existsSync(dealJsonPath)) {
    throw new Error(`Deal not found: ${dealId}`);
  }
  
  const raw = fs.readFileSync(dealJsonPath, 'utf-8');
  const data = JSON.parse(raw);
  
  // Validate against schema
  const result = DealSchema.safeParse(data);
  if (!result.success) {
    console.warn('Warning: Deal data has validation issues:', result.error.issues);
    // Return data anyway for backwards compatibility
    return data as Deal;
  }
  
  return result.data;
}

/**
 * Save a deal to disk
 */
export function saveDeal(deal: Deal, baseDir?: string): void {
  const dealJsonPath = getDealJsonPath(deal.dealId, baseDir);
  
  // Ensure parent directory exists
  const dealPath = getDealPath(deal.dealId, baseDir);
  if (!fs.existsSync(dealPath)) {
    fs.mkdirSync(dealPath, { recursive: true });
  }
  
  fs.writeFileSync(dealJsonPath, JSON.stringify(deal, null, 2), 'utf-8');
}

/**
 * Copy a source file into the deal's inputs folder
 */
export function copySourceFile(
  dealId: string, 
  sourcePath: string, 
  baseDir?: string
): string {
  const inputsPath = getInputsPath(dealId, baseDir);
  const filename = path.basename(sourcePath);
  const destPath = path.join(inputsPath, filename);
  
  // Handle duplicate filenames
  let finalPath = destPath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    finalPath = path.join(inputsPath, `${base}-${counter}${ext}`);
    counter++;
  }
  
  fs.copyFileSync(sourcePath, finalPath);
  return finalPath;
}

/**
 * Add a source to a deal
 */
export function addSource(
  deal: Deal,
  kind: Source['kind'],
  filename: string,
  originalPath?: string
): Source {
  const sourceId = `src-${deal.sources.length + 1}-${Date.now().toString(36)}`;
  
  const source: Source = {
    id: sourceId,
    kind,
    filename,
    importedAt: new Date().toISOString()
  };
  
  deal.sources.push(source);
  addAuditEntry(deal, createSourceAddedEntry({ 
    sourceId, 
    kind, 
    filename,
    originalPath 
  }));
  
  return source;
}

/**
 * Write output file (screen.md, ic_memo.md, etc.)
 */
export function writeOutput(
  dealId: string,
  filename: string,
  content: string,
  baseDir?: string
): string {
  const outputsPath = getOutputsPath(dealId, baseDir);
  
  if (!fs.existsSync(outputsPath)) {
    fs.mkdirSync(outputsPath, { recursive: true });
  }
  
  const outputPath = path.join(outputsPath, filename);
  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

/**
 * Write JSON output
 */
export function writeJsonOutput(
  dealId: string,
  filename: string,
  data: unknown,
  baseDir?: string
): string {
  const content = JSON.stringify(data, null, 2);
  return writeOutput(dealId, filename, content, baseDir);
}

/**
 * Write CSV output
 */
export function writeCsvOutput(
  dealId: string,
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  baseDir?: string
): string {
  const lines: string[] = [];
  
  // Header row
  lines.push(headers.map(h => escapeCSV(h)).join(','));
  
  // Data rows
  for (const row of rows) {
    lines.push(row.map(cell => escapeCSV(cell)).join(','));
  }
  
  const content = lines.join('\n');
  return writeOutput(dealId, filename, content, baseDir);
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * List all deals
 */
export function listDeals(baseDir?: string): { dealId: string; name: string; assetType: string; createdAt: string }[] {
  const dealsDir = baseDir || path.join(process.cwd(), DEALS_DIR);
  
  if (!fs.existsSync(dealsDir)) {
    return [];
  }
  
  const dealFolders = fs.readdirSync(dealsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  const deals: { dealId: string; name: string; assetType: string; createdAt: string }[] = [];
  
  for (const dealId of dealFolders) {
    try {
      const deal = loadDeal(dealId, baseDir);
      const createdEntry = deal.auditLog.find(e => e.action === 'DEAL_CREATED');
      deals.push({
        dealId: deal.dealId,
        name: deal.name,
        assetType: deal.assetType,
        createdAt: createdEntry?.timestamp || 'unknown'
      });
    } catch (e) {
      // Skip invalid deal folders
      console.warn(`Skipping invalid deal folder: ${dealId}`);
    }
  }
  
  return deals;
}

/**
 * Read a source file from the inputs folder
 */
export function readSourceFile(dealId: string, filename: string, baseDir?: string): string {
  const inputsPath = getInputsPath(dealId, baseDir);
  const filePath = path.join(inputsPath, filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filename}`);
  }
  
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Generate model.csv for deepdive output
 */
export function writeModelCsv(
  dealId: string,
  deepdive: DeepDiveOutput,
  baseDir?: string
): string {
  const headers = ['Year', 'NOI', 'Debt Service', 'Cash Flow', 'Cumulative CF'];
  
  let cumulative = 0;
  const rows = deepdive.cashflows.map(cf => {
    cumulative += cf.cashFlowAfterDebt.value;
    return [
      cf.year,
      cf.noi.value.toFixed(0),
      cf.debtService.value.toFixed(0),
      cf.cashFlowAfterDebt.value.toFixed(0),
      cumulative.toFixed(0)
    ];
  });

  // Add exit year summary
  const exitYear = deepdive.cashflows.length;
  const exitValue = deepdive.exitValue.value;
  const loanPayoff = deepdive.debtSizing.loanAmount.value;
  const netProceeds = exitValue - loanPayoff;
  
  rows.push([
    `Exit (Y${exitYear})`,
    '-',
    `-${loanPayoff.toFixed(0)}`,
    netProceeds.toFixed(0),
    (cumulative + netProceeds).toFixed(0)
  ]);
  
  return writeCsvOutput(dealId, 'model.csv', headers, rows, baseDir);
}

/**
 * Generate sensitivity.csv for deepdive output
 */
export function writeSensitivityCsv(
  dealId: string,
  deepdive: DeepDiveOutput,
  baseDir?: string
): string {
  // Create DSCR sensitivity grid
  // Cells store: rowValue = interest rate (%), colValue = NOI change (%), resultValue = DSCR
  const dscrSensitivities = deepdive.sensitivities.filter(s => s.resultMetric === 'DSCR');

  if (dscrSensitivities.length === 0) {
    // No sensitivity data
    return writeCsvOutput(dealId, 'sensitivity.csv', ['No sensitivity data'], [], baseDir);
  }

  // Extract unique rate levels and NOI changes
  const rateLevels = [...new Set(dscrSensitivities.map(s => s.rowValue))].sort((a, b) => a - b);
  const noiChanges = [...new Set(dscrSensitivities.map(s => s.colValue))].sort((a, b) => a - b);

  // Build grid
  const headers = ['DSCR Sensitivity', ...rateLevels.map(r => `Rate ${r.toFixed(2)}%`)];

  const rows: (string | number)[][] = [];
  for (const noi of noiChanges) {
    const row: (string | number)[] = [`NOI ${noi >= 0 ? '+' : ''}${noi.toFixed(0)}%`];
    for (const rate of rateLevels) {
      const match = dscrSensitivities.find(s => s.rowValue === rate && s.colValue === noi);
      row.push(match ? match.resultValue.toFixed(2) + 'x' : '-');
    }
    rows.push(row);
  }
  
  return writeCsvOutput(dealId, 'sensitivity.csv', headers, rows, baseDir);
}

export const storage = {
  generateDealId,
  getDealPath,
  getDealJsonPath,
  getInputsPath,
  getOutputsPath,
  dealExists,
  createDeal,
  loadDeal,
  saveDeal,
  copySourceFile,
  addSource,
  writeOutput,
  writeJsonOutput,
  writeCsvOutput,
  listDeals,
  readSourceFile,
  writeModelCsv,
  writeSensitivityCsv
};
