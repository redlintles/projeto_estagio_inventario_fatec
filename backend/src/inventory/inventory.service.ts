import { Inject } from "@nestjs/common";
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import * as S from "../persistence/schemas";
import { Actor } from "../auth/auth";
import { AssetsService } from "../assets/assets.service";
import { scanInput, missingInput, inventoryObservation } from "../validation";
import { requireStatus } from "../domain/rules";
@Injectable()
export class InventoryService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AssetsService) private readonly assets: AssetsService,
  ) {}
  async start(locationId: string, actor: Actor) {
    return this.db.transaction(async (m) => {
      // Laço serializado no banco: duas requisições não podem observar a sala livre ao mesmo tempo.
      const location = await m.getRepository(S.LocationSchema).findOne({
        where: { id: locationId, active: true },
        lock: { mode: "pessimistic_write" },
      });
      if (!location) throw new BadRequestException("Localização inválida.");
      const policy = await m.getRepository(S.SettingSchema).findOne({
        where: { name: "INVENTARIO_EXCLUSIVO_LOCAL" },
        lock: { mode: "pessimistic_read" },
      });
      if (
        policy?.value !== "false" &&
        (await m
          .getRepository(S.InventorySchema)
          .existsBy({ locationId, status: "OPEN" }))
      )
        throw new ConflictException(
          "Já existe um inventário em andamento nesta localização. Retome o seu inventário ou aguarde o responsável sincronizar a conclusão ou o cancelamento.",
        );
      const expected = await m
        .getRepository(S.AssetSchema)
        .findBy({ locationId, status: In(["I", "A"]) });
      const inventory = await m.getRepository(S.InventorySchema).save({
        id: randomUUID(),
        locationId,
        userId: actor.id,
        status: "OPEN",
        startedAt: new Date(),
        finishedAt: null,
        expectedIds: expected.map((a) => a.id),
      });
      return {
        ...inventory,
        items: [],
        expectedAssets: expected.map((a) => ({
          id: a.id,
          patrimony: a.patrimony,
          description: a.description,
        })),
      };
    });
  }
  async scan(
    m: EntityManager,
    id: string,
    input: z.infer<typeof scanInput>,
    actor: Actor,
  ) {
    const inventory = await m
      .getRepository(S.InventorySchema)
      .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
    if (!inventory) throw new NotFoundException("Inventário não encontrado.");
    if (inventory.status !== "OPEN")
      throw new ConflictException("Inventário encerrado.");
    this.assertOwner(inventory, actor);
    const asset = await this.assets.locked(
      m,
      input.assetId,
      input.expectedVersion,
    );
    requireStatus(asset, ["I", "A"]);
    if (
      await m
        .getRepository(S.InventoryItemSchema)
        .countBy({ inventoryId: id, assetId: asset.id })
    )
      throw new ConflictException("Ativo já conferido neste inventário.");
    const before = { ...asset };
    // Divergências preservam a localização oficial; somente uma conferência explícita a atualiza.
    let divergenceId: string | null = null;
    if (input.divergence) {
      divergenceId = randomUUID();
      await m.getRepository(S.DivergenceSchema).insert({
        id: divergenceId,
        assetId: asset.id,
        inventoryId: id,
        locationId: inventory.locationId,
        ...input.divergence,
        status: "PENDING",
        resolution: null,
        userId: actor.id,
        createdAt: new Date(),
        resolvedAt: null,
      });
    } else {
      asset.locationId = inventory.locationId;
      if (asset.status === "I") asset.status = "A";
      if (input.condition !== undefined) asset.condition = input.condition;
    }
    await this.assets.save(
      m,
      asset,
      before,
      input.divergence ? "DIVERGENCE" : "INVENTORY",
      actor,
      `Inventário ${id}; observado em ${input.observedAt}`,
    );
    const item = {
      id: randomUUID(),
      inventoryId: id,
      assetId: asset.id,
      userId: actor.id,
      result: input.divergence
        ? ("DIVERGENCE" as const)
        : ("CONFIRMED" as const),
      observedAt: new Date(input.observedAt),
      createdAt: new Date(),
    };
    await m.getRepository(S.InventoryItemSchema).insert(item);
    return { item, asset, divergenceId };
  }
  async onlineScan(id: string, input: z.infer<typeof scanInput>, actor: Actor) {
    return this.db.transaction((m) => this.scan(m, id, input, actor));
  }
  async sync(
    operationId: string,
    inventoryId: string,
    input: z.infer<typeof inventoryObservation>,
    actor: Actor,
  ) {
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ inventoryId, input }))
      .digest("hex");
    return this.db.transaction(async (m) => {
      // A trava por UUID serializa reenvios concorrentes mesmo antes da primeira gravação.
      await m.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        operationId,
      ]);
      const previous = await m
        .getRepository(S.SyncReceiptSchema)
        .findOneBy({ id: operationId });
      if (previous) {
        if (
          previous.userId !== actor.id ||
          previous.payloadHash !== payloadHash
        )
          throw new ConflictException(
            "Identificador já usado com outros dados.",
          );
        return previous.result;
      }
      const result =
        "notFound" in input
          ? await this.markMissing(m, inventoryId, input, actor)
          : await this.scan(m, inventoryId, input, actor);
      await m.getRepository(S.SyncReceiptSchema).save({
        id: operationId,
        userId: actor.id,
        payloadHash,
        result,
        createdAt: new Date(),
      });
      return result;
    });
  }
  async detail(id: string) {
    const inventory = await this.db
      .getRepository(S.InventorySchema)
      .findOneBy({ id });
    if (!inventory) throw new NotFoundException();
    const items = await this.db
      .getRepository(S.InventoryItemSchema)
      .findBy({ inventoryId: id });
    const seen = new Set(items.map((i) => i.assetId));
    return {
      ...inventory,
      expectedAssets: inventory.expectedIds.length
        ? await this.db.getRepository(S.AssetSchema).find({
            where: { id: In(inventory.expectedIds) },
            select: { id: true, patrimony: true, description: true },
          })
        : [],
      items,
      notFoundIds: items
        .filter((i) => i.result === "NOT_FOUND")
        .map((i) => i.assetId),
      missingIds: inventory.expectedIds.filter((assetId) => !seen.has(assetId)),
    };
  }
  private assertOwner(
    inventory: import("../domain/model").Inventory,
    actor: Actor,
  ) {
    if (inventory.userId !== actor.id && actor.role !== "ADMIN")
      throw new ForbiddenException(
        "Somente o responsável por este inventário pode registrar resultados, concluir ou cancelar.",
      );
  }
  async markMissing(
    m: EntityManager,
    id: string,
    input: z.infer<typeof missingInput>,
    actor: Actor,
  ) {
    const inventory = await m
      .getRepository(S.InventorySchema)
      .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
    if (!inventory) throw new NotFoundException("Inventário não encontrado.");
    this.assertOwner(inventory, actor);
    if (inventory.status !== "OPEN")
      throw new ConflictException("Inventário encerrado ou cancelado.");
    if (!inventory.expectedIds.includes(input.assetId))
      throw new BadRequestException(
        "Este bem não pertence à lista esperada deste inventário.",
      );
    if (
      await m
        .getRepository(S.InventoryItemSchema)
        .existsBy({ inventoryId: id, assetId: input.assetId })
    )
      throw new ConflictException("Bem já registrado neste inventário.");
    const asset = await m
      .getRepository(S.AssetSchema)
      .findOneByOrFail({ id: input.assetId });
    const item = {
      id: randomUUID(),
      inventoryId: id,
      assetId: input.assetId,
      userId: actor.id,
      result: "NOT_FOUND" as const,
      observedAt: new Date(input.observedAt),
      createdAt: new Date(),
    };
    await m.getRepository(S.InventoryItemSchema).insert(item);
    return { item, asset, divergenceId: null };
  }
  async onlineMissing(
    id: string,
    input: z.infer<typeof missingInput>,
    actor: Actor,
  ) {
    return this.db.transaction((m) => this.markMissing(m, id, input, actor));
  }
  async finish(
    id: string,
    actor: Actor,
    status: "CLOSED" | "CANCELLED",
    requireComplete = false,
  ) {
    return this.db.transaction(async (m) => {
      const inventory = await m
        .getRepository(S.InventorySchema)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!inventory) throw new NotFoundException();
      this.assertOwner(inventory, actor);
      if (inventory.status === status) return inventory; // Reenvio após perda da resposta.
      if (inventory.status !== "OPEN")
        throw new ConflictException("Inventário já encerrado ou cancelado.");
      if (requireComplete) {
        const items = await m
          .getRepository(S.InventoryItemSchema)
          .findBy({ inventoryId: id });
        const recorded = new Set(items.map((i) => i.assetId));
        if (inventory.expectedIds.some((assetId) => !recorded.has(assetId)))
          throw new ConflictException(
            "Ainda há bens esperados sem resultado. Sincronize as conferências e ausências antes de concluir.",
          );
      }
      inventory.status = status;
      inventory.finishedAt = new Date();
      return m.getRepository(S.InventorySchema).save(inventory);
    });
  }
  close(id: string, actor: Actor) {
    return this.finish(id, actor, "CLOSED");
  }
  complete(id: string, actor: Actor) {
    return this.finish(id, actor, "CLOSED", true);
  }
  cancel(id: string, actor: Actor) {
    return this.finish(id, actor, "CANCELLED");
  }
  async resolve(
    id: string,
    resolution: string,
    newLocationId: string | undefined,
    actor: Actor,
  ) {
    return this.db.transaction(async (m) => {
      const divergence = await m
        .getRepository(S.DivergenceSchema)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!divergence) throw new NotFoundException();
      if (divergence.status !== "PENDING")
        throw new ConflictException("Divergência já tratada.");
      const asset = await this.assets.locked(m, divergence.assetId);
      requireStatus(asset, ["I", "A", "D", "B"]);
      const before = { ...asset };
      if (newLocationId) {
        if (
          !(await m
            .getRepository(S.LocationSchema)
            .findOneBy({ id: newLocationId, active: true }))
        )
          throw new BadRequestException();
        asset.locationId = newLocationId;
      }
      divergence.status = "RESOLVED";
      divergence.resolution = resolution;
      divergence.resolvedAt = new Date();
      await m.getRepository(S.DivergenceSchema).save(divergence);
      await this.assets.save(
        m,
        asset,
        before,
        "DIVERGENCE_RESOLVED",
        actor,
        resolution,
      );
      return divergence;
    });
  }
}
