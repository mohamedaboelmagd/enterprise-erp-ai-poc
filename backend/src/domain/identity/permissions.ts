import { DomainError } from "../shared/errors";
import type { Actor } from "../shared/actor";

export type Role =
  | "tenant_admin"
  | "finance_manager"
  | "finance_clerk"
  | "hr_manager"
  | "hr_employee"
  | "procurement_manager"
  | "procurement_clerk"
  | "auditor";

export type Permission =
  | "finance:read"
  | "finance:write"
  | "finance:approve"
  | "finance:pay"
  | "hr:read"
  | "hr:read_all"
  | "hr:write"
  | "hr:approve"
  | "procurement:read"
  | "procurement:write"
  | "procurement:approve"
  | "procurement:issue"
  | "audit:read"
  | "ai:use"
  | "admin:users";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  tenant_admin: [
    "finance:read",
    "finance:write",
    "finance:approve",
    "finance:pay",
    "hr:read",
    "hr:read_all",
    "hr:write",
    "hr:approve",
    "procurement:read",
    "procurement:write",
    "procurement:approve",
    "procurement:issue",
    "audit:read",
    "ai:use",
    "admin:users",
  ],
  finance_manager: [
    "finance:read",
    "finance:write",
    "finance:approve",
    "finance:pay",
    "audit:read",
    "ai:use",
  ],
  finance_clerk: ["finance:read", "finance:write", "finance:pay", "ai:use"],
  hr_manager: ["hr:read", "hr:read_all", "hr:write", "hr:approve", "audit:read", "ai:use"],
  hr_employee: ["hr:read", "hr:write", "ai:use"],
  procurement_manager: [
    "procurement:read",
    "procurement:write",
    "procurement:approve",
    "procurement:issue",
    "audit:read",
    "ai:use",
  ],
  procurement_clerk: ["procurement:read", "procurement:write", "ai:use"],
  auditor: ["finance:read", "hr:read", "hr:read_all", "procurement:read", "audit:read", "ai:use"],
};

export function permissionsFor(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return set;
}

export function actorCan(actor: Actor, permission: Permission): boolean {
  return permissionsFor(actor.roles).has(permission);
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!actorCan(actor, permission)) {
    throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
  }
}

export function assertSameTenant(actor: Actor, tenantId: string): void {
  if (actor.tenantId !== tenantId) {
    throw new DomainError("FORBIDDEN", "Cross-tenant access is not allowed");
  }
}
