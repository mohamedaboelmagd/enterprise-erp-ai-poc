import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DomainError } from "../domain/shared/errors";
import type { Actor } from "../domain/shared/actor";
import type { Role } from "../domain/identity/permissions";

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  displayName: string;
  title?: string;
  roles: Role[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string }; actor?: Actor }>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new DomainError("UNAUTHORIZED", "Missing bearer token");
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      req.actor = {
        id: payload.sub,
        tenantId: payload.tenantId,
        email: payload.email,
        displayName: payload.displayName,
        title: payload.title,
        roles: payload.roles,
      };
      return true;
    } catch {
      throw new DomainError("UNAUTHORIZED", "Invalid or expired token");
    }
  }
}

export function actorOf(req: { actor?: Actor }): Actor {
  if (!req.actor) throw new DomainError("UNAUTHORIZED", "Not authenticated");
  return req.actor;
}
