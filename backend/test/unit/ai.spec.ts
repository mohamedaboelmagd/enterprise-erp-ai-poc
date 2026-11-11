import { MockLlmProvider, extractInvoice, parseReportFilter } from "../../src/domain/ai/mock-llm";
import { OpenAiCompatibleProvider } from "../../src/domain/ai/openai-compatible";
import { SAMPLE_INVOICE_TEXT } from "../../src/domain/seed";
import { setupPlatform } from "../helpers";

describe("mock LLM parser", () => {
  it("parses overdue invoices over an amount in a named month", () => {
    const filter = parseReportFilter("overdue invoices over 5000 in November", "2026-11-11");
    expect(filter.module).toBe("finance");
    expect(filter.overdue).toBe(true);
    expect(filter.minTotalMinor).toBe(500_000);
    expect(filter.issueMonth).toBe(11);
    expect(filter.issueYear).toBe(2026);
    expect(filter.confidence).toBeGreaterThan(0.8);
  });

  it("parses pending leave and open purchase orders", () => {
    const leave = parseReportFilter("pending leave requests for Youssef Farid");
    expect(leave.module).toBe("hr");
    expect(leave.status).toBe("submitted");
    expect(leave.employeeNameContains).toBe("Youssef Farid");

    const pos = parseReportFilter("open purchase orders above 20000");
    expect(pos.module).toBe("procurement");
    expect(pos.open).toBe(true);
    expect(pos.minTotalMinor).toBe(2_000_000);
  });

  it("extracts vendor, dates, VAT and line items from messy text", () => {
    const extracted = extractInvoice(SAMPLE_INVOICE_TEXT);
    expect(extracted.vendorName).toMatch(/Cedar Maintenance Group/);
    expect(extracted.issueDate).toBe("2026-10-15");
    expect(extracted.dueDate).toBe("2026-11-14");
    expect(extracted.taxBps).toBe(500);
    expect(extracted.lines).toHaveLength(2);
    expect(extracted.lines[0]).toMatchObject({ description: "Generator maintenance", quantity: 1, unitPriceMinor: 1_250_000 });
    expect(extracted.lines[1]).toMatchObject({ quantity: 2, unitPriceMinor: 85_000 });
  });

  it("fails clearly when the document has no vendor or lines", () => {
    expect(() => extractInvoice("thanks for your business")).toThrow(/vendor/i);
    expect(() => extractInvoice("Invoice from Cedar Maintenance Group")).toThrow(/line/i);
  });
});

describe("AI assistant service", () => {
  it("applies a natural-language filter to real tenant data and respects RBAC", async () => {
    const { platform, actor } = await setupPlatform();
    const result = await platform.ai.ask(actor("amira"), "overdue invoices over 5000");
    expect(result.kind).toBe("filter");
    if (result.kind !== "filter") return;
    expect(result.filter.overdue).toBe(true);
    expect(result.invoices?.every((i) => i.number === "INV-2026-0001")).toBe(true);
    await expect(platform.ai.ask(actor("youssef"), "overdue invoices")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("extracts an invoice the finance clerk can then create", async () => {
    const { platform, actor } = await setupPlatform();
    const extracted = await platform.ai.extractInvoice(actor("karim"), SAMPLE_INVOICE_TEXT);
    const created = await platform.finance.create(actor("karim"), {
      vendorName: extracted.vendorName,
      issueDate: extracted.issueDate,
      dueDate: extracted.dueDate ?? "2026-12-01",
      taxBps: extracted.taxBps,
      lines: extracted.lines,
    });
    expect(created.vendorName).toMatch(/Cedar Maintenance/);
    expect(created.lines).toHaveLength(2);
  });

  it("swaps in a different provider without changing the service", async () => {
    const { platform, actor } = await setupPlatform();
    const stub = new MockLlmProvider();
    const spy = jest.spyOn(stub, "complete");
    // Rebuild a service around the same data with an explicit provider.
    const { AiAssistantService } = await import("../../src/domain/ai/ai.service");
    const ai = new AiAssistantService(stub, platform.finance, platform.hr, platform.procurement, platform.clock);
    await ai.ask(actor("amira"), "approved invoices");
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ task: "parse_report_filter" }));
  });
});

describe("OpenAI-compatible provider", () => {
  it("posts a JSON chat completion and validates the result", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                module: "finance",
                overdue: true,
                explanation: "ok",
                confidence: 1,
              }),
            },
          },
        ],
      }),
    }));
    const provider = new OpenAiCompatibleProvider({
      baseUrl: "http://llm.local/v1",
      apiKey: "test-key",
      model: "demo-model",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await provider.complete({ task: "parse_report_filter", input: "overdue invoices", today: "2026-11-11" });
    expect(result.raw).toMatchObject({ module: "finance", overdue: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://llm.local/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(provider.remote).toBe(true);
    expect(new MockLlmProvider().remote).toBe(false);
  });
});
