/**
 * Internal Underwriting Memo (model-routed: narrative tier).
 *
 * Target format: the Mosaic Fulton Ave memo (Scenario A, Jan 2026). This is
 * the INTERNAL credit document, distinct from the outbound lender package:
 * it carries a verdict in Mosaic Schema v2.0 vocabulary (PURSUE / MONITOR /
 * PASS), critical findings, a five-year pro forma, stress rows, the red-line
 * check, and conditions for reconsideration.
 *
 * The verdict is the doctrine screen's output translated to Mosaic vocabulary
 * and labeled machine-generated: the analyst confirms or overrides it.
 * Code builds every table; the model writes findings, conditions, and
 * alternative structures from provided facts only.
 */

import { Deal } from '../core/schemas';
import { callJson, LlmUsage } from '../llm/client';
import { getMarketConfig, getBridgeRate } from '../core/market-config';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scenarioLine: { type: 'string', description: 'one line naming the scenario, e.g. "SCENARIO: $650,000 EARNOUT, GP INTEREST"' },
    killTest: { type: 'string', description: 'one sentence: the single question that decides this deal' },
    criticalFindings: { type: 'array', maxItems: 6, items: { type: 'string' } },
    conditions: { type: 'array', maxItems: 8, items: { type: 'string' }, description: 'conditions for reconsideration / proceeding, concrete with amounts' },
    alternativeStructures: { type: 'array', maxItems: 4, items: { type: 'string' } },
  },
  required: ['scenarioLine', 'killTest', 'criticalFindings', 'conditions', 'alternativeStructures'],
};

const SYSTEM = `You draft the judgment-prose sections of an INTERNAL underwriting memorandum for Mosaic Capital Solutions.
Hard rules:
- Use ONLY the facts provided in the input JSON (metrics, structure flags, screen output). Never invent a number.
- Financial figures: M for thousands, MM for millions in prose.
- Plain factual statements. No em-dashes. No exclamation points. No superlatives.
- criticalFindings: the facts that decide the deal, sharpest first, each with its number.
- conditions: concrete and actionable (amounts, approvals, escrows), drawn from the structure flags and gaps.
- alternativeStructures: only structures the facts support (earnout adjustments, escrows, seller notes, milestones).`;

export interface MemoResult { markdown: string; html: string; usage: LlmUsage }

interface MemoProse {
  scenarioLine: string;
  killTest: string;
  criticalFindings: string[];
  conditions: string[];
  alternativeStructures: string[];
}

type Row = string[];
const TBD = 'TBD (request)';
const usd = (v: number | null | undefined) => (v === null || v === undefined ? TBD : '$' + Math.round(v).toLocaleString());

/** Screen verdict -> Mosaic Schema v2.0 vocabulary. */
export function mosaicVerdict(screenVerdict?: string): { verdict: 'PURSUE' | 'MONITOR' | 'PASS'; basis: string } {
  switch (screenVerdict) {
    case 'CHASE': return { verdict: 'PURSUE', basis: 'screen verdict CHASE' };
    case 'KILL': return { verdict: 'PASS', basis: 'screen verdict KILL' };
    case 'STRUCTURE': return { verdict: 'MONITOR', basis: 'screen verdict STRUCTURE: economics may clear but the transaction requires structuring' };
    case 'DELEGATE': return { verdict: 'MONITOR', basis: 'screen verdict DELEGATE: insufficient verified data for a recommendation' };
    default: return { verdict: 'MONITOR', basis: 'no screen run' };
  }
}

interface ProFormaYear { year: number; noi: number; debtService: number; dscr: number; cfAfterDs: number }

function buildProForma(noi: number | null, loan: number | null, growth = 0.025, years = 5): ProFormaYear[] {
  if (noi === null) return [];
  const rate = getBridgeRate();
  const ds = loan !== null ? loan * rate : 0;
  const out: ProFormaYear[] = [];
  for (let y = 1; y <= years; y++) {
    const yNoi = noi * Math.pow(1 + growth, y - 1);
    out.push({ year: y, noi: yNoi, debtService: ds, dscr: ds > 0 ? yNoi / ds : NaN, cfAfterDs: yNoi - ds });
  }
  return out;
}

export async function generateMemo(deal: Deal): Promise<MemoResult> {
  const market = getMarketConfig();
  const screen = deal.underwriting.screen;
  const { verdict, basis } = mosaicVerdict(screen?.verdict);
  const notes = deal.extracted.notes ?? [];
  const note = (f: string) => notes.find(n => n.field === f)?.extractedValue;
  const flags = notes.filter(n => n.field === 'structureFlag');
  const serious = flags.filter(n => /^SERIOUS/.test(n.extractedValue));
  const price = deal.askingPrice?.value ?? null;
  const noi = deal.extracted.t12?.noi?.value ?? null;
  const loanNote = note('loanRequest');
  const loan = loanNote ? Number(loanNote) : null;
  const proForma = buildProForma(noi, loan);
  const date = new Date().toISOString().substring(0, 10);

  // ---- LLM prose from facts ----
  const facts = {
    name: deal.name, assetType: deal.assetType, location: deal.location,
    price, noi, loanRequest: loan, capex: deal.assumptions.capexTotal?.value ?? null,
    screen: screen ? { verdict: screen.verdict, riskScore: screen.riskScore, confidence: screen.confidenceSummary?.overall, killFlags: screen.killFlags?.filter(f => f.triggered) } : null,
    mosaicVerdict: verdict,
    structureFlags: flags.map(n => n.extractedValue),
    extracted: notes.filter(n => n.field !== 'structureFlag').map(n => ({ field: n.field, value: n.extractedValue, confidence: n.confidence })),
    proFormaYear1: proForma[0] ?? null,
  };
  const { data, usage } = await callJson<MemoProse>(
    'narrative', SYSTEM,
    `Draft the memo judgment sections:\n${JSON.stringify(facts, null, 1)}`,
    'underwriting_memo', SCHEMA, 2200
  );

  // ---- code-built tables ----
  const header: Row[] = [
    ['Property', String(deal.location?.address ?? deal.name)],
    ['Asset Type', deal.assetType.toUpperCase()],
    ['Acquisition Price', usd(price)],
    ['Analysis Date', date],
    ['Prepared By', 'Mosaic Capital Solutions (machine draft, analyst review required)'],
  ];
  const regulatory: Row[] = serious.slice(0, 8).map(n => {
    const body = n.extractedValue.replace(/^[A-Z]+:\s*/, '');
    const [label, ...rest] = body.split(' - ');
    return [label, rest.join(' - ')]; // full text; HTML and markdown wrap naturally
  });
  const redLine: Row[] = (screen?.killFlags ?? []).map(f => [
    f.criterion,
    f.triggered ? 'FLAGGED' : 'CLEAR',
    f.reason ?? '', // full text; both renderers wrap
  ]);
  const pf: Row[] = proForma.map(y => [
    `Year ${y.year}`, usd(y.noi), usd(y.debtService),
    isNaN(y.dscr) ? 'n/a' : y.dscr.toFixed(2) + 'x', usd(y.cfAfterDs),
  ]);

  const mdT = (h: string[], rows: Row[]) =>
    [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');

  const markdown = [
    `# UNDERWRITING MEMORANDUM - ${deal.name}`, '',
    `> Machine draft ${date} (${usage.model}). The verdict below is the doctrine screen translated to Mosaic vocabulary; the analyst confirms or overrides.`, '',
    mdT(['Item', 'Detail'], header), '',
    '## 1. EXECUTIVE SUMMARY', '',
    data.scenarioLine, '', `**VERDICT: ${verdict}** (${basis})`, '', `Kill Test: ${data.killTest}`, '',
    'CRITICAL FINDINGS:', ...data.criticalFindings.map(f => `- ${f}`), '',
    '## 2. ASSET OVERVIEW & REGULATORY FRAMEWORK', '',
    regulatory.length ? mdT(['Item', 'Detail'], regulatory) : '(no serious structure flags extracted)', '',
    '## 3. FINANCIAL UNDERWRITING', '',
    mdT(['Metric', 'Value'], [
      ['NOI (extracted' + (deal.extracted.t12?.noi?.isProxy ? ', proxy' : '') + ')', usd(noi)],
      ['Loan / Obligation Basis', usd(loan)],
      [`Assumed Rate (${market.index} + ${market.bridgeSpreadBps}bps)`, (getBridgeRate() * 100).toFixed(2) + '%'],
    ]), '',
    '### 3.1 Five-Year Pro Forma (machine assumptions: 2.5% NOI growth, IO debt)', '',
    pf.length ? mdT(['Year', 'NOI', 'Debt Service', 'DSCR', 'CF After DS'], pf) : 'Pro forma unavailable: no NOI extracted.', '',
    '## 4. RED LINE CHECK', '',
    redLine.length ? mdT(['Criterion', 'Status', 'Reason'], redLine) : '(screen not run)', '',
    '## 5. VERDICT & CONDITIONS', '',
    `**VERDICT: ${verdict}**`, '', `Kill Test: ${data.killTest}`, '',
    'CONDITIONS FOR RECONSIDERATION:', ...data.conditions.map(c => `- ${c}`), '',
    'ALTERNATIVE STRUCTURES PROPOSED:', ...data.alternativeStructures.map(a => `- ${a}`), '',
    '## 6. DOCUMENTATION', '',
    ...deal.sources.map(s => `- ${s.filename ?? s.id} (${s.kind})`), '',
    '---', `Mosaic Capital Solutions | ${date} | INTERNAL | MACHINE DRAFT`,
  ].join('\n');

  // ---- HTML ----
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const hT = (h: string[], rows: Row[]) =>
    `<table><thead><tr>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const vColor = verdict === 'PURSUE' ? '#2e7d32' : verdict === 'PASS' ? '#c62828' : '#b26a00';
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deal.name)} - Underwriting Memorandum (MACHINE DRAFT)</title>
<style>
 :root{--navy:#1a5c9e;--ink:#1c2733;--mid:#5b6b7c;--line:#d7dee6;--band:#eef3f8}
 body{font-family:'Segoe UI',system-ui,sans-serif;color:var(--ink);max-width:860px;margin:0 auto 5rem;padding:0 1.4rem;line-height:1.55}
 h1{font-size:1.4rem;color:#123f6d;border-bottom:3px solid var(--navy);padding-bottom:.5rem;margin-top:1.4rem}
 h2{font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--navy);padding:.45rem .8rem;margin:1.6rem 0 .6rem}
 h3{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--navy)}
 table{border-collapse:collapse;width:100%;font-size:.88rem;margin-bottom:.7rem}
 th{text-align:left;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mid);border-bottom:2px solid var(--navy);padding:.35rem .6rem}
 td{border-bottom:1px solid var(--line);padding:.4rem .6rem;vertical-align:top}
 tr td:first-child{font-weight:600}
 tbody tr:nth-child(even) td{background:var(--band)}
 .verdict{display:inline-block;color:#fff;background:${vColor};font-weight:700;letter-spacing:.1em;padding:.35rem 1.1rem;border-radius:3px;margin:.4rem 0}
 .ribbon{display:inline-block;font-weight:700;font-size:.72rem;letter-spacing:.12em;color:#fff;background:#e0b64a;padding:.25rem .9rem;border-radius:3px}
 ul{margin:.4rem 0 .6rem 1.2rem}
 li{margin:.25rem 0;font-size:.92rem}
 .meta{font-size:.8rem;color:var(--mid)}
 footer{font-size:.72rem;color:var(--mid);border-top:1px solid var(--line);padding-top:.7rem;margin-top:2rem;text-transform:uppercase;letter-spacing:.06em}
</style></head><body>
<div style="margin-top:1.2rem"><span class="ribbon">MACHINE DRAFT - ANALYST CONFIRMS OR OVERRIDES</span></div>
<h1>UNDERWRITING MEMORANDUM</h1>
${hT(['Item', 'Detail'], header)}
<h2>1. Executive Summary</h2>
<p><b>${esc(data.scenarioLine)}</b></p>
<div class="verdict">VERDICT: ${verdict}</div>
<p class="meta">${esc(basis)}${screen ? ` | screen risk ${screen.riskScore}/5 | confidence ${Math.round((screen.confidenceSummary?.overall ?? 0) * 100)}%` : ''}</p>
<p><b>Kill Test:</b> ${esc(data.killTest)}</p>
<p><b>CRITICAL FINDINGS:</b></p><ul>${data.criticalFindings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
<h2>2. Asset Overview & Regulatory Framework</h2>
${regulatory.length ? hT(['Item', 'Detail'], regulatory) : '<p class="meta">No serious structure flags extracted.</p>'}
<h2>3. Financial Underwriting</h2>
${hT(['Metric', 'Value'], [['NOI (extracted' + (deal.extracted.t12?.noi?.isProxy ? ', proxy' : '') + ')', usd(noi)], ['Loan / Obligation Basis', usd(loan)], [`Assumed Rate (${market.index} + ${market.bridgeSpreadBps}bps)`, (getBridgeRate() * 100).toFixed(2) + '%']])}
<h3>3.1 Five-Year Pro Forma (2.5% NOI growth, IO debt; machine assumptions)</h3>
${pf.length ? hT(['Year', 'NOI', 'Debt Service', 'DSCR', 'CF After DS'], pf) : '<p class="meta">Pro forma unavailable: no NOI extracted.</p>'}
<h2>4. Red Line Check</h2>
${redLine.length ? hT(['Criterion', 'Status', 'Reason'], redLine) : '<p class="meta">Screen not run.</p>'}
<h2>5. Verdict & Conditions</h2>
<div class="verdict">VERDICT: ${verdict}</div>
<p><b>Kill Test:</b> ${esc(data.killTest)}</p>
<p><b>CONDITIONS FOR RECONSIDERATION:</b></p><ul>${data.conditions.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
<p><b>ALTERNATIVE STRUCTURES PROPOSED:</b></p><ul>${data.alternativeStructures.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
<h2>6. Documentation</h2>
<ul>${deal.sources.map(s => `<li>${esc(s.filename ?? s.id)} <span class="meta">(${s.kind})</span></li>`).join('')}</ul>
<footer>Mosaic Capital Solutions | ${date} | INTERNAL | MACHINE DRAFT (${esc(usage.model)})</footer>
</body></html>`;

  return { markdown, html, usage };
}
