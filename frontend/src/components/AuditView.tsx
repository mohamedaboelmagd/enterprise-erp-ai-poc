"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@core/domain/shared/audit";
import { currentActor, useDemo } from "../state/store";

export function AuditView() {
  const { platform, persona, tick } = useDemo();
  const actor = currentActor(persona);
  const [rows, setRows] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!platform) return;
    void platform.audit.list(actor, { limit: 100 }).then(setRows);
  }, [platform, persona, tick]);

  return (
    <div className="pad">
      <h3>Tenant audit log</h3>
      <p className="muted">Append-only. Every mutation in this tenant is recorded with the actor and a before/after snapshot.</p>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="mono">{e.at.replace("T", " ").slice(0, 19)}</td>
              <td>{e.actorName}</td>
              <td className="mono">{e.action}</td>
              <td>{e.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
