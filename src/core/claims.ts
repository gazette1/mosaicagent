/**
 * Claims Ledger and Document Authority Hierarchy.
 *
 * The architectural answer to the class of bug that kept appearing in real
 * deal rooms: a tax-return fragment beating an appraisal's stated cap rate, a
 * superseded PSA price beating its own executed amendment, a sponsor-model
 * loan amount pairing with a memo-derived price to produce LTV > 100%.
 *
 * First-wins and even confidence-wins resolution are both wrong, because
 * confidence measures "how clearly did I read this" and not "should I believe
 * this document." Those are different questions. A broker's marketing PDF can
 * state a number very clearly and still be the least authoritative source in
 * the room.
 *
 * So every extracted value becomes a CLAIM carrying provenance, and resolution
 * is a documented three-key sort:
 *
 *   1. AUTHORITY   what kind of document said it (executed legal > audited
 *                  financial > appraisal > sponsor model > marketing)
 *   2. RECENCY     within the same authority tier, a later-dated document
 *                  supersedes an earlier one (4th Amendment beats the PSA)
 *   3. CONFIDENCE  only as the final tiebreak, how cleanly it was read
 *
 * Everything the resolver rejects is retained, not discarded. Disagreements
 * between authoritative sources are the most valuable output in the system:
 * they are exactly what a credit analyst needs to see, and no amount of model
 * quality substitutes for showing them.
 */

// ============================================================================
// Authority tiers
// ============================================================================

/** Higher wins. Gaps left between tiers so new document kinds can slot in. */
export const AUTHORITY: Record<string, number> = {
  executed_legal: 100,   // executed PSA, amendments, notes, leases, regulatory agreements
  audited_financial: 90, // audited or CPA-compiled statements, tax returns
  bank_statement: 85,    // bank statements: primary evidence of cash movement
  appraisal: 80,         // third-party licensed appraisal
  operating_statement: 70, // borrower-prepared T12 / rent roll
  sponsor_model: 55,     // sponsor's own underwriting spreadsheet (advocacy)
  term_sheet: 50,        // lender term sheets: real but indicative
  broker_memo: 40,       // financing memo, OM, teaser (advocacy)
  marketing: 30,         // brochures, flyers, listing pages
  transcript: 25,        // call transcripts: valuable for red tape, weak for figures
  unknown: 10,
};

export type DocClass = keyof typeof AUTHORITY | string;

/**
 * Classify a document by filename and (optionally) a sample of its text.
 * Deterministic and cheap: this decides who to believe, so it must never be a
 * model call that could be talked out of its answer by the document itself.
 */
export function classifyDocument(filename: string, sample = ''): { docClass: DocClass; why: string } {
  const f = (filename || '').toLowerCase();
  const s = (sample || '').substring(0, 4000).toLowerCase();
  const hit = (re: RegExp, where: string) => re.test(where);

  // Executed legal instruments. "Executed" or "signed" in the name is a strong
  // signal; amendments are legal instruments even when unsigned copies circulate.
  if (hit(/executed|fully.signed|\bsigned\b|amendment|assignment|promissory|deed of trust|regulatory agreement|operating agreement|\bpsa\b|purchase and sale|lease agreement|guaranty/, f)
      || hit(/this amendment|in witness whereof|the parties hereto agree|executed as of/, s)) {
    return { docClass: 'executed_legal', why: 'executed or legal instrument' };
  }
  if (hit(/tax return|form 1120|form 1065|k-1|audited|cpa|compiled financial/, f) || hit(/independent auditor|accountant.s compilation report|form 1120|schedule k-1/, s)) {
    return { docClass: 'audited_financial', why: 'audited/compiled financial or tax return' };
  }
  if (hit(/bank statement|eagle ?\d|operating account|statement of account/, f) || hit(/beginning balance.*ending balance|deposits and additions/, s)) {
    return { docClass: 'bank_statement', why: 'bank statement' };
  }
  if (hit(/appraisal|valuation report|22-[a-z]{2}-\d+/, f) || hit(/appraisal report|final value opinion|uspap|mai\b/, s)) {
    return { docClass: 'appraisal', why: 'third-party appraisal' };
  }
  if (hit(/rent ?roll|t-?12|trailing twelve|operating statement|income statement|financial statement|aged receivab|profit and loss|\bp&l\b/, f)) {
    return { docClass: 'operating_statement', why: 'borrower operating statement' };
  }
  if (hit(/underwriting|model|proforma|pro ?forma|budget|scorecard|debt schedule/, f) && hit(/\.xlsx?$|\.csv$/, f)) {
    return { docClass: 'sponsor_model', why: 'sponsor-prepared model' };
  }
  if (hit(/term ?sheet|loi|letter of intent|commitment letter/, f)) {
    return { docClass: 'term_sheet', why: 'term sheet or LOI' };
  }
  if (hit(/memo|memorandum|\bom\b|offering|package|financing/, f)) {
    return { docClass: 'broker_memo', why: 'broker or financing memo (advocacy)' };
  }
  if (hit(/brochure|teaser|flyer|listing|marketing|crexi|loopnet/, f)) {
    return { docClass: 'marketing', why: 'marketing collateral' };
  }
  if (hit(/transcript|otter|\.vtt$|recording|call/, f) || hit(/speaker \d|transcribed by/, s)) {
    return { docClass: 'transcript', why: 'call transcript' };
  }
  if (hit(/\.xlsx?$|\.csv$/, f)) return { docClass: 'sponsor_model', why: 'spreadsheet, unclassified' };
  return { docClass: 'unknown', why: 'unclassified' };
}

/**
 * Pull an effective date out of a filename or text sample. Recency only
 * arbitrates within an authority tier, so a rough date is enough and a missing
 * date simply forfeits the tiebreak rather than guessing.
 */
export function extractDocDate(filename: string, sample = ''): string | null {
  const hay = `${filename} ${String(sample).substring(0, 3000)}`;
  const pats: [RegExp, (m: RegExpMatchArray) => string][] = [
    // 2026-01-23, 2026_01_23
    [/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/, m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`],
    // 10-24-25, 06/05/2025, 1.7.2026
    [/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/, m => {
      const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }],
    // September 3, 2025 / Dec 2025
    [/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})/i, m => {
      const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase().substring(0, 3)) + 1;
      return `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }],
    [/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d{2})/i, m => {
      const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase().substring(0, 3)) + 1;
      return `${m[2]}-${String(mo).padStart(2, '0')}-01`;
    }],
  ];
  for (const [re, fmt] of pats) {
    const m = hay.match(re);
    if (m) {
      const iso = fmt(m);
      const y = Number(iso.substring(0, 4));
      if (y >= 1990 && y <= 2100) return iso;
    }
  }
  return null;
}

/** Amendment ordinal, so the 4th Amendment outranks the 2nd within a tier. */
export function amendmentRank(filename: string): number {
  const f = (filename || '').toLowerCase();
  if (!/amendment/.test(f)) return 0;
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  for (const [w, n] of Object.entries(words)) if (f.includes(w)) return n;
  const m = f.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  return m ? Number(m[1]) : 1;
}

// ============================================================================
// Claims
// ============================================================================

export interface Claim {
  field: string;
  value: number | string;
  confidence: number;      // how cleanly it was read
  quote: string;           // verbatim evidence
  sourceId: string;
  filename: string;
  docClass: DocClass;
  authority: number;
  docDate: string | null;
  amendmentRank: number;
  extractor: 'deterministic' | 'llm' | 'ocr' | 'manual';
  /**
   * True when the value was COMPUTED rather than stated in the document (an
   * NOI proxied from a rent roll, a RevPAR derived from ADR x occupancy). A
   * derived value never outranks a stated one at the same authority, because
   * an estimate is a weaker kind of claim no matter how recent the document.
   * Found by the golden set: a rent-roll NOI proxy was beating a stated T12.
   */
  derived?: boolean;
}

export interface Resolution {
  field: string;
  winner: Claim;
  rejected: Claim[];
  /** Plain-language reason the winner won: goes in the workbook and the memo. */
  basis: string;
  /** Material disagreement between claims a human must adjudicate. */
  conflict: Conflict | null;
}

export interface Conflict {
  field: string;
  severity: 'material' | 'minor';
  spreadPct: number | null;
  message: string;
  claims: { value: number | string; filename: string; docClass: DocClass; authority: number; docDate: string | null }[];
}

/** Fields where a numeric gap between sources is a real credit issue. */
const MATERIAL_FIELDS = new Set(['askingPrice', 'noi', 'loanRequest', 'capexTotal', 'appraisedValue', 'keys', 'totalSF', 'adr', 'occupancy', 'capRate']);
const MATERIAL_SPREAD = 0.05; // 5% disagreement between sources is worth a human look

/**
 * Resolve one field's competing claims by authority, then recency, then
 * confidence. Returns the winner, the losers, why, and any conflict worth
 * escalating.
 */
export function resolveField(field: string, claims: Claim[]): Resolution | null {
  if (!claims.length) return null;
  const sorted = [...claims].sort((a, b) => {
    if (b.authority !== a.authority) return b.authority - a.authority;
    // Stated beats derived, before recency is even considered
    const aDerived = a.derived ? 1 : 0, bDerived = b.derived ? 1 : 0;
    if (aDerived !== bDerived) return aDerived - bDerived;
    if (b.amendmentRank !== a.amendmentRank) return b.amendmentRank - a.amendmentRank;
    const ad = a.docDate ?? '', bd = b.docDate ?? '';
    if (ad !== bd) return bd.localeCompare(ad);
    return b.confidence - a.confidence;
  });
  const winner = sorted[0];
  const rejected = sorted.slice(1);

  const reasons: string[] = [`${winner.docClass} (authority ${winner.authority})`];
  const beaten = rejected[0];
  if (beaten) {
    if (winner.authority > beaten.authority) reasons.push(`outranks ${beaten.docClass}`);
    else if (!winner.derived && beaten.derived) reasons.push('stated value beats derived estimate');
    else if (winner.amendmentRank > beaten.amendmentRank) reasons.push(`amendment ${winner.amendmentRank} supersedes ${beaten.amendmentRank || 'original'}`);
    else if ((winner.docDate ?? '') > (beaten.docDate ?? '')) reasons.push(`dated ${winner.docDate} supersedes ${beaten.docDate ?? 'undated'}`);
    else reasons.push('higher read confidence at equal authority');
  }

  // Conflict detection across DISTINCT values only
  let conflict: Conflict | null = null;
  const numeric = claims.filter(c => typeof c.value === 'number' && !c.derived) as (Claim & { value: number })[];
  if (MATERIAL_FIELDS.has(field) && numeric.length > 1) {
    const vals = numeric.map(c => c.value);
    const min = Math.min(...vals), max = Math.max(...vals);
    const spread = max > 0 ? (max - min) / max : 0;
    if (spread > MATERIAL_SPREAD) {
      // A high-authority source disagreeing with another high-authority source
      // is materially worse than marketing disagreeing with an appraisal.
      const topTier = Math.max(...numeric.map(c => c.authority));
      const contenders = numeric.filter(c => c.authority >= topTier - 20);
      const contenderSpread = contenders.length > 1
        ? (Math.max(...contenders.map(c => c.value)) - Math.min(...contenders.map(c => c.value))) / Math.max(...contenders.map(c => c.value))
        : 0;
      conflict = {
        field,
        severity: contenderSpread > MATERIAL_SPREAD ? 'material' : 'minor',
        spreadPct: +(spread * 100).toFixed(1),
        message: contenderSpread > MATERIAL_SPREAD
          ? `${field}: comparably authoritative sources disagree by ${(contenderSpread * 100).toFixed(1)}%. Human adjudication required.`
          : `${field}: sources disagree by ${(spread * 100).toFixed(1)}%, resolved by authority (${winner.docClass} over ${beaten?.docClass ?? 'n/a'}).`,
        claims: numeric.map(c => ({ value: c.value, filename: c.filename, docClass: c.docClass, authority: c.authority, docDate: c.docDate })),
      };
    }
  }

  return { field, winner, rejected, basis: reasons.join('; '), conflict };
}

/** Resolve an entire ledger, field by field. */
export function resolveLedger(claims: Claim[]): { resolutions: Record<string, Resolution>; conflicts: Conflict[] } {
  const byField = new Map<string, Claim[]>();
  for (const c of claims) {
    if (!byField.has(c.field)) byField.set(c.field, []);
    byField.get(c.field)!.push(c);
  }
  const resolutions: Record<string, Resolution> = {};
  const conflicts: Conflict[] = [];
  for (const [field, list] of byField) {
    const r = resolveField(field, list);
    if (!r) continue;
    resolutions[field] = r;
    if (r.conflict) conflicts.push(r.conflict);
  }
  conflicts.sort((a, b) => (a.severity === b.severity ? (b.spreadPct ?? 0) - (a.spreadPct ?? 0) : a.severity === 'material' ? -1 : 1));
  return { resolutions, conflicts };
}

/** Build a claim from an extraction hit plus its document provenance. */
export function makeClaim(
  field: string,
  value: number | string,
  confidence: number,
  quote: string,
  doc: { sourceId: string; filename: string; docClass: DocClass; docDate: string | null; amendmentRank: number },
  extractor: Claim['extractor'],
  derived = false
): Claim {
  return {
    field, value, confidence, quote,
    sourceId: doc.sourceId,
    filename: doc.filename,
    docClass: doc.docClass,
    authority: AUTHORITY[doc.docClass] ?? AUTHORITY.unknown,
    docDate: doc.docDate,
    amendmentRank: doc.amendmentRank,
    extractor,
    derived,
  };
}
