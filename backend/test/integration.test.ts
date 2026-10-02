import nodemailer from "nodemailer";
import { JobsService } from "../src/notifications/jobs.service";
import { SettingSchema } from "../src/persistence/schemas";
import "reflect-metadata";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import {
  schemas,
  UserSchema,
  LocationSchema,
  UnitSchema,
  AssetSchema,
  PhotoSchema,
  ReservationSchema,
  DivergenceSchema,
  MovementSchema,
  OutboxSchema,
} from "../src/persistence/schemas";
import { Initial1780000000000 } from "../src/persistence/migration";
import { AssetsService } from "../src/assets/assets.service";
import { InventoryService } from "../src/inventory/inventory.service";
import { ImportsService } from "../src/imports/imports.service";
import { AuthService, hashPassword, Actor } from "../src/auth/auth";
import * as XLSX from "xlsx";
import { FilesService } from "../src/files/files.service";
import { readFile, unlink } from "node:fs/promises";
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite("Integração PostgreSQL — banco exclusivo de teste", () => {
  let db: DataSource,
    assets: AssetsService,
    inventory: InventoryService,
    imports: ImportsService;
  const actor: Actor = {
    id: randomUUID(),
    name: "Teste",
    email: "teste@fatec.local",
    role: "ADMIN",
  };
  const locationId = randomUUID(),
    otherLocation = randomUUID(),
    unitId = randomUUID();
  async function create(n: string) {
    return assets.create(
      {
        patrimony: n,
        uniqueCode: `barcode-${n}`,
        description: "Mesa",
        group: "Mobiliário",
        originUnit: "FATEC",
        incorporationDate: "2026-09-01",
        value: "125.50",
      },
      actor,
    );
  }
  beforeAll(async () => {
    if (!databaseUrl?.includes("test"))
      throw new Error(
        "TEST_DATABASE_URL deve conter test para evitar uso acidental de produção.",
      );
    db = new DataSource({
      type: "postgres",
      url: databaseUrl,
      entities: schemas,
      migrations: [Initial1780000000000],
      synchronize: false,
    });
    await db.initialize();
    await db.runMigrations();
    await db.query(
      "TRUNCATE users,locations,units,assets,reservations,movements,inventories,inventory_items,divergences,photos,outbox,import_batches,sync_receipts CASCADE",
    );
    assets = new AssetsService(db);
    inventory = new InventoryService(db, assets);
    imports = new ImportsService(db, assets);
    await db.getRepository(UserSchema).save({
      ...actor,
      passwordHash: hashPassword("teste-123456789"),
      active: true,
    });
    for (const id of [locationId, otherLocation])
      await db.getRepository(LocationSchema).save({
        id,
        code: id,
        description: "Sala",
        building: "A",
        floor: "1",
        notes: "",
        active: true,
      });
    await db.getRepository(UnitSchema).save({
      id: unitId,
      code: "DEST",
      name: "Outra unidade",
      email: "destino@example.org",
      active: true,
    });
  }, 30000);
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it("reenvia foto com o mesmo UUID sem duplicar e rejeita conteúdo diferente", async () => {
    const asset = await create("photo-test");
    process.env.UPLOAD_DIR = "/tmp/fatec-photos-test";
    const files = new FilesService(db, assets),
      uploadId = randomUUID();
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    const file = {
      buffer,
      size: buffer.length,
      originalname: "foto.jpg",
    } as Express.Multer.File;
    const first = await files.upload(
      asset.id,
      undefined,
      file,
      actor,
      uploadId,
    );
    const again = await files.upload(
      asset.id,
      undefined,
      file,
      actor,
      uploadId,
    );
    expect(again.id).toBe(first.id);
    expect(
      await db.getRepository(PhotoSchema).countBy({ assetId: asset.id }),
    ).toBe(1);
    await expect(
      files.upload(
        asset.id,
        undefined,
        { ...file, buffer: Buffer.from([0xff, 0xd8, 0xff, 9]) },
        actor,
        uploadId,
      ),
    ).rejects.toThrow();
    const { path } = await files.get(first.id);
    expect(await readFile(path)).toEqual(buffer);
    await unlink(path);
  });
  it("filtra grupo e patrimônio e pagina sem perder registros", async () => {
    await create("page-01");
    await create("page-02");
    const first = await assets.list({
      patrimony: "page-",
      group: "Mobiliário",
      limit: "1",
      offset: "0",
    });
    const second = await assets.list({
      patrimony: "page-",
      group: "Mobiliário",
      limit: "1",
      offset: "1",
    });
    expect(first[0].patrimony).toBe("page-01");
    expect(second[0].patrimony).toBe("page-02");
    await expect(assets.list({ limit: "-1" })).rejects.toThrow();
  });
  it("autentica e recusa usuário inativo", async () => {
    process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
    const auth = new AuthService(db);
    expect((await auth.login(actor.email, "teste-123456789")).user.id).toBe(
      actor.id,
    );
    await expect(auth.login(actor.email, "errada")).rejects.toThrow();
  });
  it("não altera localização em divergência e aceita reenvio offline exatamente uma vez", async () => {
    const asset = await create("001");
    await assets.locate(asset.id, asset.version, locationId, actor);
    const updated = await assets.detail(asset.id);
    const session = await inventory.start(otherLocation, actor);
    const input = {
      assetId: asset.id,
      expectedVersion: updated.version,
      observedAt: new Date().toISOString(),
      divergence: {
        type: "WRONG_LOCATION" as const,
        foundDescription: "Mesa",
        notes: "Encontrada em outra sala",
      },
    };
    const operationId = randomUUID();
    const [first, second] = await Promise.all([
      inventory.sync(operationId, session.id, input, actor),
      inventory.sync(operationId, session.id, input, actor),
    ]);
    expect((first as { asset: { id: string } }).asset.id).toBe(
      (second as { asset: { id: string } }).asset.id,
    );
    expect((await assets.detail(asset.id)).locationId).toBe(locationId);
    expect(
      await db.getRepository(DivergenceSchema).countBy({ assetId: asset.id }),
    ).toBe(1);
    await expect(
      inventory.sync(
        operationId,
        session.id,
        { ...input, observedAt: "2026-09-01T12:00:00Z" },
        actor,
      ),
    ).rejects.toThrow();
  });
  it("corrige localização somente após conferência explícita e detecta conflitos", async () => {
    const asset = await create("002");
    const session = await inventory.start(locationId, actor);
    await inventory.onlineScan(
      session.id,
      {
        assetId: asset.id,
        expectedVersion: 1,
        observedAt: new Date().toISOString(),
      },
      actor,
    );
    expect((await assets.detail(asset.id)).locationId).toBe(locationId);
    await expect(
      assets.locate(asset.id, 1, otherLocation, actor),
    ).rejects.toThrow();
    await inventory.close(session.id, actor);
    await expect(
      inventory.onlineScan(
        session.id,
        {
          assetId: asset.id,
          expectedVersion: 2,
          observedAt: new Date().toISOString(),
        },
        actor,
      ),
    ).rejects.toThrow();
  });
  it("suspende prazo reservado, reinicia ao cancelar e conclui somente após transporte", async () => {
    const asset = await create("003");
    await db.getRepository(PhotoSchema).save({
      id: randomUUID(),
      assetId: asset.id,
      eventId: null,
      filename: "teste.jpg",
      mimeType: "image/jpeg",
      originalName: "teste.jpg",
      userId: actor.id,
      createdAt: new Date(),
    });
    await assets.available(asset.id, 1, 4, actor);
    await db
      .getRepository(AssetSchema)
      .update(asset.id, { availableAt: new Date("2026-01-01") });
    const reserved = await assets.reserve(asset.id, 2, unitId, actor);
    await assets.expire();
    expect((await assets.detail(asset.id)).status).toBe("D");
    await expect(
      assets.reservation(reserved.id, "complete", 3, actor),
    ).rejects.toThrow();
    await assets.reservation(reserved.id, "cancel", 3, actor);
    expect(
      (await assets.detail(asset.id)).availableAt!.getTime(),
    ).toBeGreaterThan(Date.now() - 5000);
    const second = await assets.reserve(asset.id, 4, unitId, actor);
    await assets.reservation(second.id, "dispatch", 5, actor);
    await assets.reservation(second.id, "complete", 6, actor);
    expect((await assets.detail(asset.id)).status).toBe("T");
    expect(
      await db.getRepository(ReservationSchema).countBy({ assetId: asset.id }),
    ).toBe(2);
  });
  it("muda para a baixar e preserva o ativo após baixa definitiva", async () => {
    const asset = await create("004");
    await db.getRepository(PhotoSchema).save({
      id: randomUUID(),
      assetId: asset.id,
      eventId: null,
      filename: "teste.jpg",
      mimeType: "image/jpeg",
      originalName: "teste.jpg",
      userId: actor.id,
      createdAt: new Date(),
    });
    await assets.available(asset.id, 1, 1, actor);
    await db
      .getRepository(AssetSchema)
      .update(asset.id, { availableAt: new Date("2026-01-01") });
    await assets.expire();
    expect((await assets.detail(asset.id)).status).toBe("B");
    await assets.writeOff(
      [{ id: asset.id, expectedVersion: 3 }],
      "Autorização registrada",
      actor,
    );
    expect((await assets.detail(asset.id)).status).toBe("X");
    await expect(
      assets.locate(asset.id, 4, locationId, actor),
    ).rejects.toThrow();
    expect(
      await db.getRepository(OutboxSchema).countBy({ assetId: asset.id }),
    ).toBe(2);
  });
  it("resolve reimportação por campo sem perder localização e rejeita prévia obsoleta", async () => {
    const asset = await create("005");
    await assets.locate(asset.id, 1, locationId, actor);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          nro_patrimonio: "005",
          descricao_bem: "Mesa atualizada",
          grupo_patrimonial: "Outro grupo",
          codigo_unico: "barcode-005",
          unidade_origem: "FATEC",
          data_incorporacao: "2026-09-01",
          valor_bem: "125.50",
        },
      ]),
      "Ativos",
    );
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const batch = await imports.preview(buffer, "teste.xlsx", actor);
    await imports.apply(
      batch.id,
      [{ line: 2, action: "APPLY", fields: ["description"] }],
      actor,
    );
    const detail = await assets.detail(asset.id);
    expect(detail.description).toBe("Mesa atualizada");
    expect(detail.group).toBe("Mobiliário");
    expect(detail.locationId).toBe(locationId);
    const stale = await imports.preview(buffer, "teste.xlsx", actor);
    await assets.locate(asset.id, detail.version, otherLocation, actor);
    await expect(
      imports.apply(
        stale.id,
        [{ line: 2, action: "APPLY", fields: ["group"] }],
        actor,
      ),
    ).rejects.toThrow();
    expect(
      await db.getRepository(MovementSchema).countBy({ assetId: asset.id }),
    ).toBeGreaterThan(2);
  });
  it("rollback da baixa em lote preserva todos se um estado for inválido", async () => {
    const one = await create("006"),
      two = await create("007");
    await db.getRepository(AssetSchema).update(one.id, { status: "B" });
    await expect(
      assets.writeOff(
        [
          { id: one.id, expectedVersion: 1 },
          { id: two.id, expectedVersion: 1 },
        ],
        "Baixa em lote",
        actor,
      ),
    ).rejects.toThrow();
    expect((await assets.detail(one.id)).status).toBe("B");
  });
  it("preserva notificação após falha SMTP e confirma somente depois do envio", async () => {
    await db.getRepository(SettingSchema).save([
      { name: "EMAIL_CPS", value: "cps@example.org" },
      { name: "EMAIL_DISPONIBILIZACAO", value: "destino@example.org" },
    ]);
    const sendMail = vi
      .fn()
      .mockRejectedValueOnce(new Error("SMTP indisponível"))
      .mockResolvedValue({});
    const spy = vi
      .spyOn(nodemailer, "createTransport")
      .mockReturnValue({ sendMail } as unknown as ReturnType<
        typeof nodemailer.createTransport
      >);
    process.env.SMTP_HOST = "smtp-teste";
    try {
      const jobs = new JobsService(db, assets);
      await jobs.sendPending();
      expect(
        await db.getRepository(OutboxSchema).countBy({ status: "PENDING" }),
      ).toBeGreaterThan(0);
      expect(
        (await db.getRepository(OutboxSchema).find()).some(
          (item) => item.lastError === "SMTP indisponível",
        ),
      ).toBe(true);
      await jobs.sendPending();
      expect(
        await db.getRepository(OutboxSchema).countBy({ status: "PENDING" }),
      ).toBe(0);
      expect(sendMail).toHaveBeenCalled();
      expect(sendMail.mock.calls.at(-1)?.[0].attachments).toBeDefined();
    } finally {
      spy.mockRestore();
      delete process.env.SMTP_HOST;
    }
  });
});
