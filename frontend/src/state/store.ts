"use client";

import { create } from "zustand";
import { createInMemoryPlatform, type Platform } from "@core/domain/platform";
import { PERSONAS, actorFromPersona, seedDemo, type PersonaKey } from "@core/domain/seed";
import { FixedClock } from "@core/domain/shared/clock";
import type { Actor } from "@core/domain/shared/actor";
import type { Lang } from "../i18n/strings";

export type Tab = "dashboard" | "finance" | "hr" | "procurement" | "audit" | "assistant";

export interface Toast {
  kind: "ok" | "error";
  text: string;
  id: number;
}

interface DemoState {
  platform: Platform | null;
  clock: FixedClock | null;
  persona: PersonaKey;
  lang: Lang;
  tab: Tab;
  tick: number;
  toast: Toast | null;
  daysAdvanced: number;
  init: () => Promise<void>;
  setPersona: (p: PersonaKey) => void;
  setLang: (l: Lang) => void;
  setTab: (t: Tab) => void;
  act: <T>(label: string, fn: (p: Platform, actor: Actor) => Promise<T>) => Promise<T | undefined>;
  advanceDays: (n: number) => void;
  dismissToast: () => void;
}

let toastId = 0;
let started = false;

export const useDemo = create<DemoState>((set, get) => ({
  platform: null,
  clock: null,
  persona: "amira",
  lang: "en",
  tab: "dashboard",
  tick: 0,
  toast: null,
  daysAdvanced: 0,

  async init() {
    if (started) return;
    started = true;
    const clock = new FixedClock(new Date("2026-11-11T09:00:00.000Z"));
    const platform = createInMemoryPlatform({ clock });
    await seedDemo(platform.repos, clock);
    set({ platform, clock, tick: get().tick + 1 });
  },

  setPersona(persona) {
    set({ persona, tick: get().tick + 1 });
  },
  setLang(lang) {
    set({ lang });
  },
  setTab(tab) {
    set({ tab });
  },

  async act(label, fn) {
    const { platform, persona } = get();
    if (!platform) return undefined;
    try {
      const result = await fn(platform, actorFromPersona(persona));
      set((s) => ({ tick: s.tick + 1, toast: { kind: "ok", text: label, id: ++toastId } }));
      return result;
    } catch (err) {
      set((s) => ({
        tick: s.tick + 1,
        toast: { kind: "error", text: err instanceof Error ? err.message : String(err), id: ++toastId },
      }));
      return undefined;
    }
  },

  advanceDays(n) {
    get().clock?.advanceDays(n);
    set((s) => ({
      tick: s.tick + 1,
      daysAdvanced: s.daysAdvanced + n,
      toast: { kind: "ok", text: `Clock moved forward ${n} day${n === 1 ? "" : "s"}`, id: ++toastId },
    }));
  },

  dismissToast() {
    set({ toast: null });
  },
}));

const actorCache = new Map<PersonaKey, Actor>();

/** Stable actor per persona so view effects can depend on it without looping. */
export function currentActor(persona: PersonaKey): Actor {
  const cached = actorCache.get(persona);
  if (cached) return cached;
  const actor = actorFromPersona(persona);
  actorCache.set(persona, actor);
  return actor;
}

export const PERSONA_LIST = Object.values(PERSONAS);

/** Test-only: clears the singleton so each test can seed a fresh platform. */
export function resetDemo(): void {
  started = false;
  toastId = 0;
  actorCache.clear();
  useDemo.setState({
    platform: null,
    clock: null,
    persona: "amira",
    lang: "en",
    tab: "dashboard",
    tick: 0,
    toast: null,
    daysAdvanced: 0,
  });
}
