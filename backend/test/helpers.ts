import { FixedClock } from "../src/domain/shared/clock";
import { createInMemoryPlatform, type Platform } from "../src/domain/platform";
import { actorFromPersona, seedDemo, type PersonaKey } from "../src/domain/seed";
import type { Actor } from "../src/domain/shared/actor";

export const DEMO_DAY = new Date("2026-11-11T09:00:00.000Z");

export async function setupPlatform(): Promise<{ platform: Platform; clock: FixedClock; actor: (k: PersonaKey) => Actor }> {
  const clock = new FixedClock(DEMO_DAY);
  const platform = createInMemoryPlatform({ clock });
  await seedDemo(platform.repos, clock);
  return { platform, clock, actor: actorFromPersona };
}
