import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { Platform } from "../domain/platform";
import { PLATFORM } from "./tokens";
import { AuthGuard, actorOf } from "./auth.guard";
import type { Actor } from "../domain/shared/actor";

const askSchema = z.object({ prompt: z.string().min(1) });
const extractSchema = z.object({ documentText: z.string().min(1) });

@Controller("ai")
@UseGuards(AuthGuard)
export class AiController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get("provider")
  provider() {
    return this.platform.ai.getProviderInfo();
  }

  @Post("ask")
  async ask(@Req() req: { actor?: Actor }, @Body() body: unknown) {
    const { prompt } = askSchema.parse(body);
    return this.platform.ai.ask(actorOf(req), prompt);
  }

  @Post("extract-invoice")
  async extract(@Req() req: { actor?: Actor }, @Body() body: unknown) {
    const { documentText } = extractSchema.parse(body);
    return this.platform.ai.extractInvoice(actorOf(req), documentText);
  }
}
