/**
 * PPTX Extractor
 *
 * Investment-committee decks are marketing documents that happen to contain
 * the sponsor's headline numbers, so they belong in the ledger at authority 30
 * rather than being ignored. A deck stating a price the executed amendment
 * contradicts is a conflict worth surfacing, not noise worth dropping.
 *
 * A .pptx is a ZIP. Slide text lives in <a:t> runs inside ppt/slides/slideN.xml.
 * jszip arrives via exceljs, so this costs no new dependency.
 */

import * as fs from 'fs';

/** slide10 must sort after slide9, so compare the numeric suffix. */
function slideOrder(a: string, b: string): number {
  const n = (s: string) => Number((s.match(/slide(\d+)\.xml$/) || [])[1] ?? 0);
  return n(a) - n(b);
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');   // last, so &amp;lt; does not become <
}

export async function extractPptxText(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));

  const names = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort(slideOrder);
  if (!names.length) throw new Error('no ppt/slides/slideN.xml found (not a pptx?)');

  const out: string[] = [];
  for (const name of names) {
    const xml: string = await zip.files[name].async('string');
    const slideNo = (name.match(/slide(\d+)/) || [])[1] ?? '?';

    // Paragraph breaks first, so separate bullets do not run together into a
    // single line and glue unrelated numbers to unrelated labels.
    const lines = xml
      .replace(/<\/a:p>/g, '\n')
      .replace(/<a:tab\/>/g, ' | ')
      .split('\n')
      .map(chunk => {
        const runs = chunk.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
        return runs.map(r => unescapeXml(r.replace(/<\/?a:t>/g, ''))).join('');
      })
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (lines.length) out.push(`--- Slide ${slideNo} ---`, ...lines);
  }
  return out.join('\n');
}
