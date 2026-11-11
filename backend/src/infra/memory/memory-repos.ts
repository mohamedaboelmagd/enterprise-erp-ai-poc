import type { Tenant } from "../../domain/shared/actor";
import type { AuditEntry, AuditLog } from "../../domain/shared/audit";
import { DomainError } from "../../domain/shared/errors";
import { newId } from "../../domain/shared/ids";
import type { User } from "../../domain/identity/user";
import { matchesInvoiceFilter, type Invoice, type InvoiceFilter } from "../../domain/finance/invoice";
import { matchesLeaveFilter, type LeaveBalance, type LeaveFilter, type LeaveRequest } from "../../domain/hr/leave";
import { matchesPoFilter, type PoFilter, type PurchaseOrder } from "../../domain/procurement/purchase-order";
import type {
  InvoiceRepository,
  LeaveRepository,
  PurchaseOrderRepository,
  Repositories,
  TenantRepository,
  UserRepository,
} from "../../domain/ports";

function bumpOrFresh<T extends { version: number; id: string }>(existing: T | undefined, next: T): T {
  if (!existing) return { ...next };
  if (existing.version !== next.version - 1 && existing.version !== next.version) {
    throw new DomainError("PRECONDITION", `Stale version for ${next.id}: have ${existing.version}, wrote ${next.version}`);
  }
  return { ...next };
}

export class MemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  async getById(id: string): Promise<User | undefined> {
    const u = this.byId.get(id);
    return u ? { ...u, roles: [...u.roles] } : undefined;
  }
  async getByEmail(email: string): Promise<User | undefined> {
    const found = [...this.byId.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
    return found ? this.getById(found.id) : undefined;
  }
  async listByTenant(tenantId: string): Promise<User[]> {
    return [...this.byId.values()].filter((u) => u.tenantId === tenantId).map((u) => ({ ...u, roles: [...u.roles] }));
  }
  async save(user: User): Promise<void> {
    this.byId.set(user.id, { ...user, roles: [...user.roles] });
  }
}

export class MemoryTenantRepository implements TenantRepository {
  private readonly byId = new Map<string, Tenant>();
  async get(id: string): Promise<Tenant | undefined> {
    const t = this.byId.get(id);
    return t ? { ...t } : undefined;
  }
  async list(): Promise<Tenant[]> {
    return [...this.byId.values()].map((t) => ({ ...t }));
  }
  async save(tenant: Tenant): Promise<void> {
    this.byId.set(tenant.id, { ...tenant });
  }
}

export class MemoryInvoiceRepository implements InvoiceRepository {
  private readonly byId = new Map<string, Invoice>();
  private readonly counters = new Map<string, number>();

  async get(tenantId: string, id: string): Promise<Invoice | undefined> {
    const inv = this.byId.get(id);
    if (!inv || inv.tenantId !== tenantId) return undefined;
    return cloneInvoice(inv);
  }
  async getByNumber(tenantId: string, number: string): Promise<Invoice | undefined> {
    const inv = [...this.byId.values()].find((i) => i.tenantId === tenantId && i.number === number);
    return inv ? cloneInvoice(inv) : undefined;
  }
  async list(tenantId: string, filter: InvoiceFilter, today: string): Promise<Invoice[]> {
    return [...this.byId.values()]
      .filter((i) => i.tenantId === tenantId && matchesInvoiceFilter(i, filter, today))
      .map(cloneInvoice)
      .sort((a, b) => b.number.localeCompare(a.number));
  }
  async save(invoice: Invoice): Promise<void> {
    const existing = this.byId.get(invoice.id);
    if (existing && existing.tenantId !== invoice.tenantId) {
      throw new DomainError("FORBIDDEN", "Cross-tenant write is not allowed");
    }
    this.byId.set(invoice.id, bumpOrFresh(existing, cloneInvoice(invoice)));
  }
  async nextNumber(tenantId: string, year: number): Promise<string> {
    const key = `${tenantId}:INV:${year}`;
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return `INV-${year}-${String(n).padStart(4, "0")}`;
  }
  /** Used by the seed to keep numbers aligned with pre-assigned documents. */
  peekSetCounter(tenantId: string, year: number, value: number): void {
    this.counters.set(`${tenantId}:INV:${year}`, value);
  }
}

export class MemoryLeaveRepository implements LeaveRepository {
  private readonly byId = new Map<string, LeaveRequest>();
  private readonly balances = new Map<string, LeaveBalance>();

  async get(tenantId: string, id: string): Promise<LeaveRequest | undefined> {
    const req = this.byId.get(id);
    if (!req || req.tenantId !== tenantId) return undefined;
    return { ...req };
  }
  async list(tenantId: string, filter: LeaveFilter): Promise<LeaveRequest[]> {
    return [...this.byId.values()]
      .filter((r) => r.tenantId === tenantId && matchesLeaveFilter(r, filter))
      .map((r) => ({ ...r }))
      .sort((a, b) => b.from.localeCompare(a.from) || b.createdAt.localeCompare(a.createdAt));
  }
  async save(request: LeaveRequest): Promise<void> {
    const existing = this.byId.get(request.id);
    if (existing && existing.tenantId !== request.tenantId) {
      throw new DomainError("FORBIDDEN", "Cross-tenant write is not allowed");
    }
    this.byId.set(request.id, bumpOrFresh(existing, { ...request }));
  }
  async getBalance(tenantId: string, employeeId: string, year: number): Promise<LeaveBalance | undefined> {
    const b = this.balances.get(`${tenantId}:${employeeId}:${year}`);
    return b ? { ...b } : undefined;
  }
  async saveBalance(balance: LeaveBalance): Promise<void> {
    this.balances.set(`${balance.tenantId}:${balance.employeeId}:${balance.year}`, { ...balance });
  }
}

export class MemoryPurchaseOrderRepository implements PurchaseOrderRepository {
  private readonly byId = new Map<string, PurchaseOrder>();
  private readonly counters = new Map<string, number>();

  async get(tenantId: string, id: string): Promise<PurchaseOrder | undefined> {
    const po = this.byId.get(id);
    if (!po || po.tenantId !== tenantId) return undefined;
    return clonePo(po);
  }
  async getByNumber(tenantId: string, number: string): Promise<PurchaseOrder | undefined> {
    const po = [...this.byId.values()].find((i) => i.tenantId === tenantId && i.number === number);
    return po ? clonePo(po) : undefined;
  }
  async list(tenantId: string, filter: PoFilter): Promise<PurchaseOrder[]> {
    return [...this.byId.values()]
      .filter((p) => p.tenantId === tenantId && matchesPoFilter(p, filter))
      .map(clonePo)
      .sort((a, b) => b.number.localeCompare(a.number));
  }
  async save(po: PurchaseOrder): Promise<void> {
    const existing = this.byId.get(po.id);
    if (existing && existing.tenantId !== po.tenantId) {
      throw new DomainError("FORBIDDEN", "Cross-tenant write is not allowed");
    }
    this.byId.set(po.id, bumpOrFresh(existing, clonePo(po)));
  }
  async nextNumber(tenantId: string, year: number): Promise<string> {
    const key = `${tenantId}:PO:${year}`;
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return `PO-${year}-${String(n).padStart(4, "0")}`;
  }
  peekSetCounter(tenantId: string, year: number, value: number): void {
    this.counters.set(`${tenantId}:PO:${year}`, value);
  }
}

export class MemoryAuditLog implements AuditLog {
  private readonly entries: AuditEntry[] = [];
  async append(entry: Omit<AuditEntry, "id" | "at"> & { at?: string }): Promise<AuditEntry> {
    const full: AuditEntry = {
      ...entry,
      id: newId(),
      at: entry.at ?? new Date().toISOString(),
    };
    this.entries.unshift(full);
    return full;
  }
  async list(tenantId: string, query: { entityType?: string; entityId?: string; limit?: number } = {}): Promise<AuditEntry[]> {
    return this.entries
      .filter((e) => e.tenantId === tenantId)
      .filter((e) => (query.entityType ? e.entityType === query.entityType : true))
      .filter((e) => (query.entityId ? e.entityId === query.entityId : true))
      .slice(0, query.limit ?? 200)
      .map((e) => ({ ...e }));
  }
}

export function createMemoryRepositories(): Repositories & {
  invoices: MemoryInvoiceRepository;
  purchaseOrders: MemoryPurchaseOrderRepository;
} {
  return {
    users: new MemoryUserRepository(),
    tenants: new MemoryTenantRepository(),
    invoices: new MemoryInvoiceRepository(),
    leave: new MemoryLeaveRepository(),
    purchaseOrders: new MemoryPurchaseOrderRepository(),
    audit: new MemoryAuditLog(),
  };
}

function cloneInvoice(inv: Invoice): Invoice {
  return { ...inv, lines: inv.lines.map((l) => ({ ...l })) };
}
function clonePo(po: PurchaseOrder): PurchaseOrder {
  return { ...po, lines: po.lines.map((l) => ({ ...l })) };
}
