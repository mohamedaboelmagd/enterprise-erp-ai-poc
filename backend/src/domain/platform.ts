import { AiAssistantService } from "./ai/ai.service";
import { MockLlmProvider } from "./ai/mock-llm";
import type { LlmProvider } from "./ai/schema";
import { AuditService } from "./audit.service";
import { FinanceService } from "./finance/finance.service";
import { HrService } from "./hr/hr.service";
import { ProcurementService } from "./procurement/procurement.service";
import type { Clock } from "./shared/clock";
import { SystemClock } from "./shared/clock";
import { EventBus } from "./shared/events";
import type { Repositories } from "./ports";
import { createMemoryRepositories } from "../infra/memory/memory-repos";

/**
 * Composition root used by the API (in-memory or Prisma repos) and by the
 * static demo (in-memory only). Intentionally free of Node-only modules
 * (password hashing, Prisma) so the Next.js bundle can import it.
 */
export interface Platform {
  clock: Clock;
  bus: EventBus;
  repos: Repositories;
  finance: FinanceService;
  hr: HrService;
  procurement: ProcurementService;
  ai: AiAssistantService;
  audit: AuditService;
  llm: LlmProvider;
}

export interface PlatformOptions {
  clock?: Clock;
  llm?: LlmProvider;
  repos?: Repositories;
}

export function createPlatform(opts: PlatformOptions = {}): Platform {
  const clock = opts.clock ?? new SystemClock();
  const bus = new EventBus();
  const repos = opts.repos ?? createMemoryRepositories();
  const llm = opts.llm ?? new MockLlmProvider();
  const finance = new FinanceService(repos.invoices, repos.audit, bus, clock);
  const hr = new HrService(repos.leave, repos.audit, bus, clock);
  const procurement = new ProcurementService(repos.purchaseOrders, repos.audit, bus, clock);
  const ai = new AiAssistantService(llm, finance, hr, procurement, clock);
  const audit = new AuditService(repos.audit);
  return { clock, bus, repos, finance, hr, procurement, ai, audit, llm };
}

export function createInMemoryPlatform(opts: Omit<PlatformOptions, "repos"> = {}): Platform {
  return createPlatform({ ...opts, repos: createMemoryRepositories() });
}
