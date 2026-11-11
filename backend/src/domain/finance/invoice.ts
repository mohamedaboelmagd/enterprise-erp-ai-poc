import { DomainError } from "../shared/errors";
import { lineAmountMinor, taxMinor, type Currency } from "../shared/money";

export type InvoiceStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  number: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  lines: InvoiceLine[];
  taxBps: number;
  status: InvoiceStatus;
  notes?: string;
  submittedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectReason?: string;
  paidAt?: string;
  paidBy?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceFilter {
  status?: InvoiceStatus | InvoiceStatus[];
  overdue?: boolean;
  minTotalMinor?: number;
  maxTotalMinor?: number;
  vendorContains?: string;
  issueMonth?: number;
  issueYear?: number;
}

export function invoiceSubtotalMinor(invoice: Pick<Invoice, "lines">): number {
  return invoice.lines.reduce((sum, l) => sum + lineAmountMinor(l.quantity, l.unitPriceMinor), 0);
}

export function invoiceTaxAmountMinor(invoice: Pick<Invoice, "lines" | "taxBps">): number {
  return taxMinor(invoiceSubtotalMinor(invoice), invoice.taxBps);
}

export function invoiceTotalMinor(invoice: Pick<Invoice, "lines" | "taxBps">): number {
  return invoiceSubtotalMinor(invoice) + invoiceTaxAmountMinor(invoice);
}

export function isOverdue(invoice: Invoice, today: string): boolean {
  if (invoice.status === "paid" || invoice.status === "draft" || invoice.status === "rejected") return false;
  return invoice.dueDate < today;
}

export function assertInvoiceEditable(invoice: Invoice): void {
  if (invoice.status !== "draft" && invoice.status !== "rejected") {
    throw new DomainError("CONFLICT", `Invoice ${invoice.number} cannot be edited in status ${invoice.status}`);
  }
}

export function matchesInvoiceFilter(invoice: Invoice, filter: InvoiceFilter, today: string): boolean {
  if (filter.status) {
    const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!allowed.includes(invoice.status)) return false;
  }
  if (filter.overdue === true && !isOverdue(invoice, today)) return false;
  if (filter.overdue === false && isOverdue(invoice, today)) return false;
  const total = invoiceTotalMinor(invoice);
  if (filter.minTotalMinor !== undefined && total < filter.minTotalMinor) return false;
  if (filter.maxTotalMinor !== undefined && total > filter.maxTotalMinor) return false;
  if (filter.vendorContains) {
    const q = filter.vendorContains.toLowerCase();
    if (!invoice.vendorName.toLowerCase().includes(q)) return false;
  }
  if (filter.issueYear !== undefined && Number(invoice.issueDate.slice(0, 4)) !== filter.issueYear) return false;
  if (filter.issueMonth !== undefined && Number(invoice.issueDate.slice(5, 7)) !== filter.issueMonth) return false;
  return true;
}
