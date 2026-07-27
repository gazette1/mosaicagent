/**
 * Model Architect (Kimi K3, routed 'architect' tier).
 *
 * K3 designs the model; code builds it. Given the deal facts and structure
 * flags, K3 proposes:
 *   - assumption overrides for known levers, each with a rationale
 *   - deal-specific stress scenarios (replacing generic macro rows)
 *   - an obligations schedule (earnouts, deferred fees, seller notes) that
 *     the workbook turns into a cash-flow drag with formulas
 *   - model notes for the Executive Summary and Audit sheet
 *
 * The doctrine holds: no LLM math. K3 picks parameters and structure
 * (judgment); exceljs builds every formula (deterministic). Every override
 * is sanity-clamped and labeled "K3 proposed" with amber shading, so the
 * analyst sees exactly which inputs came from model judgment.
 */

import { Deal } from '../core/schemas';
import { callJson, LlmUsage } from '../llm/client';

// Levers K3 may propose values for, with sanity clamps [min, max]
export const ARCHITECT_LEVERS: Record<string, [number, number]> = {
  stabOcc: [0.3, 0.98],
  y1occ: [0.1, 0.95],
  occG: [0.0, 0.10],
  adrG: [0.0, 0.08],
  noiG: [-0.05, 0.08],
  fbPct: [0.0, 0.5],
  othPct: [0.0, 0.3],
  roomsX: [0.1, 0.5],
  fbX: [0.3, 0.95],
  agX: [0.02, 0.35],
  smX: [0.02, 0.3],
  utilX: [0.02, 0.3],
  ffeX: [0.01, 0.08],
  cap: [0.03, 0.15],
  permLtv: [0.4, 0.8],
  minDscr: [1.1, 1.6],
  minDy: [0.06, 0.15],
  irM: [0, 24],
  amort: [15, 40],
  allin: [0.01, 0.15],
};

// Levers that only make sense as whole numbers
const INTEGER_LEVERS = new Set(['irM', 'amort']);

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overrides: {
      type: 'array', maxItems: 12,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          lever: { type: 'string', enum: Object.keys(ARCHITECT_LEVERS) },
          value: { type: 'number' },
          rationale: { type: 'string', description: 'grounded in a provided fact, under 90 chars' },
        },
        required: ['lever', 'value', 'rationale'],
      },
    },
    scenarios: {
      type: 'array', minItems: 3, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'deal-specific, e.g. "Collections worsen", "LP recapture", not generic' },
          rateDeltaBps: { type: 'number' },
          noiDeltaPct: { type: 'number', description: 'e.g. -15 for a 15% NOI decline' },
          capDeltaBps: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['name', 'rateDeltaBps', 'noiDeltaPct', 'capDeltaBps', 'rationale'],
      },
    },
    obligations: {
      type: 'array', maxItems: 5,
      description: 'deal obligations paid from cash flow: earnouts, deferred developer fees, seller notes. Empty if none.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          label: { type: 'string' },
          annualAmounts: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'number' }, description: 'years 1-5' },
          rationale: { type: 'string' },
        },
        required: ['label', 'annualAmounts', 'rationale'],
      },
    },
    modelNotes: { type: 'array', maxItems: 6, items: { type: 'string' } },
  },
  required: ['overrides', 'scenarios', 'obligations', 'modelNotes'],
};

const SYSTEM = `You are the model architect for a commercial real estate underwriting model. You DESIGN the model; deterministic code builds every formula.
Rules:
- Ground every override, scenario, and obligation in the provided facts. Never invent amounts: obligations use amounts stated in the facts (earnout totals, deferred fees, note payments), spread sensibly across years 1-5 with the rationale saying why.
- Scenarios must be DEAL-SPECIFIC stresses named after this deal's actual risks (from the structure flags), not generic macro labels. Include one base case (all deltas 0).
- Overrides: only propose a lever when the facts justify a value different from a generic default, and say why in the rationale.
- The 'allin' lever is the all-in interest rate as a decimal: use it when the documents state an in-place, assumable, or committed rate. irM is interest reserve in WHOLE months; amort is amortization in WHOLE years.
- Keep rationales under 90 characters, plain factual language, no hype.`;

export interface ArchitectDesign {
  overrides: { lever: string; value: number; rationale: string }[];
  scenarios: { name: string; rateDeltaBps: number; noiDeltaPct: number; capDeltaBps: number; rationale: string }[];
  obligations: { label: string; annualAmounts: number[]; rationale: string }[];
  modelNotes: string[];
}

export interface ArchitectResult { design: ArchitectDesign; usage: LlmUsage }

export async function designModel(deal: Deal): Promise<ArchitectResult> {
  const notes = deal.extracted.notes ?? [];
  const facts = {
    name: deal.name,
    assetType: deal.assetType,
    location: deal.location,
    askingPrice: deal.askingPrice,
    noi: deal.extracted.t12?.noi,
    hotel: deal.extracted.hotel,
    capex: deal.assumptions.capexTotal,
    entryCap: deal.assumptions.entryCap,
    screen: deal.underwriting.screen ? {
      verdict: deal.underwriting.screen.verdict,
      riskScore: deal.underwriting.screen.riskScore,
      killFlags: deal.underwriting.screen.killFlags?.filter(f => f.triggered),
    } : null,
    structureFlags: notes.filter(n => n.field === 'structureFlag').map(n => n.extractedValue),
    extracted: notes.filter(n => n.field !== 'structureFlag').map(n => ({ field: n.field, value: n.extractedValue, confidence: n.confidence })),
    leversAvailable: Object.keys(ARCHITECT_LEVERS),
  };

  const { data, usage } = await callJson<ArchitectDesign>(
    'architect', SYSTEM,
    `Design the underwriting model for this deal:\n${JSON.stringify(facts, null, 1)}`,
    'model_design', SCHEMA, 4000
  );

  // Sanity-clamp overrides; drop anything outside the lever's bounds entirely
  // (an out-of-range proposal is a signal of confusion, not a value to clamp)
  const overrides = (data.overrides ?? []).filter(o => {
    const range = ARCHITECT_LEVERS[o.lever];
    if (!range || typeof o.value !== 'number' || o.value < range[0] || o.value > range[1]) return false;
    if (INTEGER_LEVERS.has(o.lever) && !Number.isInteger(o.value)) return false;
    return true;
  });

  // Obligations must be non-negative and finite
  const obligations = (data.obligations ?? []).filter(o =>
    Array.isArray(o.annualAmounts) && o.annualAmounts.length === 5 &&
    o.annualAmounts.every(a => typeof a === 'number' && isFinite(a) && a >= 0)
  );

  const scenarios = (data.scenarios ?? []).filter(s =>
    Math.abs(s.rateDeltaBps) <= 500 && s.noiDeltaPct >= -50 && s.noiDeltaPct <= 25 && Math.abs(s.capDeltaBps) <= 400
  );

  return { design: { overrides, scenarios, obligations, modelNotes: data.modelNotes ?? [] }, usage };
}
