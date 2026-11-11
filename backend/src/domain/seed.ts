import type { Actor, Tenant } from "./shared/actor";
import type { Clock } from "./shared/clock";
import { addUtcDays } from "./shared/clock";
import type { User } from "./identity/user";
import type { Role } from "./identity/permissions";
import type { Invoice } from "./finance/invoice";
import type { LeaveBalance, LeaveRequest } from "./hr/leave";
import type { PurchaseOrder } from "./procurement/purchase-order";
import type { Repositories } from "./ports";
import type { MemoryInvoiceRepository, MemoryPurchaseOrderRepository } from "../infra/memory/memory-repos";

/** Shared demo password for every seed user (documented in the README). */
export const DEMO_PASSWORD = "demo-pass-sample";

/** scrypt hash of DEMO_PASSWORD with a fixed salt — safe to embed, no Node crypto at import time. */
export const DEMO_PASSWORD_HASH =
  "scrypt:0123456789abcdef0123456789abcdef:7124ea834ec958cd83172645547f2122d1d95c81cbf1471b3d8ff83a1664fbf1";

export const TENANT_MERIDIAN = "tenant-meridian";
export const TENANT_HARBOR = "tenant-harbor";

export const TENANTS: Tenant[] = [
  { id: TENANT_MERIDIAN, name: "Meridian Civic Authority (sample)", country: "AE", currency: "AED" },
  { id: TENANT_HARBOR, name: "Harbor Municipal Works (sample)", country: "AE", currency: "AED" },
];

export type PersonaKey =
  | "amira"
  | "karim"
  | "lina"
  | "youssef"
  | "nour"
  | "hadi"
  | "samir"
  | "rania";

interface PersonaDef {
  key: PersonaKey;
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  title: string;
  roles: Role[];
}

export const PERSONAS: Record<PersonaKey, PersonaDef> = {
  amira: {
    key: "amira",
    id: "user-amira",
    tenantId: TENANT_MERIDIAN,
    email: "amira.saleh@meridian-civic.example",
    displayName: "Amira Saleh (sample)",
    title: "Finance manager",
    roles: ["finance_manager"],
  },
  karim: {
    key: "karim",
    id: "user-karim",
    tenantId: TENANT_MERIDIAN,
    email: "karim.nassar@meridian-civic.example",
    displayName: "Karim Nassar (sample)",
    title: "Finance clerk",
    roles: ["finance_clerk"],
  },
  lina: {
    key: "lina",
    id: "user-lina",
    tenantId: TENANT_MERIDIAN,
    email: "lina.haddad@meridian-civic.example",
    displayName: "Lina Haddad (sample)",
    title: "HR manager",
    roles: ["hr_manager"],
  },
  youssef: {
    key: "youssef",
    id: "user-youssef",
    tenantId: TENANT_MERIDIAN,
    email: "youssef.farid@meridian-civic.example",
    displayName: "Youssef Farid (sample)",
    title: "Civil engineer",
    roles: ["hr_employee"],
  },
  nour: {
    key: "nour",
    id: "user-nour",
    tenantId: TENANT_MERIDIAN,
    email: "nour.elmasry@meridian-civic.example",
    displayName: "Nour El-Masry (sample)",
    title: "Procurement manager",
    roles: ["procurement_manager"],
  },
  hadi: {
    key: "hadi",
    id: "user-hadi",
    tenantId: TENANT_MERIDIAN,
    email: "hadi.mansour@meridian-civic.example",
    displayName: "Hadi Mansour (sample)",
    title: "Procurement clerk",
    roles: ["procurement_clerk"],
  },
  samir: {
    key: "samir",
    id: "user-samir",
    tenantId: TENANT_MERIDIAN,
    email: "samir.qureshi@meridian-civic.example",
    displayName: "Samir Qureshi (sample)",
    title: "Tenant administrator",
    roles: ["tenant_admin"],
  },
  rania: {
    key: "rania",
    id: "user-rania",
    tenantId: TENANT_HARBOR,
    email: "rania.adel@harbor-works.example",
    displayName: "Rania Adel (sample)",
    title: "Finance manager",
    roles: ["finance_manager"],
  },
};

export function actorFromPersona(key: PersonaKey): Actor {
  const p = PERSONAS[key];
  return { id: p.id, tenantId: p.tenantId, email: p.email, displayName: p.displayName, title: p.title, roles: [...p.roles] };
}

export const SAMPLE_INVOICE_TEXT = [
  "Invoice from Cedar Maintenance Group dated 2026-10-15, due 2026-11-14.",
  "Line: Generator maintenance x1 @ 12500.00 AED.",
  "Line: Emergency call-out x2 @ 850.00.",
  "VAT 5%.",
].join(" ");

export async function seedDemo(repos: Repositories, clock: Clock): Promise<void> {
  for (const t of TENANTS) await repos.tenants.save(t);
  for (const p of Object.values(PERSONAS)) {
    const user: User = {
      id: p.id,
      tenantId: p.tenantId,
      email: p.email,
      displayName: p.displayName,
      title: p.title,
      roles: [...p.roles],
      passwordHash: DEMO_PASSWORD_HASH,
      active: true,
    };
    await repos.users.save(user);
  }

  const today = clock.today();
  const now = clock.now().toISOString();
  const meridianInvoices: Invoice[] = [
    makeInvoice({
      id: "inv-m-1",
      tenantId: TENANT_MERIDIAN,
      number: "INV-2026-0001",
      vendorName: "Cedar Maintenance Group (sample)",
      issueDate: "2026-09-20",
      dueDate: "2026-10-20",
      status: "approved",
      submittedBy: PERSONAS.karim.id,
      approvedBy: PERSONAS.amira.id,
      lines: [{ id: "inv-m-1-l1", description: "Quarterly generator servicing", quantity: 1, unitPriceMinor: 1_850_000 }],
      now,
    }),
    makeInvoice({
      id: "inv-m-2",
      tenantId: TENANT_MERIDIAN,
      number: "INV-2026-0002",
      vendorName: "Atlas Industrial Parts (sample)",
      issueDate: "2026-11-02",
      dueDate: addUtcDays(today, 20),
      status: "submitted",
      submittedBy: PERSONAS.karim.id,
      lines: [
        { id: "inv-m-2-l1", description: "Pump assembly, storm-water station 4", quantity: 2, unitPriceMinor: 3_200_000 },
        { id: "inv-m-2-l2", description: "Installation kit", quantity: 2, unitPriceMinor: 240_000 },
      ],
      now,
    }),
    makeInvoice({
      id: "inv-m-3",
      tenantId: TENANT_MERIDIAN,
      number: "INV-2026-0003",
      vendorName: "Nile Office Systems (sample)",
      issueDate: today,
      dueDate: addUtcDays(today, 30),
      status: "draft",
      lines: [{ id: "inv-m-3-l1", description: "Workstation refresh, planning floor", quantity: 6, unitPriceMinor: 95_000 }],
      now,
    }),
    makeInvoice({
      id: "inv-m-4",
      tenantId: TENANT_MERIDIAN,
      number: "INV-2026-0004",
      vendorName: "Oasis Facilities LLC (sample)",
      issueDate: "2026-08-01",
      dueDate: "2026-08-31",
      status: "paid",
      submittedBy: PERSONAS.karim.id,
      approvedBy: PERSONAS.amira.id,
      paidBy: PERSONAS.amira.id,
      paidAt: "2026-08-28T10:00:00.000Z",
      lines: [{ id: "inv-m-4-l1", description: "August cleaning contract", quantity: 1, unitPriceMinor: 640_000 }],
      now,
    }),
    makeInvoice({
      id: "inv-m-5",
      tenantId: TENANT_MERIDIAN,
      number: "INV-2026-0005",
      vendorName: "Cedar Maintenance Group (sample)",
      issueDate: "2026-11-05",
      dueDate: addUtcDays(today, 14),
      status: "approved",
      submittedBy: PERSONAS.karim.id,
      approvedBy: PERSONAS.amira.id,
      lines: [{ id: "inv-m-5-l1", description: "HVAC filter replacement", quantity: 8, unitPriceMinor: 12_500 }],
      now,
    }),
  ];
  for (const inv of meridianInvoices) await repos.invoices.save(inv);
  maybeSetInvoiceCounter(repos, TENANT_MERIDIAN, 2026, 5);

  await repos.invoices.save(
    makeInvoice({
      id: "inv-h-1",
      tenantId: TENANT_HARBOR,
      number: "INV-2026-0001",
      vendorName: "Atlas Industrial Parts (sample)",
      issueDate: "2026-10-01",
      dueDate: "2026-10-31",
      status: "approved",
      submittedBy: PERSONAS.rania.id,
      lines: [{ id: "inv-h-1-l1", description: "Harbor wall lighting", quantity: 20, unitPriceMinor: 18_000 }],
      now,
    }),
  );
  maybeSetInvoiceCounter(repos, TENANT_HARBOR, 2026, 1);

  const youssefApproved: LeaveRequest = {
    id: "leave-m-1",
    tenantId: TENANT_MERIDIAN,
    employeeId: PERSONAS.youssef.id,
    employeeName: PERSONAS.youssef.displayName,
    type: "annual",
    from: "2026-07-06",
    to: "2026-07-10",
    days: 5,
    reason: "Family visit (sample)",
    status: "approved",
    submittedBy: PERSONAS.youssef.id,
    approvedBy: PERSONAS.lina.id,
    version: 1,
    createdAt: "2026-06-15T08:00:00.000Z",
    updatedAt: "2026-06-16T08:00:00.000Z",
  };
  const youssefPending: LeaveRequest = {
    id: "leave-m-2",
    tenantId: TENANT_MERIDIAN,
    employeeId: PERSONAS.youssef.id,
    employeeName: PERSONAS.youssef.displayName,
    type: "annual",
    from: "2026-12-14",
    to: "2026-12-18",
    days: 5,
    reason: "Year-end leave (sample)",
    status: "submitted",
    submittedBy: PERSONAS.youssef.id,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await repos.leave.save(youssefApproved);
  await repos.leave.save(youssefPending);
  const balance: LeaveBalance = {
    tenantId: TENANT_MERIDIAN,
    employeeId: PERSONAS.youssef.id,
    year: 2026,
    annualAllowanceDays: 21,
    annualUsedDays: 5,
  };
  await repos.leave.saveBalance(balance);

  const pos: PurchaseOrder[] = [
    makePo({
      id: "po-m-1",
      tenantId: TENANT_MERIDIAN,
      number: "PO-2026-0001",
      vendorName: "Atlas Industrial Parts (sample)",
      neededBy: addUtcDays(today, 30),
      status: "submitted",
      submittedBy: PERSONAS.hadi.id,
      lines: [{ id: "po-m-1-l1", description: "Spare impellers, pump station 2", quantity: 4, unitPriceMinor: 1_520_000 }],
      now,
    }),
    makePo({
      id: "po-m-2",
      tenantId: TENANT_MERIDIAN,
      number: "PO-2026-0002",
      vendorName: "Oasis Facilities LLC (sample)",
      neededBy: "2026-09-01",
      status: "issued",
      submittedBy: PERSONAS.hadi.id,
      approvedBy: PERSONAS.nour.id,
      issuedBy: PERSONAS.nour.id,
      issuedAt: "2026-08-10T09:00:00.000Z",
      lines: [{ id: "po-m-2-l1", description: "Annual grounds maintenance", quantity: 1, unitPriceMinor: 2_200_000 }],
      now,
    }),
    makePo({
      id: "po-m-3",
      tenantId: TENANT_MERIDIAN,
      number: "PO-2026-0003",
      vendorName: "Nile Office Systems (sample)",
      neededBy: addUtcDays(today, 45),
      status: "draft",
      lines: [{ id: "po-m-3-l1", description: "Ergonomic chairs, records room", quantity: 12, unitPriceMinor: 42_000 }],
      now,
    }),
  ];
  for (const po of pos) await repos.purchaseOrders.save(po);
  maybeSetPoCounter(repos, TENANT_MERIDIAN, 2026, 3);

  await repos.audit.append({
    tenantId: TENANT_MERIDIAN,
    actorId: PERSONAS.samir.id,
    actorName: PERSONAS.samir.displayName,
    action: "seed.loaded",
    entityType: "tenant",
    entityId: TENANT_MERIDIAN,
    summary: "Loaded fictional sample data for the demonstration tenant",
    at: now,
  });
}

function maybeSetInvoiceCounter(repos: Repositories, tenantId: string, year: number, value: number): void {
  const repo = repos.invoices as MemoryInvoiceRepository;
  if (typeof repo.peekSetCounter === "function") repo.peekSetCounter(tenantId, year, value);
}

function maybeSetPoCounter(repos: Repositories, tenantId: string, year: number, value: number): void {
  const repo = repos.purchaseOrders as MemoryPurchaseOrderRepository;
  if (typeof repo.peekSetCounter === "function") repo.peekSetCounter(tenantId, year, value);
}

function makeInvoice(opts: {
  id: string;
  tenantId: string;
  number: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  status: Invoice["status"];
  lines: Invoice["lines"];
  submittedBy?: string;
  approvedBy?: string;
  paidBy?: string;
  paidAt?: string;
  now: string;
}): Invoice {
  return {
    id: opts.id,
    tenantId: opts.tenantId,
    number: opts.number,
    vendorName: opts.vendorName,
    issueDate: opts.issueDate,
    dueDate: opts.dueDate,
    currency: "AED",
    lines: opts.lines,
    taxBps: 500,
    status: opts.status,
    submittedBy: opts.submittedBy,
    approvedBy: opts.approvedBy,
    paidBy: opts.paidBy,
    paidAt: opts.paidAt,
    version: 1,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

function makePo(opts: {
  id: string;
  tenantId: string;
  number: string;
  vendorName: string;
  neededBy?: string;
  status: PurchaseOrder["status"];
  lines: PurchaseOrder["lines"];
  submittedBy?: string;
  approvedBy?: string;
  issuedBy?: string;
  issuedAt?: string;
  now: string;
}): PurchaseOrder {
  return {
    id: opts.id,
    tenantId: opts.tenantId,
    number: opts.number,
    vendorName: opts.vendorName,
    neededBy: opts.neededBy,
    currency: "AED",
    lines: opts.lines,
    taxBps: 500,
    status: opts.status,
    submittedBy: opts.submittedBy,
    approvedBy: opts.approvedBy,
    issuedBy: opts.issuedBy,
    issuedAt: opts.issuedAt,
    version: 1,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}
