import { randomUUID } from "node:crypto";
import { dataSource } from "./data-source";
import { UserSchema } from "./persistence/schemas";
import { hashPassword } from "./auth/auth";
async function bootstrap() {
  const email = process.env.BOOTSTRAP_EMAIL?.toLowerCase(),
    password = process.env.BOOTSTRAP_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Configure BOOTSTRAP_EMAIL e BOOTSTRAP_PASSWORD (mínimo 12 caracteres).",
    );
  await dataSource.initialize();
  try {
    if (await dataSource.getRepository(UserSchema).countBy({ role: "ADMIN" }))
      throw new Error("Já existe administrador. Use a gestão de usuários.");
    await dataSource.getRepository(UserSchema).insert({
      id: randomUUID(),
      name: "Administrador",
      email,
      passwordHash: hashPassword(password),
      role: "ADMIN",
      active: true,
    });
    console.log("Administrador criado. Remova BOOTSTRAP_PASSWORD do ambiente.");
  } finally {
    await dataSource.destroy();
  }
}
void bootstrap();
