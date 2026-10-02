import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/auth/auth";
import * as S from "../src/persistence/schemas";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite("Contrato HTTP e permissões", () => {
  let app: INestApplication, db: DataSource, admin: string, consulta: string;
  const adminEmail = `${randomUUID()}@example.org`,
    consultaEmail = `${randomUUID()}@example.org`;
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
    process.env.JOBS_ENABLED = "false";
    const { dataSource } = await import("../src/data-source");
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();
    const { AppModule } = await import("../src/app.module");
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");
    await app.init();
    db = app.get(DataSource);
    for (const [email, role] of [
      [adminEmail, "ADMIN"],
      [consultaEmail, "CONSULTA"],
    ] as const)
      await db.getRepository(S.UserSchema).save({
        id: randomUUID(),
        name: "Teste HTTP",
        email,
        passwordHash: hashPassword("senha-123456789"),
        role,
        active: true,
      });
    admin = (
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "senha-123456789" })
    ).body.token;
    consulta = (
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: consultaEmail, password: "senha-123456789" })
    ).body.token;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db?.isInitialized) await db.destroy();
  });
  it("nega acesso sem token e alteração para perfil de consulta", async () => {
    expect((await request(app.getHttpServer()).get("/api/assets")).status).toBe(
      401,
    );
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/assets")
          .auth(consulta, { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/locations")
          .auth(consulta, { type: "bearer" })
          .send({ code: "x", description: "Sala" })
      ).status,
    ).toBe(403);
  });
  it("valida dados e recusa UUID inválido", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/assets")
          .auth(admin, { type: "bearer" })
          .send({ description: "Sem campos obrigatórios" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/assets/invalid")
          .auth(admin, { type: "bearer" })
      ).status,
    ).toBe(400);
  });
  it("não expõe hash na listagem de usuários", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/users")
      .auth(admin, { type: "bearer" });
    expect(response.status).toBe(200);
    expect(
      response.body.every(
        (u: Record<string, unknown>) => !("passwordHash" in u),
      ),
    ).toBe(true);
  });
  it("serve modelo de planilha e health", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/imports/template")
          .auth(admin, { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(
      (await request(app.getHttpServer()).get("/api/health")).body.status,
    ).toBe("ok");
  });
});
