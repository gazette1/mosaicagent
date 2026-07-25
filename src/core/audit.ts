/**
 * Audit Trail System
 * Tracks all actions and decisions for full transparency
 */

import { AuditLogEntry, Deal } from './schemas';

// ============================================================================
// Audit Actions
// ============================================================================

export type AuditAction =
  | 'DEAL_CREATED'
  | 'SOURCE_ADDED'
  | 'DATA_EXTRACTED'
  | 'DATA_MERGED'
  | 'CONFLICT_RESOLVED'
  | 'ASSUMPTION_SET'
  | 'ASSUMPTION_COMPUTED'
  | 'PROXY_APPLIED'
  | 'SCREEN_EXECUTED'
  | 'DEEPDIVE_EXECUTED'
  | 'STRESS_APPLIED'
  | 'ADAPTIVE_ADJUSTMENT'
  | 'KILL_FLAG_TRIGGERED'
  | 'MANUAL_OVERRIDE';

// ============================================================================
// Create audit entry
// ============================================================================

export function createAuditEntry(
  action: AuditAction,
  details: Record<string, unknown>,
  sourceId?: string
): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    details,
    sourceId,
  };
}

// ============================================================================
// Factory functions for specific entry types
// ============================================================================

export function createDealCreatedEntry(details: { name: string; assetType: string; location?: string }): AuditLogEntry {
  return createAuditEntry('DEAL_CREATED', details);
}

export function createSourceAddedEntry(details: { kind: string; filename?: string; sourceId: string; originalPath?: string }): AuditLogEntry {
  return createAuditEntry('SOURCE_ADDED', details, details.sourceId);
}

// ============================================================================
// Add audit entry to deal
// ============================================================================

export function addAuditEntry(deal: Deal, entry: AuditLogEntry): void {
  deal.auditLog.push(entry);
  deal.updatedAt = new Date().toISOString();
}

// ============================================================================
// Audit helper functions
// ============================================================================

export function auditSourceAdded(
  deal: Deal,
  sourceId: string,
  kind: string,
  filename?: string
): void {
  addAuditEntry(deal, createAuditEntry('SOURCE_ADDED', {
    kind,
    filename,
  }, sourceId));
}

export function auditDataExtracted(
  deal: Deal,
  sourceId: string,
  dataType: string,
  fieldCount: number,
  confidence: number
): void {
  addAuditEntry(deal, createAuditEntry('DATA_EXTRACTED', {
    dataType,
    fieldCount,
    confidence,
  }, sourceId));
}

export function auditConflictResolved(
  deal: Deal,
  field: string,
  selectedValue: unknown,
  selectedSourceId: string,
  alternatives: Array<{ value: unknown; sourceId: string }>
): void {
  addAuditEntry(deal, createAuditEntry('CONFLICT_RESOLVED', {
    field,
    selectedValue,
    selectedSourceId,
    alternatives,
  }));
}

export function auditProxyApplied(
  deal: Deal,
  field: string,
  proxyValue: unknown,
  proxyMethod: string,
  reason: string
): void {
  addAuditEntry(deal, createAuditEntry('PROXY_APPLIED', {
    field,
    proxyValue,
    proxyMethod,
    reason,
  }));
}

export function auditAssumptionComputed(
  deal: Deal,
  field: string,
  value: unknown,
  formula: string,
  inputs: Record<string, unknown>
): void {
  addAuditEntry(deal, createAuditEntry('ASSUMPTION_COMPUTED', {
    field,
    value,
    formula,
    inputs,
  }));
}

export function auditStressApplied(
  deal: Deal,
  stressType: string,
  baseValue: unknown,
  stressedValue: unknown,
  stressFactor: number
): void {
  addAuditEntry(deal, createAuditEntry('STRESS_APPLIED', {
    stressType,
    baseValue,
    stressedValue,
    stressFactor,
  }));
}

export function auditAdaptiveAdjustment(
  deal: Deal,
  adjustmentType: string,
  reason: string,
  oldValue: unknown,
  newValue: unknown
): void {
  addAuditEntry(deal, createAuditEntry('ADAPTIVE_ADJUSTMENT', {
    adjustmentType,
    reason,
    oldValue,
    newValue,
  }));
}

export function auditKillFlagTriggered(
  deal: Deal,
  criterionId: string,
  reason: string,
  severity: string
): void {
  addAuditEntry(deal, createAuditEntry('KILL_FLAG_TRIGGERED', {
    criterionId,
    reason,
    severity,
  }));
}

export function auditScreenExecuted(
  deal: Deal,
  verdict: string,
  riskScore: number,
  confidence: number
): void {
  addAuditEntry(deal, createAuditEntry('SCREEN_EXECUTED', {
    verdict,
    riskScore,
    confidence,
  }));
}

export function auditDeepDiveExecuted(
  deal: Deal,
  metricsComputed: string[],
  confidence: number
): void {
  addAuditEntry(deal, createAuditEntry('DEEPDIVE_EXECUTED', {
    metricsComputed,
    confidence,
  }));
}

// ============================================================================
// Format audit log for display
// ============================================================================

export function formatAuditLog(entries: AuditLogEntry[]): string {
  return entries.map(entry => {
    const time = new Date(entry.timestamp).toLocaleString();
    const source = entry.sourceId ? ` [${entry.sourceId}]` : '';
    const details = Object.entries(entry.details)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    return `[${time}] ${entry.action}${source}: ${details}`;
  }).join('\n');
}

// ============================================================================
// Get entries by type
// ============================================================================

export function getEntriesByAction(entries: AuditLogEntry[], action: AuditAction): AuditLogEntry[] {
  return entries.filter(e => e.action === action);
}

// ============================================================================
// Summarize audit log
// ============================================================================

export function summarizeAuditLog(entries: AuditLogEntry[]): {
  totalEntries: number;
  byAction: Record<string, number>;
  proxiesApplied: number;
  conflictsResolved: number;
  killFlagsTriggered: number;
} {
  const byAction: Record<string, number> = {};
  
  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
  }
  
  return {
    totalEntries: entries.length,
    byAction,
    proxiesApplied: byAction['PROXY_APPLIED'] || 0,
    conflictsResolved: byAction['CONFLICT_RESOLVED'] || 0,
    killFlagsTriggered: byAction['KILL_FLAG_TRIGGERED'] || 0,
  };
}
