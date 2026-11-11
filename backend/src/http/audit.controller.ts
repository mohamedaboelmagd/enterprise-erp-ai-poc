import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Platform } from "../domain/platform";
import { PLATFORM } from "./tokens";
import { AuthGuard, actorOf } from "./auth.guard";
import type { Actor } from "../domain/shared/actor";

@Controller("audit")
@UseGuards(AuthGuard)
export class AuditController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get()
  async list(
    @Req() req: { actor?: Actor },
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
  ) {
    return this.platform.audit.list(actorOf(req), { entityType, entityId, limit: 200 });
  }
}
