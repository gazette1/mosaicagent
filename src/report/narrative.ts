/**
 * Narrative draft generation (model-routed: narrative tier).
 *
 * Drafts the prose sections of a lender package from deal.json facts ONLY.
 * The model receives the extracted data and audit context, not the raw
 * documents, and is instructed to use nothing else. Output is a DRAFT the
 * human owns; the judgment calls (rating, recommendation) stay human.
 *
 * Voice: Mosaic rules. Plain factual statements. No em-dashes. No
 * exclamation points. No superlatives. M for thousands, MM for millions.
 */

import { Deal } from '../core/schemas';
import { callJson, LlmUsage } from '../llm/client';
import { describeBridgePricing } from '../core/market-config';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executiveSummary: { type: 'string' },
    propertyOverview: { type: 'string' },
    financialAnalysis: { type: 'string' },
    risksAndMitigants: { type: 'string' },
    dataGaps: { type: 'string', description: 'documents or fields still needed, as a bulleted list' },
  },
  required: ['executiveSummary', 'propertyOverview', 'financialAnalysis', 'risksAndMitigants', 'dataGaps'],
};

const SYSTEM = `You draft the prose sections of a commercial real estate lender package for Mosaic Capital Solutions.
Hard rules:
- Use ONLY the facts provided in the input JSON. If a fact is not provided, do not state it. List missing items in dataGaps instead.
- Financial notation: M for thousands, MM for millions (e.g. 18.4MM, 750M).
- Plain factual statements. No em-dashes. No exclamation points. No superlatives or hype language.
- Never state a risk rating or a credit recommendation. That is the human's call.
- Where a number is a proxy or low confidence, say so plainly.
- Each section 80-200 words. dataGaps is a markdown bulleted list.`;

export interface NarrativeResult {
  markdown: string;
  usage: LlmUsage;
}

export async function generateNarrative(deal: Deal): Promise<NarrativeResult> {
  const facts = {
    name: deal.name,
    assetType: deal.assetType,
    location: deal.location,
    askingPrice: deal.askingPrice,
    hotel: deal.extracted.hotel,
    noi: deal.extracted.t12?.noi,
    rentRollSummary: deal.extracted.rentRoll
      ? {
          units: deal.extracted.rentRoll.tenants?.length,
          occupancyRate: deal.extracted.rentRoll.occupancyRate,
          effectiveGrossRent: deal.extracted.rentRoll.effectiveGrossRent,
        }
      : undefined,
    screen: deal.underwriting.screen
      ? {
          keyMetrics: deal.underwriting.screen.verdict ? deal.underwriting.screen.keyMetrics : undefined,
          killFlags: deal.underwriting.screen.killFlags?.filter(f => f.triggered),
          confidence: deal.underwriting.screen.confidenceSummary,
        }
      : undefined,
    marketPricing: describeBridgePricing(),
    extractedNotes: (deal.extracted.notes ?? []).map(n => ({ field: n.field, value: n.extractedValue, confidence: n.confidence })),
  };

  const { data, usage } = await callJson<{
    executiveSummary: string;
    propertyOverview: string;
    financialAnalysis: string;
    risksAndMitigants: string;
    dataGaps: string;
  }>(
    'narrative',
    SYSTEM,
    `Draft the package sections for this deal:\n${JSON.stringify(facts, null, 1)}`,
    'package_narrative',
    SCHEMA,
    2500
  );

  const markdown = [
    `# ${deal.name} - Lender Package Narrative`,
    '',
    `> DRAFT generated ${new Date().toISOString().substring(0, 10)} by ${usage.model}. Facts sourced from deal.json only.`,
    `> Judgment sections (risk rating, recommendation) are intentionally absent: human owns them.`,
    '',
    '## Executive Summary', '', data.executiveSummary, '',
    '## Property Overview', '', data.propertyOverview, '',
    '## Financial Analysis', '', data.financialAnalysis, '',
    '## Risks and Mitigants', '', data.risksAndMitigants, '',
    '## Data Gaps', '', data.dataGaps, '',
  ].join('\n');

  return { markdown, usage };
}
