import * as XLSX from "xlsx";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { secureHttp } from "../src/security";
import { hashPassword } from "../src/auth/auth";
import * as S from "../src/persistence/schemas";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite("Contrato HTTP e permissões", () => {
  let app: INestApplication, db: DataSource, admin: string, consulta: string;
  const adminEmail = `${randomUUID()}@example.org`,
    consultaEmail = `${randomUUID()}@example.org`;
  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      !new URL(process.env.TEST_DATABASE_URL).pathname.includes("test")
    )
      throw new Error("Banco de teste obrigatório.");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
    process.env.JOBS_ENABLED = "false";
    const { dataSource } = await import("../src/data-source");
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();
    const { AppModule } = await import("../src/app.module");
    app = await NestFactory.create(AppModule, {
      logger: false,
      bodyParser: false,
    });
    secureHttp(app);
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
  it("protege localização em lote e exige unidade na importação", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/assets/location-batch")
          .auth(consulta, { type: "bearer" })
          .send({ assets: [], locationId: randomUUID() })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/assets/location-batch")
          .auth(admin, { type: "bearer" })
          .send({ assets: [], locationId: randomUUID() })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/imports/preview")
          .auth(admin, { type: "bearer" })
          .attach("file", Buffer.from("invalid"), "test.xlsx")
      ).status,
    ).toBe(400);
  });
  it("protege e valida a vinculação de unidade em lote", async () => {
    for (const [token, status] of [
      [consulta, 403],
      [admin, 400],
    ] as const) {
      expect(
        (
          await request(app.getHttpServer())
            .post("/api/assets/unit-batch")
            .auth(token, { type: "bearer" })
            .send({ assets: [], unitId: randomUUID() })
        ).status,
      ).toBe(status);
    }
    const unit = await db.getRepository(S.UnitSchema).save({
      id: randomUUID(),
      code: randomUUID(),
      name: "Unidade HTTP",
      email: "unit@example.org",
      active: true,
    });
    const asset = (
      await request(app.getHttpServer())
        .post("/api/assets")
        .auth(admin, { type: "bearer" })
        .send({
          patrimony: randomUUID().slice(0, 20),
          uniqueCode: "http-unit",
          description: "Mesa",
          group: "Grupo",
          originUnit: "Original",
          incorporationDate: "2026-01-01",
          value: "10.00",
        })
        .expect(201)
    ).body;
    const result = await request(app.getHttpServer())
      .post("/api/assets/unit-batch")
      .auth(admin, { type: "bearer" })
      .send({
        assets: [{ id: asset.id, expectedVersion: asset.version }],
        unitId: unit.id,
      });
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ updated: 1, unchanged: 0 });
    expect(
      (await db.getRepository(S.AssetSchema).findOneByOrFail({ id: asset.id }))
        .unitId,
    ).toBe(unit.id);
  });
  it("restringe seleção global, histórico, confirmação e reversão", async () => {
    for (const path of [
      "/api/asset-batches/selection",
      "/api/asset-batches/preview",
      `/api/asset-batches/${randomUUID()}/apply`,
      `/api/asset-batches/${randomUUID()}/undo`,
    ]) {
      expect(
        (
          await request(app.getHttpServer())
            .post(path)
            .auth(consulta, { type: "bearer" })
            .send({})
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/asset-batches")
          .auth(consulta, { type: "bearer" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/asset-batches/selection")
          .auth(admin, { type: "bearer" })
          .send({ filters: { unitId: "none", locationId: "none" } })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/asset-batches/preview")
          .auth(admin, { type: "bearer" })
          .send({ field: "passwordHash", targetId: randomUUID(), filters: {} })
      ).status,
    ).toBe(400);
  });
  it("exporta relatórios filtrados em CSV, XLSX e ODS sem UUIDs internos", async () => {
    const patrimony = "REP-" + randomUUID().slice(0, 8);
    const create = await request(app.getHttpServer())
      .post("/api/assets")
      .auth(admin, { type: "bearer" })
      .send({
        patrimony,
        description: "Mesa de relatório",
        uniqueCode: "000007",
        group: "Grupo de relatório",
        originUnit: "270",
        incorporationDate: "2026-09-01",
        value: "199.99",
      });
    expect(create.status).toBe(201);
    const preview = await request(app.getHttpServer())
      .get("/api/reports/byLocation/preview")
      .query({ patrimony, dateFrom: "2026-09-01", dateTo: "2026-09-01" })
      .auth(consulta, { type: "bearer" });
    expect(preview.status).toBe(200);
    expect(preview.body.count).toBe(1);
    expect(preview.body.rows[0]).toContain("01/09/2026");
    expect(JSON.stringify(preview.body)).not.toContain(create.body.id);
    for (const format of ["csv", "xlsx", "ods"]) {
      const response = await request(app.getHttpServer())
        .get("/api/reports/byLocation")
        .query({ patrimony, format })
        .auth(consulta, { type: "bearer" })
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.from(c)));
          res.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(response.status).toBe(200);
      expect(response.headers["content-disposition"]).toContain("." + format);
      expect(response.headers["cache-control"]).toBe("no-store");
      if (format === "csv") {
        expect(response.body.toString("utf8")).toContain(patrimony);
        expect(response.body.toString("utf8")).not.toContain(create.body.id);
      } else {
        const book = XLSX.read(response.body, { type: "buffer" });
        expect(book.Sheets.Dados.A2.v).toBe(patrimony);
      }
    }
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/reports/byLocation")
          .query({ format: "zip" })
          .auth(admin, { type: "bearer" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/reports/movements/preview")
          .query({ dateFrom: "2026-10-15", dateTo: "2026-10-01" })
          .auth(admin, { type: "bearer" })
      ).status,
    ).toBe(400);
  });
  it("aplica permissões por tarefa, impede elevação e revoga sessões ao editar o acesso", async () => {
    const email = `custom-${randomUUID()}@example.org`;
    const created = await request(app.getHttpServer())
      .post("/api/users")
      .auth(admin, { type: "bearer" })
      .send({
        name: "Acesso específico",
        email,
        password: "custom-password-1234",
        role: "CONSULTA",
        permissions: ["assets.location", "batches.unit"],
      });
    expect(created.status).toBe(201);
    expect(created.body.permissions).toContain("assets.view");
    expect(created.body.permissions).not.toContain("reports.export");
    expect(created.body.passwordHash).toBeUndefined();
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: "custom-password-1234" });
    const token = login.body.token;
    expect(login.body.user.permissions).toContain("assets.location");
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/assets")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/assets/${randomUUID()}/location`)
          .auth(token, { type: "bearer" })
          .send({ expectedVersion: 1, locationId: randomUUID() })
      ).status,
    ).not.toBe(403);
    for (const path of [
      "/api/users",
      "/api/reports/byLocation",
      "/api/dashboard",
      "/api/settings",
    ]) {
      expect(
        (
          await request(app.getHttpServer())
            .get(path)
            .auth(token, { type: "bearer" })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/users/${created.body.id}`)
          .auth(token, { type: "bearer" })
          .send({ role: "ADMIN" })
      ).status,
    ).toBe(403);
    const loc = await db.getRepository(S.LocationSchema).save({
      id: randomUUID(),
      code: randomUUID(),
      description: "Sala de permissão",
      building: "",
      floor: "",
      notes: "",
      active: true,
    });
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/asset-batches/preview")
          .auth(token, { type: "bearer" })
          .send({ field: "locationId", targetId: loc.id, filters: {} })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/users/${created.body.id}`)
          .auth(admin, { type: "bearer" })
          .send({ permissions: ["unknown.permission"] })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/users/${created.body.id}`)
          .auth(admin, { type: "bearer" })
          .send({ permissions: [] })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/assets")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(401);
    const again = (
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email, password: "custom-password-1234" })
    ).body;
    expect(again.user.permissions).toEqual([]);
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/assets")
          .auth(again.token, { type: "bearer" })
      ).status,
    ).toBe(403);
    await request(app.getHttpServer())
      .patch(`/api/users/${created.body.id}`)
      .auth(admin, { type: "bearer" })
      .send({ permissions: null, role: "CONSULTA" });
    const reset = (
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email, password: "custom-password-1234" })
    ).body;
    expect(reset.user.permissions).toContain("reports.export");
  });
  it("protege o administrador principal inclusive contra outro administrador", async () => {
    const primary = await db
      .getRepository(S.UserSchema)
      .findOneByOrFail({ email: adminEmail });
    await db.query(
      'UPDATE users SET "primaryAdmin"=false WHERE "primaryAdmin"=true',
    );
    await db
      .getRepository(S.UserSchema)
      .update(primary.id, { primaryAdmin: true });
    const other = await db.getRepository(S.UserSchema).save({
      id: randomUUID(),
      name: "Outro admin",
      email: `other-${randomUUID()}@example.org`,
      role: "ADMIN",
      active: true,
      passwordHash: hashPassword("other-password-1234"),
    });
    const token = (
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: other.email, password: "other-password-1234" })
    ).body.token;
    for (const body of [
      { active: false },
      { role: "CONSULTA" },
      { permissions: [] },
      { password: "new-password-1234" },
    ])
      expect(
        (
          await request(app.getHttpServer())
            .patch(`/api/users/${primary.id}`)
            .auth(token, { type: "bearer" })
            .send(body)
        ).status,
      ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/users/${primary.id}`)
          .auth(admin, { type: "bearer" })
          .send({ permissions: [] })
      ).status,
    ).toBe(400);
    await expect(
      db.getRepository(S.UserSchema).update(primary.id, { active: false }),
    ).rejects.toThrow();
    const listed = (
      await request(app.getHttpServer())
        .get("/api/users")
        .auth(admin, { type: "bearer" })
    ).body;
    expect(listed.find((u: any) => u.id === primary.id).primaryAdmin).toBe(
      true,
    );
  });
  it("controla acesso à reaplicação de lote", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/asset-batches/${randomUUID()}/redo`)
          .auth(consulta, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/asset-batches/${randomUUID()}/events`)
          .auth(consulta, { type: "bearer" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/asset-batches/${randomUUID()}/redo`)
          .auth(admin, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(409);
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
  it("não expõe dados ou fotos sem autenticação e impede exportação administrativa", async () => {
    for (const route of [
      "assets",
      "reports/byLocation",
      "reports/movements",
      "photos/" + randomUUID(),
      "audit",
      "imports/template",
      "notifications",
    ]) {
      const response = await request(app.getHttpServer()).get("/api/" + route);
      expect(response.status).toBe(401);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["x-powered-by"]).toBeUndefined();
    }
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/audit")
          .auth(consulta, { type: "bearer" })
      ).status,
    ).toBe(403);
  });
  it("revoga tokens quando a senha é redefinida, mesmo se a conta for reativada", async () => {
    const repo = db.getRepository(S.UserSchema),
      user = await repo.findOneByOrFail({ email: consultaEmail });
    const response = await request(app.getHttpServer())
      .patch("/api/users/" + user.id)
      .auth(admin, { type: "bearer" })
      .send({ password: "nova-senha-123456" });
    expect(response.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/assets")
          .auth(consulta, { type: "bearer" })
      ).status,
    ).toBe(401);
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: consultaEmail, password: "nova-senha-123456" });
    const token = login.body.token;
    expect(token).toBeTruthy();
    await request(app.getHttpServer())
      .post("/api/auth/logout")
      .auth(token, { type: "bearer" })
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .get("/api/assets")
      .auth(token, { type: "bearer" })
      .expect(401);
  });
  it("limita tentativas em contas inexistentes e restringe multipart", async () => {
    const email = randomUUID() + "@example.org";
    for (let i = 0; i < 8; i++)
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email, password: "errada" })
        .expect(401);
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: "errada" })
      .expect(429);
    await request(app.getHttpServer())
      .post("/api/imports/preview")
      .auth(admin, { type: "bearer" })
      .field("unexpected", "value")
      .attach("file", Buffer.from("bad"), "bad.xlsx")
      .expect(400);
  });
});
