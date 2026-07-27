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
import { smartParse, parseXLSXWorkbook } from '../ingest/parsers';
import { normalizeRentRoll } from '../ingest/rentroll-normalizer';
import { normalizeT12, estimateNoiFromRentRoll } from '../ingest/t12-normalizer';
import { parseBrokerEmail, parseOMText, extractFromText } from '../ingest/text-parser';
import { extractFromPdf } from '../ingest/pdf-extractor';
import { extractDocxText } from '../ingest/docx-extractor';
import { ASSET_TYPE_CRITERIA } from '../core/doctrine';
import { llmAvailable } from '../llm/client';
import { extractWithLlm, extractWithOcrPdf, extractWithOcrImage, LlmExtractionOutcome } from '../ingest/llm-extractor';
import { generateNarrative } from '../report/narrative';
import { screenDeal } from '../underwrite/screen';
import { deepDiveDeal } from '../underwrite/deepdive';
import { generateScreenReport } from '../report/screen-report';
import { generateICMemo } from '../report/ic-memo';
import { buildDealWorkbook } from '../report/workbook';
import { generateMemo } from '../report/memo';
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
  .requiredOption('-t, --type <type>', 'Asset type (industrial, retail, multifamily, hotel, lihtc, other)')
  .option('-l, --location <location>', 'Property location')
  .action((options: { name: string; type: string; location?: string }) => {
    const validTypes: AssetType[] = ['industrial', 'retail', 'multifamily', 'hotel', 'lihtc', 'other'];
    
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
  .requiredOption('-k, --kind <kind>', 'Source type (email, om_text, rentroll_csv, t12_csv, pdf, xlsx_model, image, docx)')
  .action(async (options: { deal: string; file: string; kind: string }) => {
    const validKinds: Source['kind'][] = ['email', 'om_text', 'rentroll_csv', 't12_csv', 'pdf', 'xlsx_model', 'image', 'docx', 'manual'];
    
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
          applyHotelMetrics(deal, extracted.extractedValues, source.id);
          
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
          applyHotelMetrics(deal, extracted.extractedValues, source.id);
          
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
        
        case 'pdf': {
          console.log('  Extracting PDF text...');
          const extracted = await extractFromPdf(filePath, source.id);
          console.log(`  ✓ ${extracted.pageCount} pages`);

          if (!deal.extracted.notes) deal.extracted.notes = [];
          deal.extracted.notes.push(...extracted.notes);
          applyExtractedValues(deal, extracted.extractedValues, source.id);
          applyHotelMetrics(deal, extracted.extractedValues, source.id);
          await maybeLlmAugment(deal, extracted.extractedValues, extracted.rawText, source.id);

          // OCR fallback: image-based PDFs have a near-empty text layer.
          // Send the PDF itself to the extraction model (server-side OCR).
          const textPerPage = extracted.pageCount > 0 ? extracted.rawText.length / extracted.pageCount : 0;
          const fieldsSoFar = (deal.extracted.notes ?? []).filter(n => n.sourceId === source.id).length;
          if (llmAvailable() && (extracted.rawText.length < 2000 || textPerPage < 200) && fieldsSoFar < 4) {
            try {
              console.log(`  Text layer thin (${extracted.rawText.length} chars / ${extracted.pageCount} pages) - running OCR pass...`);
              const ocr = await extractWithOcrPdf(filePath, source.id, {});
              applyLlmOutcome(deal, ocr, source.id, 'OCR_EXTRACTION');
            } catch (e) {
              console.warn(`  OCR pass failed: ${e instanceof Error ? e.message : e}`);
            }
          }

          const avgConfidence = extracted.notes.length > 0
            ? extracted.notes.reduce((sum, n) => sum + n.confidence, 0) / extracted.notes.length
            : 0.5;
          auditDataExtracted(deal, source.id, 'pdf', extracted.notes.length, avgConfidence);

          console.log(`  ✓ Extracted ${extracted.notes.length} data points`);
          for (const note of extracted.notes) {
            console.log(`    - ${note.field}: ${note.extractedValue} (confidence: ${note.confidence.toFixed(2)})`);
          }
          break;
        }

        case 'xlsx_model': {
          console.log('  Parsing multi-sheet workbook...');
          const wbParsed = parseXLSXWorkbook(filePath);
          console.log(`  ✓ Sheets (${wbParsed.sheetNames.length}): ${wbParsed.sheetNames.join(', ')}`);

          // Pattern extraction across the full workbook text
          const extracted = extractFromText(wbParsed.asText, source.id);
          if (!deal.extracted.notes) deal.extracted.notes = [];
          deal.extracted.notes.push(...extracted.notes);
          applyExtractedValues(deal, extracted.extractedValues, source.id);
          applyHotelMetrics(deal, extracted.extractedValues, source.id);
          await maybeLlmAugment(deal, extracted.extractedValues, wbParsed.asText, source.id);

          auditDataExtracted(deal, source.id, 'xlsx_model', extracted.notes.length, 0.6);
          console.log(`  ✓ Extracted ${extracted.notes.length} data points across sheets`);
          for (const note of extracted.notes) {
            console.log(`    - ${note.field}: ${note.extractedValue} (confidence: ${note.confidence.toFixed(2)})`);
          }
          break;
        }

        case 'docx': {
          console.log('  Extracting DOCX text...');
          const text = await extractDocxText(filePath);
          console.log(`  ✓ ${text.length} chars`);
          const extracted = extractFromText(text, source.id);
          if (!deal.extracted.notes) deal.extracted.notes = [];
          deal.extracted.notes.push(...extracted.notes);
          applyExtractedValues(deal, extracted.extractedValues, source.id);
          applyHotelMetrics(deal, extracted.extractedValues, source.id);
          await maybeLlmAugment(deal, extracted.extractedValues, text, source.id);
          auditDataExtracted(deal, source.id, 'docx', extracted.notes.length, 0.65);
          console.log(`  ✓ Extracted ${extracted.notes.length} data points (deterministic)`);
          break;
        }

        case 'image': {
          if (!llmAvailable()) {
            console.error('  Image ingest requires OPENAI_API_KEY (.env) for the OCR pass');
            break;
          }
          console.log('  Running OCR/vision extraction on image...');
          try {
            const ocr = await extractWithOcrImage(filePath, source.id, {});
            applyLlmOutcome(deal, ocr, source.id, 'OCR_EXTRACTION');
            auditDataExtracted(deal, source.id, 'image', ocr.merged, 0.6);
          } catch (e) {
            console.warn(`  OCR failed: ${e instanceof Error ? e.message : e}`);
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
// NARRATIVE COMMAND - LLM draft of the package prose (human owns judgment)
// ============================================================================
program
  .command('narrative')
  .description('Draft package narrative sections from deal facts (LLM, DRAFT)')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .action(async (options: { deal: string }) => {
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    if (!llmAvailable()) {
      console.error('Error: OPENAI_API_KEY not set (.env)');
      process.exit(1);
    }
    try {
      const deal = loadDeal(options.deal);
      console.log('Drafting narrative (routed: narrative tier)...');
      const result = await generateNarrative(deal);
      const outPath = writeOutput(deal.dealId, 'narrative.md', result.markdown);
      const htmlPath = writeOutput(deal.dealId, 'narrative.html', result.html);
      console.log(`✓ Styled HTML: ${htmlPath}`);
      deal.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'NARRATIVE_DRAFTED',
        details: {
          model: result.usage.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estCostUsd: +result.usage.estCostUsd.toFixed(5),
        },
      });
      saveDeal(deal);
      console.log(`✓ Narrative draft: ${outPath}`);
      console.log(`  ${result.usage.model}, ${result.usage.inputTokens} in / ${result.usage.outputTokens} out, ~$${result.usage.estCostUsd.toFixed(4)}`);
      console.log('  Risk rating and recommendation intentionally absent: human owns judgment.');
    } catch (error) {
      console.error('Error drafting narrative:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// MEMO COMMAND - Internal underwriting memo (Fulton format, Mosaic verdict)
// ============================================================================
program
  .command('memo')
  .description('Internal underwriting memo with Mosaic verdict (PURSUE/MONITOR/PASS)')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .action(async (options: { deal: string }) => {
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    if (!llmAvailable()) {
      console.error('Error: OPENAI_API_KEY not set (.env)');
      process.exit(1);
    }
    try {
      const deal = loadDeal(options.deal);
      console.log('Drafting underwriting memo (routed: narrative tier)...');
      const result = await generateMemo(deal);
      const mdPath = writeOutput(deal.dealId, 'memo.md', result.markdown);
      const htmlPath = writeOutput(deal.dealId, 'memo.html', result.html);
      deal.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'MEMO_DRAFTED',
        details: {
          model: result.usage.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estCostUsd: +result.usage.estCostUsd.toFixed(5),
        },
      });
      saveDeal(deal);
      console.log(`✓ Memo: ${mdPath}`);
      console.log(`✓ Styled HTML: ${htmlPath}`);
      console.log(`  ${result.usage.model}, ${result.usage.inputTokens} in / ${result.usage.outputTokens} out, ~$${result.usage.estCostUsd.toFixed(4)}`);
      console.log('  Verdict is the doctrine screen in Mosaic vocabulary; analyst confirms or overrides.');
    } catch (error) {
      console.error('Error drafting memo:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// WORKBOOK COMMAND - Generate the lender package workbook
// ============================================================================
program
  .command('workbook')
  .description('Generate the multi-sheet lender package XLSX (live formulas)')
  .requiredOption('-d, --deal <dealId>', 'Deal ID')
  .action(async (options: { deal: string }) => {
    if (!dealExists(options.deal)) {
      console.error(`Error: Deal not found: ${options.deal}`);
      process.exit(1);
    }
    try {
      const deal = loadDeal(options.deal);
      const outDir = path.join(process.cwd(), 'deals', deal.dealId, 'outputs');
      const outPath = await buildDealWorkbook(deal, outDir);
      console.log(`✓ Workbook written: ${outPath}`);
      console.log('  Sheets: Summary, Inputs, Pro Forma, Debt, Sensitivity, Audit');
      console.log('  All computed cells are live formulas; Inputs carries source + confidence per value');
    } catch (error) {
      console.error('Error generating workbook:', error instanceof Error ? error.message : error);
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
 * Apply extracted values from text parsing to the deal.
 *
 * Resolution rule: HIGHEST CONFIDENCE WINS across sources. First-wins let a
 * "3 Cap" tax-form fragment beat an appraisal's stated 6.25% cap rate, and a
 * superseded PSA price beat the executed amendment. Ties keep the incumbent.
 */
function applyExtractedValues(
  deal: ReturnType<typeof loadDeal>,
  extractedValues: Record<string, { value: number | string; confidence: number; rawText: string }>,
  sourceId: string
): void {
  const beats = (incoming: { confidence: number }, incumbent?: { confidence?: number } | null): boolean =>
    !incumbent || incoming.confidence > (incumbent.confidence ?? 0);

  const price = extractedValues['askingPrice'];
  if (price && typeof price.value === 'number' && beats(price, deal.askingPrice)) {
    deal.askingPrice = tracked(price.value, price.confidence, {
      sourceId,
      unit: 'USD',
      rationale: `Extracted from text: "${price.rawText.substring(0, 50)}..."`,
    });
  }

  // Location: keep the first plausible address (junk tax-form fragments carry
  // the same pattern confidence, so confidence cannot arbitrate here)
  if (extractedValues['address'] && !deal.location) {
    const address = extractedValues['address'];
    if (typeof address.value === 'string') {
      deal.location = { address: address.value };
    }
  }

  const noi = extractedValues['noi'];
  if (noi && typeof noi.value === 'number' && beats(noi, deal.extracted.t12?.noi)) {
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

  // Capital budget: a PIP or renovation budget in the room means capex IS
  // priced, which is what the CapEx kill criterion tests against
  const capex = extractedValues['capexTotal'];
  if (capex && typeof capex.value === 'number' && beats(capex, deal.assumptions.capexTotal)) {
    deal.assumptions.capexTotal = tracked(capex.value, capex.confidence, {
      sourceId,
      unit: 'USD',
      rationale: `Renovation / PIP budget: "${capex.rawText.substring(0, 60)}"`,
    });
  }

  // Apply cap rate as an assumption if extracted (highest confidence wins)
  const cap = extractedValues['capRate'];
  if (cap && typeof cap.value === 'number' && beats({ confidence: cap.confidence - 0.1 }, deal.assumptions.entryCap)) {
    deal.assumptions.entryCap = tracked(cap.value, cap.confidence - 0.1, { // Lower confidence for cap rate from text
      sourceId,
      unit: '%',
      rationale: `Extracted from broker materials - verify independently: "${cap.rawText.substring(0, 40)}"`,
    });
  }
}

/**
 * LLM augmentation: runs only when deterministic extraction came up short
 * (early-exit lever). Cheapest routed model, JSON-schema output, same sanity
 * ranges. Cost is audit-logged per call.
 */
async function maybeLlmAugment(
  deal: ReturnType<typeof loadDeal>,
  extractedValues: Record<string, { value: number | string; confidence: number; rawText: string }>,
  rawText: string,
  sourceId: string
): Promise<void> {
  if (!llmAvailable()) return;
  // The LLM pass now ALWAYS runs on text documents: numeric gap-fill keeps
  // its value, but the structure-flag sweep (GP transfers, agency approvals,
  // evictions, fee overhangs) has no deterministic substitute and the red
  // tape is usually the story. Nano-tier cost, ~$0.001/doc.
  const found = Object.keys(extractedValues).length;
  try {
    console.log(`  LLM pass (${found} deterministic fields; gap-fill + structure-flag sweep)...`);
    const out = await extractWithLlm(rawText, sourceId, extractedValues);
    applyLlmOutcome(deal, out, sourceId, 'LLM_EXTRACTION');
  } catch (e) {
    console.warn(`  LLM pass failed (kept deterministic results): ${e instanceof Error ? e.message : e}`);
  }
}

/** Merge an LLM extraction outcome into the deal with cost audit-logged. */
function applyLlmOutcome(
  deal: ReturnType<typeof loadDeal>,
  out: LlmExtractionOutcome,
  sourceId: string,
  action: string
): void {
  if (!deal.extracted.notes) deal.extracted.notes = [];
  deal.extracted.notes.push(...out.notes);
  applyExtractedValues(deal, out.values, sourceId);
  applyHotelMetrics(deal, out.values, sourceId);
  // Structure flags land as notes so every surface (back office, narrative,
  // screen) sees the red tape alongside the numbers. Deduped by normalized
  // label: three years of audited financials repeat the same LP covenants.
  const flagKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
  const existingFlagKeys = new Set(
    deal.extracted.notes
      .filter(n => n.field === 'structureFlag')
      .map(n => flagKey(n.extractedValue.replace(/^[A-Z]+:\s*/, '').split(' - ')[0]))
  );
  for (const f of out.structureFlags ?? []) {
    const key = flagKey(f.flag);
    if (existingFlagKeys.has(key)) continue;
    existingFlagKeys.add(key);
    deal.extracted.notes.push({
      sourceId,
      field: 'structureFlag',
      extractedValue: `${f.severity.toUpperCase()}: ${f.flag} - ${f.detail}`,
      confidence: f.severity === 'serious' ? 0.85 : f.severity === 'caution' ? 0.7 : 0.6,
      rawText: `"${(f.quote || '').substring(0, 90)}"`,
    });
    console.log(`    ! [${f.severity.toUpperCase()}] ${f.flag}: ${f.detail.substring(0, 80)}`);
  }
  deal.auditLog.push({
    timestamp: new Date().toISOString(),
    action,
    details: {
      sourceId,
      model: out.usage.model,
      fieldsAdded: out.merged,
      inputTokens: out.usage.inputTokens,
      outputTokens: out.usage.outputTokens,
      estCostUsd: +out.usage.estCostUsd.toFixed(5),
      attempts: out.usage.attempts,
    },
  });
  console.log(`  ✓ ${action === 'OCR_EXTRACTION' ? 'OCR' : 'LLM'} added ${out.merged} fields (${out.usage.model}, ${out.usage.inputTokens} in / ${out.usage.outputTokens} out, ~$${out.usage.estCostUsd.toFixed(4)})`);
  for (const n of out.notes) {
    console.log(`    + ${n.field}: ${n.extractedValue} (confidence: ${n.confidence.toFixed(2)})`);
  }
}

/**
 * Populate hotel metrics from extracted values (hotel deals only).
 * Hotels underwrite off keys x occupancy x ADR; if NOI is absent it is
 * proxied through the hotel expense ratio and flagged as such.
 */
function applyHotelMetrics(
  deal: ReturnType<typeof loadDeal>,
  extractedValues: Record<string, { value: number | string; confidence: number; rawText: string }>,
  sourceId: string
): void {
  if (deal.assetType !== 'hotel') return;

  const num = (field: string): { value: number; confidence: number } | null => {
    const e = extractedValues[field];
    return e && typeof e.value === 'number' ? { value: e.value, confidence: e.confidence } : null;
  };

  const keys = num('keys') ?? num('totalUnits');
  const adr = num('adr');
  const occ = num('occupancy');
  const revpar = num('revpar');

  if (!keys && !adr && !occ && !revpar) return;

  const hotel = deal.extracted.hotel ?? { sourceId };
  const set = (k: 'keys' | 'occupancy' | 'adr' | 'revpar', v: { value: number; confidence: number } | null, unit: string) => {
    if (v && !hotel[k]) hotel[k] = tracked(v.value, v.confidence, { sourceId, unit });
  };
  set('keys', keys, 'keys');
  set('adr', adr, 'USD');
  set('occupancy', occ, 'decimal');
  set('revpar', revpar, 'USD');

  // Derive RevPAR when missing
  if (!hotel.revpar && hotel.adr && hotel.occupancy) {
    hotel.revpar = tracked(hotel.adr.value * hotel.occupancy.value, Math.min(hotel.adr.confidence, hotel.occupancy.confidence), {
      sourceId, unit: 'USD', formula: 'ADR x occupancy',
    });
  }

  // Proxy NOI from keys x occ x ADR through the hotel expense ratio when
  // no operating statement NOI exists
  if (!deal.extracted.t12?.noi && hotel.keys && hotel.adr && hotel.occupancy) {
    const roomsRev = hotel.keys.value * 365 * hotel.occupancy.value * hotel.adr.value;
    const ratio = ASSET_TYPE_CRITERIA['hotel'].defaultExpenseRatio;
    const noi = roomsRev * (1 - ratio);
    const conf = Math.min(hotel.keys.confidence, hotel.adr.confidence, hotel.occupancy.confidence) - 0.2;
    hotel.roomsRevenue = tracked(roomsRev, conf + 0.1, { sourceId, unit: 'USD/year', formula: 'keys x 365 x occ x ADR' });
    hotel.noi = tracked(noi, Math.max(conf, 0.3), {
      sourceId, unit: 'USD/year', isProxy: true,
      proxyMethod: 'rooms_revenue_expense_ratio',
      formula: `roomsRevenue x (1 - ${ratio})`,
      rationale: 'Proxy NOI; request operating statements',
    });
    deal.extracted.t12 = {
      sourceId,
      revenue: [],
      expenses: [],
      noi: hotel.noi,
    };
  }

  deal.extracted.hotel = hotel;
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
