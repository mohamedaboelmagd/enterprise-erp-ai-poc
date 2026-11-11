export interface AuditEntry {
  id: string;
  tenantId: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditLog {
  append(entry: Omit<AuditEntry, "id" | "at"> & { at?: string }): Promise<AuditEntry>;
  list(tenantId: string, query?: { entityType?: string; entityId?: string; limit?: number }): Promise<AuditEntry[]>;
}
