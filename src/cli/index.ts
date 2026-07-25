#!/usr/bin/env node

/**
 * Mosaic Underwriting CLI
 * Local-first real estate deal underwriting tool
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { 
  createDeal, 
  loadDeal, 
  saveDeal, 
  addSource, 
  copySourceFile,
  dealExists,
  listDeals,
  writeOutput,
  writeJsonOutput,
  writeModelCsv,
  writeSensitivityCsv,
  getOutputsPath
} from '../storage';
import { AssetType, Source, ExtractedNote, tracked } from '../core/schemas';
import { smartParse } from '../ingest/parsers';
import { normalizeRentRoll } from '../ingest/rentroll-normalizer';
import { normalizeT12, estimateNoiFromRentRoll } from '../ingest/t12-normalizer';
import { parseBrokerEmail, parseOMText } from '../ingest/text-parser';
import { screenDeal } from '../underwrite/screen';
import { deepDiveDeal } from '../underwrite/deepdive';
import { generateScreenReport } from '../report/screen-report';
import { generateICMemo } from '../report/ic-memo';
import { auditDataExtracted, auditProxyApplied, auditSourceAdded } from '../core/audit';

const program = new Command();

program
  .name('mosaic')
  .description('Local-first CLI for real estate deal underwriting')
  .version('1.0.0');

// ============================================================================
// NEW COMMAND - Create a new deal
// ============================================================================
program
  .command('new')
  .description('Create a new deal folder')
  .requiredOption('-n, --name <n>', 'Deal name')
  .requiredOption('-t, --type <type>', 'Asset type (industrial, retail, multifamily, other)')
  .option('-l, --location <location>', 'Property location')
  .action((options: { name: string; type: string; location?: string }) => {
    const validTypes: AssetType[] = ['industrial', 'retail', 'multifamily', 'other'];
    
    if (!validTypes.includes(options.type as AssetType)) {
      console.error(`Error: Invalid asset type "${options.type}". Must be one of: ${validTypes.join(', ')}`);
      process.exit(1);
    }
    
    try {
      const deal = createDeal(
        options.name,
        options.type as AssetType,
        options.location
      );
      
      console.log(`✓ Created deal: ${deal.dealId}`);
      console.log(`  Name: ${deal.name}`);
      console.log(`  Type: ${deal.assetType}`);
      if (deal.location) console.log(`  Location: ${deal.location.address || ''}`);
      console.log(`  Folder: deals/${deal.dealId}/`);
      console.log('');
      console.log('Next steps:');
      console.log(`  mosaic ingest --deal ${deal.dealId} --file <path> --kind <email|om_text|rentroll_csv|t12_csv>`);
    } catch (error) {
      console.error('Error creating deal:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// LIST COMMAND - Show all deals
// ============================================================================
program
  .command('list')
  .description('List all deals')
  .action(() => {
    try {
      const deals = listDeals();
      
      if (deals.length === 0) {
        console.log('No deals found. Create one with: mosaic new --name "<n>" --type <type>');
        return;
      }
      
      console.log('Deals:');
      console.log('─'.repeat(60));
      
      for (const dealInfo of deals) {
        const deal = loadDeal(dealInfo.dealId);
        const screenStatus = deal.underwriting.screen 
          ? `[${deal.underwriting.screen.verdict}]` 
          : '[Not screened]';
        console.log(`  ${deal.dealId}: ${deal.name} (${deal.assetType}) ${screenStatus}`);
      }
    } catch (error) {
      console.error('Error listing deals:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// INGEST COMMAND - Add source files to a deal
// ============================================================================
program
  .command('ingest')
  .description('Ingest a source file into a deal')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .requiredOption('-f, --file <path>', 'Path to source file')
  .requiredOption('-k, --kind <kind>', 'Source type (email, om_text, rentroll_csv, t12_csv)')
  .action((options: { deal: string; file: string; kind: string }) => {
    const validKinds: Source['kind'][] = ['email', 'om_text', 'rentroll_csv', 't12_csv', 'manual'];
    
    if (!validKinds.includes(options.kind as Source['kind'])) {
      console.error(`Error: Invalid kind "${options.kind}". Must be one of: ${validKinds.join(', ')}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(options.file)) {
      console.error(`Error: File not found: ${options.file}`);
      process.exit(1);
    }
    
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    
    try {
      const deal = loadDeal(options.deal);
      const kind = options.kind as Source['kind'];
      
      // Copy file to inputs folder
      const copiedPath = copySourceFile(deal.dealId, options.file);
      const filename = path.basename(copiedPath);
      
      // Add source to deal
      const source = addSource(deal, kind, filename, options.file);
      auditSourceAdded(deal, source.id, kind, filename);
      
      console.log(`✓ Added source: ${source.id}`);
      console.log(`  Kind: ${kind}`);
      console.log(`  File: ${filename}`);
      
      // Parse based on kind
      const filePath = copiedPath;
      
      switch (kind) {
        case 'rentroll_csv': {
          console.log('  Parsing rent roll...');
          const parsed = smartParse(filePath);
          
          if (parsed.errors.length > 0) {
            console.warn(`  Warnings: ${parsed.errors.length} parse errors`);
          }
          
          const result = normalizeRentRoll(parsed, source.id);
          deal.extracted.rentRoll = result.rentRoll;
          
          if (result.warnings.length > 0) {
            for (const warning of result.warnings) {
              console.warn(`  Warning: ${warning}`);
            }
          }
          
          // Audit the extraction
          const confidence = result.rentRoll.occupancyRate?.confidence ?? 0.7;
          auditDataExtracted(deal, source.id, 'rentRoll', result.rentRoll.tenants.length, confidence);
          
          console.log(`  ✓ Extracted ${result.rentRoll.tenants.length} units`);
          if (result.rentRoll.occupancyRate) {
            console.log(`  ✓ Occupancy: ${(result.rentRoll.occupancyRate.value * 100).toFixed(1)}% (confidence: ${result.rentRoll.occupancyRate.confidence.toFixed(2)})`);
          }
          if (result.rentRoll.grossPotentialRent) {
            console.log(`  ✓ Gross Rent: $${result.rentRoll.grossPotentialRent.value.toLocaleString()}/yr`);
          }
          
          // Estimate NOI if no T12 exists
          if (!deal.extracted.t12 && result.rentRoll.effectiveGrossRent) {
            console.log('  No T12 found - estimating NOI from rent roll...');
            const estimatedNoi = estimateNoiFromRentRoll(
              result.rentRoll.effectiveGrossRent.value,
              deal.assetType,
              source.id
            );
            
            // Create a minimal T12 with just the estimated NOI
            deal.extracted.t12 = {
              sourceId: source.id,
              revenue: [],
              expenses: [],
              noi: estimatedNoi,
            };
            
            auditProxyApplied(
              deal,
              'NOI',
              estimatedNoi.value,
              'rentroll_expense_ratio',
              `Estimated from rent roll using ${deal.assetType} expense ratio`
            );
            
            console.log(`  ✓ Estimated NOI: $${estimatedNoi.value.toLocaleString()}/yr (proxy, confidence: ${estimatedNoi.confidence.toFixed(2)})`);
          }
          break;
        }
        
        case 't12_csv': {
          console.log('  Parsing T12 operating statement...');
          const parsed = smartParse(filePath);
          
          if (parsed.errors.length > 0) {
            console.warn(`  Warnings: ${parsed.errors.length} parse errors`);
          }
          
          const result = normalizeT12(parsed, source.id);
          deal.extracted.t12 = result.t12;
          
          if (result.warnings.length > 0) {
            for (const warning of result.warnings) {
              console.warn(`  Warning: ${warning}`);
            }
          }
          
          const confidence = result.t12.noi?.confidence ?? 0.5;
          auditDataExtracted(deal, source.id, 't12', result.t12.revenue.length + result.t12.expenses.length, confidence);
          
          console.log(`  ✓ Revenue items: ${result.t12.revenue.length}`);
          console.log(`  ✓ Expense items: ${result.t12.expenses.length}`);
          if (result.t12.noi) {
            console.log(`  ✓ NOI: $${result.t12.noi.value.toLocaleString()}/yr (confidence: ${result.t12.noi.confidence.toFixed(2)})`);
          }
          break;
        }
        
        case 'email': {
          console.log('  Parsing broker email...');
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const extracted = parseBrokerEmail(fileContent, source.id);
          
          // Initialize notes array if needed
          if (!deal.extracted.notes) {
            deal.extracted.notes = [];
          }
          deal.extracted.notes.push(...extracted.notes);
          
          // Apply extracted values to deal
          applyExtractedValues(deal, extracted.extractedValues, source.id);
          
          const avgConfidence = extracted.notes.length > 0 
            ? extracted.notes.reduce((sum, n) => sum + n.confidence, 0) / extracted.notes.length 
            : 0.5;
          auditDataExtracted(deal, source.id, 'email', extracted.notes.length, avgConfidence);
          
          console.log(`  ✓ Extracted ${extracted.notes.length} data points`);
          for (const note of extracted.notes) {
            console.log(`    - ${note.field}: ${note.extractedValue} (confidence: ${note.confidence.toFixed(2)})`);
          }
          break;
        }
        
        case 'om_text': {
          console.log('  Parsing offering memorandum...');
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const extracted = parseOMText(fileContent, source.id);
          
          // Initialize notes array if needed
          if (!deal.extracted.notes) {
            deal.extracted.notes = [];
          }
          deal.extracted.notes.push(...extracted.notes);
          
          // Apply extracted values to deal
          applyExtractedValues(deal, extracted.extractedValues, source.id);
          
          const avgConfidence = extracted.notes.length > 0 
            ? extracted.notes.reduce((sum, n) => sum + n.confidence, 0) / extracted.notes.length 
            : 0.5;
          auditDataExtracted(deal, source.id, 'om', extracted.notes.length, avgConfidence);
          
          console.log(`  ✓ Extracted ${extracted.notes.length} data points`);
          for (const note of extracted.notes) {
            console.log(`    - ${note.field}: ${note.extractedValue} (confidence: ${note.confidence.toFixed(2)})`);
          }
          break;
        }
        
        default:
          console.log('  No parsing implemented for this kind');
      }
      
      // Save deal
      saveDeal(deal);
      console.log(`✓ Deal saved`);
      
    } catch (error) {
      console.error('Error ingesting file:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// SCREEN COMMAND - Phase 1 quick screen
// ============================================================================
program
  .command('screen')
  .description('Run Phase 1 screening')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .action((options: { deal: string }) => {
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    
    try {
      const deal = loadDeal(options.deal);
      
      console.log(`Screening: ${deal.name}`);
      console.log('─'.repeat(60));
      
      // Run screening
      const screenResult = screenDeal(deal);
      deal.underwriting.screen = screenResult.output;
      
      // Generate report
      const report = generateScreenReport(deal, screenResult.output);
      
      // Write outputs
      const mdPath = writeOutput(deal.dealId, 'screen.md', report);
      const jsonPath = writeJsonOutput(deal.dealId, 'screen.json', screenResult.output);
      
      // Save updated deal
      saveDeal(deal);
      
      // Display summary
      const screenOutput = screenResult.output;
      console.log('');
      console.log(`VERDICT: ${screenOutput.verdict}`);
      console.log(`Risk Score: ${screenOutput.riskScore}/5`);
      console.log(`Rationale: ${screenOutput.riskScoreRationale}`);
      
      if (screenOutput.killFlags.filter(f => f.triggered).length > 0) {
        console.log('');
        console.log('Kill Flags Triggered:');
        for (const flag of screenOutput.killFlags.filter(f => f.triggered)) {
          console.log(`  ⚠ [${flag.severity.toUpperCase()}] ${flag.criterion}: ${flag.reason}`);
        }
      }
      
      console.log('');
      console.log('Key Metrics:');
      for (const [, metric] of Object.entries(screenOutput.keyMetrics)) {
        const val = metric.value.value;
        const conf = metric.value.confidence;
        const unit = metric.value.unit;
        // Values are stored display-ready: unit '%' is already scaled to percent
        const formatted = typeof val !== 'number' ? val
          : unit === '%' ? val.toFixed(2) + '%'
          : unit === 'x' ? val.toFixed(2) + 'x'
          : '$' + Math.round(val).toLocaleString();
        console.log(`  ${metric.name}: ${formatted} (conf: ${conf.toFixed(2)})`);
      }
      
      console.log('');
      console.log('Data Quality:');
      console.log(`  Overall Confidence: ${(screenOutput.confidenceSummary.overall * 100).toFixed(0)}%`);
      if (screenOutput.confidenceSummary.criticalGaps.length > 0) {
        console.log(`  Critical Gaps: ${screenOutput.confidenceSummary.criticalGaps.join(', ')}`);
      }
      
      console.log('');
      console.log('Outputs:');
      console.log(`  ${mdPath}`);
      console.log(`  ${jsonPath}`);
      
    } catch (error) {
      console.error('Error running screen:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// DEEPDIVE COMMAND - Full underwriting model
// ============================================================================
program
  .command('deepdive')
  .description('Run Phase 2 deep dive analysis')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .action((options: { deal: string }) => {
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    
    try {
      const deal = loadDeal(options.deal);
      
      console.log(`Deep Dive: ${deal.name}`);
      console.log('─'.repeat(60));
      
      // Run screen first if not done
      if (!deal.underwriting.screen) {
        console.log('Running screening first...');
        const screenResult = screenDeal(deal);
        deal.underwriting.screen = screenResult.output;
      }
      
      // Run deep dive
      const deepdiveOutput = deepDiveDeal(deal);
      deal.underwriting.deepdive = deepdiveOutput;
      
      // Generate IC memo
      const memo = generateICMemo(deal, deepdiveOutput, deal.underwriting.screen);
      
      // Write outputs
      const memoPath = writeOutput(deal.dealId, 'ic_memo.md', memo);
      const jsonPath = writeJsonOutput(deal.dealId, 'deepdive.json', deepdiveOutput);
      const modelPath = writeModelCsv(deal.dealId, deepdiveOutput);
      const sensPath = writeSensitivityCsv(deal.dealId, deepdiveOutput);
      
      // Save updated deal
      saveDeal(deal);
      
      // Display summary
      console.log('');
      console.log('Investment Thesis:');
      console.log(`  ${deepdiveOutput.thesis}`);
      
      console.log('');
      console.log('Projected Returns:');
      console.log(`  Equity Multiple: ${deepdiveOutput.returns.equityMultiple.value.toFixed(2)}x`);
      console.log(`  Cash-on-Cash: ${deepdiveOutput.returns.cashOnCash.value.toFixed(1)}%`);
      console.log(`  IRR (approx): ${deepdiveOutput.returns.leveredIRR.value.toFixed(1)}%`);
      
      console.log('');
      console.log('Strategy Options:');
      deepdiveOutput.strategyOptions.forEach((strategy, i) => {
        console.log(`  ${i + 1}. ${strategy.name}: ${strategy.description}`);
      });
      
      console.log('');
      console.log('Key Risks:');
      for (const risk of deepdiveOutput.keyRisks.slice(0, 3)) {
        console.log(`  - ${risk.risk} (${risk.likelihood}/${risk.impact}): ${risk.mitigant}`);
      }
      
      console.log('');
      console.log('Outputs:');
      console.log(`  ${memoPath}`);
      console.log(`  ${jsonPath}`);
      console.log(`  ${modelPath}`);
      console.log(`  ${sensPath}`);
      
    } catch (error) {
      console.error('Error running deep dive:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// SHOW COMMAND - Display deal details
// ============================================================================
program
  .command('show')
  .description('Show deal details')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .action((options: { deal: string }) => {
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    
    try {
      const deal = loadDeal(options.deal);
      
      console.log(`Deal: ${deal.name}`);
      console.log('─'.repeat(60));
      console.log(`  ID: ${deal.dealId}`);
      console.log(`  Asset Type: ${deal.assetType}`);
      if (deal.location) console.log(`  Location: ${deal.location.address || ''}`);
      if (deal.askingPrice) console.log(`  Asking Price: $${deal.askingPrice.value.toLocaleString()}`);
      console.log(`  Created: ${deal.createdAt}`);
      console.log(`  Updated: ${deal.updatedAt}`);
      
      console.log('');
      console.log('Sources:');
      if (deal.sources.length === 0) {
        console.log('  (none)');
      } else {
        for (const source of deal.sources) {
          console.log(`  - [${source.kind}] ${source.filename || source.id} (${source.importedAt})`);
        }
      }
      
      console.log('');
      console.log('Extracted Data:');
      if (deal.extracted.rentRoll) {
        const rr = deal.extracted.rentRoll;
        console.log(`  Rent Roll: ${rr.tenants.length} units`);
        if (rr.occupancyRate) console.log(`    Occupancy: ${(rr.occupancyRate.value * 100).toFixed(1)}%`);
        if (rr.effectiveGrossRent) console.log(`    Gross Rent: $${rr.effectiveGrossRent.value.toLocaleString()}/yr`);
      }
      if (deal.extracted.t12) {
        const t12 = deal.extracted.t12;
        console.log(`  T12: ${t12.revenue.length} revenue, ${t12.expenses.length} expense items`);
        if (t12.noi) console.log(`    NOI: $${t12.noi.value.toLocaleString()}/yr`);
      }
      if (deal.extracted.notes && deal.extracted.notes.length > 0) {
        console.log(`  Notes: ${deal.extracted.notes.length} extracted data points`);
      }
      
      console.log('');
      console.log('Underwriting Status:');
      if (deal.underwriting.screen) {
        console.log(`  Screen: ${deal.underwriting.screen.verdict} (Risk: ${deal.underwriting.screen.riskScore}/5)`);
      } else {
        console.log('  Screen: Not run');
      }
      if (deal.underwriting.deepdive) {
        console.log(`  Deep Dive: Complete`);
        console.log(`    IRR: ${deal.underwriting.deepdive.returns.leveredIRR.value.toFixed(1)}%`);
        console.log(`    Equity Multiple: ${deal.underwriting.deepdive.returns.equityMultiple.value.toFixed(2)}x`);
      } else {
        console.log('  Deep Dive: Not run');
      }
      
      console.log('');
      console.log(`Audit Log: ${deal.auditLog.length} entries`);
      
    } catch (error) {
      console.error('Error showing deal:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply extracted values from text parsing to the deal
 */
function applyExtractedValues(
  deal: ReturnType<typeof loadDeal>,
  extractedValues: Record<string, { value: number | string; confidence: number; rawText: string }>,
  sourceId: string
): void {
  // Apply asking price if extracted and not already set
  if (extractedValues['askingPrice'] && !deal.askingPrice) {
    const price = extractedValues['askingPrice'];
    if (typeof price.value === 'number') {
      deal.askingPrice = tracked(price.value, price.confidence, {
        sourceId,
        unit: 'USD',
        rationale: `Extracted from text: "${price.rawText.substring(0, 50)}..."`,
      });
    }
  }
  
  // Apply location if extracted and not already set
  if (extractedValues['address'] && !deal.location) {
    const address = extractedValues['address'];
    if (typeof address.value === 'string') {
      deal.location = { address: address.value };
    }
  }
  
  // If NOI is extracted and no T12 exists, create a minimal T12
  if (extractedValues['noi'] && !deal.extracted.t12) {
    const noi = extractedValues['noi'];
    if (typeof noi.value === 'number') {
      deal.extracted.t12 = {
        sourceId,
        revenue: [],
        expenses: [],
        noi: tracked(noi.value, noi.confidence, {
          sourceId,
          unit: 'USD/year',
          rationale: `Extracted from text: "${noi.rawText.substring(0, 50)}..."`,
        }),
      };
    }
  }
  
  // Apply cap rate as an assumption if extracted
  if (extractedValues['capRate'] && !deal.assumptions.entryCap) {
    const cap = extractedValues['capRate'];
    if (typeof cap.value === 'number') {
      deal.assumptions.entryCap = tracked(cap.value, cap.confidence - 0.1, { // Lower confidence for cap rate from text
        sourceId,
        unit: '%',
        rationale: `Extracted from broker materials - verify independently`,
      });
    }
  }
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
