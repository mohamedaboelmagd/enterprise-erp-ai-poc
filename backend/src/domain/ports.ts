import type { Tenant } from "./shared/actor";
import type { AuditEntry, AuditLog } from "./shared/audit";
import type { User } from "./identity/user";
import type { Invoice, InvoiceFilter } from "./finance/invoice";
import type { LeaveBalance, LeaveFilter, LeaveRequest } from "./hr/leave";
import type { PoFilter, PurchaseOrder } from "./procurement/purchase-order";

export interface UserRepository {
  getById(id: string): Promise<User | undefined>;
  getByEmail(email: string): Promise<User | undefined>;
  listByTenant(tenantId: string): Promise<User[]>;
  save(user: User): Promise<void>;
}

export interface TenantRepository {
  get(id: string): Promise<Tenant | undefined>;
  list(): Promise<Tenant[]>;
  save(tenant: Tenant): Promise<void>;
}

export interface InvoiceRepository {
  get(tenantId: string, id: string): Promise<Invoice | undefined>;
  getByNumber(tenantId: string, number: string): Promise<Invoice | undefined>;
  list(tenantId: string, filter: InvoiceFilter, today: string): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<void>;
  nextNumber(tenantId: string, year: number): Promise<string>;
}

export interface LeaveRepository {
  get(tenantId: string, id: string): Promise<LeaveRequest | undefined>;
  list(tenantId: string, filter: LeaveFilter): Promise<LeaveRequest[]>;
  save(request: LeaveRequest): Promise<void>;
  getBalance(tenantId: string, employeeId: string, year: number): Promise<LeaveBalance | undefined>;
  saveBalance(balance: LeaveBalance): Promise<void>;
}

export interface PurchaseOrderRepository {
  get(tenantId: string, id: string): Promise<PurchaseOrder | undefined>;
  getByNumber(tenantId: string, number: string): Promise<PurchaseOrder | undefined>;
  list(tenantId: string, filter: PoFilter): Promise<PurchaseOrder[]>;
  save(po: PurchaseOrder): Promise<void>;
  nextNumber(tenantId: string, year: number): Promise<string>;
}

export interface Repositories {
  users: UserRepository;
  tenants: TenantRepository;
  invoices: InvoiceRepository;
  leave: LeaveRepository;
  purchaseOrders: PurchaseOrderRepository;
  audit: AuditLog;
}
