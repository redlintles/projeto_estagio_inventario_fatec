import { InventoryProgress1786000000000 } from "../src/persistence/inventory-progress";
import { BatchRedo1785000000000 } from "../src/persistence/batch-redo";
import { BatchHistory1783000000000 } from "../src/persistence/batch-history";
import { ReportsService } from "../src/reports/reports";
import { UserPermissions1784000000000 } from "../src/persistence/user-permissions";
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
import sharp from "sharp";
import { AssetUnit1782000000000 } from "../src/persistence/asset-unit";
import { RealTemplate1781000000000 } from "../src/persistence/real-template";
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
    if (!databaseUrl || !new URL(databaseUrl).pathname.includes("test"))
      throw new Error(
        "TEST_DATABASE_URL deve conter test para evitar uso acidental de produção.",
      );
    db = new DataSource({
      type: "postgres",
      url: databaseUrl,
      entities: schemas,
      migrations: [
        BatchHistory1783000000000,
        UserPermissions1784000000000,
        BatchRedo1785000000000,
        InventoryProgress1786000000000,
        Initial1780000000000,
        RealTemplate1781000000000,
        AssetUnit1782000000000,
      ],
      synchronize: false,
    });
    await db.initialize();
    await db.runMigrations();
    await db.query(
      "TRUNCATE users,locations,units,assets,reservations,movements,inventories,inventory_items,divergences,photos,outbox,import_batches,sync_receipts CASCADE",
    );
    assets = new AssetsService(db);
    inventory = new InventoryService(db, assets);
    await db
      .getRepository(SettingSchema)
      .save({ name: "INVENTARIO_EXCLUSIVO_LOCAL", value: "false" });
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
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
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
        {
          ...file,
          buffer: await sharp({
            create: { width: 2, height: 2, channels: 3, background: "blue" },
          })
            .jpeg()
            .toBuffer(),
        },
        actor,
        uploadId,
      ),
    ).rejects.toThrow();
    const { path } = await files.get(first.id);
    expect((await sharp(await readFile(path)).metadata()).format).toBe("jpeg");
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
  it("importa Incorporado e Baixado com código compartilhado, preserva UUID na reimportação e calcula soma e próxima inclusão", async () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [
        "NroPatrimonio",
        "Descrição do Bem",
        "Grupo patrimonial",
        "Código único",
        "Unidade",
        "Data de Incorporação",
        "Status",
        "Valor R$",
      ],
      [
        "native-001",
        "Mesa",
        "Grupo",
        "shared-code",
        "270",
        "01/06/2026",
        "Incorporado",
        1,
      ],
      [
        "native-002",
        "Cadeira",
        "Grupo",
        "shared-code",
        "270",
        "01/06/2026",
        "Baixado",
        2,
      ],
    ]);
    XLSX.utils.book_append_sheet(book, sheet, "Base");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    const preview = await imports.preview(buffer, "ficticio.xlsx", actor);
    expect(preview.imported).toBe(2);
    expect(preview.rows).toEqual([]);
    expect(preview.status).toBe("APPLIED");
    const one = (await assets.list({ patrimony: "native-001" }))[0],
      two = (await assets.list({ patrimony: "native-002" }))[0];
    expect(one.status).toBe("I");
    expect(two.status).toBe("X");
    expect(one.id).not.toBe(two.id);
    const again = await imports.preview(buffer, "ficticio.xlsx", actor);
    expect(again.imported).toBe(0);
    expect(again.unchanged).toBe(2);
    expect(again.rows).toEqual([]);
    expect((await assets.detail(one.id)).id).toBe(one.id);
    const next = await assets.create(
      { ...one, patrimony: "native-003", status: "I" } as unknown as Record<
        string,
        string
      >,
      actor,
      two.id,
    );
    expect(next.value).toBe("3.00");
    expect(
      Number((await assets.dashboard()).totalValue),
    ).toBeGreaterThanOrEqual(6);
    const session = await inventory.start(locationId, actor);
    const current = await assets.detail(one.id);
    await inventory.onlineScan(
      session.id,
      {
        assetId: one.id,
        expectedVersion: current.version,
        observedAt: new Date().toISOString(),
      },
      actor,
    );
    expect((await assets.detail(one.id)).status).toBe("A");
    const files = new FilesService(db, assets);
    await expect(
      files.upload(
        one.id,
        undefined,
        {
          buffer: Buffer.from([255, 216, 255, 0]),
          size: 4,
          originalname: "fake.jpg",
        } as Express.Multer.File,
        actor,
      ),
    ).rejects.toThrow();
  });
  it("importa novos imediatamente, mostra apenas conflitos e preserva inclusões ao resolver conflitos depois", async () => {
    const original = await create("automatic-existing"),
      same = await create("automatic-same");
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        {
          nro_patrimonio: original.patrimony,
          descricao_bem: "Descrição modificada",
          grupo_patrimonial: original.group,
          codigo_unico: original.uniqueCode,
          unidade_origem: original.originUnit,
          data_incorporacao: original.incorporationDate,
          valor_bem: original.value,
        },
        {
          nro_patrimonio: "automatic-new",
          descricao_bem: "Novo bem",
          grupo_patrimonial: original.group,
          codigo_unico: original.uniqueCode,
          unidade_origem: original.originUnit,
          data_incorporacao: original.incorporationDate,
          valor_bem: "9.00",
        },
        {
          nro_patrimonio: same.patrimony,
          descricao_bem: same.description,
          grupo_patrimonial: same.group,
          codigo_unico: same.uniqueCode,
          unidade_origem: same.originUnit,
          data_incorporacao: same.incorporationDate,
          valor_bem: same.value,
        },
        {
          nro_patrimonio: "automatic-invalid",
          descricao_bem: "",
          grupo_patrimonial: original.group,
          codigo_unico: original.uniqueCode,
          unidade_origem: original.originUnit,
          data_incorporacao: original.incorporationDate,
          valor_bem: "9.00",
        },
      ]),
      "Base",
    );
    const data = XLSX.write(book, { bookType: "xlsx", type: "buffer" });
    const batch = await imports.preview(data, "automatic.xlsx", actor);
    expect(batch.imported).toBe(1);
    expect(batch.unchanged).toBe(1);
    expect(batch.issues).toHaveLength(1);
    expect(batch.rows).toHaveLength(1);
    expect(batch.rows[0].assetId).toBe(original.id);
    expect(await assets.list({ patrimony: "automatic-new" })).toHaveLength(1);
    expect(await assets.list({ patrimony: "automatic-invalid" })).toHaveLength(
      0,
    );
    expect((await assets.detail(original.id)).description).toBe("Mesa");
    await expect(imports.apply(batch.id, [], actor)).rejects.toThrow();
    await expect(
      imports.apply(batch.id, [{ line: 2, action: "APPLY" }], {
        ...actor,
        id: randomUUID(),
      }),
    ).rejects.toThrow();
    await imports.apply(
      batch.id,
      [{ line: 2, action: "APPLY", fields: ["description"] }],
      actor,
    );
    expect((await assets.detail(original.id)).description).toBe(
      "Descrição modificada",
    );
    const again = await imports.preview(data, "automatic.xlsx", actor);
    expect(again.imported).toBe(0);
    expect(again.rows).toEqual([]);
    expect(again.unchanged).toBe(3);
    expect((await assets.detail(same.id)).version).toBe(1);
  });
  it("vincula a unidade sem alterar a fonte e revisa mudanças de vínculo", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        {
          nro_patrimonio: "unit-import",
          descricao_bem: "Mesa",
          grupo_patrimonial: "Grupo",
          codigo_unico: "123",
          unidade_origem: "270-original",
          data_incorporacao: "2026-01-01",
          valor_bem: "10.00",
        },
      ]),
      "Base",
    );
    const data = XLSX.write(book, { bookType: "xlsx", type: "buffer" });
    const batch = await imports.preview(data, "unit.xlsx", actor, unitId);
    expect(batch.imported).toBe(1);
    const [asset] = await assets.list({ patrimony: "unit-import", unitId });
    expect(asset.originUnit).toBe("270-original");
    expect(asset.unitId).toBe(unitId);
    expect(
      (await imports.preview(data, "unit.xlsx", actor, unitId)).unchanged,
    ).toBe(1);
    const newUnit = await db.getRepository(UnitSchema).save({
      id: randomUUID(),
      code: "NEW",
      name: "Nova",
      email: "new@example.org",
      active: true,
    });
    const change = await imports.preview(data, "unit.xlsx", actor, newUnit.id);
    expect(change.rows[0].differences).toEqual(["unitId"]);
    await imports.apply(
      change.id,
      [{ line: change.rows[0].line, action: "APPLY", fields: ["unitId"] }],
      actor,
    );
    expect((await assets.detail(asset.id)).unitId).toBe(newUnit.id);
    expect((await assets.detail(asset.id)).originUnit).toBe("270-original");
    await db.getRepository(UnitSchema).update(newUnit.id, { active: false });
    await expect(
      imports.preview(data, "unit.xlsx", actor, newUnit.id),
    ).rejects.toThrow();
  });
  it("atribui localização em lote com auditoria e desfaz tudo em conflito", async () => {
    const one = await create("batch-one"),
      two = await create("batch-two");
    const selected = [one, two].map((a) => ({
      id: a.id,
      expectedVersion: a.version,
    }));
    expect(await assets.locateBatch(selected, locationId, actor)).toEqual({
      updated: 2,
      unchanged: 0,
    });
    expect((await assets.detail(one.id)).locationId).toBe(locationId);
    expect(
      await db
        .getRepository(MovementSchema)
        .countBy({ assetId: one.id, operation: "LOCATION_BATCH" }),
    ).toBe(1);
    await expect(
      assets.locateBatch(selected, otherLocation, actor),
    ).rejects.toThrow();
    expect((await assets.detail(two.id)).locationId).toBe(locationId);
    const current = await Promise.all(
      [one, two].map((a) => assets.detail(a.id)),
    );
    expect(
      await assets.locateBatch(
        current.map((a) => ({ id: a.id, expectedVersion: a.version })),
        locationId,
        actor,
      ),
    ).toEqual({ updated: 0, unchanged: 2 });
    await db.getRepository(AssetSchema).update(two.id, { status: "X" });
    await expect(
      assets.locateBatch(
        current.map((a) => ({ id: a.id, expectedVersion: a.version })),
        otherLocation,
        actor,
      ),
    ).rejects.toThrow();
    expect((await assets.detail(one.id)).locationId).toBe(locationId);
    await expect(
      assets.locateBatch([selected[0], selected[0]], locationId, actor),
    ).rejects.toThrow();
    await expect(
      assets.locateBatch([selected[0]], randomUUID(), actor),
    ).rejects.toThrow();
  });
  it("vincula unidade em lote preservando fonte e localização e cancela todo o lote em conflito", async () => {
    const records = (
      await Promise.all([create("unit-batch-a"), create("unit-batch-b")])
    ).sort((a, b) => a.id.localeCompare(b.id));
    const selected = records.map((a) => ({
      id: a.id,
      expectedVersion: a.version,
    }));
    await db.getRepository(AssetSchema).update(records[0].id, { locationId });
    await expect(
      assets.assignUnitBatch(
        [selected[0], { ...selected[1], expectedVersion: 99 }],
        unitId,
        actor,
      ),
    ).rejects.toThrow();
    expect((await assets.detail(records[0].id)).unitId).toBeNull();
    expect(
      await db
        .getRepository(MovementSchema)
        .countBy({ assetId: records[0].id, operation: "UNIT_BATCH" }),
    ).toBe(0);
    expect(await assets.assignUnitBatch(selected, unitId, actor)).toEqual({
      updated: 2,
      unchanged: 0,
    });
    const current = await Promise.all(records.map((a) => assets.detail(a.id)));
    expect(current[0].unitId).toBe(unitId);
    expect(current[0].locationId).toBe(locationId);
    expect(current[0].originUnit).toBe("FATEC");
    expect(current[0].version).toBe(records[0].version + 1);
    expect(
      await db
        .getRepository(MovementSchema)
        .countBy({ assetId: records[0].id, operation: "UNIT_BATCH" }),
    ).toBe(1);
    const selection = current.map((a) => ({
      id: a.id,
      expectedVersion: a.version,
    }));
    expect(await assets.assignUnitBatch(selection, unitId, actor)).toEqual({
      updated: 0,
      unchanged: 2,
    });
    expect((await assets.detail(records[0].id)).version).toBe(
      current[0].version,
    );
    await expect(
      assets.assignUnitBatch([selection[0], selection[0]], unitId, actor),
    ).rejects.toThrow();
    await expect(
      assets.assignUnitBatch(selection, randomUUID(), actor),
    ).rejects.toThrow();
    const inactive = await db.getRepository(UnitSchema).save({
      id: randomUUID(),
      code: "INACTIVE-BATCH",
      name: "Inativa",
      email: "inactive@example.org",
      active: false,
    });
    await expect(
      assets.assignUnitBatch(selection, inactive.id, actor),
    ).rejects.toThrow();
    await db.getRepository(AssetSchema).update(records[1].id, { status: "X" });
    await expect(
      assets.assignUnitBatch(selection, unitId, actor),
    ).rejects.toThrow();
  });
  it("seleciona todos pelos filtros sem paginação e permite desfazer um lote específico", async () => {
    const records = await Promise.all([
      create("global-one"),
      create("global-two"),
      create("global-disposed"),
    ]);
    await db.getRepository(AssetSchema).update(
      records.map((a) => a.id),
      { group: "GLOBAL-FILTER" },
    );
    await db.getRepository(AssetSchema).update(records[2].id, { status: "X" });
    const filters = {
      group: "GLOBAL-FILTER",
      unitId: "none",
      offset: "0",
      limit: "1",
    };
    expect(await assets.list(filters)).toHaveLength(1);
    const preview = await assets.previewBatch(
      "unitId",
      unitId,
      undefined,
      filters,
      actor,
    );
    expect(preview).toMatchObject({
      matched: 3,
      selected: 2,
      changed: 2,
      skipped: 1,
    });
    const later = await create("global-later");
    await db
      .getRepository(AssetSchema)
      .update(later.id, { group: "GLOBAL-FILTER" });
    await expect(
      assets.applyBatch(preview.id, { ...actor, id: randomUUID() }),
    ).rejects.toThrow();
    expect(await assets.applyBatch(preview.id, actor)).toMatchObject({
      updated: 2,
    });
    await expect(assets.applyBatch(preview.id, actor)).rejects.toThrow();
    expect((await assets.detail(later.id)).unitId).toBeNull();
    expect((await assets.detail(records[2].id)).unitId).toBeNull();
    expect(
      (await assets.batchHistory()).find((h: any) => h.id === preview.id),
    ).toMatchObject({ status: "APPLIED", updated: 2 });
    expect(await assets.undoBatch(preview.id, actor)).toMatchObject({
      restored: 2,
    });
    const restored = await assets.detail(records[0].id);
    expect(restored.unitId).toBeNull();
    expect(restored.version).toBe(3);
    expect(
      await db
        .getRepository(MovementSchema)
        .countBy({ assetId: restored.id, operation: "BATCH_UNDO" }),
    ).toBe(1);
    await expect(assets.undoBatch(preview.id, actor)).rejects.toThrow();
    expect(
      (await assets.batchHistory()).find((h: any) => h.id === preview.id)
        .status,
    ).toBe("UNDONE");
  });
  it("desfaz localização para valores individuais e bloqueia reversão após alterações posteriores", async () => {
    const records = (
      await Promise.all([create("undo-one"), create("undo-two")])
    ).sort((a, b) => a.id.localeCompare(b.id));
    await db.getRepository(AssetSchema).update(records[0].id, { locationId });
    const inputs = records.map((a) => ({
      id: a.id,
      expectedVersion: a.version,
    }));
    const preview = await assets.previewBatch(
      "locationId",
      otherLocation,
      inputs,
      undefined,
      actor,
    );
    await assets.applyBatch(preview.id, actor);
    await assets.undoBatch(preview.id, actor);
    expect((await assets.detail(records[0].id)).locationId).toBe(locationId);
    expect((await assets.detail(records[1].id)).locationId).toBeNull();
    const next = await assets.previewBatch(
      "locationId",
      otherLocation,
      records.map((a) => ({ id: a.id, expectedVersion: 3 })),
      undefined,
      actor,
    );
    await assets.applyBatch(next.id, actor);
    await assets.locate(records[1].id, 4, locationId, actor);
    await expect(assets.undoBatch(next.id, actor)).rejects.toThrow();
    expect((await assets.detail(records[0].id)).locationId).toBe(otherLocation);
    expect((await assets.detail(records[0].id)).version).toBe(4);
    expect((await assets.detail(records[1].id)).locationId).toBe(locationId);
  });
  it("filtra relatórios completos e resolve referências sem UUIDs ou objetos internos", async () => {
    const a = await create("report-001"),
      b = await create("report-002");
    await db
      .getRepository(AssetSchema)
      .update(a.id, { unitId, locationId, group: "REPORT-ONLY" });
    await db
      .getRepository(AssetSchema)
      .update(b.id, { group: "REPORT-ONLY", incorporationDate: "2025-01-01" });
    const reports = new ReportsService(db, assets);
    const out = await reports.build("byLocation", {
      group: "REPORT-ONLY",
      unitId,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-01",
    });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0][0]).toBe(a.patrimony);
    expect(out.rows[0]).toContain("DEST · Outra unidade");
    expect(JSON.stringify(out)).not.toContain(a.id);
    expect(JSON.stringify(out)).not.toContain(unitId);
    expect(JSON.stringify(out)).not.toContain(locationId);
    expect(out.columns).not.toContain("id");
    expect(out.rows[0].at(-1)).toBe(125.5);
    expect(
      (
        await reports.build("byLocation", {
          group: "REPORT-ONLY",
          unitId: "none",
          locationId: "none",
        })
      ).rows[0][0],
    ).toBe(b.patrimony);
    expect(
      (
        await reports.build("byLocation", {
          group: "REPORT-ONLY",
          description: "inexistente",
        })
      ).rows,
    ).toHaveLength(0);
    const movements = await reports.build("movements", {
      patrimony: a.patrimony,
    });
    expect(movements.rows.length).toBeGreaterThan(0);
    expect(movements.columns).toContain("Responsável");
    expect(movements.rows[0]).toContain(actor.name);
    expect(JSON.stringify(movements)).not.toContain(a.id);
    await db.transaction(async (m) =>
      inventory.scan(
        m,
        (await inventory.start(locationId, actor)).id,
        {
          assetId: a.id,
          expectedVersion: 1,
          observedAt: new Date().toISOString(),
        },
        actor,
      ),
    );
    expect(
      (await reports.build("inventories", { patrimony: a.patrimony })).rows,
    ).toHaveLength(1);
    await expect(
      reports.build("byLocation", {
        dateFrom: "2026-10-01",
        dateTo: "2026-09-01",
      }),
    ).rejects.toThrow();
    await expect(reports.build("available", { status: "I" })).rejects.toThrow();
    await expect(reports.build("unknown", {})).rejects.toThrow();
    await expect(
      reports.build("byLocation", { format: "exe" }),
    ).rejects.toThrow();
  });
  it("filtra o histórico no banco pelos limites do dia em São Paulo", async () => {
    const asset = await create("report-timezone");
    const repository = db.getRepository(MovementSchema);
    const movement = (await repository.findBy({ assetId: asset.id }))[0];
    await repository.update(movement.id, {
      createdAt: new Date("2026-10-16T02:59:59Z"),
    });
    await repository.save({
      ...movement,
      id: randomUUID(),
      createdAt: new Date("2026-10-16T03:00:00Z"),
    });
    await repository.save({
      ...movement,
      id: randomUUID(),
      createdAt: new Date("2026-10-17T03:00:00Z"),
    });
    const report = await new ReportsService(db, assets).build("movements", {
      patrimony: asset.patrimony,
      dateFrom: "2026-10-16",
      dateTo: "2026-10-16",
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0][5]).toEqual(new Date("2026-10-16T03:00:00Z"));
    await expect(
      new ReportsService(db, assets).build("toString", {}),
    ).rejects.toThrow("inexistente");
  });
  it("refaz lotes com versões e eventos e recusa alterações posteriores", async () => {
    const records = (
      await Promise.all([create("redo-one"), create("redo-two")])
    ).sort((a, b) => a.id.localeCompare(b.id));
    const preview = await assets.previewBatch(
      "locationId",
      otherLocation,
      records.map((a) => ({ id: a.id, expectedVersion: 1 })),
      undefined,
      actor,
    );
    await assets.applyBatch(preview.id, actor);
    await assets.undoBatch(preview.id, actor);
    const results = await Promise.allSettled([
      assets.redoBatch(preview.id, actor),
      assets.redoBatch(preview.id, actor),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const a of records) {
      const current = await assets.detail(a.id);
      expect(current.locationId).toBe(otherLocation);
      expect(current.version).toBe(4);
    }
    expect(
      (await assets.batchEvents(preview.id)).map((e: any) => e.action),
    ).toEqual(["APPLY", "UNDO", "REDO"]);
    await assets.undoBatch(preview.id, actor);
    await assets.redoBatch(preview.id, actor);
    expect(
      (await assets.batchEvents(preview.id)).map((e: any) => e.revision),
    ).toEqual([1, 2, 3, 4, 5]);
    await assets.undoBatch(preview.id, actor);
    await assets.locate(records[1].id, 7, locationId, actor);
    await expect(assets.redoBatch(preview.id, actor)).rejects.toThrow();
    expect((await assets.detail(records[0].id)).locationId).toBeNull();
    expect((await assets.detail(records[0].id)).version).toBe(7);
  });
  it("refaz somente com destino ativo e permissão, preservando nulos e históricos", async () => {
    const record = await create("redo-unit");
    const target = await db.getRepository(UnitSchema).save({
      id: randomUUID(),
      code: "REDO",
      name: "Unidade refazer",
      email: "redo@example.org",
      active: true,
    });
    const preview = await assets.previewBatch(
      "unitId",
      target.id,
      [{ id: record.id, expectedVersion: 1 }],
      undefined,
      actor,
    );
    await assets.applyBatch(preview.id, actor);
    await assets.undoBatch(preview.id, actor);
    await db.getRepository(UnitSchema).update(target.id, { active: false });
    await expect(assets.redoBatch(preview.id, actor)).rejects.toThrow();
    expect((await assets.detail(record.id)).unitId).toBeNull();
    await db.getRepository(UnitSchema).update(target.id, { active: true });
    await expect(
      assets.redoBatch(preview.id, {
        ...actor,
        role: "PATRIMONIAL",
        permissions: ["batches.undo"],
      }),
    ).rejects.toThrow();
    await assets.redoBatch(preview.id, actor);
    expect((await assets.detail(record.id)).unitId).toBe(target.id);
    expect(
      await db
        .getRepository(MovementSchema)
        .countBy({ assetId: record.id, operation: "BATCH_REDO" }),
    ).toBe(1);
    const events = await assets.batchEvents(preview.id);
    expect(events).toHaveLength(3);
    expect(events[2].userName).toBe(actor.name);
  });
  it("processa 1301 ativos em blocos com poucas consultas e auditoria integral", async () => {
    const base = await create("large-base");
    const records = Array.from({ length: 1301 }, (_, i) => ({
      ...base,
      id: randomUUID(),
      patrimony: `LARGE-${String(i).padStart(5, "0")}`,
      group: "BULK-PERFORMANCE",
      version: 1,
      unitId: null,
      locationId: null,
    }));
    for (let start = 0; start < records.length; start += 500)
      await db
        .getRepository(AssetSchema)
        .insert(records.slice(start, start + 500));
    const preview = await assets.previewBatch(
      "unitId",
      unitId,
      undefined,
      { group: "BULK-PERFORMANCE" },
      actor,
    );
    expect(preview.changed).toBe(1301);
    const queries = vi.spyOn(db.logger, "logQuery");
    const timings: number[] = [];
    try {
      for (const action of [
        () => assets.applyBatch(preview.id, actor),
        () => assets.undoBatch(preview.id, actor),
        () => assets.redoBatch(preview.id, actor),
      ]) {
        queries.mockClear();
        const start = performance.now();
        await action();
        timings.push(Math.round(performance.now() - start));
        expect(queries.mock.calls.length).toBeLessThan(25);
      }
    } finally {
      queries.mockRestore();
    }
    const after = await assets.list({ group: "BULK-PERFORMANCE" }, true);
    expect(after).toHaveLength(1301);
    expect(
      after.every(
        (a) => a.version === 4 && a.unitId === unitId && a.locationId === null,
      ),
    ).toBe(true);
    const [audit] = await db.query(
      `SELECT count(*)::int AS count FROM movements WHERE "assetId"=ANY($1::uuid[])`,
      [records.map((a) => a.id)],
    );
    expect(audit.count).toBe(3903);
    const historyReport = await new ReportsService(db, assets).build(
      "movements",
      { group: "BULK-PERFORMANCE" },
    );
    expect(historyReport.rows).toHaveLength(3903);
    const historyDates = historyReport.rows.map((row) =>
      (row[5] as Date).getTime(),
    );
    expect(historyDates).toEqual(
      [...historyDates].sort((left, right) => right - left),
    );

    console.log(
      `Lote de 1301 ativos: aplicar/desfazer/refazer em ${timings.join("/")} ms, menos de 25 consultas por operação.`,
    );
  });
  it("recusa exportação acima do limite e aplica o período antes de contar bens", async () => {
    const base = await create("report-limit-base");
    const repository = db.getRepository(AssetSchema);
    try {
      for (let offset = 0; offset < 20001; offset += 500) {
        const records = Array.from(
          { length: Math.min(500, 20001 - offset) },
          (_, index) => ({
            ...base,
            id: randomUUID(),
            patrimony: `REPORT-LIMIT-${offset + index}`,
            group: "REPORT-LIMIT",
            unitId: null,
            locationId: null,
          }),
        );
        await repository.insert(records);
      }
      const reports = new ReportsService(db, assets);
      await expect(
        reports.build("byLocation", { group: "REPORT-LIMIT" }),
      ).rejects.toThrow("nenhum arquivo parcial");
      expect(
        (
          await reports.build("byLocation", {
            group: "REPORT-LIMIT",
            dateFrom: "2027-01-01",
          })
        ).rows,
      ).toHaveLength(0);
    } finally {
      await repository.delete({ group: "REPORT-LIMIT" });
    }
  });
  it("reverte blocos já processados se a auditoria falhar no bloco seguinte", async () => {
    const base = await create("rollback-base");
    const records = Array.from({ length: 601 }, (_, i) => ({
      ...base,
      id: randomUUID(),
      patrimony: `ROLLBACK-${String(i).padStart(4, "0")}`,
      group: "BULK-ROLLBACK",
      version: 1,
      unitId: null,
      locationId: null,
    }));
    await db.getRepository(AssetSchema).insert(records);
    const preview = await assets.previewBatch(
      "unitId",
      unitId,
      undefined,
      { group: "BULK-ROLLBACK" },
      actor,
    );
    await db.query(
      `CREATE FUNCTION test_batch_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='UNIT_BATCH' AND NEW."after"->>'patrimony'='ROLLBACK-0550' THEN RAISE EXCEPTION 'simulated audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_batch_audit_failure BEFORE INSERT ON movements FOR EACH ROW EXECUTE FUNCTION test_batch_audit_failure()`,
    );
    try {
      await expect(assets.applyBatch(preview.id, actor)).rejects.toThrow();
    } finally {
      await db.query(
        "DROP TRIGGER test_batch_audit_failure ON movements; DROP FUNCTION test_batch_audit_failure()",
      );
    }
    const after = await assets.list({ group: "BULK-ROLLBACK" }, true);
    expect(after.every((a) => a.version === 1 && a.unitId === null)).toBe(true);
    const [audit] = await db.query(
      `SELECT count(*)::int AS count FROM movements WHERE "assetId"=ANY($1::uuid[])`,
      [records.map((a) => a.id)],
    );
    expect(audit.count).toBe(0);
    expect(await assets.batchEvents(preview.id)).toEqual([]);
    expect((await assets.applyBatch(preview.id, actor)).updated).toBe(601);
  });
  it("serializa uploads repetidos para não duplicar novos registros", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        {
          nro_patrimonio: "concurrent-new",
          descricao_bem: "Teste",
          grupo_patrimonial: "Grupo",
          codigo_unico: "codigo",
          unidade_origem: "270",
          data_incorporacao: "2026-01-01",
          valor_bem: "1.00",
        },
      ]),
      "Base",
    );
    const data = XLSX.write(book, { bookType: "xlsx", type: "buffer" });
    const results = await Promise.all([
      imports.preview(data, "one.xlsx", actor),
      imports.preview(data, "two.xlsx", actor),
    ]);
    expect(results.reduce((n, b) => n + b.imported, 0)).toBe(1);
    expect(await assets.list({ patrimony: "concurrent-new" })).toHaveLength(1);
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
        (await db.getRepository(OutboxSchema).find()).some((item) =>
          item.lastError?.startsWith("Falha SMTP"),
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
