"use client";

import { actorCan } from "@core/domain/identity/permissions";
import { isOverdue } from "@core/domain/finance/invoice";
import { isOpenPo } from "@core/domain/procurement/purchase-order";
import { STRINGS } from "../i18n/strings";
import { currentActor, useDemo } from "../state/store";
import { useEffect, useState } from "react";

export function DashboardView() {
  const { platform, persona, lang, clock, tick, setTab } = useDemo();
  const actor = currentActor(persona);
  const t = STRINGS[lang];
  const [counts, setCounts] = useState({ overdue: 0, pendingInv: 0, pendingLeave: 0, openPo: 0 });

  useEffect(() => {
    if (!platform || !clock) return;
    void (async () => {
      const today = clock.today();
      const overdue = actorCan(actor, "finance:read") ? (await platform.finance.list(actor)).filter((i) => isOverdue(i, today)).length : 0;
      const pendingInv = actorCan(actor, "finance:approve") ? (await platform.finance.list(actor, { status: "submitted" })).length : 0;
      const pendingLeave = actorCan(actor, "hr:approve") ? (await platform.hr.list(actor, { status: "submitted" })).length : 0;
      const openPo = actorCan(actor, "procurement:read") ? (await platform.procurement.list(actor)).filter(isOpenPo).length : 0;
      setCounts({ overdue, pendingInv, pendingLeave, openPo });
    })();
  }, [platform, actor, clock, tick]);

  const cards = [
    actorCan(actor, "finance:read") && { id: "overdue", label: t.overdue, value: counts.overdue, tab: "finance" as const },
    actorCan(actor, "finance:approve") && { id: "pending-invoices", label: t.pendingInv, value: counts.pendingInv, tab: "finance" as const },
    actorCan(actor, "hr:approve") && { id: "pending-leave", label: t.pendingLeave, value: counts.pendingLeave, tab: "hr" as const },
    actorCan(actor, "procurement:read") && { id: "open-po", label: t.openPo, value: counts.openPo, tab: "procurement" as const },
  ].filter(Boolean) as { id: string; label: string; value: number; tab: "finance" | "hr" | "procurement" }[];

  return (
    <div>
      <p className="banner">
        {t.hint} {t.provider}: <span className="mono">{platform?.ai.getProviderInfo().id}</span> ({t.offline}).
      </p>
      <div className="cards">
        {cards.map((c) => (
          <button key={c.id} type="button" className="card" style={{ textAlign: "start" }} onClick={() => setTab(c.tab)} data-testid={`kpi-${c.id}`}>
            <div className="muted">{c.label}</div>
            <div className="kpi">{c.value}</div>
          </button>
        ))}
      </div>
      <div className="pad">
        <div className="card">
          <h3>What to try</h3>
          <ol>
            <li>Open Finance as Amira Saleh: INV-2026-0001 is overdue; INV-2026-0002 is waiting for your approval.</li>
            <li>Switch to Karim Nassar (clerk): the Approve button disappears. Submit the draft INV-2026-0003, then switch back to Amira to approve it.</li>
            <li>As Lina Haddad, approve Youssef Farid&apos;s December leave and watch his remaining annual balance drop.</li>
            <li>In the AI assistant, try “overdue invoices over 5000” or paste the sample invoice text to extract fields — the mock provider never leaves the browser.</li>
            <li>Switch to Rania Adel at Harbor Municipal Works (sample) to see tenant isolation.</li>
            <li>Use عربي to flip the chrome into a right-to-left layout.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
