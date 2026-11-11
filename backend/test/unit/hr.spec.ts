import { DomainError } from "../../src/domain/shared/errors";
import { setupPlatform } from "../helpers";

describe("HR leave", () => {
  it("hides other people's requests from an employee and shows them to the manager", async () => {
    const { platform, actor } = await setupPlatform();
    const mine = await platform.hr.list(actor("youssef"));
    expect(mine.every((r) => r.employeeId === actor("youssef").id)).toBe(true);
    const all = await platform.hr.list(actor("lina"));
    expect(all.length).toBeGreaterThanOrEqual(mine.length);
  });

  it("approves a pending request, consumes annual balance, and forbids self-approval", async () => {
    const { platform, actor } = await setupPlatform();
    const before = await platform.hr.getBalance(actor("youssef"));
    expect(before.annualUsedDays).toBe(5);
    await expect(platform.hr.approve(actor("youssef"), "leave-m-2")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const approved = await platform.hr.approve(actor("lina"), "leave-m-2");
    expect(approved.status).toBe("approved");
    const after = await platform.hr.getBalance(actor("youssef"));
    expect(after.annualUsedDays).toBe(10);
  });

  it("rejects a request that exceeds the remaining annual balance", async () => {
    const { platform, actor } = await setupPlatform();
    const req = await platform.hr.create(actor("youssef"), {
      type: "annual",
      from: "2026-11-16",
      to: "2026-12-11", // many working days, more than the 16 remaining
    });
    await expect(platform.hr.submit(actor("youssef"), req.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects overlapping submitted leave and weekend-only ranges", async () => {
    const { platform, actor } = await setupPlatform();
    const overlap = await platform.hr.create(actor("youssef"), {
      type: "sick",
      from: "2026-12-16",
      to: "2026-12-17",
    });
    await expect(platform.hr.submit(actor("youssef"), overlap.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      platform.hr.create(actor("youssef"), { type: "unpaid", from: "2026-11-14", to: "2026-11-15" }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
