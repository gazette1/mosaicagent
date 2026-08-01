/**
 * Instrument Segmentation
 *
 * The claims ledger assumed the unit of authority is the FILE. Real deal rooms
 * disagree. On the Caven Point package, "Jersey Mike's Termsheet +
 * Amendment_5.17.26 (2).pdf" is a single PDF containing two legal instruments:
 * pages 1-3 are the April 20 Term Sheet ($60MM seller mortgage, first lien, no
 * junior debt) and pages 4-6 are the May 13 First Amendment that reverses the
 * junior-debt prohibition. One file, two generations of terms, and the older
 * generation is the one a naive reader quotes.
 *
 * File-level ranking also fails on filenames alone. The controlling document in
 * that room is named "...vADDENDUM_(CG_Comments_20260513)doc (3) (1).pdf" while
 * its title line reads "FIRST AMENDMENT TO NON-BINDING TERM SHEET". Filenames
 * are written by whoever last hit Save As. Title lines are written by lawyers.
 *
 * So: split a document into instruments, rank and date each one from its own
 * text, and locate each claim by the verbatim quote the ledger already requires
 * it to carry. The provenance requirement pays for itself here, because the
 * quote is what tells us which generation of the deal a number belongs to.
 */

import { extractDocDate, amendmentRank } from './claims';

export interface Instrument {
  /** Title line as found, trimmed. Shown in the provenance surfaces. */
  label: string;
  amendmentRank: number;
  docDate: string | null;
  start: number;
  end: number;
}

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

/** A boundary candidate: an instrument title at the start of a line. */
const TITLES: { re: RegExp; rank: (m: RegExpMatchArray) => number }[] = [
  { re: /^\s*(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+amendment\b/i,
    rank: m => ORDINALS[m[1].toLowerCase()] ?? 1 },
  { re: /^\s*amendment\s+(?:no\.?|number)\s*(\d{1,2})\b/i, rank: m => Number(m[1]) },
  { re: /^\s*(\d{1,2})(?:st|nd|rd|th)\s+amendment\b/i, rank: m => Number(m[1]) },
  { re: /^\s*amended\s+and\s+restated\b/i, rank: () => 99 }, // restatement supersedes numbered amendments
  { re: /^\s*addendum\b/i, rank: () => 1 },
  { re: /^\s*amendment\s+to\b/i, rank: () => 1 },
  // Base instruments: rank 0, so any amendment to them wins the tiebreak.
  { re: /^\s*(?:non-?binding\s+)?term\s*sheet\b/i, rank: () => 0 },
  { re: /^\s*purchase\s+and\s+sale\s+agreement\b/i, rank: () => 0 },
  { re: /^\s*promissory\s+note\b/i, rank: () => 0 },
  { re: /^\s*(?:limited\s+)?guaranty\b/i, rank: () => 0 },
  { re: /^\s*assignment\s+and\s+assumption\b/i, rank: () => 0 },
];

/** Strip page-header decoration so repeated running headers group together. */
function normalizeTitle(line: string): string {
  return line.split('|')[0].replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Reject prose that merely starts with instrument words. PDF line wrapping
 * produces lines like "Term Sheet shall remain unchanged and in full force and
 * effect." and "Purchase and Sale Agreement." mid-paragraph. Left unchecked
 * the second one opens a rank-0 segment INSIDE the First Amendment, which
 * would date and rank that amendment's own claims as the superseded original.
 *
 * Real titles are set in caps, or are short headings with no sentence
 * punctuation. Title-cased headings are common enough in legal drafting that
 * caps alone is too strict.
 */
function looksLikeTitle(line: string): boolean {
  const head = line.split('|')[0].trim();
  if (!head) return false;
  const alpha = head.replace(/[^a-zA-Z]/g, '');
  if (alpha.length >= 4) {
    const upper = head.replace(/[^A-Z]/g, '').length / alpha.length;
    if (upper >= 0.6) return true;
  }
  return head.length <= 80 && !/[.;:]$/.test(head) && !/\.\s/.test(head);
}

/**
 * Date the instrument from its own opening. Recitals reference the dates of
 * EARLIER instruments ("WHEREAS, the parties entered into a Term Sheet dated
 * April 20, 2026"), so an unguided date scan over a Second Amendment returns
 * April and silently ages the newest document in the room. Anchor on the
 * execution phrase first and only then fall back to a general scan.
 */
function dateInstrument(text: string): string | null {
  const head = text.substring(0, 600);
  const anchored = head.match(
    /(?:made\s+and\s+entered\s+into|entered\s+into|executed|dated)\s*:?\s*(?:as\s+of\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}|\d{1,2}[-/.]\d{1,2}[-/.](?:20)?\d{2})/i
  );
  if (anchored) {
    const d = extractDocDate('', anchored[1]);
    if (d) return d;
  }
  return extractDocDate('', text.substring(0, 3000));
}

/**
 * Split text into legal instruments. Returns a single whole-document
 * instrument when no titles are found, so callers need no special case.
 */
export function splitInstruments(text: string, filename = ''): Instrument[] {
  const lines = text.split('\n');
  const cands: { start: number; label: string; rank: number; norm: string }[] = [];

  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Instrument titles are short. A long line matching "amendment to" is prose.
    if (trimmed.length > 0 && trimmed.length <= 120 && looksLikeTitle(trimmed)) {
      for (const t of TITLES) {
        const m = trimmed.match(t.re);
        if (m) {
          cands.push({ start: offset, label: trimmed, rank: t.rank(m), norm: normalizeTitle(trimmed) });
          break;
        }
      }
    }
    offset += line.length + 1;
  }

  // A title repeated across the document is a running page header, not a new
  // instrument. Keep its first appearance only.
  const counts = new Map<string, number>();
  for (const c of cands) counts.set(c.norm, (counts.get(c.norm) ?? 0) + 1);
  const kept: typeof cands = [];
  const seen = new Set<string>();
  for (const c of cands) {
    if ((counts.get(c.norm) ?? 0) > 2) {
      if (seen.has(c.norm)) continue;
      seen.add(c.norm);
    }
    // Cover pages repeat the title within a few lines; keep the stronger claim.
    const prev = kept[kept.length - 1];
    if (prev && c.start - prev.start < 200) {
      if (c.rank > prev.rank) kept[kept.length - 1] = c;
      continue;
    }
    kept.push(c);
  }

  if (!kept.length) {
    return [{
      label: 'whole document',
      amendmentRank: amendmentRank(filename),
      docDate: extractDocDate(filename, text),
      start: 0,
      end: text.length,
    }];
  }

  const out: Instrument[] = [];
  if (kept[0].start > 0) {
    const body = text.substring(0, kept[0].start);
    out.push({
      label: 'preamble',
      amendmentRank: amendmentRank(filename),
      docDate: dateInstrument(body) ?? extractDocDate(filename, body),
      start: 0,
      end: kept[0].start,
    });
  }
  for (let i = 0; i < kept.length; i++) {
    const start = kept[i].start;
    const end = i + 1 < kept.length ? kept[i + 1].start : text.length;
    const body = text.substring(start, end);
    out.push({
      label: kept[i].label,
      amendmentRank: kept[i].rank,
      docDate: dateInstrument(body),
      start,
      end,
    });
  }
  return out;
}

/**
 * Find which instrument a claim came from, using its verbatim quote. Falls back
 * through progressively looser matches because extractors normalize whitespace
 * differently than the source text.
 */
export function locateInstrument(quote: string, text: string, instruments: Instrument[]): Instrument | null {
  const q = (quote || '').trim();
  if (!q || instruments.length === 0) return null;

  let idx = text.indexOf(q);
  if (idx < 0) {
    const head = q.substring(0, 40);
    if (head.length >= 8) idx = text.indexOf(head);
  }
  if (idx < 0) {
    // Whitespace-insensitive: build a regex from the first few tokens.
    const toks = q.split(/\s+/).filter(Boolean).slice(0, 6).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (toks.length >= 2) {
      const m = text.match(new RegExp(toks.join('\\s+'), 'i'));
      if (m && m.index !== undefined) idx = m.index;
    }
  }
  if (idx < 0) return null;

  for (const inst of instruments) if (idx >= inst.start && idx < inst.end) return inst;
  return null;
}
