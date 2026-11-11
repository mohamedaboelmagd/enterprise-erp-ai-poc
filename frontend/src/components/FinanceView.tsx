"use client";

import { useEffect, useState } from "react";
import { actorCan } from "@core/domain/identity/permissions";
import { invoiceSubtotalMinor, invoiceTaxAmountMinor, invoiceTotalMinor, isOverdue, type Invoice } from "@core/domain/finance/invoice";
import { currentActor, useDemo } from "../state/store";
import { money } from "../format";
import { Chip } from "./Chip";

export function FinanceView() {
  const { platform, persona, clock, tick, act } = useDemo();
  const actor = currentActor(persona);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [vendor, setVendor] = useState("Cedar Maintenance Group (sample)");
  const [dueDate, setDueDate] = useState("2026-12-15");
  const [description, setDescription] = useState("Ad hoc works");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState(1500);
  const today = clock?.today() ?? "2026-11-11";

  useEffect(() => {
    if (!platform) return;
    void platform.finance.list(actor).then((list) => {
      setRows(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    });
  }, [platform, persona, tick]);

  const current = rows.find((r) => r.id === selected);
  const canWrite = actorCan(actor, "finance:write");
  const canApprove = actorCan(actor, "finance:approve");
  const canPay = actorCan(actor, "finance:pay");

  return (
    <div className="split">
      <aside className="list">
        <div className="list-head">
          <h3>Invoices</h3>
        </div>
        {rows.map((inv) => {
          const overdue = isOverdue(inv, today);
          return (
            <button key={inv.id} type="button" className={`list-item ${inv.id === selected ? "active" : ""}`} onClick={() => setSelected(inv.id)} data-testid={`invoice-${inv.number}`}>
              <div className="row">
                <span className="mono">{inv.number}</span>
                <Chip status={inv.status} overdue={overdue} />
              </div>
              <div className="title">{inv.vendorName}</div>
              <div className="row muted">
                <span>due {inv.dueDate}</span>
                <span>{money(invoiceTotalMinor(inv), inv.currency)}</span>
              </div>
            </button>
          );
        })}
      </aside>
      <section className="detail">
        {current && (
          <div className="stack">
            <div className="row">
              <h2>{current.number}</h2>
              <Chip status={current.status} overdue={isOverdue(current, today)} />
            </div>
            <p>
              {current.vendorName} · issued {current.issueDate} · due {current.dueDate}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}</td>
                    <td className="num">{l.quantity}</td>
                    <td className="num">{money(l.unitPriceMinor, current.currency)}</td>
                    <td className="num">{money(l.quantity * l.unitPriceMinor, current.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Subtotal {money(invoiceSubtotalMinor(current))} · VAT {money(invoiceTaxAmountMinor(current))} ·{" "}
              <strong>Total {money(invoiceTotalMinor(current))}</strong>
            </p>
            <div className="actions">
              {canWrite && (current.status === "draft" || current.status === "rejected") && (
                <button type="button" onClick={() => void act(`Submitted ${current.number}`, (p, a) => p.finance.submit(a, current.id))}>
                  Submit
                </button>
              )}
              {canApprove && current.status === "submitted" && (
                <>
                  <button type="button" data-testid="approve-invoice" onClick={() => void act(`Approved ${current.number}`, (p, a) => p.finance.approve(a, current.id))}>
                    Approve
                  </button>
                  <button type="button" className="danger" onClick={() => void act(`Rejected ${current.number}`, (p, a) => p.finance.reject(a, current.id, "Needs revision"))}>
                    Reject
                  </button>
                </>
              )}
              {canPay && current.status === "approved" && (
                <button type="button" onClick={() => void act(`Recorded payment for ${current.number}`, (p, a) => p.finance.pay(a, current.id))}>
                  Record payment
                </button>
              )}
            </div>
          </div>
        )}
        {canWrite && (
          <form
            className="card stack"
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              void act("Created draft invoice", async (p, a) => {
                const inv = await p.finance.create(a, {
                  vendorName: vendor,
                  dueDate,
                  lines: [{ description, quantity: qty, unitPriceMinor: Math.round(unit * 100) }],
                });
                setSelected(inv.id);
                return inv;
              });
            }}
          >
            <h3>New draft invoice</h3>
            <div className="form-grid">
              <label className="field">
                Vendor
                <input value={vendor} onChange={(e) => setVendor(e.target.value)} required />
              </label>
              <label className="field">
                Due
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </label>
              <label className="field">
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </label>
              <label className="field">
                Qty
                <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </label>
              <label className="field">
                Unit (AED)
                <input type="number" min={0} step="0.01" value={unit} onChange={(e) => setUnit(Number(e.target.value))} />
              </label>
            </div>
            <button type="submit">Create draft</button>
          </form>
        )}
      </section>
    </div>
  );
}
