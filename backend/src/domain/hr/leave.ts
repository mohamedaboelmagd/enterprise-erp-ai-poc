import { dateRangesOverlap, inclusiveBusinessDays } from "../shared/clock";
import { DomainError } from "../shared/errors";

export type LeaveType = "annual" | "sick" | "unpaid";
export type LeaveStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled";

export interface LeaveBalance {
  tenantId: string;
  employeeId: string;
  year: number;
  annualAllowanceDays: number;
  annualUsedDays: number;
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  submittedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveFilter {
  status?: LeaveStatus | LeaveStatus[];
  employeeId?: string;
  type?: LeaveType;
  employeeNameContains?: string;
}

export function computeLeaveDays(from: string, to: string): number {
  if (to < from) throw new DomainError("VALIDATION", "Leave end date must be on or after the start date");
  const days = inclusiveBusinessDays(from, to);
  if (days <= 0) throw new DomainError("VALIDATION", "Leave must include at least one working day");
  return days;
}

export function remainingAnnualDays(balance: LeaveBalance): number {
  return balance.annualAllowanceDays - balance.annualUsedDays;
}

export function leaveOverlaps(a: LeaveRequest, b: LeaveRequest): boolean {
  const active = (s: LeaveStatus) => s === "submitted" || s === "approved";
  if (!active(a.status) || !active(b.status)) return false;
  if (a.employeeId !== b.employeeId) return false;
  if (a.id === b.id) return false;
  return dateRangesOverlap(a.from, a.to, b.from, b.to);
}

export function matchesLeaveFilter(req: LeaveRequest, filter: LeaveFilter): boolean {
  if (filter.status) {
    const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!allowed.includes(req.status)) return false;
  }
  if (filter.employeeId && req.employeeId !== filter.employeeId) return false;
  if (filter.type && req.type !== filter.type) return false;
  if (filter.employeeNameContains) {
    const q = filter.employeeNameContains.toLowerCase();
    if (!req.employeeName.toLowerCase().includes(q)) return false;
  }
  return true;
}
