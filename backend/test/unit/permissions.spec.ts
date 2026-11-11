import { actorCan, permissionsFor } from "../../src/domain/identity/permissions";
import { actorFromPersona } from "../../src/domain/seed";
import { DomainError } from "../../src/domain/shared/errors";
import { setupPlatform } from "../helpers";

describe("RBAC", () => {
  it("gives clerks write but not approve", () => {
    const karim = actorFromPersona("karim");
    expect(actorCan(karim, "finance:write")).toBe(true);
    expect(actorCan(karim, "finance:approve")).toBe(false);
    expect(actorCan(karim, "hr:read")).toBe(false);
    expect(permissionsFor(["auditor"]).has("finance:write")).toBe(false);
    expect(permissionsFor(["auditor"]).has("audit:read")).toBe(true);
  });

  it("blocks a finance clerk from the HR module and a Harbor actor from Meridian data", async () => {
    const { platform, actor } = await setupPlatform();
    await expect(platform.hr.list(actor("karim"))).rejects.toBeInstanceOf(DomainError);
    const meridian = await platform.finance.list(actor("amira"));
    const harbor = await platform.finance.list(actor("rania"));
    expect(meridian.some((i) => i.id === "inv-m-1")).toBe(true);
    expect(harbor.some((i) => i.id === "inv-m-1")).toBe(false);
    expect(harbor.some((i) => i.id === "inv-h-1")).toBe(true);
    expect(harbor.every((i) => i.tenantId === actor("rania").tenantId)).toBe(true);
  });
});
