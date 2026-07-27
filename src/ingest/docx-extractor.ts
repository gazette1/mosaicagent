/**
 * DOCX Extractor
 * A .docx is a ZIP with the text in word/document.xml. Paragraphs and table
 * rows become lines; table cells become " | " separated segments so tabular
 * memos read as rows. jszip arrives via exceljs, no new dependency.
 */

import * as fs from 'fs';

export async function extractDocxText(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('word/document.xml not found (not a docx?)');
  let xml: string = await doc.async('string');
  xml = xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n');
  const text = xml
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .split('\n')
    .map(l => l.replace(/\s*\|\s*$/, '').trim())
    .filter(Boolean)
    .join('\n');
  return text;
}
