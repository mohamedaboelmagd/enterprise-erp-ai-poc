import type { PrismaClient } from "@prisma/client";
import type { Tenant } from "../../domain/shared/actor";
import type { AuditEntry, AuditLog } from "../../domain/shared/audit";
import { DomainError } from "../../domain/shared/errors";
import { newId } from "../../domain/shared/ids";
import type { User } from "../../domain/identity/user";
import type { Role } from "../../domain/identity/permissions";
import { matchesInvoiceFilter, type Invoice, type InvoiceFilter, type InvoiceLine, type InvoiceStatus } from "../../domain/finance/invoice";
import type { LeaveBalance, LeaveFilter, LeaveRequest, LeaveStatus, LeaveType } from "../../domain/hr/leave";
import { matchesLeaveFilter } from "../../domain/hr/leave";
import type { PoFilter, PoLine, PoStatus, PurchaseOrder } from "../../domain/procurement/purchase-order";
import { matchesPoFilter } from "../../domain/procurement/purchase-order";
import type {
  InvoiceRepository,
  LeaveRepository,
  PurchaseOrderRepository,
  Repositories,
  TenantRepository,
  UserRepository,
} from "../../domain/ports";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}
  async getById(id: string): Promise<User | undefined> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUser(row) : undefined;
  }
  async getByEmail(email: string): Promise<User | undefined> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toUser(row) : undefined;
  }
  async listByTenant(tenantId: string): Promise<User[]> {
    const rows = await this.db.user.findMany({ where: { tenantId } });
    return rows.map(toUser);
  }
  async save(user: User): Promise<void> {
    await this.db.user.upsert({
      where: { id: user.id },
      create: fromUser(user),
      update: fromUser(user),
    });
  }
}

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly db: PrismaClient) {}
  async get(id: string): Promise<Tenant | undefined> {
    const row = await this.db.tenant.findUnique({ where: { id } });
    return row ? { id: row.id, name: row.name, country: row.country, currency: "AED" } : undefined;
  }
  async list(): Promise<Tenant[]> {
    const rows = await this.db.tenant.findMany();
    return rows.map((r) => ({ id: r.id, name: r.name, country: r.country, currency: "AED" as const }));
  }
  async save(tenant: Tenant): Promise<void> {
    await this.db.tenant.upsert({
      where: { id: tenant.id },
      create: { id: tenant.id, name: tenant.name, country: tenant.country, currency: tenant.currency },
      update: { name: tenant.name, country: tenant.country, currency: tenant.currency },
    });
  }
}

export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: PrismaClient) {}
  async get(tenantId: string, id: string): Promise<Invoice | undefined> {
    const row = await this.db.invoice.findFirst({ where: { id, tenantId }, include: { lines: true } });
    return row ? toInvoice(row) : undefined;
  }
  async getByNumber(tenantId: string, number: string): Promise<Invoice | undefined> {
    const row = await this.db.invoice.findUnique({ where: { tenantId_number: { tenantId, number } }, include: { lines: true } });
    return row ? toInvoice(row) : undefined;
  }
  async list(tenantId: string, filter: InvoiceFilter, today: string): Promise<Invoice[]> {
    const rows = await this.db.invoice.findMany({ where: { tenantId }, include: { lines: true } });
    return rows.map(toInvoice).filter((i) => matchesInvoiceFilter(i, filter, today)).sort((a, b) => b.number.localeCompare(a.number));
  }
  async save(invoice: Invoice): Promise<void> {
    const existing = await this.db.invoice.findUnique({ where: { id: invoice.id } });
    if (existing && existing.tenantId !== invoice.tenantId) {
      throw new DomainError("FORBIDDEN", "Cross-tenant write is not allowed");
    }
    if (existing && existing.version !== invoice.version - 1 && existing.version !== invoice.version) {
      throw new DomainError("PRECONDITION", `Stale version for ${invoice.id}`);
    }
    await this.db.$transaction(async (tx) => {
      await tx.invoice.upsert({
        where: { id: invoice.id },
        create: invoiceScalars(invoice),
        update: invoiceScalars(invoice),
      });
      await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
      if (invoice.lines.length) {
        await tx.invoiceLine.createMany({ data: invoice.lines.map((l) => ({ ...l, invoiceId: invoice.id })) });
      }
    });
  }
  async nextNumber(tenantId: string, year: number): Promise<string> {
    const key = `${tenantId}:INV:${year}`;
    const row = await this.db.sequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `INV-${year}-${String(row.value).padStart(4, "0")}`;
  }
}

export class PrismaLeaveRepository implements LeaveRepository {
  constructor(private readonly db: PrismaClient) {}
  async get(tenantId: string, id: string): Promise<LeaveRequest | undefined> {
    const row = await this.db.leaveRequest.findFirst({ where: { id, tenantId } });
    return row ? toLeave(row) : undefined;
  }
  async list(tenantId: string, filter: LeaveFilter): Promise<LeaveRequest[]> {
    const rows = await this.db.leaveRequest.findMany({ where: { tenantId } });
    return rows.map(toLeave).filter((r) => matchesLeaveFilter(r, filter)).sort((a, b) => b.from.localeCompare(a.from));
  }
  async save(request: LeaveRequest): Promise<void> {
    const existing = await this.db.leaveRequest.findUnique({ where: { id: request.id } });
    if (existing && existing.tenantId !== request.tenantId) {
      throw new DomainError("FORBIDDEN", "Cross-tenant write is not allowed");
    }
    await this.db.leaveRequest.upsert({
      where: { id: request.id },
      create: leaveScalars(request),
      update: leaveScalars(request),
    });
  }
  async getBalance(tenantId: string, employeeId: string, year: number): Promise<LeaveBalance | undefined> {
    const row = await this.db.leaveBalance.findUnique({ where: { tenantId_employeeId_year: { tenantId, employeeId, year } } });
    return row ? { ...row } : undefined;
  }
  async saveBalance(balance: LeaveBalance): Promise<void> {
    await this.db.leaveBalance.upsert({
      where: { tenantId_employeeId_year: { tenantId: balance.tenantId, employeeId: balance.employeeId, year: balance.year } },
      create: balance,
      update: { annualAllowanceDays: balance.annualAllowanceDays, annualUsedDays: balance.annualUsedDays },
    });
  }
}

export class PrismaPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly db: PrismaClient) {}
  async get(tenantId: string, id: string): Promise<PurchaseOrder | undefined> {
    const row = await this.db.purchaseOrder.findFirst({ where: { id, tenantId }, include: { lines: true } });
    return row ? toPo(row) : undefined;
  }
  async getByNumber(tenantId: string, number: string): Promise<PurchaseOrder | undefined> {
    const row = await this.db.purchaseOrder.findUnique({ where: { tenantId_number: { tenantId, number } }, include: { lines: true } });
    return row ? toPo(row) : undefined;
  }
  async list(tenantId: string, filter: PoFilter): Promise<PurchaseOrder[]> {
    const rows = await this.db.purchaseOrder.findMany({ where: { tenantId }, include: { lines: true } });
    return rows.map(toPo).filter((p) => matchesPoFilter(p, filter)).sort((a, b) => b.number.localeCompare(a.number));
  }
  async save(po: PurchaseOrder): Promise<void> {
    const existing = await this.db.purchaseOrder.findUnique({ where: { id: po.id } });
    if (existing && existing.tenantId !== po.tenantId) {
      throw new DomainError("FORBIDDEN", "Cross-tenant write is not allowed");
    }
    await this.db.$transaction(async (tx) => {
      await tx.purchaseOrder.upsert({
        where: { id: po.id },
        create: poScalars(po),
        update: poScalars(po),
      });
      await tx.poLine.deleteMany({ where: { poId: po.id } });
      if (po.lines.length) {
        await tx.poLine.createMany({ data: po.lines.map((l) => ({ id: l.id, poId: po.id, description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor })) });
      }
    });
  }
  async nextNumber(tenantId: string, year: number): Promise<string> {
    const key = `${tenantId}:PO:${year}`;
    const row = await this.db.sequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `PO-${year}-${String(row.value).padStart(4, "0")}`;
  }
}

export class PrismaAuditLog implements AuditLog {
  constructor(private readonly db: PrismaClient) {}
  async append(entry: Omit<AuditEntry, "id" | "at"> & { at?: string }): Promise<AuditEntry> {
    const full: AuditEntry = { ...entry, id: newId(), at: entry.at ?? new Date().toISOString() };
    await this.db.auditEntry.create({
      data: {
        id: full.id,
        tenantId: full.tenantId,
        at: full.at,
        actorId: full.actorId,
        actorName: full.actorName,
        action: full.action,
        entityType: full.entityType,
        entityId: full.entityId,
        summary: full.summary,
        before: (full.before ?? undefined) as object | undefined,
        after: (full.after ?? undefined) as object | undefined,
      },
    });
    return full;
  }
  async list(tenantId: string, query: { entityType?: string; entityId?: string; limit?: number } = {}): Promise<AuditEntry[]> {
    const rows = await this.db.auditEntry.findMany({
      where: { tenantId, entityType: query.entityType, entityId: query.entityId },
      orderBy: { at: "desc" },
      take: query.limit ?? 200,
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      at: r.at,
      actorId: r.actorId,
      actorName: r.actorName,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      summary: r.summary,
      before: (r.before as Record<string, unknown> | null) ?? undefined,
      after: (r.after as Record<string, unknown> | null) ?? undefined,
    }));
  }
}

export function createPrismaRepositories(db: PrismaClient): Repositories {
  return {
    users: wrapAsync(new PrismaUserRepository(db)),
    tenants: wrapAsync(new PrismaTenantRepository(db)),
    invoices: wrapAsync(new PrismaInvoiceRepository(db)),
    leave: wrapAsync(new PrismaLeaveRepository(db)),
    purchaseOrders: wrapAsync(new PrismaPurchaseOrderRepository(db)),
    audit: new PrismaAuditLog(db),
  };
}

/**
 * Domain ports are synchronous so the in-memory adapter and the browser demo
 * can call them directly. Prisma is async, so we expose thenable results
 * behind the same method names. Service callers in the API should await
 * repository methods when running on Prisma — see docs/adr/0003.
 *
 * For this PoC the self-hosted API still prefers awaiting at the edges
 * (seed, nextNumber). The in-memory path used by CI does not use this wrapper.
 */
function wrapAsync<T extends object>(impl: T): T {
  return impl;
}

function toUser(row: { id: string; tenantId: string; email: string; displayName: string; title: string | null; roles: string[]; passwordHash: string; active: boolean }): User {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    displayName: row.displayName,
    title: row.title ?? undefined,
    roles: row.roles as Role[],
    passwordHash: row.passwordHash,
    active: row.active,
  };
}
function fromUser(user: User) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    displayName: user.displayName,
    title: user.title,
    roles: user.roles,
    passwordHash: user.passwordHash,
    active: user.active,
  };
}

function toInvoice(row: { id: string; tenantId: string; number: string; vendorName: string; issueDate: string; dueDate: string; currency: string; taxBps: number; status: string; notes: string | null; submittedBy: string | null; approvedBy: string | null; rejectedBy: string | null; rejectReason: string | null; paidAt: string | null; paidBy: string | null; version: number; createdAt: string; updatedAt: string; lines: { id: string; description: string; quantity: number; unitPriceMinor: number }[] }): Invoice {
  return {
    id: row.id,
    tenantId: row.tenantId,
    number: row.number,
    vendorName: row.vendorName,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    currency: "AED",
    taxBps: row.taxBps,
    status: row.status as InvoiceStatus,
    notes: row.notes ?? undefined,
    submittedBy: row.submittedBy ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    rejectReason: row.rejectReason ?? undefined,
    paidAt: row.paidAt ?? undefined,
    paidBy: row.paidBy ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map((l): InvoiceLine => ({ id: l.id, description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor })),
  };
}
function invoiceScalars(invoice: Invoice) {
  const { lines: _l, ...rest } = invoice;
  return rest;
}

function toLeave(row: { id: string; tenantId: string; employeeId: string; employeeName: string; type: string; from: string; to: string; days: number; reason: string | null; status: string; submittedBy: string | null; approvedBy: string | null; rejectedBy: string | null; rejectReason: string | null; version: number; createdAt: string; updatedAt: string }): LeaveRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    type: row.type as LeaveType,
    from: row.from,
    to: row.to,
    days: row.days,
    reason: row.reason ?? undefined,
    status: row.status as LeaveStatus,
    submittedBy: row.submittedBy ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    rejectReason: row.rejectReason ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function leaveScalars(request: LeaveRequest) {
  return { ...request };
}

function toPo(row: { id: string; tenantId: string; number: string; vendorName: string; neededBy: string | null; currency: string; taxBps: number; status: string; notes: string | null; submittedBy: string | null; approvedBy: string | null; rejectedBy: string | null; rejectReason: string | null; issuedAt: string | null; issuedBy: string | null; version: number; createdAt: string; updatedAt: string; lines: { id: string; description: string; quantity: number; unitPriceMinor: number }[] }): PurchaseOrder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    number: row.number,
    vendorName: row.vendorName,
    neededBy: row.neededBy ?? undefined,
    currency: "AED",
    taxBps: row.taxBps,
    status: row.status as PoStatus,
    notes: row.notes ?? undefined,
    submittedBy: row.submittedBy ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    rejectReason: row.rejectReason ?? undefined,
    issuedAt: row.issuedAt ?? undefined,
    issuedBy: row.issuedBy ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map((l): PoLine => ({ id: l.id, description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor })),
  };
}
function poScalars(po: PurchaseOrder) {
  const { lines: _l, ...rest } = po;
  return rest;
}
