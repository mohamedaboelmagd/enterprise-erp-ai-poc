process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.SEED_DEMO = "true";
delete process.env.DATABASE_URL;

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { DomainExceptionFilter } from "../../src/http/domain.filter";
import { DEMO_PASSWORD, PERSONAS } from "../../src/domain/seed";
import { SAMPLE_INVOICE_TEXT } from "../../src/domain/seed";

describe("API lifecycle", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string, password = DEMO_PASSWORD) {
    const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password });
    return res;
  }

  async function token(email: string) {
    const res = await login(email);
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  }

  it("rejects bad credentials and serves a public health check", async () => {
    const health = await request(app.getHttpServer()).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");
    expect(health.body.llm.id).toBe("mock");
    const bad = await login(PERSONAS.amira.email, "wrong-password");
    expect(bad.status).toBe(401);
  });

  it("walks an invoice from create to paid and forbids self-approval", async () => {
    const clerk = await token(PERSONAS.karim.email);
    const manager = await token(PERSONAS.amira.email);
    const created = await request(app.getHttpServer())
      .post("/finance/invoices")
      .set("Authorization", `Bearer ${clerk}`)
      .send({
        vendorName: "Oasis Facilities LLC (sample)",
        dueDate: "2026-12-20",
        lines: [{ description: "Window cleaning", quantity: 3, unitPriceMinor: 15_000 }],
      });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(created.body.totalMinor).toBe(45_000 + 2_250);
    await request(app.getHttpServer()).post(`/finance/invoices/${id}/submit`).set("Authorization", `Bearer ${clerk}`).expect(201);
    const self = await request(app.getHttpServer()).post(`/finance/invoices/${id}/approve`).set("Authorization", `Bearer ${clerk}`);
    expect(self.status).toBe(403);
    await request(app.getHttpServer()).post(`/finance/invoices/${id}/approve`).set("Authorization", `Bearer ${manager}`).expect(201);
    const paid = await request(app.getHttpServer()).post(`/finance/invoices/${id}/pay`).set("Authorization", `Bearer ${manager}`).expect(201);
    expect(paid.body.status).toBe("paid");
  });

  it("isolates tenants and hides approve from clerks", async () => {
    const amira = await token(PERSONAS.amira.email);
    const rania = await token(PERSONAS.rania.email);
    const meridian = await request(app.getHttpServer()).get("/finance/invoices").set("Authorization", `Bearer ${amira}`);
    const harbor = await request(app.getHttpServer()).get("/finance/invoices").set("Authorization", `Bearer ${rania}`);
    expect(meridian.body.some((i: { id: string }) => i.id === "inv-m-1")).toBe(true);
    expect(harbor.body.some((i: { id: string }) => i.id === "inv-m-1")).toBe(false);
    const clerk = await token(PERSONAS.karim.email);
    const forbidden = await request(app.getHttpServer())
      .post("/finance/invoices/inv-m-2/approve")
      .set("Authorization", `Bearer ${clerk}`);
    expect(forbidden.status).toBe(403);
  });

  it("answers a natural-language report query and extracts invoice fields", async () => {
    const amira = await token(PERSONAS.amira.email);
    const asked = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("Authorization", `Bearer ${amira}`)
      .send({ prompt: "overdue invoices over 5000" });
    expect(asked.status).toBe(201);
    expect(asked.body.kind).toBe("filter");
    expect(asked.body.invoices.some((i: { number: string }) => i.number === "INV-2026-0001")).toBe(true);
    const extracted = await request(app.getHttpServer())
      .post("/ai/extract-invoice")
      .set("Authorization", `Bearer ${amira}`)
      .send({ documentText: SAMPLE_INVOICE_TEXT });
    expect(extracted.status).toBe(201);
    expect(extracted.body.vendorName).toMatch(/Cedar Maintenance/);
    expect(extracted.body.lines).toHaveLength(2);
  });

  it("approves leave as the HR manager and lists the audit log", async () => {
    const lina = await token(PERSONAS.lina.email);
    const approved = await request(app.getHttpServer())
      .post("/hr/leave/leave-m-2/approve")
      .set("Authorization", `Bearer ${lina}`);
    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe("approved");
    const audit = await request(app.getHttpServer()).get("/audit").set("Authorization", `Bearer ${lina}`);
    expect(audit.status).toBe(200);
    expect(audit.body.some((e: { action: string }) => e.action === "leave.approved")).toBe(true);
    const youssef = await token(PERSONAS.youssef.email);
    const hidden = await request(app.getHttpServer()).get("/audit").set("Authorization", `Bearer ${youssef}`);
    expect(hidden.status).toBe(403);
  });
});
