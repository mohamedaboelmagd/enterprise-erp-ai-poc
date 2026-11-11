"use client";

import { actorCan } from "@core/domain/identity/permissions";
import { TENANTS } from "@core/domain/seed";
import { STRINGS, type MessageKey } from "../i18n/strings";
import { currentActor, PERSONA_LIST, useDemo, type Tab } from "../state/store";
import { AssistantView } from "./AssistantView";
import { AuditView } from "./AuditView";
import { DashboardView } from "./DashboardView";
import { FinanceView } from "./FinanceView";
import { HrView } from "./HrView";
import { ProcurementView } from "./ProcurementView";

const TABS: { id: Tab; key: MessageKey; permission?: Parameters<typeof actorCan>[1] }[] = [
  { id: "dashboard", key: "dashboard" },
  { id: "finance", key: "finance", permission: "finance:read" },
  { id: "hr", key: "hr", permission: "hr:read" },
  { id: "procurement", key: "procurement", permission: "procurement:read" },
  { id: "audit", key: "audit", permission: "audit:read" },
  { id: "assistant", key: "assistant", permission: "ai:use" },
];

export function AppShell() {
  const { platform, persona, lang, tab, toast, clock, setPersona, setLang, setTab, advanceDays, dismissToast } = useDemo();
  const actor = currentActor(persona);
  const t = (k: MessageKey) => STRINGS[lang][k];
  const tenant = TENANTS.find((x) => x.id === actor.tenantId);

  return (
    <div className="app" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} data-testid="app-shell">
      <header className="top">
        <div>
          <h1>Enterprise ERP + AI PoC</h1>
          <span className="sub">{t("subtitle")}</span>
        </div>
        <div className="controls">
          <label>
            {t("persona")}
            <select value={persona} onChange={(e) => setPersona(e.target.value as typeof persona)} data-testid="persona">
              {PERSONA_LIST.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.displayName} — {p.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost lang" onClick={() => setLang(lang === "en" ? "ar" : "en")} data-testid="lang-toggle">
            {t("language")}
          </button>
          <div className="clock">
            <span>
              {t("clock")}: <span className="mono">{clock?.today() ?? "—"}</span>
            </span>
            <button type="button" className="ghost" onClick={() => advanceDays(1)}>
              {t("advance")}
            </button>
          </div>
        </div>
      </header>
      <nav className="tabs">
        {TABS.filter((tabDef) => !tabDef.permission || actorCan(actor, tabDef.permission)).map((tabDef) => (
          <button key={tabDef.id} type="button" className={tab === tabDef.id ? "active" : ""} onClick={() => setTab(tabDef.id)} data-testid={`tab-${tabDef.id}`}>
            {t(tabDef.key)}
          </button>
        ))}
        <span className="hint" data-testid="tenant-name">{tenant?.name}</span>
      </nav>
      <main>
        {!platform ? (
          <p className="pad muted">Loading sample data…</p>
        ) : (
          <>
            {tab === "dashboard" && <DashboardView />}
            {tab === "finance" && <FinanceView />}
            {tab === "hr" && <HrView />}
            {tab === "procurement" && <ProcurementView />}
            {tab === "audit" && <AuditView />}
            {tab === "assistant" && <AssistantView />}
          </>
        )}
      </main>
      <footer className="foot">{t("footer")}</footer>
      {toast && (
        <div className={`toast ${toast.kind === "error" ? "error" : ""}`} onClick={dismissToast} data-testid="toast">
          {toast.text}
        </div>
      )}
    </div>
  );
}
