import { DomainError } from "../shared/errors";
import { extractedInvoiceSchema, reportFilterSchema, type CompletionRequest, type CompletionResponse, type LlmProvider } from "./schema";

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

/**
 * Optional provider for an OpenAI-compatible endpoint (a local model server or a
 * hosted API). Not used by the demo or by CI. Enabling it sends the prompt to
 * that endpoint — see docs/SECURITY.md before pointing this at a third party.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id = "openai-compatible";
  readonly remote = true;
  constructor(private readonly opts: OpenAiCompatibleOptions) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const res = await fetchImpl(`${trimSlash(this.opts.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.opts.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(request.task, request.today) },
          { role: "user", content: request.input },
        ],
      }),
    });
    if (!res.ok) {
      throw new DomainError("UNSUPPORTED", `LLM endpoint returned ${res.status}`);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new DomainError("UNSUPPORTED", "LLM endpoint returned an empty completion");
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new DomainError("UNSUPPORTED", "LLM endpoint did not return JSON");
    }
    const schema = request.task === "parse_report_filter" ? reportFilterSchema : extractedInvoiceSchema;
    const raw = schema.parse(parsed);
    return { task: request.task, raw };
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function systemPrompt(task: CompletionRequest["task"], today?: string): string {
  if (task === "parse_report_filter") {
    return `You convert a natural-language report request into JSON with keys: module (finance|hr|procurement), status, overdue, open, minTotalMinor, maxTotalMinor, vendorContains, employeeNameContains, issueMonth, issueYear, type, explanation, confidence. Amounts are integer minor units (1 AED = 100). Today is ${today ?? "unknown"}. Return JSON only.`;
  }
  return `You extract invoice fields from messy text into JSON with keys: vendorName, issueDate (YYYY-MM-DD), dueDate, taxBps (500 = 5%), currency, notes, lines[{description, quantity, unitPriceMinor}], explanation, confidence. unitPriceMinor is integer minor units. Return JSON only.`;
}
