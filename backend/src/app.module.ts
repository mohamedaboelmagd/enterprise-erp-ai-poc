import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { IdentityService } from "./domain/identity/identity.service";
import { createInMemoryPlatform, createPlatform, type Platform } from "./domain/platform";
import { MockLlmProvider } from "./domain/ai/mock-llm";
import { OpenAiCompatibleProvider } from "./domain/ai/openai-compatible";
import type { LlmProvider } from "./domain/ai/schema";
import { seedDemo } from "./domain/seed";
import { FixedClock, SystemClock, type Clock } from "./domain/shared/clock";
import { AuthController } from "./http/auth.controller";
import { AuthGuard } from "./http/auth.guard";
import { FinanceController } from "./http/finance.controller";
import { HrController } from "./http/hr.controller";
import { ProcurementController } from "./http/procurement.controller";
import { AiController } from "./http/ai.controller";
import { AuditController } from "./http/audit.controller";
import { HealthController } from "./http/health.controller";
import { IDENTITY, PLATFORM } from "./http/tokens";

export interface AppOptions {
  platform?: Platform;
  jwtSecret?: string;
  seed?: boolean;
  clock?: Clock;
}

export function jwtSecretFromEnv(): string {
  const s = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me-32ch";
  return s;
}

export function llmFromEnv(): LlmProvider {
  if ((process.env.LLM_PROVIDER ?? "mock") === "openai-compatible") {
    const baseUrl = process.env.OPENAI_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    if (!baseUrl || !apiKey) {
      throw new Error("LLM_PROVIDER=openai-compatible requires OPENAI_BASE_URL and OPENAI_API_KEY");
    }
    return new OpenAiCompatibleProvider({ baseUrl, apiKey, model });
  }
  return new MockLlmProvider();
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecretFromEnv(),
      signOptions: { expiresIn: "8h" },
    }),
  ],
  controllers: [
    AuthController,
    FinanceController,
    HrController,
    ProcurementController,
    AiController,
    AuditController,
    HealthController,
  ],
  providers: [
    AuthGuard,
    {
      provide: PLATFORM,
      useFactory: async (): Promise<Platform> => {
        if (process.env.DATABASE_URL) {
          const { PrismaClient } = await import("@prisma/client");
          const { createPrismaRepositories } = await import("./infra/prisma/prisma-repos");
          const db = new PrismaClient();
          const repos = createPrismaRepositories(db);
          const platform = createPlatform({ repos, clock: new SystemClock(), llm: llmFromEnv() });
          if (process.env.SEED_DEMO === "true") {
            const existing = await repos.tenants.list();
            if (existing.length === 0) await seedDemo(repos, platform.clock);
          }
          return platform;
        }
        const clock = new FixedClock(new Date("2026-11-11T09:00:00.000Z"));
        const platform = createInMemoryPlatform({ clock, llm: llmFromEnv() });
        await seedDemo(platform.repos, clock);
        return platform;
      },
    },
    {
      provide: IDENTITY,
      useFactory: (platform: Platform) => new IdentityService(platform.repos.users, platform.repos.tenants),
      inject: [PLATFORM],
    },
  ],
})
export class AppModule {}
