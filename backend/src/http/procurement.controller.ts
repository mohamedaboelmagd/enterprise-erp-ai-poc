import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { Platform } from "../domain/platform";
import { poSubtotalMinor, poTaxAmountMinor, poTotalMinor } from "../domain/procurement/purchase-order";
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
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taxBps: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
const rejectSchema = z.object({ reason: z.string().min(1) });

@Controller("procurement/purchase-orders")
@UseGuards(AuthGuard)
export class ProcurementController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get()
  async list(@Req() req: { actor?: Actor }) {
    const rows = await this.platform.procurement.list(actorOf(req));
    return rows.map(presentPo);
  }

  @Get(":id")
  async get(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentPo(await this.platform.procurement.get(actorOf(req), id));
  }

  @Post()
  async create(@Req() req: { actor?: Actor }, @Body() body: unknown) {
    return presentPo(await this.platform.procurement.create(actorOf(req), createSchema.parse(body)));
  }

  @Patch(":id")
  async update(@Req() req: { actor?: Actor }, @Param("id") id: string, @Body() body: unknown) {
    return presentPo(await this.platform.procurement.update(actorOf(req), id, createSchema.partial().parse(body)));
  }

  @Post(":id/submit")
  async submit(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentPo(await this.platform.procurement.submit(actorOf(req), id));
  }

  @Post(":id/approve")
  async approve(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentPo(await this.platform.procurement.approve(actorOf(req), id));
  }

  @Post(":id/reject")
  async reject(@Req() req: { actor?: Actor }, @Param("id") id: string, @Body() body: unknown) {
    return presentPo(await this.platform.procurement.reject(actorOf(req), id, rejectSchema.parse(body).reason));
  }

  @Post(":id/issue")
  async issue(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return presentPo(await this.platform.procurement.issue(actorOf(req), id));
  }
}

function presentPo(po: import("../domain/procurement/purchase-order").PurchaseOrder) {
  return { ...po, subtotalMinor: poSubtotalMinor(po), taxMinor: poTaxAmountMinor(po), totalMinor: poTotalMinor(po) };
}
