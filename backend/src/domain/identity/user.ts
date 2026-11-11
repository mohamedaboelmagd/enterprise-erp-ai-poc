import type { Role } from "./permissions";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  title?: string;
  roles: Role[];
  /** scrypt:<saltHex>:<hashHex>; never returned by the API. */
  passwordHash: string;
  active: boolean;
}

export interface PublicUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  title?: string;
  roles: Role[];
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    email: u.email,
    displayName: u.displayName,
    title: u.title,
    roles: u.roles,
  };
}
