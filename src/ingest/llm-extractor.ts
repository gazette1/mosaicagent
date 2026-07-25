/**
 * LLM extraction pass (model-routed, price-scaled).
 *
 * Runs ONLY when deterministic extraction is insufficient (early-exit lever):
 * regex+sanity got fewer fields than the threshold. Uses the cheapest routed
 * tier with a strict JSON schema. LLM output goes through the SAME sanity
 * ranges as regex output; the model gets no license to invent numbers.
 */

import * as fs from 'fs';
import * as path from 'path';
import { callJson, LlmUsage, UserContent } from '../llm/client';
import { ExtractedNote } from '../core/schemas';
import { passesSanity } from './text-parser';

const EXTRACTION_FIELDS = [
  'askingPrice', 'noi', 'capRate', 'occupancy', 'adr', 'revpar', 'keys',
  'totalSF', 'totalUnits', 'yearBuilt', 'address', 'cityState', 'loanRequest',
] as const;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    EXTRACTION_FIELDS.map(f => [f, {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        value: { type: ['number', 'string'] },
        quote: { type: 'string', description: 'short verbatim quote the value came from' },
        confidence: { type: 'number' },
      },
      required: ['value', 'quote', 'confidence'],
    }])
  ),
  required: [...EXTRACTION_FIELDS],
};

const SYSTEM = `You extract commercial real estate deal facts from documents for an underwriting pipeline.
Rules:
- Only report values explicitly present in the text. Never estimate or infer.
- If a field is not in the text, return null for it.
- askingPrice is the purchase/asking price, NOT a loan amount. loanRequest is the debt being requested.
- occupancy as a decimal (0.52 for 52%). capRate as a decimal (0.0717 for 7.17%).
- Dollar amounts as plain numbers (18400000 for $18.4MM).
- quote is a short verbatim snippet (under 80 chars) proving the value.
- confidence 0-1: 0.9 clear statement, 0.7 requires light interpretation, 0.5 ambiguous.`;

export interface LlmExtractionOutcome {
  merged: number; // fields added
  usage: LlmUsage;
  notes: ExtractedNote[];
  values: Record<string, { value: number | string; confidence: number; rawText: string }>;
}

type FieldHit = { value: number | string; quote: string; confidence: number } | null;

async function runExtraction(
  userContent: UserContent,
  sourceId: string,
  already: Record<string, unknown>
): Promise<LlmExtractionOutcome> {
  const { data, usage } = await callJson<Record<string, FieldHit>>(
    'extraction',
    SYSTEM,
    userContent,
    'deal_extraction',
    SCHEMA,
    1500
  );

  const values: LlmExtractionOutcome['values'] = {};
  const notes: ExtractedNote[] = [];
  let merged = 0;

  for (const field of EXTRACTION_FIELDS) {
    const hit = data[field];
    if (!hit || hit.value === null || hit.value === undefined) continue;
    if (already[field] !== undefined) continue; // deterministic result wins; LLM fills gaps
    if (!passesSanity(field, hit.value)) continue; // same guardrail as regex
    const confidence = Math.max(0.3, Math.min(0.85, hit.confidence)); // capped below primary docs
    values[field] = { value: hit.value, confidence, rawText: hit.quote };
    notes.push({
      sourceId,
      field,
      extractedValue: String(hit.value),
      confidence,
      rawText: `LLM(${usage.model}): "${hit.quote.substring(0, 80)}"`,
    });
    merged++;
  }

  return { merged, usage, notes, values };
}

/** Text-based LLM extraction (documents whose text layer parsed). */
export async function extractWithLlm(
  text: string,
  sourceId: string,
  already: Record<string, unknown>
): Promise<LlmExtractionOutcome> {
  // Cap the input: first 60K chars covers any memo/OM body; appraisals get
  // their leading sections which carry the value conclusions
  const doc = text.length > 60_000 ? text.substring(0, 60_000) : text;
  return runExtraction(`Extract deal facts from this document:\n\n${doc}`, sourceId, already);
}

const MAX_OCR_BYTES = 25 * 1024 * 1024;

/**
 * OCR/vision extraction: sends the PDF itself to the extraction model
 * (OCR happens server-side). For image-based teasers and brochures whose
 * text layer is empty.
 */
export async function extractWithOcrPdf(
  filePath: string,
  sourceId: string,
  already: Record<string, unknown>
): Promise<LlmExtractionOutcome> {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_OCR_BYTES) {
    throw new Error(`PDF too large for OCR pass (${(stat.size / 1e6).toFixed(0)}MB > 25MB)`);
  }
  const b64 = fs.readFileSync(filePath).toString('base64');
  return runExtraction(
    [
      { type: 'file', file: { filename: path.basename(filePath), file_data: `data:application/pdf;base64,${b64}` } },
      { type: 'text', text: 'Extract deal facts from this document. It may be image-based; read the images.' },
    ],
    sourceId,
    already
  );
}

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
};

/** OCR/vision extraction for image files (photographed rent rolls, scans). */
export async function extractWithOcrImage(
  filePath: string,
  sourceId: string,
  already: Record<string, unknown>
): Promise<LlmExtractionOutcome> {
  const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`Unsupported image type: ${path.extname(filePath)}`);
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_OCR_BYTES) {
    throw new Error(`Image too large for OCR pass (${(stat.size / 1e6).toFixed(0)}MB > 25MB)`);
  }
  const b64 = fs.readFileSync(filePath).toString('base64');
  return runExtraction(
    [
      { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
      { type: 'text', text: 'Extract deal facts from this document image.' },
    ],
    sourceId,
    already
  );
}
