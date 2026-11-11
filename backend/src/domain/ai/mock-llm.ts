import { DomainError } from "../shared/errors";
import { parseMajorToMinor } from "../shared/money";
import type {
  CompletionRequest,
  CompletionResponse,
  ExtractedInvoice,
  LlmProvider,
  ReportFilter,
} from "./schema";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Deterministic, offline provider. No network, no keys. The same prompt always
 * yields the same structured result so tests and the hosted demo stay stable.
 * A production deployment can swap this for an on-prem or vendor endpoint.
 */
export class MockLlmProvider implements LlmProvider {
  readonly id = "mock";
  readonly remote = false;

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (request.task === "parse_report_filter") {
      return { task: request.task, raw: parseReportFilter(request.input, request.today) };
    }
    if (request.task === "extract_invoice_fields") {
      return { task: request.task, raw: extractInvoice(request.input) };
    }
    throw new DomainError("UNSUPPORTED", `Unknown AI task ${(request as CompletionRequest).task}`);
  }
}

export function parseReportFilter(input: string, today?: string): ReportFilter {
  const text = input.trim();
  if (!text) throw new DomainError("VALIDATION", "Ask the assistant a question first");
  const lower = text.toLowerCase();

  const module = detectModule(lower);
  const filter: ReportFilter = { module, explanation: "", confidence: 0.9 };

  if (/\boverdue\b|\bpast due\b|\blate\b/.test(lower)) filter.overdue = true;
  if (/\bopen\b|\boutstanding\b/.test(lower) && module === "procurement") filter.open = true;

  const status = detectStatus(lower, module);
  if (status) filter.status = status;

  const min = amountAfter(lower, /\b(?:over|above|greater than|more than|at least|min(?:imum)?)\b/);
  if (min !== undefined) filter.minTotalMinor = min;
  const max = amountAfter(lower, /\b(?:under|below|less than|up to|max(?:imum)?)\b/);
  if (max !== undefined) filter.maxTotalMinor = max;

  const month = detectMonth(lower);
  if (month) {
    filter.issueMonth = month;
    const yearMatch = lower.match(/\b(20\d{2})\b/);
    if (yearMatch) filter.issueYear = Number(yearMatch[1]);
    else if (today) filter.issueYear = Number(today.slice(0, 4));
  } else if (/\bthis month\b/.test(lower) && today) {
    filter.issueMonth = Number(today.slice(5, 7));
    filter.issueYear = Number(today.slice(0, 4));
  }

  const vendor = text.match(/\b(?:from|for vendor|vendor)\s+([A-Z][\w&.\s-]{1,60}?)(?:\s+(?:in|over|under|above|dated)|[.?,]|$)/);
  if (vendor && module !== "hr") filter.vendorContains = vendor[1].trim();

  const employee = text.match(/\b(?:for|by|employee)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (employee && module === "hr") filter.employeeNameContains = employee[1].trim();

  if (/\bsick\b/.test(lower)) filter.type = "sick";
  else if (/\bunpaid\b/.test(lower)) filter.type = "unpaid";
  else if (/\bannual\b|\bvacation\b|\bholiday\b/.test(lower)) filter.type = "annual";

  filter.explanation = explain(filter, text);
  if (!hasSignal(filter)) {
    filter.confidence = 0.4;
    filter.explanation =
      `I treated this as a ${module} listing, but I could not pick out a status, amount or date. Try e.g. "overdue invoices over 5000 in November".`;
  }
  return filter;
}

export function extractInvoice(input: string): ExtractedInvoice {
  const text = input.trim();
  if (!text) throw new DomainError("VALIDATION", "Paste the invoice text first");

  const vendor =
    match(text, /invoice\s+from\s+(.+?)(?=\s+dated|\s+due\b|\s+on\b|,|\n)/i) ??
    match(text, /vendor(?:\s*name)?\s*[:\-]\s*(.+)$/im) ??
    match(text, /\bfrom\s+(.+?)(?=\s+dated|\s+due\b|,|\n)/i);
  if (!vendor) {
    throw new DomainError("UNSUPPORTED", "Could not find a vendor name. Include a line such as 'Invoice from Cedar Maintenance Group'.");
  }

  const issueDate = match(text, /(?:dated|issue(?:d)?(?:\s+date)?|date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i);
  const dueDate = match(text, /(?:due(?:\s+(?:on|date))?)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i);

  let taxBps: number | undefined;
  const taxPct = text.match(/(?:vat|tax|gst)\s*[:\-]?\s*(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (taxPct) taxBps = Math.round(Number(taxPct[1]) * 100);

  const lines: ExtractedInvoice["lines"] = [];
  const labeled = text.split(/\bLine\s*\d*\s*[:\-]?\s*/i).slice(1);
  const chunks = labeled.length > 0 ? labeled : [text];
  for (const chunk of chunks) {
    const lineMatch = chunk.match(/^\s*(.+?)\s+x\s*(\d+)\s*@\s*(?:AED\s*)?([\d,]+(?:\.\d{1,2})?)/i);
    if (!lineMatch) continue;
    const unit = parseMajorToMinor(lineMatch[3]);
    if (unit === undefined) continue;
    const description = lineMatch[1].replace(/^[-•*\d.\s]+/, "").trim();
    if (!description) continue;
    lines.push({ description, quantity: Number(lineMatch[2]), unitPriceMinor: unit });
  }

  if (lines.length === 0) {
    throw new DomainError(
      "UNSUPPORTED",
      "Could not find line items. Use the form 'Generator maintenance x1 @ 12500.00'.",
    );
  }

  const currency = /AED/i.test(text) ? "AED" : undefined;
  return {
    vendorName: tidyVendor(vendor),
    issueDate: issueDate || undefined,
    dueDate: dueDate || undefined,
    taxBps,
    currency,
    lines,
    explanation: `Extracted ${lines.length} line${lines.length === 1 ? "" : "s"} from ${tidyVendor(vendor)}.`,
    confidence: 0.95,
  };
}

function detectModule(lower: string): ReportFilter["module"] {
  if (/\bleave\b|\bhr\b|\bholiday\b|\bvacation\b|\bemployee\b/.test(lower)) return "hr";
  if (/\bpurchase order|\bpurchase-order|\b\bpos\b|\bprocurement\b|\bpo\b/.test(lower)) return "procurement";
  if (/\binvoice|\bfinance|\bpayable|\boverdue|\bpayment/.test(lower)) return "finance";
  // default: invoices are the most common report in this demo
  return "finance";
}

function detectStatus(lower: string, module: ReportFilter["module"]): string | string[] | undefined {
  if (/\bpending approval\b|\bawaiting approval\b|\bto approve\b|\bpending\b/.test(lower)) return "submitted";
  if (/\bdraft\b/.test(lower)) return "draft";
  if (/\brejected\b/.test(lower)) return "rejected";
  if (/\bpaid\b/.test(lower)) return "paid";
  if (/\bissued\b/.test(lower)) return "issued";
  if (/\bapproved\b/.test(lower)) return "approved";
  if (module === "procurement" && /\bopen\b/.test(lower)) return ["draft", "submitted", "approved"];
  return undefined;
}

function amountAfter(lower: string, verb: RegExp): number | undefined {
  const re = new RegExp(verb.source + String.raw`\s*(?:of\s*)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)`, "i");
  const m = lower.match(re);
  if (!m) return undefined;
  return parseMajorToMinor(m[1]);
}

function detectMonth(lower: string): number | undefined {
  const iso = lower.match(/\b(20\d{2})-(\d{2})\b/);
  if (iso) return Number(iso[2]);
  for (const [name, n] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return n;
  }
  return undefined;
}

function explain(filter: ReportFilter, original: string): string {
  const bits: string[] = [`${filter.module} report`];
  if (filter.overdue) bits.push("overdue only");
  if (filter.status) bits.push(`status ${Array.isArray(filter.status) ? filter.status.join("/") : filter.status}`);
  if (filter.minTotalMinor !== undefined) bits.push(`minimum ${filter.minTotalMinor / 100}`);
  if (filter.maxTotalMinor !== undefined) bits.push(`maximum ${filter.maxTotalMinor / 100}`);
  if (filter.issueMonth) bits.push(`month ${filter.issueMonth}${filter.issueYear ? " " + filter.issueYear : ""}`);
  if (filter.vendorContains) bits.push(`vendor contains "${filter.vendorContains}"`);
  if (filter.employeeNameContains) bits.push(`employee contains "${filter.employeeNameContains}"`);
  return `From “${original.trim()}”: ${bits.join(", ")}.`;
}

function hasSignal(filter: ReportFilter): boolean {
  return Boolean(
    filter.overdue ||
      filter.status ||
      filter.open ||
      filter.minTotalMinor !== undefined ||
      filter.maxTotalMinor !== undefined ||
      filter.issueMonth ||
      filter.vendorContains ||
      filter.employeeNameContains ||
      filter.type,
  );
}

function match(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1]?.trim();
}

function tidyVendor(raw: string): string {
  return raw.replace(/[,.]+$/, "").replace(/\s+/g, " ").trim();
}
