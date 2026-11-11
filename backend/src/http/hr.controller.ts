import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { Platform } from "../domain/platform";
import { PLATFORM } from "./tokens";
import { AuthGuard, actorOf } from "./auth.guard";
import type { Actor } from "../domain/shared/actor";

const createSchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  type: z.enum(["annual", "sick", "unpaid"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});
const rejectSchema = z.object({ reason: z.string().min(1) });

@Controller("hr")
@UseGuards(AuthGuard)
export class HrController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get("leave")
  async list(@Req() req: { actor?: Actor }) {
    return this.platform.hr.list(actorOf(req));
  }

  @Get("leave/balance")
  async balance(@Req() req: { actor?: Actor }) {
    return this.platform.hr.getBalance(actorOf(req));
  }

  @Get("leave/:id")
  async get(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return this.platform.hr.get(actorOf(req), id);
  }

  @Post("leave")
  async create(@Req() req: { actor?: Actor }, @Body() body: unknown) {
    return this.platform.hr.create(actorOf(req), createSchema.parse(body));
  }

  @Post("leave/:id/submit")
  async submit(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return this.platform.hr.submit(actorOf(req), id);
  }

  @Post("leave/:id/approve")
  async approve(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return this.platform.hr.approve(actorOf(req), id);
  }

  @Post("leave/:id/reject")
  async reject(@Req() req: { actor?: Actor }, @Param("id") id: string, @Body() body: unknown) {
    return this.platform.hr.reject(actorOf(req), id, rejectSchema.parse(body).reason);
  }

  @Post("leave/:id/cancel")
  async cancel(@Req() req: { actor?: Actor }, @Param("id") id: string) {
    return this.platform.hr.cancel(actorOf(req), id);
  }
}
