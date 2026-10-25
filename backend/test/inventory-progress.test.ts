import "reflect-metadata";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import { dataSource } from "../src/data-source";
import * as S from "../src/persistence/schemas";
import { AssetsService } from "../src/assets/assets.service";
import { InventoryService } from "../src/inventory/inventory.service";
import { Actor } from "../src/auth/auth";

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite("Inventário: exclusividade, ausência, conclusão e cancelamento", () => {
  let db: DataSource,
    service: InventoryService,
    assets: AssetsService,
    locationId: string;
  const owner: Actor = {
    id: randomUUID(),
    name: "Coletor",
    email: `${randomUUID()}@test.local`,
    role: "CONSULTA",
  };
  const other: Actor = {
    id: randomUUID(),
    name: "Outro",
    email: `${randomUUID()}@test.local`,
    role: "CONSULTA",
  };
  beforeAll(async () => {
    if (!new URL(process.env.TEST_DATABASE_URL!).pathname.includes("test"))
      throw new Error("Banco exclusivo de teste obrigatório");
    db = new DataSource({
      type: "postgres",
      url: process.env.TEST_DATABASE_URL,
      entities: S.schemas,
      migrations: dataSource.options.migrations,
    });
    await db.initialize();
    await db.runMigrations();
    for (const user of [owner, other])
      await db
        .getRepository(S.UserSchema)
        .save({ ...user, passwordHash: "not-used", active: true });
    assets = new AssetsService(db);
    service = new InventoryService(db, assets);
  });
  beforeEach(async () => {
    locationId = randomUUID();
    await db.getRepository(S.LocationSchema).save({
      id: locationId,
      code: locationId,
      description: "Sala de teste",
      building: "Teste",
      floor: "Térreo",
      notes: "",
      active: true,
    });
    await db
      .getRepository(S.SettingSchema)
      .save({ name: "INVENTARIO_EXCLUSIVO_LOCAL", value: "true" });
  });
  afterAll(async () => {
    if (db?.isInitialized) {
      await db
        .getRepository(S.SettingSchema)
        .save({ name: "INVENTARIO_EXCLUSIVO_LOCAL", value: "true" });
      await db.destroy();
    }
  });
  async function asset() {
    const result = await assets.create(
      {
        patrimony: randomUUID().slice(0, 20),
        uniqueCode: randomUUID(),
        description: "Bem esperado",
        group: "Teste",
        originUnit: "FATEC",
        incorporationDate: "2026-10-25",
        value: "1.00",
      },
      owner,
    );
    await assets.locate(result.id, result.version, locationId, owner);
    return assets.detail(result.id);
  }
  it("serializa aberturas concorrentes e usa bloqueio mesmo sem parâmetro cadastrado", async () => {
    await db
      .getRepository(S.SettingSchema)
      .delete({ name: "INVENTARIO_EXCLUSIVO_LOCAL" });
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        service.start(locationId, i % 2 ? owner : other),
      ),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(
      await db
        .getRepository(S.InventorySchema)
        .countBy({ locationId, status: "OPEN" }),
    ).toBe(1);
    for (const result of attempts)
      if (result.status === "rejected")
        expect(result.reason.getStatus()).toBe(409);
  });
  it("permite sessões independentes com proteção desligada e volta a bloquear ao reativar", async () => {
    await db
      .getRepository(S.SettingSchema)
      .save({ name: "INVENTARIO_EXCLUSIVO_LOCAL", value: "false" });
    const a = await service.start(locationId, owner),
      b = await service.start(locationId, other);
    await db
      .getRepository(S.SettingSchema)
      .save({ name: "INVENTARIO_EXCLUSIVO_LOCAL", value: "true" });
    await expect(service.start(locationId, owner)).rejects.toThrow();
    await service.cancel(a.id, owner);
    await service.cancel(b.id, other);
    expect((await service.start(locationId, owner)).status).toBe("OPEN");
  });
  it("impede outra conta de usar ou cancelar a sessão do responsável", async () => {
    const a = await asset(),
      inv = await service.start(locationId, owner);
    const observation = {
      assetId: a.id,
      observedAt: new Date().toISOString(),
      notFound: true as const,
    };
    await expect(
      service.onlineMissing(inv.id, observation, other),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.onlineScan(
        inv.id,
        {
          assetId: a.id,
          expectedVersion: a.version,
          observedAt: observation.observedAt,
        },
        other,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.cancel(inv.id, other)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.complete(inv.id, other)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("registra ausência idempotente, preserva cadastro e exige resultados antes de concluir", async () => {
    const a = await asset(),
      b = await asset(),
      inv = await service.start(locationId, owner);
    expect(inv.expectedIds).toHaveLength(2);
    expect(inv.expectedAssets.map((a) => a.patrimony)).toContain(a.patrimony);
    await expect(service.complete(inv.id, owner)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      service.onlineMissing(
        inv.id,
        {
          assetId: randomUUID(),
          notFound: true,
          observedAt: new Date().toISOString(),
        },
        owner,
      ),
    ).rejects.toMatchObject({ status: 400 });
    const operationId = randomUUID(),
      input = {
        assetId: a.id,
        notFound: true as const,
        observedAt: new Date().toISOString(),
      };
    const results = await Promise.all([
      service.sync(operationId, inv.id, input, owner),
      service.sync(operationId, inv.id, input, owner),
    ]);
    expect(JSON.parse(JSON.stringify(results[0]))).toEqual(
      JSON.parse(JSON.stringify(results[1])),
    );
    expect((await assets.detail(a.id)).version).toBe(a.version);
    expect((await assets.detail(a.id)).locationId).toBe(locationId);
    await service.onlineScan(
      inv.id,
      {
        assetId: b.id,
        expectedVersion: b.version,
        observedAt: new Date().toISOString(),
      },
      owner,
    );
    const detail = await service.detail(inv.id);
    expect(detail.missingIds).toEqual([]);
    expect(detail.notFoundIds).toEqual([a.id]);
    expect(detail.items).toHaveLength(2);
    expect((await service.complete(inv.id, owner)).status).toBe("CLOSED");
    expect((await service.complete(inv.id, owner)).status).toBe("CLOSED");
    expect((await service.start(locationId, other)).status).toBe("OPEN");
  });
  it("cancelamento preserva resultados aceitos, recusa novos resultados e libera a sala", async () => {
    const a = await asset(),
      inv = await service.start(locationId, owner);
    await service.onlineMissing(
      inv.id,
      { assetId: a.id, notFound: true, observedAt: new Date().toISOString() },
      owner,
    );
    expect((await service.cancel(inv.id, owner)).status).toBe("CANCELLED");
    expect((await service.cancel(inv.id, owner)).status).toBe("CANCELLED");
    expect((await service.detail(inv.id)).items).toHaveLength(1);
    await expect(
      service.onlineMissing(
        inv.id,
        { assetId: a.id, notFound: true, observedAt: new Date().toISOString() },
        owner,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await service.start(locationId, other)).status).toBe("OPEN");
  });
});
