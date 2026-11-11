import { poTotalMinor } from "../../src/domain/procurement/purchase-order";
import { setupPlatform } from "../helpers";

describe("procurement purchase orders", () => {
  it("lets a clerk submit and a manager approve and issue, but not the submitter", async () => {
    const { platform, actor } = await setupPlatform();
    const submitted = await platform.procurement.get(actor("nour"), "po-m-1");
    expect(submitted.status).toBe("submitted");
    expect(poTotalMinor(submitted)).toBe(4 * 1_520_000 + 304_000);
    await expect(platform.procurement.approve(actor("hadi"), submitted.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const approved = await platform.procurement.approve(actor("nour"), submitted.id);
    expect(approved.status).toBe("approved");
    const issued = await platform.procurement.issue(actor("nour"), submitted.id);
    expect(issued.status).toBe("issued");
    expect(issued.issuedBy).toBe(actor("nour").id);
  });

  it("blocks issuing a draft and allows editing a rejected PO back to draft", async () => {
    const { platform, actor } = await setupPlatform();
    await expect(platform.procurement.issue(actor("nour"), "po-m-3")).rejects.toMatchObject({ code: "CONFLICT" });
    const created = await platform.procurement.create(actor("hadi"), {
      vendorName: "Nile Office Systems (sample)",
      neededBy: "2026-12-01",
      lines: [{ description: "Desks", quantity: 2, unitPriceMinor: 80_000 }],
    });
    const submitted = await platform.procurement.submit(actor("hadi"), created.id);
    const rejected = await platform.procurement.reject(actor("nour"), submitted.id, "Wrong cost centre");
    expect(rejected.status).toBe("rejected");
    const edited = await platform.procurement.update(actor("hadi"), rejected.id, { notes: "Cost centre 440" });
    expect(edited.status).toBe("draft");
  });
});
