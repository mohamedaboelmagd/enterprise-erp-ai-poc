import type { Actor } from "../shared/actor";
import { DomainError } from "../shared/errors";
import { assertCan } from "./permissions";
import { verifyPassword } from "./passwords";
import { toPublicUser, type PublicUser, type User } from "./user";
import type { TenantRepository, UserRepository } from "../ports";

export class IdentityService {
  constructor(
    private readonly users: UserRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async authenticate(email: string, password: string): Promise<User> {
    const user = await this.users.getByEmail(email.trim());
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      throw new DomainError("UNAUTHORIZED", "Invalid email or password");
    }
    return user;
  }

  actorFrom(user: User): Actor {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      title: user.title,
      roles: [...user.roles],
    };
  }

  async me(actor: Actor): Promise<PublicUser & { tenantName?: string }> {
    const user = await this.users.getById(actor.id);
    if (!user) throw new DomainError("NOT_FOUND", "User not found");
    const tenant = await this.tenants.get(user.tenantId);
    return { ...toPublicUser(user), tenantName: tenant?.name };
  }

  async listUsers(actor: Actor): Promise<PublicUser[]> {
    assertCan(actor, "admin:users");
    return (await this.users.listByTenant(actor.tenantId)).map(toPublicUser);
  }
}
