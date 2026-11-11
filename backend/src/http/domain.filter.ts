import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";
import { DomainError } from "../domain/shared/errors";

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger("DomainExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof DomainError) {
      res.status(exception.httpStatus).json({
        error: exception.code,
        message: exception.message,
        details: exception.details,
      });
      return;
    }
    if (exception instanceof ZodError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "VALIDATION",
        message: "Request validation failed",
        details: exception.issues,
      });
      return;
    }
    const anyErr = exception as { status?: number; message?: string; name?: string };
    if (typeof anyErr?.status === "number" && anyErr.status >= 400 && anyErr.status < 600) {
      res.status(anyErr.status).json({ error: anyErr.name ?? "HTTP", message: anyErr.message });
      return;
    }
    this.log.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "INTERNAL", message: "Unexpected error" });
  }
}
