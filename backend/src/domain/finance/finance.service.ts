import { assertCan, assertSameTenant } from "../identity/permissions";
import type { Actor } from "../shared/actor";
import type { AuditLog } from "../shared/audit";
import type { Clock } from "../shared/clock";
import { DomainError, required } from "../shared/errors";
import { EventBus } from "../shared/events";
import { newId } from "../shared/ids";
import { DEFAULT_CURRENCY } from "../shared/money";
import type { InvoiceRepository } from "../ports";
import {
  assertInvoiceEditable,
  invoiceTotalMinor,
  isOverdue,
  matchesInvoiceFilter,
  type Invoice,
  type InvoiceFilter,
  type InvoiceLine,
} from "./invoice";

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface CreateInvoiceInput {
  vendorName: string;
  issueDate?: string;
  dueDate: string;
  taxBps?: number;
  notes?: string;
  lines: InvoiceLineInput[];
}

export class FinanceService {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly audit: AuditLog,
    private readonly bus: EventBus,
    private readonly clock: Clock,
  ) {}

  async list(actor: Actor, filter: InvoiceFilter = {}): Promise<Invoice[]> {
    assertCan(actor, "finance:read");
    return await this.invoices.list(actor.tenantId, filter, this.clock.today());
  }

  async get(actor: Actor, id: string): Promise<Invoice> {
    assertCan(actor, "finance:read");
    const invoice = await this.invoices.get(actor.tenantId, id);
    if (!invoice) throw new DomainError("NOT_FOUND", "Invoice not found");
    assertSameTenant(actor, invoice.tenantId);
    return invoice;
  }

  async create(actor: Actor, input: CreateInvoiceInput): Promise<Invoice> {
    assertCan(actor, "finance:write");
    const invoice = await this.buildDraft(actor, input);
    await this.invoices.save(invoice);
    await this.record(actor, "invoice.created", invoice, `Created ${invoice.number}`);
    return invoice;
  }

  async update(actor: Actor, id: string, input: Partial<CreateInvoiceInput>): Promise<Invoice> {
    assertCan(actor, "finance:write");
    const current = await this.get(actor, id);
    assertInvoiceEditable(current);
    const lines = input.lines ? this.normalizeLines(input.lines) : current.lines;
    const next: Invoice = {
      ...current,
      vendorName: input.vendorName !== undefined ? required(input.vendorName, "vendorName") : current.vendorName,
      issueDate: input.issueDate ?? current.issueDate,
      dueDate: input.dueDate ?? current.dueDate,
      taxBps: input.taxBps ?? current.taxBps,
      notes: input.notes !== undefined ? input.notes : current.notes,
      lines,
      status: "draft",
      rejectedBy: undefined,
      rejectReason: undefined,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    this.assertDates(next);
    await this.invoices.save(next);
    await this.record(actor, "invoice.updated", next, `Updated ${next.number}`, current);
    return next;
  }

  async submit(actor: Actor, id: string): Promise<Invoice> {
    assertCan(actor, "finance:write");
    const current = await this.get(actor, id);
    if (current.status !== "draft" && current.status !== "rejected") {
      throw new DomainError("CONFLICT", `Invoice ${current.number} cannot be submitted from ${current.status}`);
    }
    if (current.lines.length === 0) throw new DomainError("VALIDATION", "Invoice must have at least one line");
    const next: Invoice = {
      ...current,
      status: "submitted",
      submittedBy: actor.id,
      rejectedBy: undefined,
      rejectReason: undefined,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.invoices.save(next);
    await this.record(actor, "invoice.submitted", next, `Submitted ${next.number} (${invoiceTotalMinor(next)} minor)`, current);
    return next;
  }

  async approve(actor: Actor, id: string): Promise<Invoice> {
    assertCan(actor, "finance:approve");
    const current = await this.get(actor, id);
    if (current.status !== "submitted") {
      throw new DomainError("CONFLICT", `Invoice ${current.number} is not awaiting approval`);
    }
    if (current.submittedBy === actor.id) {
      throw new DomainError("FORBIDDEN", "You cannot approve an invoice you submitted (segregation of duties)");
    }
    const next: Invoice = {
      ...current,
      status: "approved",
      approvedBy: actor.id,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.invoices.save(next);
    await this.record(actor, "invoice.approved", next, `Approved ${next.number}`, current);
    return next;
  }

  async reject(actor: Actor, id: string, reason: string): Promise<Invoice> {
    assertCan(actor, "finance:approve");
    const current = await this.get(actor, id);
    if (current.status !== "submitted") {
      throw new DomainError("CONFLICT", `Invoice ${current.number} is not awaiting approval`);
    }
    const why = required(reason, "reason");
    const next: Invoice = {
      ...current,
      status: "rejected",
      rejectedBy: actor.id,
      rejectReason: why,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.invoices.save(next);
    await this.record(actor, "invoice.rejected", next, `Rejected ${next.number}: ${why}`, current);
    return next;
  }

  async pay(actor: Actor, id: string): Promise<Invoice> {
    assertCan(actor, "finance:pay");
    const current = await this.get(actor, id);
    if (current.status !== "approved") {
      throw new DomainError("CONFLICT", `Invoice ${current.number} must be approved before payment`);
    }
    const next: Invoice = {
      ...current,
      status: "paid",
      paidAt: this.clock.now().toISOString(),
      paidBy: actor.id,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.invoices.save(next);
    await this.record(actor, "invoice.paid", next, `Recorded payment for ${next.number}`, current);
    return next;
  }

  async overdue(actor: Actor): Promise<Invoice[]> {
    return await this.list(actor, { overdue: true });
  }

  isOverdue(invoice: Invoice): boolean {
    return isOverdue(invoice, this.clock.today());
  }

  private async buildDraft(actor: Actor, input: CreateInvoiceInput): Promise<Invoice> {
    const vendorName = required(input.vendorName, "vendorName");
    const dueDate = required(input.dueDate, "dueDate");
    const issueDate = input.issueDate ?? this.clock.today();
    const taxBps = input.taxBps ?? 500;
    const lines = this.normalizeLines(input.lines);
    if (lines.length === 0) throw new DomainError("VALIDATION", "Invoice must have at least one line");
    const year = Number(issueDate.slice(0, 4));
    const now = this.clock.now().toISOString();
    const invoice: Invoice = {
      id: newId(),
      tenantId: actor.tenantId,
      number: await this.invoices.nextNumber(actor.tenantId, year),
      vendorName,
      issueDate,
      dueDate,
      currency: DEFAULT_CURRENCY,
      lines,
      taxBps,
      status: "draft",
      notes: input.notes,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.assertDates(invoice);
    return invoice;
  }

  private normalizeLines(lines: InvoiceLineInput[]): InvoiceLine[] {
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

  private assertDates(invoice: Invoice): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate)) {
      throw new DomainError("VALIDATION", "Dates must be YYYY-MM-DD");
    }
    if (invoice.dueDate < invoice.issueDate) {
      throw new DomainError("VALIDATION", "Due date cannot be before the issue date");
    }
    if (invoice.taxBps < 0 || invoice.taxBps > 10_000) {
      throw new DomainError("VALIDATION", "taxBps must be between 0 and 10000");
    }
  }

  private async record(actor: Actor, action: string, invoice: Invoice, summary: string, before?: Invoice): Promise<void> {
    await this.audit.append({
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.displayName,
      action,
      entityType: "invoice",
      entityId: invoice.id,
      summary,
      before: before ? snapshot(before) : undefined,
      after: snapshot(invoice),
    });
    this.bus.publish({
      id: newId(),
      tenantId: actor.tenantId,
      type: action,
      at: this.clock.now().toISOString(),
      actorId: actor.id,
      entityType: "invoice",
      entityId: invoice.id,
      payload: { number: invoice.number, status: invoice.status, totalMinor: invoiceTotalMinor(invoice) },
    });
  }
}

function snapshot(invoice: Invoice): Record<string, unknown> {
  return {
    number: invoice.number,
    status: invoice.status,
    vendorName: invoice.vendorName,
    totalMinor: invoiceTotalMinor(invoice),
    version: invoice.version,
  };
}

export { matchesInvoiceFilter };
