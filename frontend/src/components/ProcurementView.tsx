"use client";

import { useEffect, useState } from "react";
import { actorCan } from "@core/domain/identity/permissions";
import { poSubtotalMinor, poTaxAmountMinor, poTotalMinor, type PurchaseOrder } from "@core/domain/procurement/purchase-order";
import { currentActor, useDemo } from "../state/store";
import { money } from "../format";
import { Chip } from "./Chip";

export function ProcurementView() {
  const { platform, persona, tick, act } = useDemo();
  const actor = currentActor(persona);
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [vendor, setVendor] = useState("Atlas Industrial Parts (sample)");
  const [description, setDescription] = useState("Spare seals");
  const [qty, setQty] = useState(4);
  const [unit, setUnit] = useState(220);

  useEffect(() => {
    if (!platform) return;
    void platform.procurement.list(actor).then((list) => {
      setRows(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    });
  }, [platform, persona, tick]);

  const current = rows.find((r) => r.id === selected);
  const canWrite = actorCan(actor, "procurement:write");
  const canApprove = actorCan(actor, "procurement:approve");
  const canIssue = actorCan(actor, "procurement:issue");

  return (
    <div className="split">
      <aside className="list">
        <div className="list-head">
          <h3>Purchase orders</h3>
        </div>
        {rows.map((po) => (
          <button key={po.id} type="button" className={`list-item ${po.id === selected ? "active" : ""}`} onClick={() => setSelected(po.id)}>
            <div className="row">
              <span className="mono">{po.number}</span>
              <Chip status={po.status} />
            </div>
            <div className="title">{po.vendorName}</div>
            <div className="muted">{money(poTotalMinor(po), po.currency)}</div>
          </button>
        ))}
      </aside>
      <section className="detail">
        {current && (
          <div className="stack">
            <div className="row">
              <h2>{current.number}</h2>
              <Chip status={current.status} />
            </div>
            <p>
              {current.vendorName}
              {current.neededBy ? ` · needed by ${current.neededBy}` : ""}
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
                    <td className="num">{money(l.unitPriceMinor)}</td>
                    <td className="num">{money(l.quantity * l.unitPriceMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Subtotal {money(poSubtotalMinor(current))} · VAT {money(poTaxAmountMinor(current))} · <strong>Total {money(poTotalMinor(current))}</strong>
            </p>
            <div className="actions">
              {canWrite && (current.status === "draft" || current.status === "rejected") && (
                <button type="button" onClick={() => void act(`Submitted ${current.number}`, (p, a) => p.procurement.submit(a, current.id))}>
                  Submit
                </button>
              )}
              {canApprove && current.status === "submitted" && (
                <>
                  <button type="button" onClick={() => void act(`Approved ${current.number}`, (p, a) => p.procurement.approve(a, current.id))}>
                    Approve
                  </button>
                  <button type="button" className="danger" onClick={() => void act(`Rejected ${current.number}`, (p, a) => p.procurement.reject(a, current.id, "Check the budget code"))}>
                    Reject
                  </button>
                </>
              )}
              {canIssue && current.status === "approved" && (
                <button type="button" onClick={() => void act(`Issued ${current.number}`, (p, a) => p.procurement.issue(a, current.id))}>
                  Issue to vendor
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
              void act("Created draft purchase order", async (p, a) => {
                const po = await p.procurement.create(a, {
                  vendorName: vendor,
                  lines: [{ description, quantity: qty, unitPriceMinor: Math.round(unit * 100) }],
                });
                setSelected(po.id);
                return po;
              });
            }}
          >
            <h3>New draft purchase order</h3>
            <div className="form-grid">
              <label className="field">
                Vendor
                <input value={vendor} onChange={(e) => setVendor(e.target.value)} required />
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
