/**
 * Lender package narrative (model-routed: narrative tier).
 *
 * Target format: the AvDyne bridge package (Mosaic work product, Jan 2026).
 * Table-driven advocacy with receipts, not neutral prose blocks:
 *   Cover block -> Executive Summary -> Loan Request terms -> Property
 *   Underwriting -> Debt Service Coverage walk -> Sources & Uses ->
 *   Risk Analysis & Exit Strategy -> Data Gaps.
 *
 * Division of labor (tokenomics): every table of numbers is built by CODE
 * from deal.json; the model writes only the prose sections and the
 * risk/mitigant judgments phrased from provided facts. Missing values render
 * as "TBD (request)" so the package shape shows what to collect.
 *
 * Still absent by design: a risk rating and a recommendation. Advocacy is
 * allowed (this is a loan request), invention is not.
 */

import { Deal } from '../core/schemas';
import { callJson, LlmUsage } from '../llm/client';
import { getMarketConfig, getBridgeRate } from '../core/market-config';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executiveSummary: { type: 'string', description: '2 short paragraphs presenting the request on behalf of the sponsor' },
    propertyOverview: { type: 'string', description: '1 paragraph on the asset from the provided facts' },
    risks: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          risk: { type: 'string' }, assessment: { type: 'string' }, mitigant: { type: 'string' },
        },
        required: ['risk', 'assessment', 'mitigant'],
      },
    },
    strengths: { type: 'array', maxItems: 7, items: { type: 'string' } },
    exits: {
      type: 'array', maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        properties: { label: { type: 'string' }, detail: { type: 'string' } },
        required: ['label', 'detail'],
      },
    },
    dataGaps: { type: 'array', maxItems: 14, items: { type: 'string' } },
  },
  required: ['executiveSummary', 'propertyOverview', 'risks', 'strengths', 'exits', 'dataGaps'],
};

const SYSTEM = `You draft the prose sections of a commercial real estate LOAN REQUEST package for Mosaic Capital Solutions, presented to a lender on behalf of a sponsor.
Hard rules:
- Use ONLY the facts provided in the input JSON. If a fact is not provided, do not state it; put the need in dataGaps instead.
- This is advocacy with receipts: present the deal favorably but never beyond the facts. Every risk gets an honest assessment AND a mitigant grounded in provided facts.
- Financial figures in prose: M for thousands, MM for millions (18.4MM, 750M).
- Plain factual statements. No em-dashes. No exclamation points. No superlatives.
- Never state a risk rating or a lending recommendation.
- Where a number is a proxy or low confidence, say so plainly.
- executiveSummary opens with "Mosaic Capital Solutions presents this request on behalf of..." style framing.`;

export interface NarrativeResult {
  markdown: string;
  html: string;
  usage: LlmUsage;
}

interface ProseSections {
  executiveSummary: string;
  propertyOverview: string;
  risks: { risk: string; assessment: string; mitigant: string }[];
  strengths: string[];
  exits: { label: string; detail: string }[];
  dataGaps: string[];
}

// ============================================================================
// Deterministic table assembly (code owns every number)
// ============================================================================

type Row = [string, string] | [string, string, string];

const TBD = 'TBD (request)';
const usd = (v: number | null | undefined) =>
  v === null || v === undefined ? TBD : '$' + Math.round(v).toLocaleString();
const pct = (v: number | null | undefined, dp = 1) =>
  v === null || v === undefined ? TBD : (v * 100).toFixed(dp) + '%';

interface PackageTables {
  loanRequest: Row[];
  propertyOverview: Row[];
  terms: Row[];
  assetOverview: Row[];
  dsc: Row[];
  sourcesUses: { sources: Row[]; uses: Row[] };
}

function buildTables(deal: Deal): PackageTables {
  const market = getMarketConfig();
  const bridgeRate = getBridgeRate();
  const price = deal.askingPrice?.value ?? null;
  const noi = deal.extracted.t12?.noi?.value ?? null;
  const noiProxy = Boolean(deal.extracted.t12?.noi?.isProxy);
  const hotel = deal.extracted.hotel;
  const notes = deal.extracted.notes ?? [];
  const note = (f: string) => notes.find(n => n.field === f)?.extractedValue;
  const loanNote = note('loanRequest');
  const loan = loanNote ? Number(loanNote) : price ? price * 0.75 : null;
  const loanLabel = loanNote ? '' : loan ? ' (indicative at 75% of price)' : '';
  const capex = deal.assumptions.capexTotal?.value ?? null;
  const totalCost = price !== null ? price + (capex ?? 0) : null;
  const ltc = loan !== null && totalCost ? loan / totalCost : null;
  const ltv = loan !== null && price ? loan / price : null;
  const equity = loan !== null && totalCost !== null ? Math.max(0, totalCost - loan) : null;
  const occupancy = hotel?.occupancy?.value ?? null;
  const sf = note('totalSF');
  const ioInterest = loan !== null ? loan * bridgeRate : null;

  const sizeLine = hotel?.keys?.value
    ? `${hotel.keys.value} keys${sf ? ` / ${Number(sf).toLocaleString()} SF` : ''}`
    : sf ? `${Number(sf).toLocaleString()} SF` : TBD;

  const dsc: Row[] = [
    ['Loan Amount Requested', usd(loan) + loanLabel],
    [`Assumed Bridge Rate (${market.index} + ${market.bridgeSpreadBps}bps, as of ${market.asOf})`, pct(bridgeRate, 2)],
    ['Annual Interest (I/O)', usd(ioInterest)],
    [noiProxy ? 'NOI (proxy, verify with operating statements)' : 'NOI (extracted)', usd(noi)],
    ['NOI / Debt Service', noi !== null && ioInterest ? (noi / ioInterest).toFixed(1) + 'x Coverage' : TBD],
  ];
  if (hotel?.adr?.value && hotel?.occupancy?.value && hotel?.keys?.value) {
    dsc.splice(3, 0, ['Rooms Revenue Basis', `${hotel.keys.value} keys x ${pct(hotel.occupancy.value, 0)} occ x $${hotel.adr.value} ADR`]);
  }

  return {
    loanRequest: [
      ['Amount', usd(loan) + loanLabel],
      ['LTC', pct(ltc)],
      ['LTV', pct(ltv)],
      ['Use of Proceeds', capex ? 'Acquisition + Capital Plan' : 'Acquisition'],
    ],
    propertyOverview: [
      ['Size', sizeLine],
      ['Contract / Basis Price', usd(price)],
      ['Appraised Value', note('appraisedValue') ? usd(Number(note('appraisedValue'))) : TBD],
      ['Occupancy', occupancy !== null ? pct(occupancy, 0) : note('occupancy') ? pct(Number(note('occupancy')), 0) : TBD],
    ],
    terms: [
      ['Loan Amount', usd(loan)],
      ['LTC / LTV', `${pct(ltc)} / ${pct(ltv)}`],
      ['Interest Rate', `Market bridge rates (${market.index} + ${market.bridgeSpreadBps}bps indicative)`],
      ['Term', '12-24 months'],
      ['Amortization', 'Interest Only'],
      ['DSCR Requirement', 'Negotiable'],
      ['Equity Required', usd(equity)],
      ['Origination Fee', 'TBD'],
    ],
    assetOverview: [
      ['Address', String(deal.location?.address ?? note('address') ?? TBD)],
      ['Market', String(note('cityState') ?? deal.location?.address ?? TBD)],
      ['Property Type', deal.assetType.toUpperCase()],
      ['Size', sizeLine],
      ['Year Built', note('yearBuilt') ? String(note('yearBuilt')) : TBD],
      ...(capex !== null ? [['Capital Plan / PIP Budget', usd(capex)] as Row] : []),
      ...(hotel?.adr?.value ? [['ADR (trailing or stated)', '$' + hotel.adr.value] as Row] : []),
      ...(hotel?.revpar?.value ? [['RevPAR', '$' + Math.round(hotel.revpar.value)] as Row] : []),
    ],
    dsc,
    sourcesUses: {
      sources: [
        ['Bridge Loan', `${usd(loan)}\t${ltc !== null ? pct(ltc) : ''}`],
        ['Sponsor Equity', `${usd(equity)}\t${ltc !== null && equity !== null && totalCost ? pct(equity / totalCost) : ''}`],
        ['TOTAL SOURCES', `${usd(totalCost)}\t${totalCost ? '100.0%' : ''}`],
      ],
      uses: [
        ['Acquisition Price', `${usd(price)}\t${totalCost && price !== null ? pct(price / totalCost) : ''}`],
        ...(capex !== null ? [['Capital Plan / PIP', `${usd(capex)}\t${totalCost ? pct(capex / totalCost) : ''}`] as Row] : []),
        ['TOTAL USES', `${usd(totalCost)}\t${totalCost ? '100.0%' : ''}`],
      ],
    },
  };
}

// ============================================================================
// Renderers (markdown + HTML from the same data)
// ============================================================================

function mdTable(header: string[], rows: Row[]): string {
  const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];
  for (const r of rows) lines.push(`| ${(r as string[]).map(c => c.replace(/\t/g, ' | ')).join(' | ')} |`);
  return lines.join('\n');
}

function renderMarkdown(deal: Deal, t: PackageTables, p: ProseSections, model: string): string {
  const date = new Date().toISOString().substring(0, 10);
  return [
    `# ${deal.name} - Bridge Loan Request`,
    '',
    `> DRAFT generated ${date} by ${model}. Facts from deal.json only; tables assembled deterministically.`,
    `> No risk rating and no recommendation: the credit call stays with the analyst.`,
    '',
    '## Loan Request', '', mdTable(['Item', 'Detail'], t.loanRequest), '',
    '## Property Overview', '', mdTable(['Item', 'Detail'], t.propertyOverview), '',
    '## Executive Summary', '', p.executiveSummary, '',
    '### Proposed Terms', '', mdTable(['Metric', 'Bridge Loan Request'], t.terms), '',
    '## Property Underwriting', '', p.propertyOverview, '', mdTable(['Property Data', 'Details'], t.assetOverview), '',
    '## Debt Service Coverage Analysis', '', mdTable(['Debt Service Analysis', 'Calculation'], t.dsc), '',
    '## Sources & Uses of Funds', '',
    mdTable(['Sources', 'Amount', '% of Total'], t.sourcesUses.sources), '',
    mdTable(['Uses', 'Amount', '% of Total'], t.sourcesUses.uses), '',
    '## Risk Analysis', '', mdTable(['Risk Factor', 'Assessment', 'Mitigant'], p.risks.map(r => [r.risk, r.assessment, r.mitigant] as Row)), '',
    '## Exit Strategy', '', mdTable(['Exit', 'Detail'], p.exits.map(e => [e.label, e.detail] as Row)), '',
    '## Strengths', '', ...p.strengths.map(s => `- ${s}`), '',
    '## Data Gaps - Request Before Routing', '', ...p.dataGaps.map(g => `- ${g}`), '',
    '---', `Prepared by Mosaic Capital Solutions | ${date} | CONFIDENTIAL | DRAFT`,
  ].join('\n');
}

function renderHtml(deal: Deal, t: PackageTables, p: ProseSections, model: string): string {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const date = new Date().toISOString().substring(0, 10);
  const table = (header: string[], rows: Row[]) =>
    `<table><thead><tr>${header.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(r => `<tr>${(r as string[]).map(c => c.split('\t').map(cell => `<td>${esc(cell)}</td>`).join('')).join('')}</tr>`).join('') +
    '</tbody></table>';
  const section = (title: string, inner: string, cls = '') =>
    `<section class="${cls}"><h2>${esc(title)}</h2>${inner}</section>`;
  const para = (s: string) => esc(s).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deal.name)} - Bridge Loan Request (DRAFT)</title>
<style>
  :root { --navy:#1a5c9e; --navy-dark:#123f6d; --ink:#1c2733; --mid:#5b6b7c; --line:#d7dee6; --band:#eef3f8; --warn-bg:#fff7e0; --warn-line:#e0b64a; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: var(--ink); max-width: 880px; margin: 0 auto 5rem; padding: 0 1.4rem; line-height: 1.55; background:#fff; }
  .runhead { display:flex; justify-content:space-between; font-size:.72rem; color:var(--mid); border-bottom:1px solid var(--line); padding:.5rem 0; margin-bottom:1.6rem; text-transform:uppercase; letter-spacing:.06em; }
  .ribbon { display:inline-block; font-weight:700; font-size:.72rem; letter-spacing:.12em; color:#fff; background:var(--warn-line); padding:.25rem .9rem; border-radius:3px; margin-bottom:.7rem; }
  h1 { font-size:1.7rem; color:var(--navy-dark); margin:.1rem 0 .2rem; }
  .addr { color:var(--mid); margin-bottom:1.4rem; }
  .cover { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.4rem; }
  @media (max-width:700px){ .cover { grid-template-columns:1fr; } }
  section { margin-bottom:1.5rem; }
  h2 { font-size:.85rem; letter-spacing:.1em; text-transform:uppercase; color:#fff; background:var(--navy); padding:.45rem .8rem; margin:0 0 .6rem; }
  h3 { font-size:.8rem; letter-spacing:.08em; text-transform:uppercase; color:var(--navy); margin:1rem 0 .4rem; }
  table { border-collapse:collapse; width:100%; font-size:.88rem; margin-bottom:.6rem; }
  th { text-align:left; font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; color:var(--mid); border-bottom:2px solid var(--navy); padding:.35rem .6rem; }
  td { border-bottom:1px solid var(--line); padding:.4rem .6rem; vertical-align:top; }
  tr td:first-child { font-weight:600; width:38%; }
  tbody tr:nth-child(even) td { background:var(--band); }
  p { margin:.45rem 0; font-size:.92rem; }
  .gaps section, .gaps { border-left:4px solid var(--warn-line); background:var(--warn-bg); padding:.7rem 1rem; }
  .gaps h2 { background:var(--warn-line); }
  .gaps ul { margin:.3rem 0 .2rem 1.2rem; padding:0; font-size:.9rem; }
  ul.strengths { margin:.3rem 0 .2rem 1.2rem; font-size:.9rem; }
  footer { font-size:.72rem; color:var(--mid); border-top:1px solid var(--line); padding-top:.7rem; text-transform:uppercase; letter-spacing:.06em; display:flex; justify-content:space-between; }
</style></head><body>
<div class="runhead"><span>Prepared for: [Lender]</span><span>Bridge Loan Request - ${esc(deal.name)}</span></div>
<div class="ribbon">DRAFT - ANALYST REVIEW REQUIRED</div>
<h1>Bridge Loan Request</h1>
<div class="addr">${esc(String(deal.location?.address ?? ''))} | ${esc(deal.assetType.toUpperCase())} | Acquisition Financing</div>
<div class="cover">
  <div>${table(['Loan Request', ''], t.loanRequest)}</div>
  <div>${table(['Property Overview', ''], t.propertyOverview)}</div>
</div>
${section('Executive Summary', para(p.executiveSummary) + '<h3>Proposed Terms</h3>' + table(['Metric', 'Bridge Loan Request'], t.terms))}
${section('Property Underwriting', para(p.propertyOverview) + table(['Property Data', 'Details'], t.assetOverview))}
${section('Debt Service Coverage Analysis', table(['Debt Service Analysis', 'Calculation'], t.dsc))}
${section('Sources & Uses of Funds', table(['Sources', 'Amount', '% of Total'], t.sourcesUses.sources) + table(['Uses', 'Amount', '% of Total'], t.sourcesUses.uses))}
${section('Risk Analysis', table(['Risk Factor', 'Assessment', 'Mitigant'], p.risks.map(r => [r.risk, r.assessment, r.mitigant] as Row)))}
${section('Exit Strategy', table(['Exit', 'Detail'], p.exits.map((e, i) => [`${['Primary', 'Secondary', 'Tertiary'][i] ?? ''} - ${e.label}`, e.detail] as Row)))}
${section('Strengths', '<ul class="strengths">' + p.strengths.map(s => `<li>${esc(s)}</li>`).join('') + '</ul>')}
<div class="gaps"><h2>Data Gaps - Request Before Routing</h2><ul>${p.dataGaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
<footer><span>Prepared by Mosaic Capital Solutions | ${date}</span><span>CONFIDENTIAL | DRAFT (${esc(model)})</span></footer>
</body></html>`;
}

// ============================================================================
// Entry point
// ============================================================================

export async function generateNarrative(deal: Deal): Promise<NarrativeResult> {
  const tables = buildTables(deal);

  const facts = {
    name: deal.name,
    assetType: deal.assetType,
    location: deal.location,
    askingPrice: deal.askingPrice,
    hotel: deal.extracted.hotel,
    noi: deal.extracted.t12?.noi,
    capexBudget: deal.assumptions.capexTotal,
    screen: deal.underwriting.screen
      ? {
          killFlags: deal.underwriting.screen.killFlags?.filter(f => f.triggered),
          confidence: deal.underwriting.screen.confidenceSummary,
          keyMetrics: deal.underwriting.screen.keyMetrics,
        }
      : undefined,
    assembledTables: tables, // so prose never contradicts the tables
    extractedNotes: (deal.extracted.notes ?? []).map(n => ({ field: n.field, value: n.extractedValue, confidence: n.confidence })),
  };

  const { data, usage } = await callJson<ProseSections>(
    'narrative',
    SYSTEM,
    `Draft the prose sections of the loan request package for this deal:\n${JSON.stringify(facts, null, 1)}`,
    'loan_package_narrative',
    SCHEMA,
    3000
  );

  return {
    markdown: renderMarkdown(deal, tables, data, usage.model),
    html: renderHtml(deal, tables, data, usage.model),
    usage,
  };
}
