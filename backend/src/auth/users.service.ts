import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import * as S from "../persistence/schemas";
import { Actor } from "./auth";
import { Permission, normalizePermissions } from "./permissions";
import { hashPasswordAsync } from "./passwords";

type UserAccessChange = {
  active?: boolean;
  role?: "ADMIN" | "PATRIMONIAL" | "CONSULTA";
  permissions?: Permission[] | null;
  password?: string;
};

@Injectable()
export class UsersService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}
  list() {
    return this.db.getRepository(S.UserSchema).find({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        permissions: true,
        primaryAdmin: true,
      },
      order: { name: "ASC" },
    });
  }
  async create(input: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "PATRIMONIAL" | "CONSULTA";
    permissions?: Permission[] | null;
  }) {
    const user = await this.db.getRepository(S.UserSchema).save({
      id: randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPasswordAsync(input.password),
      role: input.role,
      permissions: input.permissions
        ? normalizePermissions(input.permissions)
        : null,
      active: true,
    });
    const { passwordHash, ...safe } = user;
    return safe;
  }
  async update(id: string, input: UserAccessChange, actor: Actor) {
    if (
      id === actor.id &&
      (input.active === false || (input.role && input.role !== "ADMIN"))
    )
      throw new BadRequestException(
        "Não remova seu próprio acesso administrativo.",
      );
    const { password, ...fields } = input;
    const targetId = id;
    const passwordHash = password
      ? await hashPasswordAsync(password)
      : undefined;
    // A alteração do acesso e a revogação das sessões precisam ser gravadas juntas.
    return this.db.transaction(async (manager) => {
      const target = await manager.getRepository(S.UserSchema).findOne({
        where: { id: targetId },
        lock: { mode: "pessimistic_write" },
      });
      if (!target) throw new BadRequestException("Usuário não encontrado.");
      if (
        target.primaryAdmin &&
        (actor.id !== targetId ||
          input.active === false ||
          (input.role && input.role !== "ADMIN") ||
          input.permissions !== undefined)
      )
        throw new BadRequestException(
          "O administrador principal mantém acesso global. Somente ele pode alterar sua própria senha.",
        );
      const result = await manager
        .getRepository(S.UserSchema)
        .update(targetId, {
          ...fields,
          ...(fields.permissions
            ? { permissions: normalizePermissions(fields.permissions) }
            : {}),
          ...(passwordHash ? { passwordHash } : {}),
        });
      await manager
        .getRepository(S.UserSchema)
        .increment({ id: targetId }, "tokenVersion", 1);
      return result;
    });
  }
}
