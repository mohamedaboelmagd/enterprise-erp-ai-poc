import type { Role, Permission } from "../identity/permissions";

export interface Actor {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: Role[];
  /** Optional display title, e.g. "Finance manager". */
  title?: string;
}

export interface Tenant {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2, used only for display and residency notes. */
  country: string;
  currency: "AED";
}
