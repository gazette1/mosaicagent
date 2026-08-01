/**
 * Text Parser for Emails and Offering Memoranda
 * Extracts structured data from unstructured text
 */

import { ExtractedNote, TrackedNumber, tracked } from '../core/schemas';

// ============================================================================
// Extraction patterns
// ============================================================================

interface ExtractionPattern {
  field: string;
  patterns: RegExp[];
  valueType: 'currency' | 'percent' | 'number' | 'string';
  confidence: number;
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // Pricing
  {
    field: 'askingPrice',
    patterns: [
      /(?:asking|list|offer|price)[\s:]*\$?([\d,]+(?:\.\d+)?)\s*(?:mm?|million)?/i,
      /\$?([\d,]+(?:\.\d+)?)\s*(?:mm?|million)[\s]*(?:asking|list)?/i,
      /(?:price|priced\s+at)[\s:]*\$?([\d,]+(?:\.\d+)?)/i,
    ],
    valueType: 'currency',
    confidence: 0.7,
  },
  // NOI
  {
    field: 'noi',
    patterns: [
      /(?:noi|net operating income)[\s:]*\$?([\d,]+(?:\.\d+)?)/i,
      /\$?([\d,]+(?:\.\d+)?)\s*(?:noi|net operating)/i,
    ],
    valueType: 'currency',
    confidence: 0.65,
  },
  // Cap rate. The bare-number form requires a % sign: tax forms are full of
  // fragments like "3 Cap" (Schedule 3 Capital) that are not cap rates.
  {
    field: 'capRate',
    patterns: [
      /(?:cap\s*rate|going.in\s*cap)[\s:]*(\d+(?:\.\d+)?)\s*%?/i,
      /(\d+(?:\.\d+)?)\s*%\s*cap\b/i,
    ],
    valueType: 'percent',
    confidence: 0.7,
  },
  // Square footage
  {
    field: 'totalSF',
    patterns: [
      /(\d{1,3}(?:,\d{3})+|\d+)\s*(?:sf|sq\.?\s*ft\.?|square\s*feet)/i,
      /(?:rsf|nra|gla|gba)[\s:]*(\d{1,3}(?:,\d{3})+|\d+)/i,
    ],
    valueType: 'number',
    confidence: 0.75,
  },
  // Units
  {
    field: 'totalUnits',
    patterns: [
      /(\d+)\s*(?:unit|door|apartment|suite)s?/i,
      /(?:unit|door)\s*(?:count|mix)?[\s:]*(\d+)/i,
    ],
    valueType: 'number',
    confidence: 0.8,
  },
  // Year built
  {
    field: 'yearBuilt',
    patterns: [
      /(?:built|constructed|year\s*built)[\s:]*(?:in\s*)?((?:19|20)\d{2})/i,
      /((?:19|20)\d{2})\s*(?:construction|vintage)/i,
    ],
    valueType: 'number',
    confidence: 0.85,
  },
  // Occupancy
  {
    field: 'occupancy',
    patterns: [
      /(?:occupancy|occupied)[\s:]*(\d+(?:\.\d+)?)\s*%/i,
      /occupancy\s*\([^)]{0,30}\)\s*:?\s*(\d+(?:\.\d+)?)\s*%/i, // "Occupancy (Trailing 12): 52%"
      /occupancy[^%\d\n]{0,24}(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*(?:occupied|leased|occupancy)/i,
    ],
    valueType: 'percent',
    confidence: 0.7,
  },
  // Capital budget: PIP / renovation. Populates assumptions.capexTotal, which
  // clears the "CapEx cannot be priced" kill flag when a budget is in the room.
  {
    field: 'capexTotal',
    patterns: [
      /(?:total\s+)?(?:renovation|pip)(?:\s*(?:and|\/|&)\s*pip)?\s*budget[\s:]*\$?([\d,]+(?:\.\d+)?)\s*(?:mm?|million)?/i,
      /(?:renovation|pip|capital\s+improvement)[^\n$]{0,30}\$?([\d,]+(?:\.\d+)?)\s*(?:mm|million)/i,
      /total\s+pip[\s:]*\$?([\d,]+(?:\.\d+)?)/i,
    ],
    valueType: 'currency',
    confidence: 0.75,
  },
  // Hotel: key count
  {
    field: 'keys',
    patterns: [
      /(\d{2,4})[\s-]*(?:key|room|guest\s*room)s?\b/i,
      /(?:key|room)\s*count[\s:]*(\d{2,4})/i,
    ],
    valueType: 'number',
    confidence: 0.8,
  },
  // Hotel: ADR
  {
    field: 'adr',
    patterns: [
      /(?:adr|average\s*daily\s*rate)[\s:]*\$?([\d,]+(?:\.\d+)?)/i,
      /\$?([\d,]+(?:\.\d+)?)\s*adr/i,
    ],
    valueType: 'currency',
    confidence: 0.75,
  },
  // Hotel: RevPAR
  {
    field: 'revpar',
    patterns: [
      /(?:revpar|rev\s*par)[\s:]*\$?([\d,]+(?:\.\d+)?)/i,
    ],
    valueType: 'currency',
    confidence: 0.75,
  },
  // Rent per SF
  {
    field: 'rentPerSF',
    patterns: [
      /\$?([\d.]+)(?:\s*\/?\s*(?:psf|sf|per\s*sf))/i,
      /(?:rent|asking)[\s:]*\$?([\d.]+)[\s/]*(?:sf|psf)/i,
    ],
    valueType: 'currency',
    confidence: 0.65,
  },
  // Location/Address
  {
    field: 'address',
    patterns: [
      /(?:address|located\s*at|property\s*at)[\s:]*([^\n,]+(?:,\s*[A-Z]{2}\s*\d{5})?)/i,
      /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln)[^\n]*)/i,
    ],
    valueType: 'string',
    confidence: 0.7,
  },
  // City/State
  {
    field: 'cityState',
    patterns: [
      /([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?/,
    ],
    valueType: 'string',
    confidence: 0.75,
  },
];

// ============================================================================
// Parse value by type
// ============================================================================

function parseValue(raw: string, valueType: string, fullMatch?: string): number | string | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  // Multiplier suffixes live in the surrounding text, not the captured number
  const context = (fullMatch ?? raw).toLowerCase();

  switch (valueType) {
    case 'currency': {
      let num = parseFloat(cleaned);
      if (/\d\s*(?:mm|million)/.test(context)) {
        num *= 1_000_000;
      } else if (/\d\s*k\b/.test(context)) {
        num *= 1_000;
      }
      return isNaN(num) ? null : num;
    }
    case 'percent': {
      const num = parseFloat(cleaned);
      // Convert to decimal if > 1 (i.e., 5.5% -> 0.055)
      if (num > 1) return num / 100;
      return isNaN(num) ? null : num;
    }
    case 'number': {
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
    case 'string':
      return raw.trim();
    default:
      return raw.trim();
  }
}

// ============================================================================
// Extract data from text
// ============================================================================

export interface TextExtractionResult {
  notes: ExtractedNote[];
  extractedValues: Record<string, { value: number | string; confidence: number; rawText: string }>;
  rawText: string;
}

// Plausibility ranges per field. Values outside are pattern collisions
// (years read as occupancy, spreads read as prices) and are discarded.
// Deterministic QC: cheaper than any model and never hallucinates.
const SANITY_RANGES: Record<string, [number, number]> = {
  askingPrice: [250_000, 5_000_000_000],
  noi: [25_000, 500_000_000],
  capRate: [0.005, 0.25],
  occupancy: [0.01, 1.0],
  adr: [30, 2_500],
  revpar: [5, 2_000],
  keys: [10, 2_500],
  totalUnits: [1, 10_000],
  totalSF: [500, 50_000_000],
  yearBuilt: [1850, 2035],
  rentPerSF: [0.25, 500],
  loanRequest: [250_000, 5_000_000_000],
  capexTotal: [10_000, 2_000_000_000],
};

export function passesSanity(field: string, value: number | string): boolean {
  const range = SANITY_RANGES[field];
  if (!range) return true;
  // A field with a numeric range must receive a number. Found by a shadow run:
  // the extraction model returned a full address string for `keys`, and the
  // old string-passthrough let it straight into the deal record.
  if (typeof value !== 'number') {
    const coerced = Number(String(value).replace(/[$,\s]/g, ''));
    if (!isFinite(coerced)) return false;
    return coerced >= range[0] && coerced <= range[1];
  }
  return value >= range[0] && value <= range[1];
}

/** Numeric fields coerce to number, so downstream math never sees prose. */
export function coerceField(field: string, value: number | string): number | string {
  if (!SANITY_RANGES[field] || typeof value === 'number') return value;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : value;
}

export function extractFromText(text: string, sourceId: string): TextExtractionResult {
  const notes: ExtractedNote[] = [];
  const extractedValues: Record<string, { value: number | string; confidence: number; rawText: string }> = {};

  for (const pattern of EXTRACTION_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        const rawText = match[0];
        const value = parseValue(match[1], pattern.valueType, match[0]);

        if (value !== null && passesSanity(pattern.field, value)) {
          // Only add if we don't already have this field or if this match is better
          if (!extractedValues[pattern.field] || 
              pattern.confidence > extractedValues[pattern.field].confidence) {
            extractedValues[pattern.field] = {
              value,
              confidence: pattern.confidence,
              rawText,
            };
            
            notes.push({
              sourceId,
              field: pattern.field,
              extractedValue: String(value),
              confidence: pattern.confidence,
              rawText,
            });
          }
          break; // Found a match for this field, move to next
        }
      }
    }
  }
  
  return {
    notes,
    extractedValues,
    rawText: text,
  };
}

// ============================================================================
// Merge text extractions into deal
// ============================================================================

export function createTrackedFromExtraction(
  extracted: { value: number | string; confidence: number; rawText: string },
  sourceId: string,
  unit?: string
): TrackedNumber {
  return tracked(extracted.value as number, extracted.confidence, {
    sourceId,
    unit,
    rationale: `Extracted from text: "${extracted.rawText.substring(0, 50)}..."`,
  });
}

// ============================================================================
// Parse broker email specifically
// ============================================================================

export function parseBrokerEmail(emailText: string, sourceId: string): TextExtractionResult {
  // First do standard extraction
  const result = extractFromText(emailText, sourceId);
  
  // Look for additional broker-specific patterns
  
  // Deal name / property name
  const namePatterns = [
    /(?:property|deal|opportunity)[\s:]+["']?([^"'\n]+)["']?/i,
    /(?:re:|subject:)\s*([^\n]+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = emailText.match(pattern);
    if (match && match[1] && !result.extractedValues['propertyName']) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 100) {
        result.extractedValues['propertyName'] = {
          value: name,
          confidence: 0.6,
          rawText: match[0],
        };
        result.notes.push({
          sourceId,
          field: 'propertyName',
          extractedValue: name,
          confidence: 0.6,
          rawText: match[0],
        });
        break;
      }
    }
  }
  
  // Broker contact
  const contactPatterns = [
    /(?:contact|call|reach)[\s:]*([A-Za-z\s]+)[\s,]*(?:at\s*)?(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/i,
    /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*[-–]\s*(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/i,
  ];
  
  for (const pattern of contactPatterns) {
    const match = emailText.match(pattern);
    if (match) {
      result.notes.push({
        sourceId,
        field: 'brokerContact',
        extractedValue: `${match[1].trim()}: ${match[2]}`,
        confidence: 0.7,
        rawText: match[0],
      });
      break;
    }
  }
  
  return result;
}

// ============================================================================
// Parse OM text
// ============================================================================

export function parseOMText(omText: string, sourceId: string): TextExtractionResult {
  // First do standard extraction
  const result = extractFromText(omText, sourceId);
  
  // OMs typically have more structured data, look for investment highlights
  const highlightPatterns = [
    /(?:investment\s+)?highlight[s]?[\s:]*([^\n]+(?:\n\s*[-•]\s*[^\n]+)*)/i,
    /(?:key\s+)?feature[s]?[\s:]*([^\n]+(?:\n\s*[-•]\s*[^\n]+)*)/i,
  ];
  
  for (const pattern of highlightPatterns) {
    const match = omText.match(pattern);
    if (match) {
      result.notes.push({
        sourceId,
        field: 'investmentHighlights',
        extractedValue: match[1].trim().substring(0, 500),
        confidence: 0.8,
        rawText: match[0].substring(0, 200),
      });
      break;
    }
  }
  
  return result;
}
