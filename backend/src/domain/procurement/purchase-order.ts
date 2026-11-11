import { DomainError } from "../shared/errors";
import { lineAmountMinor, taxMinor, type Currency } from "../shared/money";

export type PoStatus = "draft" | "submitted" | "approved" | "rejected" | "issued" | "cancelled";

export interface PoLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  number: string;
  vendorName: string;
  neededBy?: string;
  currency: Currency;
  lines: PoLine[];
  taxBps: number;
  status: PoStatus;
  notes?: string;
  submittedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectReason?: string;
  issuedAt?: string;
  issuedBy?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PoFilter {
  status?: PoStatus | PoStatus[];
  minTotalMinor?: number;
  maxTotalMinor?: number;
  vendorContains?: string;
  open?: boolean;
}

export function poSubtotalMinor(po: Pick<PurchaseOrder, "lines">): number {
  return po.lines.reduce((sum, l) => sum + lineAmountMinor(l.quantity, l.unitPriceMinor), 0);
}

export function poTaxAmountMinor(po: Pick<PurchaseOrder, "lines" | "taxBps">): number {
  return taxMinor(poSubtotalMinor(po), po.taxBps);
}

export function poTotalMinor(po: Pick<PurchaseOrder, "lines" | "taxBps">): number {
  return poSubtotalMinor(po) + poTaxAmountMinor(po);
}

export function isOpenPo(po: PurchaseOrder): boolean {
  return po.status === "submitted" || po.status === "approved" || po.status === "draft";
}

export function assertPoEditable(po: PurchaseOrder): void {
  if (po.status !== "draft" && po.status !== "rejected") {
    throw new DomainError("CONFLICT", `Purchase order ${po.number} cannot be edited in status ${po.status}`);
  }
}

export function matchesPoFilter(po: PurchaseOrder, filter: PoFilter): boolean {
  if (filter.status) {
    const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!allowed.includes(po.status)) return false;
  }
  if (filter.open === true && !isOpenPo(po)) return false;
  const total = poTotalMinor(po);
  if (filter.minTotalMinor !== undefined && total < filter.minTotalMinor) return false;
  if (filter.maxTotalMinor !== undefined && total > filter.maxTotalMinor) return false;
  if (filter.vendorContains) {
    const q = filter.vendorContains.toLowerCase();
    if (!po.vendorName.toLowerCase().includes(q)) return false;
  }
  return true;
}
