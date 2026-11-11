import { actorCan, assertCan, assertSameTenant } from "../identity/permissions";
import type { Actor } from "../shared/actor";
import type { AuditLog } from "../shared/audit";
import type { Clock } from "../shared/clock";
import { DomainError, required } from "../shared/errors";
import { EventBus } from "../shared/events";
import { newId } from "../shared/ids";
import type { LeaveRepository } from "../ports";
import {
  computeLeaveDays,
  leaveOverlaps,
  remainingAnnualDays,
  type LeaveBalance,
  type LeaveFilter,
  type LeaveRequest,
  type LeaveType,
} from "./leave";

export interface CreateLeaveInput {
  employeeId?: string;
  employeeName?: string;
  type: LeaveType;
  from: string;
  to: string;
  reason?: string;
}

const DEFAULT_ANNUAL = 21;

export class HrService {
  constructor(
    private readonly leave: LeaveRepository,
    private readonly audit: AuditLog,
    private readonly bus: EventBus,
    private readonly clock: Clock,
  ) {}

  async list(actor: Actor, filter: LeaveFilter = {}): Promise<LeaveRequest[]> {
    assertCan(actor, "hr:read");
    const scoped: LeaveFilter = actorCan(actor, "hr:read_all") ? filter : { ...filter, employeeId: actor.id };
    return await this.leave.list(actor.tenantId, scoped);
  }

  async get(actor: Actor, id: string): Promise<LeaveRequest> {
    assertCan(actor, "hr:read");
    const req = await this.leave.get(actor.tenantId, id);
    if (!req) throw new DomainError("NOT_FOUND", "Leave request not found");
    assertSameTenant(actor, req.tenantId);
    if (!actorCan(actor, "hr:read_all") && req.employeeId !== actor.id) {
      throw new DomainError("FORBIDDEN", "You can only view your own leave requests");
    }
    return req;
  }

  async getBalance(actor: Actor, employeeId?: string): Promise<LeaveBalance> {
    assertCan(actor, "hr:read");
    const id = employeeId ?? actor.id;
    if (!actorCan(actor, "hr:read_all") && id !== actor.id) {
      throw new DomainError("FORBIDDEN", "You can only view your own leave balance");
    }
    const year = Number(this.clock.today().slice(0, 4));
    return await this.leave.getBalance(actor.tenantId, id, year) ?? this.freshBalance(actor.tenantId, id, year);
  }

  async create(actor: Actor, input: CreateLeaveInput): Promise<LeaveRequest> {
    assertCan(actor, "hr:write");
    const employeeId = input.employeeId ?? actor.id;
    if (!actorCan(actor, "hr:approve") && employeeId !== actor.id) {
      throw new DomainError("FORBIDDEN", "You can only raise leave for yourself");
    }
    const employeeName = required(input.employeeName ?? (employeeId === actor.id ? actor.displayName : ""), "employeeName");
    const days = computeLeaveDays(required(input.from, "from"), required(input.to, "to"));
    const now = this.clock.now().toISOString();
    const req: LeaveRequest = {
      id: newId(),
      tenantId: actor.tenantId,
      employeeId,
      employeeName,
      type: input.type,
      from: input.from,
      to: input.to,
      days,
      reason: input.reason,
      status: "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.invoicesStyleSave(req);
    await this.record(actor, "leave.created", req, `Created ${req.days}-day ${req.type} leave for ${req.employeeName}`);
    return req;
  }

  async submit(actor: Actor, id: string): Promise<LeaveRequest> {
    assertCan(actor, "hr:write");
    const current = await this.get(actor, id);
    if (!actorCan(actor, "hr:approve") && current.employeeId !== actor.id) {
      throw new DomainError("FORBIDDEN", "You can only submit your own leave requests");
    }
    if (current.status !== "draft" && current.status !== "rejected") {
      throw new DomainError("CONFLICT", `Leave request cannot be submitted from ${current.status}`);
    }
    await this.assertNoOverlap({ ...current, status: "submitted" });
    await this.assertAnnualBalance(current);
    const next: LeaveRequest = {
      ...current,
      status: "submitted",
      submittedBy: actor.id,
      rejectedBy: undefined,
      rejectReason: undefined,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.leave.save(next);
    await this.record(actor, "leave.submitted", next, `Submitted ${next.days}-day ${next.type} leave`, current);
    return next;
  }

  async approve(actor: Actor, id: string): Promise<LeaveRequest> {
    assertCan(actor, "hr:approve");
    const current = await this.get(actor, id);
    if (current.status !== "submitted") {
      throw new DomainError("CONFLICT", "Leave request is not awaiting approval");
    }
    if (current.employeeId === actor.id || current.submittedBy === actor.id) {
      throw new DomainError("FORBIDDEN", "You cannot approve your own leave request (segregation of duties)");
    }
    await this.assertNoOverlap({ ...current, status: "approved" });
    await this.assertAnnualBalance(current);
    const next: LeaveRequest = {
      ...current,
      status: "approved",
      approvedBy: actor.id,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.leave.save(next);
    if (next.type === "annual") {
      const year = Number(next.from.slice(0, 4));
      const balance = await this.leave.getBalance(next.tenantId, next.employeeId, year) ?? this.freshBalance(next.tenantId, next.employeeId, year);
      await this.leave.saveBalance({ ...balance, annualUsedDays: balance.annualUsedDays + next.days });
    }
    await this.record(actor, "leave.approved", next, `Approved ${next.days}-day ${next.type} leave for ${next.employeeName}`, current);
    return next;
  }

  async reject(actor: Actor, id: string, reason: string): Promise<LeaveRequest> {
    assertCan(actor, "hr:approve");
    const current = await this.get(actor, id);
    if (current.status !== "submitted") {
      throw new DomainError("CONFLICT", "Leave request is not awaiting approval");
    }
    if (current.employeeId === actor.id) {
      throw new DomainError("FORBIDDEN", "You cannot reject your own leave request");
    }
    const why = required(reason, "reason");
    const next: LeaveRequest = {
      ...current,
      status: "rejected",
      rejectedBy: actor.id,
      rejectReason: why,
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.leave.save(next);
    await this.record(actor, "leave.rejected", next, `Rejected leave for ${next.employeeName}: ${why}`, current);
    return next;
  }

  async cancel(actor: Actor, id: string): Promise<LeaveRequest> {
    assertCan(actor, "hr:write");
    const current = await this.get(actor, id);
    if (current.employeeId !== actor.id && !actorCan(actor, "hr:approve")) {
      throw new DomainError("FORBIDDEN", "You can only cancel your own leave requests");
    }
    if (current.status === "approved" || current.status === "cancelled") {
      throw new DomainError("CONFLICT", `Leave request cannot be cancelled in status ${current.status}`);
    }
    const next: LeaveRequest = {
      ...current,
      status: "cancelled",
      version: current.version + 1,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.leave.save(next);
    await this.record(actor, "leave.cancelled", next, `Cancelled leave for ${next.employeeName}`, current);
    return next;
  }

  private async invoicesStyleSave(req: LeaveRequest): Promise<void> {
    await this.leave.save(req);
  }

  private async assertNoOverlap(candidate: LeaveRequest): Promise<void> {
    const existing = await this.leave.list(candidate.tenantId, { employeeId: candidate.employeeId });
    if (existing.some((e) => leaveOverlaps(candidate, e))) {
      throw new DomainError("CONFLICT", "This leave overlaps an existing submitted or approved request");
    }
  }

  private async assertAnnualBalance(req: LeaveRequest): Promise<void> {
    if (req.type !== "annual") return;
    const year = Number(req.from.slice(0, 4));
    const balance = await this.leave.getBalance(req.tenantId, req.employeeId, year) ?? this.freshBalance(req.tenantId, req.employeeId, year);
    if (req.days > remainingAnnualDays(balance)) {
      throw new DomainError(
        "VALIDATION",
        `Annual leave of ${req.days} days exceeds the remaining balance of ${remainingAnnualDays(balance)} days`,
      );
    }
  }

  private freshBalance(tenantId: string, employeeId: string, year: number): LeaveBalance {
    return { tenantId, employeeId, year, annualAllowanceDays: DEFAULT_ANNUAL, annualUsedDays: 0 };
  }

  private async record(actor: Actor, action: string, req: LeaveRequest, summary: string, before?: LeaveRequest): Promise<void> {
    await this.audit.append({
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.displayName,
      action,
      entityType: "leave",
      entityId: req.id,
      summary,
      before: before ? { status: before.status, days: before.days } : undefined,
      after: { status: req.status, days: req.days, type: req.type },
    });
    this.bus.publish({
      id: newId(),
      tenantId: actor.tenantId,
      type: action,
      at: this.clock.now().toISOString(),
      actorId: actor.id,
      entityType: "leave",
      entityId: req.id,
      payload: { employeeId: req.employeeId, status: req.status, days: req.days, type: req.type },
    });
  }
}
