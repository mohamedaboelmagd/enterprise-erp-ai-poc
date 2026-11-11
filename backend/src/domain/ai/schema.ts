import { z } from "zod";

export const reportFilterSchema = z.object({
  module: z.enum(["finance", "hr", "procurement"]),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  overdue: z.boolean().optional(),
  open: z.boolean().optional(),
  minTotalMinor: z.number().int().nonnegative().optional(),
  maxTotalMinor: z.number().int().nonnegative().optional(),
  vendorContains: z.string().min(1).optional(),
  employeeNameContains: z.string().min(1).optional(),
  issueMonth: z.number().int().min(1).max(12).optional(),
  issueYear: z.number().int().min(2000).max(2100).optional(),
  type: z.string().optional(),
  explanation: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1),
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

export const extractedInvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
});

export const extractedInvoiceSchema = z.object({
  vendorName: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taxBps: z.number().int().min(0).max(10_000).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(extractedInvoiceLineSchema).min(1),
  explanation: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

export type LlmTask = "parse_report_filter" | "extract_invoice_fields";

export interface CompletionRequest {
  task: LlmTask;
  input: string;
  today?: string;
}

export interface CompletionResponse {
  task: LlmTask;
  raw: unknown;
}

export interface LlmProvider {
  readonly id: string;
  /** True when calls leave the local process (network). */
  readonly remote: boolean;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
