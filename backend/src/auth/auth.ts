import { Inject } from "@nestjs/common";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
  BadRequestException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { UserSchema } from "../persistence/schemas";
import { Role, User } from "../domain/model";
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export type Actor = Pick<User, "id" | "role" | "name" | "email">;
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error("Configure JWT_SECRET com pelo menos 32 caracteres.");
  return value;
}
@Injectable()
export class AuthService {
  private failures = new Map<string, { count: number; until: number }>();
  constructor(@Inject(DataSource) private readonly db: DataSource) {}
  async login(email: string, password: string) {
    const key = email.toLowerCase(),
      failure = this.failures.get(key);
    if (failure && failure.until > Date.now() && failure.count >= 8)
      throw new UnauthorizedException("Muitas tentativas. Aguarde 15 minutos.");
    const user = await this.db
      .getRepository(UserSchema)
      .findOneBy({ email: key });
    if (!user?.active || !verifyPassword(password, user.passwordHash)) {
      this.failures.set(key, {
        count: (failure && failure.until > Date.now() ? failure.count : 0) + 1,
        until: Date.now() + 900000,
      });
      throw new UnauthorizedException("Credenciais inválidas.");
    }
    this.failures.delete(key);
    const actor = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    return {
      token: jwt.sign({}, jwtSecret(), {
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
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    try {
      const decoded = jwt.verify(token ?? "", jwtSecret(), {
        algorithms: ["HS256"],
        issuer: "patrimonio",
      });
      if (typeof decoded === "string" || !decoded.sub) throw new Error();
      const user = await this.db
        .getRepository(UserSchema)
        .findOneBy({ id: decoded.sub });
      if (!user?.active) throw new Error();
      request.user = {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      };
    } catch {
      throw new UnauthorizedException("Faça login novamente.");
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
