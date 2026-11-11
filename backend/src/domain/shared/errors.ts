export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "PRECONDITION"
  | "UNSUPPORTED";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
    this.httpStatus = statusFor(code);
  }
}

function statusFor(code: ErrorCode): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "PRECONDITION":
      return 412;
    case "UNSUPPORTED":
      return 422;
  }
}

export function required(value: string | undefined, field: string): string {
  const v = value?.trim() ?? "";
  if (!v) throw new DomainError("VALIDATION", `${field} is required`);
  return v;
}
