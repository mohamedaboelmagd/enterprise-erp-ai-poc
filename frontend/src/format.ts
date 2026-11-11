import { formatMoney, type Currency } from "@core/domain/shared/money";
import type { InvoiceStatus } from "@core/domain/finance/invoice";
import type { LeaveStatus } from "@core/domain/hr/leave";
import type { PoStatus } from "@core/domain/procurement/purchase-order";

export function money(minor: number, currency: Currency = "AED"): string {
  return formatMoney(minor, currency);
}

export function statusTone(status: string, overdue = false): "ok" | "warn" | "bad" | "info" | "neutral" {
  if (overdue) return "bad";
  if (status === "approved" || status === "paid" || status === "issued") return "ok";
  if (status === "submitted") return "warn";
  if (status === "rejected" || status === "cancelled") return "bad";
  if (status === "draft") return "info";
  return "neutral";
}

export type AnyStatus = InvoiceStatus | LeaveStatus | PoStatus | string;
