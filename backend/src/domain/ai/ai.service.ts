import { assertCan } from "../identity/permissions";
import type { Actor } from "../shared/actor";
import type { Clock } from "../shared/clock";
import { DomainError } from "../shared/errors";
import type { FinanceService } from "../finance/finance.service";
import type { Invoice, InvoiceFilter } from "../finance/invoice";
import type { HrService } from "../hr/hr.service";
import type { LeaveFilter, LeaveRequest } from "../hr/leave";
import type { ProcurementService } from "../procurement/procurement.service";
import type { PoFilter, PurchaseOrder } from "../procurement/purchase-order";
import {
  extractedInvoiceSchema,
  reportFilterSchema,
  type ExtractedInvoice,
  type LlmProvider,
  type ReportFilter,
} from "./schema";

export type AssistantResult =
  | { kind: "filter"; filter: ReportFilter; invoices?: Invoice[]; leave?: LeaveRequest[]; purchaseOrders?: PurchaseOrder[] }
  | { kind: "extraction"; invoice: ExtractedInvoice };

export class AiAssistantService {
  constructor(
    private readonly provider: LlmProvider,
    private readonly finance: FinanceService,
    private readonly hr: HrService,
    private readonly procurement: ProcurementService,
    private readonly clock: Clock,
  ) {}

  getProviderInfo(): { id: string; remote: boolean } {
    return { id: this.provider.id, remote: this.provider.remote };
  }

  async ask(actor: Actor, prompt: string): Promise<AssistantResult> {
    assertCan(actor, "ai:use");
    const completion = await this.provider.complete({
      task: "parse_report_filter",
      input: prompt,
      today: this.clock.today(),
    });
    const parsed = reportFilterSchema.safeParse(completion.raw);
    if (!parsed.success) {
      throw new DomainError("UNSUPPORTED", "The assistant could not produce a valid report filter", parsed.error.issues);
    }
    const filter = parsed.data;
    if (filter.module === "finance") {
      assertCan(actor, "finance:read");
      const invoices = await this.finance.list(actor, toInvoiceFilter(filter));
      return { kind: "filter", filter, invoices };
    }
    if (filter.module === "hr") {
      assertCan(actor, "hr:read");
      const leave = await this.hr.list(actor, toLeaveFilter(filter));
      return { kind: "filter", filter, leave };
    }
    assertCan(actor, "procurement:read");
    const purchaseOrders = await this.procurement.list(actor, toPoFilter(filter));
    return { kind: "filter", filter, purchaseOrders };
  }

  async extractInvoice(actor: Actor, documentText: string): Promise<ExtractedInvoice> {
    assertCan(actor, "ai:use");
    const completion = await this.provider.complete({
      task: "extract_invoice_fields",
      input: documentText,
      today: this.clock.today(),
    });
    const parsed = extractedInvoiceSchema.safeParse(completion.raw);
    if (!parsed.success) {
      throw new DomainError("UNSUPPORTED", "The assistant could not extract invoice fields", parsed.error.issues);
    }
    return parsed.data;
  }
}

export function toInvoiceFilter(filter: ReportFilter): InvoiceFilter {
  return {
    status: asStatus(filter.status) as InvoiceFilter["status"],
    overdue: filter.overdue,
    minTotalMinor: filter.minTotalMinor,
    maxTotalMinor: filter.maxTotalMinor,
    vendorContains: filter.vendorContains,
    issueMonth: filter.issueMonth,
    issueYear: filter.issueYear,
  };
}

export function toLeaveFilter(filter: ReportFilter): LeaveFilter {
  return {
    status: asStatus(filter.status) as LeaveFilter["status"],
    type: filter.type as LeaveFilter["type"],
    employeeNameContains: filter.employeeNameContains,
  };
}

export function toPoFilter(filter: ReportFilter): PoFilter {
  return {
    status: asStatus(filter.status) as PoFilter["status"],
    minTotalMinor: filter.minTotalMinor,
    maxTotalMinor: filter.maxTotalMinor,
    vendorContains: filter.vendorContains,
    open: filter.open,
  };
}

function asStatus(status: string | string[] | undefined): string | string[] | undefined {
  return status;
}
