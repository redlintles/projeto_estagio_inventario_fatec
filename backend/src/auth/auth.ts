import { Inject } from "@nestjs/common";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { randomBytes, createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { UserSchema } from "../persistence/schemas";
import { Role, User } from "../domain/model";
import {
  hashPassword,
  verifyPasswordAsync,
  hashPasswordAsync,
} from "./passwords";
export { hashPassword, verifyPassword } from "./passwords";
import { AttemptLimiter } from "./rate-limit";
import { effectivePermissions, Permission } from "./permissions";
export const RequireAnyPermissions = (...permissions: Permission[]) =>
  SetMetadata("anyPermissions", permissions);
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata("permissions", permissions);
const dummyHash = hashPassword(randomBytes(32).toString("hex"));
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export type Actor = Pick<User, "id" | "role" | "name" | "email"> & {
  permissions?: Permission[];
  primaryAdmin?: boolean;
};
export function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error("Configure JWT_SECRET com pelo menos 32 caracteres.");
  return value;
}
@Injectable()
export class AuthService {
  private limiter = new AttemptLimiter();
  constructor(@Inject(DataSource) private readonly db: DataSource) {}
  async login(email: string, password: string, remoteAddress = "local") {
    const normalizedEmail = email.toLowerCase();
    const accountKey =
      "account:" + createHash("sha256").update(normalizedEmail).digest("hex");
    this.limiter.take("ip:" + remoteAddress, 40, 60000);
    this.limiter.take(accountKey, 8, 900000);
    const user = await this.db.getRepository(UserSchema).findOne({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        primaryAdmin: true,
        active: true,
        passwordHash: true,
        tokenVersion: true,
      },
    });
    const validPassword = await verifyPasswordAsync(
      password,
      user?.passwordHash ?? dummyHash,
    );
    if (!user?.active || !validPassword) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }
    if (!user.passwordHash.startsWith("scrypt-v2:")) {
      const passwordHash = await hashPasswordAsync(password);
      // Uma troca de senha simultânea não pode ser sobrescrita pelo login antigo.
      const upgraded = await this.db.getRepository(UserSchema).update(
        {
          id: user.id,
          passwordHash: user.passwordHash,
          tokenVersion: user.tokenVersion ?? 0,
          active: true,
        },
        { passwordHash },
      );
      if (!upgraded.affected)
        throw new UnauthorizedException("Faça login novamente.");
    }
    this.limiter.clear(accountKey);
    const actor = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: effectivePermissions(user),
      primaryAdmin: user.primaryAdmin,
    };
    return {
      token: jwt.sign({ ver: user.tokenVersion ?? 0 }, jwtSecret(), {
        subject: user.id,
        expiresIn: "8h",
        algorithm: "HS256",
        issuer: "patrimonio",
      }),
      user: actor,
    };
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.get<boolean>("public", context.getHandler()))
      return true;
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    const token =
      typeof authorization === "string" &&
      authorization.length < 4096 &&
      authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";
    try {
      const decoded = jwt.verify(token ?? "", jwtSecret(), {
        algorithms: ["HS256"],
        issuer: "patrimonio",
      });
      if (typeof decoded === "string" || !decoded.sub) throw new Error();
      const user = await this.db.getRepository(UserSchema).findOne({
        where: { id: decoded.sub },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          primaryAdmin: true,
          active: true,
          tokenVersion: true,
        },
      });
      if (!user?.active || decoded.ver !== (user.tokenVersion ?? 0))
        throw new Error();
      request.user = {
        id: user.id,
        role: user.role,
        permissions: effectivePermissions(user),
        primaryAdmin: user.primaryAdmin,
        name: user.name,
        email: user.email,
      };
    } catch {
      throw new UnauthorizedException("Faça login novamente.");
    }
    const any = this.reflector.getAllAndOverride<Permission[]>(
      "anyPermissions",
      [context.getHandler(), context.getClass()],
    );
    if (any && !any.some((p) => request.user.permissions.includes(p)))
      throw new ForbiddenException("Você não tem permissão para esta tarefa.");
    const required = this.reflector.getAllAndOverride<Permission[]>(
      "permissions",
      [context.getHandler(), context.getClass()],
    );
    if (required) {
      if (!required.every((p) => request.user.permissions.includes(p)))
        throw new ForbiddenException(
          "Você não tem permissão para esta tarefa.",
        );
      return true;
    }
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      roles &&
      request.user.role !== "ADMIN" &&
      !roles.includes(request.user.role)
    )
      throw new ForbiddenException("Seu perfil não permite esta operação.");
    return true;
  }
}
