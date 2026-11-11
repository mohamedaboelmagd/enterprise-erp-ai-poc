"use client";

import { useState } from "react";
import type { AssistantResult } from "@core/domain/ai/ai.service";
import type { ExtractedInvoice } from "@core/domain/ai/schema";
import { invoiceTotalMinor, isOverdue } from "@core/domain/finance/invoice";
import { poTotalMinor } from "@core/domain/procurement/purchase-order";
import { SAMPLE_INVOICE_TEXT } from "@core/domain/seed";
import { currentActor, useDemo } from "../state/store";
import { money } from "../format";
import { Chip } from "./Chip";

const EXAMPLES = ["overdue invoices over 5000", "pending leave requests", "open purchase orders above 20000"];

export function AssistantView() {
  const { platform, persona, clock, act, setTab } = useDemo();
  const actor = currentActor(persona);
  const [prompt, setPrompt] = useState("overdue invoices over 5000");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [documentText, setDocumentText] = useState(SAMPLE_INVOICE_TEXT);
  const [extracted, setExtracted] = useState<ExtractedInvoice | null>(null);
  const today = clock?.today() ?? "2026-11-11";

  return (
    <div className="pad stack" style={{ maxWidth: 960 }}>
      <div className="card stack">
        <h3>Natural-language report filter</h3>
        <p className="muted">
          The default provider is a deterministic offline mock — the same wording always produces the same filter, and the prompt never leaves this browser. A self-hosted
          deployment can point the same interface at a local model server.
        </p>
        <div className="row">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="ghost" onClick={() => setPrompt(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (!platform) return;
              const out = await act("Ran report filter", (p, a) => p.ai.ask(a, prompt));
              if (out) setResult(out);
            })();
          }}
        >
          <label className="field">
            Ask
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} data-testid="ai-prompt" />
          </label>
          <button type="submit" data-testid="ai-ask">
            Run filter
          </button>
        </form>
        {result?.kind === "filter" && (
          <div data-testid="ai-filter-result">
            <p className="muted">{result.filter.explanation}</p>
            {result.invoices && (
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="mono">{inv.number}</td>
                      <td>{inv.vendorName}</td>
                      <td>
                        <Chip status={inv.status} overdue={isOverdue(inv, today)} />
                      </td>
                      <td className="num">{money(invoiceTotalMinor(inv))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {result.leave && (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.leave.map((req) => (
                    <tr key={req.id}>
                      <td>{req.employeeName}</td>
                      <td>{req.type}</td>
                      <td>
                        {req.from} → {req.to}
                      </td>
                      <td>
                        <Chip status={req.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {result.purchaseOrders && (
              <table>
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="mono">{po.number}</td>
                      <td>{po.vendorName}</td>
                      <td>
                        <Chip status={po.status} />
                      </td>
                      <td className="num">{money(poTotalMinor(po))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Invoice field extraction</h3>
        <p className="muted">Paste unstructured invoice text. The mock provider reads vendor, dates, VAT and line items of the form “description xQTY @ amount”.</p>
        <textarea value={documentText} onChange={(e) => setDocumentText(e.target.value)} data-testid="extract-text" />
        <button
          type="button"
          data-testid="extract-run"
          onClick={() => {
            void (async () => {
              if (!platform) return;
              const out = await act("Extracted invoice fields", (p, a) => p.ai.extractInvoice(a, documentText));
              if (out) setExtracted(out);
            })();
          }}
        >
          Extract fields
        </button>
        {extracted && (
          <div data-testid="extract-result" className="stack">
            <p>
              {extracted.vendorName} · issued {extracted.issueDate ?? "—"} · due {extracted.dueDate ?? "—"} · VAT {extracted.taxBps ? `${extracted.taxBps / 100}%` : "—"}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit</th>
                </tr>
              </thead>
              <tbody>
                {extracted.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.description}</td>
                    <td className="num">{l.quantity}</td>
                    <td className="num">{money(l.unitPriceMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => {
                void act("Created draft from extraction", async (p, a) => {
                  const inv = await p.finance.create(a, {
                    vendorName: extracted.vendorName,
                    issueDate: extracted.issueDate,
                    dueDate: extracted.dueDate ?? "2026-12-01",
                    taxBps: extracted.taxBps,
                    lines: extracted.lines,
                  });
                  setTab("finance");
                  return inv;
                });
              }}
            >
              Create draft invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
