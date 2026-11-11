import { assertCan } from "../identity/permissions";
import type { Actor } from "../shared/actor";
import type { AuditLog } from "../shared/audit";
import type { Clock } from "../shared/clock";
import { DomainError, required } from "../shared/errors";
import { EventBus } from "../shared/events";
import { newId } from "../shared/ids";
import { DEFAULT_CURRENCY } from "../shared/money";
import type { PurchaseOrderRepository } from "../ports";
import {
  assertPoEditable,
  poTotalMinor,
  type PoLine,
  type PoFilter,
  type PurchaseOrder,
} from "./purchase-order";

export interface PoLineInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface CreatePoInput {
  vendorName: string;
  neededBy?: string;
  taxBps?: number;
  notes?: string;
  lines: PoLineInput[];
}

export class ProcurementService {
  constructor(
    private readonly purchaseOrders: PurchaseOrderRepository,
    private readonly audit: AuditLog,
    private readonly bus: EventBus,
    private readonly clock: Clock,
  ) {}

  async list(actor: Actor, filter: PoFilter = {}): Promise<PurchaseOrder[]> {
    assertCan(actor, "procurement:read");
    return await this.purchaseOrders.list(actor.tenantId, filter);
  }

  async get(actor: Actor, id: string): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:read");
    const po = await this.purchaseOrders.get(actor.tenantId, id);
    if (!po) throw new DomainError("NOT_FOUND", "Purchase order not found");
    return po;
  }

  async create(actor: Actor, input: CreatePoInput): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:write");
    const po = await this.buildDraft(actor, input);
    await this.purchaseOrders.save(po);
    await this.record(actor, "po.created", po, `Created ${po.number}`);
    return po;
  }

  async update(actor: Actor, id: string, input: Partial<CreatePoInput>): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:write");
    const current = await this.get(actor, id);
    assertPoEditable(current);
    const lines = input.lines ? this.normalizeLines(input.lines) : current.lines;
    const next: PurchaseOrder = {
      ...current,
      vendorName: input.vendorName !== undefined ? required(input.vendorName, "vendorName") : current.vendorName,
      neededBy: input.neededBy !== undefined ? input.neededBy : current.neededBy,
      taxBps: input.taxBps ?? current.taxBps,
      notes: input.notes !== undefined ? input.notes : current.notes,
      lines,
      status: "draft",
      rejectedBy: undefined,
      rejectReason: undefined,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.purchaseOrders.save(next);
    await this.record(actor, "po.updated", next, `Updated ${next.number}`, current);
    return next;
  }

  async submit(actor: Actor, id: string): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:write");
    const current = await this.get(actor, id);
    if (current.status !== "draft" && current.status !== "rejected") {
      throw new DomainError("CONFLICT", `Purchase order ${current.number} cannot be submitted from ${current.status}`);
    }
    if (current.lines.length === 0) throw new DomainError("VALIDATION", "Purchase order must have at least one line");
    const next: PurchaseOrder = {
      ...current,
      status: "submitted",
      submittedBy: actor.id,
      rejectedBy: undefined,
      rejectReason: undefined,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.purchaseOrders.save(next);
    await this.record(actor, "po.submitted", next, `Submitted ${next.number}`, current);
    return next;
  }

  async approve(actor: Actor, id: string): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:approve");
    const current = await this.get(actor, id);
    if (current.status !== "submitted") {
      throw new DomainError("CONFLICT", `Purchase order ${current.number} is not awaiting approval`);
    }
    if (current.submittedBy === actor.id) {
      throw new DomainError("FORBIDDEN", "You cannot approve a purchase order you submitted (segregation of duties)");
    }
    const next: PurchaseOrder = {
      ...current,
      status: "approved",
      approvedBy: actor.id,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.purchaseOrders.save(next);
    await this.record(actor, "po.approved", next, `Approved ${next.number}`, current);
    return next;
  }

  async reject(actor: Actor, id: string, reason: string): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:approve");
    const current = await this.get(actor, id);
    if (current.status !== "submitted") {
      throw new DomainError("CONFLICT", `Purchase order ${current.number} is not awaiting approval`);
    }
    const why = required(reason, "reason");
    const next: PurchaseOrder = {
      ...current,
      status: "rejected",
      rejectedBy: actor.id,
      rejectReason: why,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.purchaseOrders.save(next);
    await this.record(actor, "po.rejected", next, `Rejected ${next.number}: ${why}`, current);
    return next;
  }

  async issue(actor: Actor, id: string): Promise<PurchaseOrder> {
    assertCan(actor, "procurement:issue");
    const current = await this.get(actor, id);
    if (current.status !== "approved") {
      throw new DomainError("CONFLICT", `Purchase order ${current.number} must be approved before it can be issued`);
    }
    const next: PurchaseOrder = {
      ...current,
      status: "issued",
      issuedAt: this.clock.now().toISOString(),
      issuedBy: actor.id,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.purchaseOrders.save(next);
    await this.record(actor, "po.issued", next, `Issued ${next.number}`, current);
    return next;
  }

  private async buildDraft(actor: Actor, input: CreatePoInput): Promise<PurchaseOrder> {
    const vendorName = required(input.vendorName, "vendorName");
    const lines = this.normalizeLines(input.lines);
    if (lines.length === 0) throw new DomainError("VALIDATION", "Purchase order must have at least one line");
    const year = Number(this.clock.today().slice(0, 4));
    const now = this.clock.now().toISOString();
    return {
      id: newId(),
      tenantId: actor.tenantId,
      number: await this.purchaseOrders.nextNumber(actor.tenantId, year),
      vendorName,
      neededBy: input.neededBy,
      currency: DEFAULT_CURRENCY,
      lines,
      taxBps: input.taxBps ?? 500,
      status: "draft",
      notes: input.notes,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  private normalizeLines(lines: PoLineInput[]): PoLine[] {
    return lines.map((l) => {
      const description = required(l.description, "line description");
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        throw new DomainError("VALIDATION", "Line quantity must be a positive integer");
      }
      if (!Number.isInteger(l.unitPriceMinor) || l.unitPriceMinor < 0) {
        throw new DomainError("VALIDATION", "Line unit price must be a non-negative integer (minor units)");
      }
      return { id: newId(), description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor };
    });
  }

  private async record(actor: Actor, action: string, po: PurchaseOrder, summary: string, before?: PurchaseOrder): Promise<void> {
    await this.audit.append({
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.displayName,
      action,
      entityType: "purchase_order",
      entityId: po.id,
      summary,
      before: before ? { number: before.number, status: before.status, totalMinor: poTotalMinor(before) } : undefined,
      after: { number: po.number, status: po.status, totalMinor: poTotalMinor(po) },
    });
    this.bus.publish({
      id: newId(),
      tenantId: actor.tenantId,
      type: action,
      at: this.clock.now().toISOString(),
      actorId: actor.id,
      entityType: "purchase_order",
      entityId: po.id,
      payload: { number: po.number, status: po.status, totalMinor: poTotalMinor(po) },
    });
  }
}
