"use client";

import { useEffect, useState } from "react";
import { actorCan } from "@core/domain/identity/permissions";
import { remainingAnnualDays, type LeaveBalance, type LeaveRequest } from "@core/domain/hr/leave";
import { currentActor, useDemo } from "../state/store";
import { Chip } from "./Chip";

export function HrView() {
  const { platform, persona, tick, act } = useDemo();
  const actor = currentActor(persona);
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState("2026-11-23");
  const [to, setTo] = useState("2026-11-25");
  const [reason, setReason] = useState("Personal (sample)");

  useEffect(() => {
    if (!platform) return;
    void (async () => {
      const list = await platform.hr.list(actor);
      setRows(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
      setBalance(await platform.hr.getBalance(actor));
    })();
  }, [platform, persona, tick]);

  const current = rows.find((r) => r.id === selected);
  const canApprove = actorCan(actor, "hr:approve");

  return (
    <div className="split">
      <aside className="list">
        <div className="list-head">
          <h3>Leave requests</h3>
        </div>
        {rows.map((req) => (
          <button key={req.id} type="button" className={`list-item ${req.id === selected ? "active" : ""}`} onClick={() => setSelected(req.id)}>
            <div className="row">
              <span>{req.employeeName}</span>
              <Chip status={req.status} />
            </div>
            <div className="title">
              {req.type} · {req.days} working day{req.days === 1 ? "" : "s"}
            </div>
            <div className="muted">
              {req.from} → {req.to}
            </div>
          </button>
        ))}
      </aside>
      <section className="detail stack">
        {balance && (
          <div className="card">
            Annual leave remaining: <strong>{remainingAnnualDays(balance)}</strong> of {balance.annualAllowanceDays} days ({balance.year}).
          </div>
        )}
        {current && (
          <div className="stack">
            <div className="row">
              <h2>{current.employeeName}</h2>
              <Chip status={current.status} />
            </div>
            <p>
              {current.type} from {current.from} to {current.to} ({current.days} working days). {current.reason}
            </p>
            <div className="actions">
              {actorCan(actor, "hr:write") && (current.status === "draft" || current.status === "rejected") && (
                <button type="button" onClick={() => void act("Submitted leave request", (p, a) => p.hr.submit(a, current.id))}>
                  Submit
                </button>
              )}
              {canApprove && current.status === "submitted" && (
                <>
                  <button type="button" data-testid="approve-leave" onClick={() => void act("Approved leave", (p, a) => p.hr.approve(a, current.id))}>
                    Approve
                  </button>
                  <button type="button" className="danger" onClick={() => void act("Rejected leave", (p, a) => p.hr.reject(a, current.id, "Please discuss dates"))}>
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {actorCan(actor, "hr:write") && (
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              void act("Created leave request", (p, a) => p.hr.create(a, { type: "annual", from, to, reason }));
            }}
          >
            <h3>New annual leave</h3>
            <div className="form-grid">
              <label className="field">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <label className="field">
                Reason
                <input value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            </div>
            <button type="submit">Create draft</button>
          </form>
        )}
      </section>
    </div>
  );
}
