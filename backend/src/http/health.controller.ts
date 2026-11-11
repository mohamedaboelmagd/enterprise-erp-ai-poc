import { Controller, Get, Inject } from "@nestjs/common";
import type { Platform } from "../domain/platform";
import { PLATFORM } from "./tokens";

@Controller("health")
export class HealthController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get()
  check() {
    return {
      status: "ok",
      today: this.platform.clock.today(),
      llm: this.platform.ai.getProviderInfo(),
    };
  }
}
