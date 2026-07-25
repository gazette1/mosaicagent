/**
 * PDF Extractor
 * Pulls text from PDF documents (OMs, appraisals, memos, term sheets) and
 * runs it through the pattern extraction layer. Deterministic; an LLM
 * extraction pass can be layered on the same text later (model routing:
 * extraction is a small-model job when it arrives).
 */

import * as fs from 'fs';
import { extractFromText, TextExtractionResult } from './text-parser';

export interface PdfExtractionResult extends TextExtractionResult {
  pageCount: number;
}

export async function extractFromPdf(filePath: string, sourceId: string): Promise<PdfExtractionResult> {
  // Lazy require keeps pdf-parse (and its pdfjs payload) out of non-PDF runs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PDFParse } = require('pdf-parse');

  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    const text: string = result.text || '';
    const pageCount: number = result.pages ? result.pages.length : 0;
    const extraction = extractFromText(text, sourceId);
    return { ...extraction, pageCount };
  } finally {
    await parser.destroy();
  }
}
