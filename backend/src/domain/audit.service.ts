import { assertCan } from "./identity/permissions";
import type { Actor } from "./shared/actor";
import type { AuditEntry, AuditLog } from "./shared/audit";

export class AuditService {
  constructor(private readonly audit: AuditLog) {}

  async list(actor: Actor, query?: { entityType?: string; entityId?: string; limit?: number }): Promise<AuditEntry[]> {
    assertCan(actor, "audit:read");
    return await this.audit.list(actor.tenantId, query);
  }
}
