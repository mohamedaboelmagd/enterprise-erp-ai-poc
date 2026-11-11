import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { z } from "zod";
import { IdentityService } from "../domain/identity/identity.service";
import { IDENTITY } from "./tokens";
import { AuthGuard, actorOf, type JwtPayload } from "./auth.guard";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(IDENTITY) private readonly identity: IdentityService,
    private readonly jwt: JwtService,
  ) {}

  @Post("login")
  async login(@Body() body: unknown) {
    const { email, password } = loginSchema.parse(body);
    const user = await this.identity.authenticate(email, password);
    const actor = this.identity.actorFrom(user);
    const payload: JwtPayload = {
      sub: actor.id,
      tenantId: actor.tenantId,
      email: actor.email,
      displayName: actor.displayName,
      title: actor.title,
      roles: actor.roles,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: { ...payload, id: actor.id } };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() req: { actor?: import("../domain/shared/actor").Actor }) {
    return this.identity.me(actorOf(req));
  }
}
