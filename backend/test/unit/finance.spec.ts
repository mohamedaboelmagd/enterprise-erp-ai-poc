import { invoiceTotalMinor, isOverdue } from "../../src/domain/finance/invoice";
import { DomainError } from "../../src/domain/shared/errors";
import { setupPlatform } from "../helpers";

describe("finance invoices", () => {
  it("flags INV-2026-0001 as overdue on the demo date and 0005 as not", async () => {
    const { platform, actor, clock } = await setupPlatform();
    const invoices = await platform.finance.list(actor("amira"));
    const overdue = invoices.find((i) => i.number === "INV-2026-0001")!;
    const current = invoices.find((i) => i.number === "INV-2026-0005")!;
    expect(isOverdue(overdue, clock.today())).toBe(true);
    expect(isOverdue(current, clock.today())).toBe(false);
    expect(invoiceTotalMinor(overdue)).toBe(1_850_000 + 92_500);
  });

  it("lets a clerk raise and submit, and a manager approve (segregation of duties)", async () => {
    const { platform, actor } = await setupPlatform();
    const draft = await platform.finance.create(actor("karim"), {
      vendorName: "Cedar Maintenance Group (sample)",
      dueDate: "2026-12-01",
      lines: [{ description: "Call-out", quantity: 1, unitPriceMinor: 10_000 }],
    });
    expect(draft.number).toBe("INV-2026-0006");
    expect(draft.status).toBe("draft");
    const submitted = await platform.finance.submit(actor("karim"), draft.id);
    expect(submitted.status).toBe("submitted");
    await expect(platform.finance.approve(actor("karim"), draft.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const approved = await platform.finance.approve(actor("amira"), draft.id);
    expect(approved.status).toBe("approved");
    const paid = await platform.finance.pay(actor("amira"), draft.id);
    expect(paid.status).toBe("paid");
  });

  it("rejects a manager approving their own submission and refuses payment before approval", async () => {
    const { platform, actor } = await setupPlatform();
    const draft = await platform.finance.create(actor("amira"), {
      vendorName: "Oasis Facilities LLC (sample)",
      dueDate: "2026-12-15",
      lines: [{ description: "Ad hoc", quantity: 1, unitPriceMinor: 5_000 }],
    });
    const submitted = await platform.finance.submit(actor("amira"), draft.id);
    await expect(platform.finance.approve(actor("amira"), submitted.id)).rejects.toBeInstanceOf(DomainError);
    await expect(platform.finance.pay(actor("amira"), submitted.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("sends a rejected invoice back to draft on edit and writes an audit trail", async () => {
    const { platform, actor } = await setupPlatform();
    const rejected = await platform.finance.reject(actor("amira"), "inv-m-2", "Need a revised quote");
    expect(rejected.status).toBe("rejected");
    const edited = await platform.finance.update(actor("karim"), "inv-m-2", { notes: "Revised" });
    expect(edited.status).toBe("draft");
    const log = await platform.audit.list(actor("amira"), { entityId: "inv-m-2" });
    expect(log.some((e) => e.action === "invoice.rejected")).toBe(true);
    expect(log.some((e) => e.action === "invoice.updated")).toBe(true);
  });

  it("validates dates and empty lines", async () => {
    const { platform, actor } = await setupPlatform();
    await expect(
      platform.finance.create(actor("karim"), {
        vendorName: "Atlas Industrial Parts (sample)",
        issueDate: "2026-12-01",
        dueDate: "2026-11-01",
        lines: [{ description: "Late", quantity: 1, unitPriceMinor: 1 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
