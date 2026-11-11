import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { Platform } from "../domain/platform";
import { invoiceTaxAmountMinor, invoiceTotalMinor, invoiceSubtotalMinor, isOverdue } from "../domain/finance/invoice";
import { PLATFORM } from "./tokens";
import { AuthGuard, actorOf } from "./auth.guard";
import type { Actor } from "../domain/shared/actor";

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
});
const createSchema = z.object({
  vendorName: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taxBps: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
const rejectSchema = z.object({ reason: z.string().min(1) });

@Controller("finance/invoices")
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get()
  async list(@Req() req: { actor?: Actor }, @Query("overdue") overdue?: string) {
    const actor = actorOf(req);
    const invoices = await this.platform.finance.list(actor, { overdue: overdue === "true" ? true : undefined });
    return invoices.map((i) => presentInvoice(i, this.platform.clock.today()));
  }

  @Get(":id")
  async get(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    const inv = await this.platform.finance.get(actorOf(req), id);
    return presentInvoice(inv, this.platform.clock.today());
  }

  @Post()
  async create(@Req() req: { actor?: Actor }, @Body() body: unknown) {
    const input = createSchema.parse(body);
    const inv = await this.platform.finance.create(actorOf(req), input);
    return presentInvoice(inv, this.platform.clock.today());
  }

  @Patch(":id")
  async update(@Req() req: { actor?: Actor }, @Param("id") id: string, @Body() body: unknown) {
    const input = createSchema.partial().parse(body);
    const inv = await this.platform.finance.update(actorOf(req), id, input);
    return presentInvoice(inv, this.platform.clock.today());
  }

  @Post(":id/submit")
  async submit(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentInvoice(await this.platform.finance.submit(actorOf(req), id), this.platform.clock.today());
  }

  @Post(":id/approve")
  async approve(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentInvoice(await this.platform.finance.approve(actorOf(req), id), this.platform.clock.today());
  }

  @Post(":id/reject")
  async reject(@Req() req: { actor?: Actor }, @Param("id") id: string, @Body() body: unknown) {
    const { reason } = rejectSchema.parse(body);
    return presentInvoice(await this.platform.finance.reject(actorOf(req), id, reason), this.platform.clock.today());
  }

  @Post(":id/pay")
  async pay(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentInvoice(await this.platform.finance.pay(actorOf(req), id), this.platform.clock.today());
  }
}

function presentInvoice(invoice: import("../domain/finance/invoice").Invoice, today: string) {
  return {
    ...invoice,
    subtotalMinor: invoiceSubtotalMinor(invoice),
    taxMinor: invoiceTaxAmountMinor(invoice),
    totalMinor: invoiceTotalMinor(invoice),
    overdue: isOverdue(invoice, today),
  };
}
