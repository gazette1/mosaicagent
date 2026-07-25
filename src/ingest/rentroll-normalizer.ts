/**
 * Rent Roll Normalizer
 * Parses and normalizes rent roll data into canonical format
 */

import { randomUUID as uuidv4 } from 'crypto';
import { RentRoll, Tenant, TrackedNumber, tracked } from '../core/schemas';
import { ParseResult, findColumn, parseNumber } from './parsers';

// ============================================================================
// Normalize rent roll from parsed CSV
// ============================================================================

export interface RentRollNormalizationResult {
  rentRoll: RentRoll;
  warnings: string[];
  unmappedColumns: string[];
}

export function normalizeRentRoll(
  parsed: ParseResult,
  sourceId: string
): RentRollNormalizationResult {
  const warnings: string[] = [];
  const unmappedColumns: string[] = [];
  
  // Find column mappings
  const columns = {
    unit: findColumn(parsed.headers, 'unit'),
    tenant: findColumn(parsed.headers, 'tenant'),
    sqft: findColumn(parsed.headers, 'sqft'),
    monthlyRent: findColumn(parsed.headers, 'monthly_rent'),
    annualRent: findColumn(parsed.headers, 'annual_rent'),
    leaseStart: findColumn(parsed.headers, 'lease_start'),
    leaseEnd: findColumn(parsed.headers, 'lease_end'),
    rentPerSF: findColumn(parsed.headers, 'rent_per_sf'),
  };
  
  // Track unmapped columns
  for (const header of parsed.headers) {
    const isMapped = Object.values(columns).includes(header);
    if (!isMapped) {
      unmappedColumns.push(header);
    }
  }
  
  // Process each row into a tenant
  const tenants: Tenant[] = [];
  let totalSF = 0;
  let occupiedUnits = 0;
  let vacantUnits = 0;
  let grossPotentialRent = 0;
  let effectiveGrossRent = 0;
  
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const rowNum = i + 2; // 1-indexed, plus header row
    
    // Extract tenant data
    const unit = columns.unit ? String(row[columns.unit] || '') : `Unit ${i + 1}`;
    const tenantName = columns.tenant ? String(row[columns.tenant] || '') : undefined;
    
    // Determine if vacant
    const isVacant = 
      !tenantName || 
      tenantName.toLowerCase().includes('vacant') ||
      tenantName.toLowerCase().includes('available') ||
      tenantName === '';
    
    // Extract numeric fields
    const sqft = columns.sqft ? parseNumber(row[columns.sqft]) : null;
    const monthlyRent = columns.monthlyRent ? parseNumber(row[columns.monthlyRent]) : null;
    let annualRent = columns.annualRent ? parseNumber(row[columns.annualRent]) : null;
    const rentPerSF = columns.rentPerSF ? parseNumber(row[columns.rentPerSF]) : null;
    
    // Calculate annual rent if only monthly provided
    if (!annualRent && monthlyRent !== null) {
      annualRent = monthlyRent * 12;
    }
    
    // Calculate monthly if only annual provided
    const calculatedMonthly = annualRent !== null ? annualRent / 12 : null;
    
    // Build tenant record
    const tenant: Tenant = {
      id: generateTenantId(),
      unit,
      name: tenantName,
      isVacant,
    };
    
    if (sqft !== null) {
      tenant.squareFeet = tracked(sqft, 0.9, {
        sourceId,
        unit: 'SF',
        rationale: `From rent roll row ${rowNum}`,
      });
      totalSF += sqft;
    }
    
    if (monthlyRent !== null || calculatedMonthly !== null) {
      tenant.monthlyRent = tracked(monthlyRent ?? calculatedMonthly!, 0.85, {
        sourceId,
        unit: 'USD/month',
        formula: monthlyRent ? 'direct' : 'annual / 12',
      });
    }
    
    if (annualRent !== null) {
      tenant.annualRent = tracked(annualRent, 0.85, {
        sourceId,
        unit: 'USD/year',
      });
      
      if (!isVacant) {
        effectiveGrossRent += annualRent;
      }
      grossPotentialRent += annualRent;
    }
    
    if (rentPerSF !== null) {
      tenant.rentPerSF = tracked(rentPerSF, 0.85, {
        sourceId,
        unit: 'USD/SF/year',
      });
    } else if (annualRent !== null && sqft !== null && sqft > 0) {
      // Calculate rent per SF
      tenant.rentPerSF = tracked(annualRent / sqft, 0.8, {
        sourceId,
        unit: 'USD/SF/year',
        formula: 'annual_rent / sqft',
        rationale: 'Calculated from annual rent and square footage',
      });
    }
    
    // Lease dates (as strings for now)
    if (columns.leaseStart && row[columns.leaseStart]) {
      tenant.leaseStart = String(row[columns.leaseStart]);
    }
    if (columns.leaseEnd && row[columns.leaseEnd]) {
      tenant.leaseEnd = String(row[columns.leaseEnd]);
    }
    
    // Track vacancy
    if (isVacant) {
      vacantUnits++;
    } else {
      occupiedUnits++;
    }
    
    tenants.push(tenant);
  }
  
  // Build summary metrics
  const totalUnits = tenants.length;
  const occupancyRate = totalUnits > 0 ? occupiedUnits / totalUnits : 0;
  
  // Create rent roll
  const rentRoll: RentRoll = {
    sourceId,
    tenants,
    totalUnits: tracked(totalUnits, 0.95, {
      sourceId,
      formula: 'count(tenants)',
    }),
    occupiedUnits: tracked(occupiedUnits, 0.9, {
      sourceId,
      formula: 'count(tenants where !isVacant)',
    }),
    vacantUnits: tracked(vacantUnits, 0.9, {
      sourceId,
      formula: 'count(tenants where isVacant)',
    }),
    occupancyRate: tracked(occupancyRate, 0.85, {
      sourceId,
      formula: 'occupiedUnits / totalUnits',
      rationale: warnings.length > 0 ? 'Some vacancy data inferred' : undefined,
    }),
  };
  
  if (totalSF > 0) {
    rentRoll.totalSF = tracked(totalSF, 0.9, {
      sourceId,
      unit: 'SF',
      formula: 'sum(tenant.squareFeet)',
    });
  }
  
  if (grossPotentialRent > 0) {
    rentRoll.grossPotentialRent = tracked(grossPotentialRent, 0.8, {
      sourceId,
      unit: 'USD/year',
      formula: 'sum(tenant.annualRent)',
      rationale: 'Assumes current rents for vacant units',
    });
  }
  
  if (effectiveGrossRent > 0) {
    rentRoll.effectiveGrossRent = tracked(effectiveGrossRent, 0.85, {
      sourceId,
      unit: 'USD/year',
      formula: 'sum(tenant.annualRent where !isVacant)',
    });
  }
  
  // Calculate averages
  if (totalUnits > 0 && effectiveGrossRent > 0) {
    rentRoll.avgRentPerUnit = tracked(effectiveGrossRent / occupiedUnits, 0.8, {
      sourceId,
      unit: 'USD/year/unit',
      formula: 'effectiveGrossRent / occupiedUnits',
    });
  }
  
  if (totalSF > 0 && effectiveGrossRent > 0) {
    rentRoll.avgRentPerSF = tracked(effectiveGrossRent / totalSF, 0.8, {
      sourceId,
      unit: 'USD/SF/year',
      formula: 'effectiveGrossRent / totalSF',
    });
  }
  
  // Add warnings
  if (!columns.tenant) {
    warnings.push('No tenant name column found - vacancy detection may be inaccurate');
  }
  if (!columns.sqft) {
    warnings.push('No square footage column found');
  }
  if (!columns.monthlyRent && !columns.annualRent) {
    warnings.push('No rent column found - income data incomplete');
  }
  
  return {
    rentRoll,
    warnings,
    unmappedColumns,
  };
}

// ============================================================================
// Generate unique tenant ID
// ============================================================================

function generateTenantId(): string {
  const bytes = new Uint8Array(6);
  require('crypto').getRandomValues(bytes);
  return 'T' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
