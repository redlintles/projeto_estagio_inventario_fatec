import { assertPermission } from "../auth/permissions";
import { Inject } from "@nestjs/common";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { z } from "zod";
import { parse, uuid } from "../validation";
import { randomUUID } from "node:crypto";
import * as S from "../persistence/schemas";
import { plusOne } from "../imports/spreadsheet";
import { Asset, Reservation } from "../domain/model";
import { Actor } from "../auth/auth";
import {
  checkVersion,
  requireStatus,
  conditionValue,
  isOverdue,
} from "../domain/rules";
@Injectable()
export class AssetsService {
  constructor(@Inject(DataSource) public readonly db: DataSource) {}
  async locked(m: EntityManager, id: string, expected?: number) {
    const asset = await m
      .getRepository(S.AssetSchema)
      .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
    if (!asset) throw new NotFoundException("Ativo não encontrado.");
    if (expected !== undefined) checkVersion(asset, expected);
    return asset;
  }
  async audit(
    m: EntityManager,
    asset: Asset,
    before: Asset | null,
    operation: string,
    actor: Actor | null,
    notes = "",
  ) {
    await m.getRepository(S.MovementSchema).save({
      id: randomUUID(),
      assetId: asset.id,
      userId: actor?.id ?? null,
      operation,
      before: before ? { ...before } : null,
      after: { ...asset },
      notes,
      createdAt: new Date(),
    });
  }
  async save(
    m: EntityManager,
    asset: Asset,
    before: Asset,
    operation: string,
    actor: Actor | null,
    notes = "",
  ) {
    asset.version++;
    asset.updatedAt = new Date();
    await m.getRepository(S.AssetSchema).save(asset);
    await this.audit(m, asset, before, operation, actor, notes);
    return asset;
  }
  filteredQuery(filters: Record<string, string>) {
    parse(
      z
        .object({
          status: z
            .union([z.enum(["I", "A", "D", "B", "T", "X"]), z.literal("")])
            .optional(),
          locationId: z
            .union([uuid, z.literal(""), z.literal("none")])
            .optional(),
          unitId: z.union([uuid, z.literal(""), z.literal("none")]).optional(),
          patrimony: z.string().max(100).optional(),
          description: z.string().max(255).optional(),
          group: z.string().max(100).optional(),
          offset: z.string().max(10).optional(),
          limit: z.string().max(5).optional(),
        })
        .strict(),
      filters,
    );
    const query = this.db.getRepository(S.AssetSchema).createQueryBuilder("a");
    for (const key of ["status", "locationId", "unitId"])
      if (filters[key] === "none") query.andWhere(`a.${key} IS NULL`);
      else if (filters[key])
        query.andWhere(`a.${key} = :${key}`, { [key]: filters[key] });
    for (const key of ["patrimony", "description", "group"])
      if (filters[key])
        query.andWhere(`a.${key} ILIKE :${key}`, {
          [key]: `%${filters[key]}%`,
        });
    return query.orderBy("a.patrimony");
  }
  async list(filters: Record<string, string>, all = false) {
    const query = this.filteredQuery(filters);
    if (!all) {
      const offset = Number(filters.offset ?? 0),
        limit = Number(filters.limit ?? 1000);
      if (
        !Number.isSafeInteger(offset) ||
        offset > 10000000 ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 5000
      )
        throw new BadRequestException("Paginação inválida.");
      query.skip(offset).take(limit);
    }
    return query.getMany();
  }
  async detail(id: string) {
    const asset = await this.db.getRepository(S.AssetSchema).findOneBy({ id });
    if (!asset) throw new NotFoundException();
    return {
      ...asset,
      movements: await this.db
        .getRepository(S.MovementSchema)
        .find({ where: { assetId: id }, order: { createdAt: "DESC" } }),
      photos: await this.db
        .getRepository(S.PhotoSchema)
        .findBy({ assetId: id }),
      reservations: await this.db
        .getRepository(S.ReservationSchema)
        .find({ where: { assetId: id }, order: { createdAt: "DESC" } }),
    };
  }
  async create(
    input: Record<string, string>,
    actor: Actor,
    previousAssetId?: string,
  ) {
    return this.db.transaction(async (m) => {
      const now = new Date();
      if (previousAssetId)
        input = {
          ...input,
          value: plusOne((await this.locked(m, previousAssetId)).value),
        };
      if (
        input.unitId &&
        !(await m
          .getRepository(S.UnitSchema)
          .findOneBy({ id: input.unitId, active: true }))
      )
        throw new BadRequestException("Unidade inativa ou inexistente.");
      const asset = m.getRepository(S.AssetSchema).create({
        ...input,
        id: randomUUID(),
        status: (input.status ?? "A") as Asset["status"],
        unitId: input.unitId ?? null,
        locationId: null,
        condition: null,
        version: 1,
        availableAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await m.getRepository(S.AssetSchema).save(asset);
      await this.audit(m, asset, null, "INCLUSION", actor);
      return asset;
    });
  }
  async locate(id: string, expected: number, locationId: string, actor: Actor) {
    return this.db.transaction(async (m) => {
      const asset = await this.locked(m, id, expected);
      requireStatus(asset, ["I", "A"]);
      if (
        !(await m
          .getRepository(S.LocationSchema)
          .findOneBy({ id: locationId, active: true }))
      )
        throw new BadRequestException("Localização inativa ou inexistente.");
      const before = { ...asset };
      asset.locationId = locationId;
      return this.save(m, asset, before, "LOCATION", actor);
    });
  }
  async locateBatch(
    inputs: { id: string; expectedVersion: number }[],
    locationId: string,
    actor: Actor,
  ) {
    const preview = await this.previewBatch(
      "locationId",
      locationId,
      inputs,
      undefined,
      actor,
    );
    const { updated, unchanged } = await this.applyBatch(preview.id, actor);
    return { updated, unchanged };
  }
  async assignUnitBatch(
    inputs: { id: string; expectedVersion: number }[],
    unitId: string,
    actor: Actor,
  ) {
    const preview = await this.previewBatch(
      "unitId",
      unitId,
      inputs,
      undefined,
      actor,
    );
    const { updated, unchanged } = await this.applyBatch(preview.id, actor);
    return { updated, unchanged };
  }
  async previewBatch(
    field: "unitId" | "locationId",
    targetId: string,
    inputs: { id: string; expectedVersion: number }[] | undefined,
    filters: Record<string, string> | undefined,
    actor: Actor,
  ) {
    assertPermission(
      actor,
      field === "unitId" ? "batches.unit" : "batches.location",
    );
    if (
      inputs &&
      (!inputs.length ||
        inputs.length > 500 ||
        new Set(inputs.map((a) => a.id)).size !== inputs.length)
    )
      throw new BadRequestException(
        "Selecione de 1 a 500 ativos sem duplicações.",
      );
    if (!!inputs === !!filters)
      throw new BadRequestException("Informe uma seleção ou filtros.");
    const target =
      field === "unitId"
        ? await this.db
            .getRepository(S.UnitSchema)
            .findOneBy({ id: targetId, active: true })
        : await this.db
            .getRepository(S.LocationSchema)
            .findOneBy({ id: targetId, active: true });
    if (!target)
      throw new BadRequestException("Destino inativo ou inexistente.");
    const records = inputs
      ? await this.db
          .getRepository(S.AssetSchema)
          .findBy({ id: In(inputs.map((a) => a.id)) })
      : await this.list(filters!, true);
    if (inputs && records.length !== inputs.length)
      throw new NotFoundException("Ativo não encontrado.");
    const eligible = records.filter((a) => ["I", "A"].includes(a.status));
    if (inputs && eligible.length !== records.length)
      throw new BadRequestException(
        "Selecione apenas bens Incorporados ou Ativos.",
      );
    if (!eligible.length)
      throw new BadRequestException(
        "Nenhum ativo elegível corresponde à seleção.",
      );
    const inputVersions = new Map(
      inputs?.map((i) => [i.id, i.expectedVersion]),
    );
    const items = eligible.map((a) => ({
      id: a.id,
      patrimony: a.patrimony,
      before: a[field],
      expectedVersion: inputVersions.get(a.id) ?? a.version,
    }));
    await this.db.query(
      `DELETE FROM asset_batches WHERE status='PREVIEW' AND "createdAt" < now() - interval '30 minutes'`,
    );
    const id = randomUUID(),
      unchanged = items.filter((i) => i.before === targetId).length;
    const label =
      field === "unitId"
        ? (target as { name: string }).name
        : (target as { description: string }).description;
    await this.db.query(
      `INSERT INTO asset_batches(id,"userId",field,"targetId","targetLabel",status,items,filters,matched,skipped,unchanged) VALUES($1,$2,$3,$4,$5,'PREVIEW',$6,$7,$8,$9,$10)`,
      [
        id,
        actor.id,
        field,
        targetId,
        label,
        JSON.stringify(items),
        filters ? JSON.stringify(filters) : null,
        records.length,
        records.length - eligible.length,
        unchanged,
      ],
    );
    return {
      id,
      field,
      targetLabel: label,
      matched: records.length,
      selected: items.length,
      skipped: records.length - eligible.length,
      unchanged,
      changed: items.length - unchanged,
    };
  }
  async applyBatch(id: string, actor: Actor) {
    return this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout = '10s'");
      const [batch] = await m.query(
        "SELECT * FROM asset_batches WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!batch || batch.userId !== actor.id || batch.status !== "PREVIEW")
        throw new ConflictException("Confirmação inválida ou já utilizada.");
      if (Date.now() - new Date(batch.createdAt).getTime() > 30 * 60 * 1000)
        throw new ConflictException(
          "A confirmação expirou. Selecione os ativos novamente.",
        );
      assertPermission(
        actor,
        batch.field === "unitId" ? "batches.unit" : "batches.location",
      );
      const target =
        batch.field === "unitId"
          ? await m.getRepository(S.UnitSchema).findOne({
              where: { id: batch.targetId, active: true },
              lock: { mode: "pessimistic_read" },
            })
          : await m.getRepository(S.LocationSchema).findOne({
              where: { id: batch.targetId, active: true },
              lock: { mode: "pessimistic_read" },
            });
      if (!target)
        throw new BadRequestException("Destino inativo ou inexistente.");
      const assets = await this.lockBatchAssets(m, batch.items);
      const changes: any[] = [];
      let unchanged = 0;
      const field = batch.field as "unitId" | "locationId";
      for (const item of batch.items) {
        const asset = assets.get(item.id)!;
        requireStatus(asset, ["I", "A"]);
        if (asset[field] === batch.targetId) {
          unchanged++;
          continue;
        }
        changes.push({
          ...item,
          before: asset[field],
          after: batch.targetId,
          appliedVersion: asset.version + 1,
        });
      }
      await this.writeBatch(
        m,
        changes.map((item) => ({
          asset: assets.get(item.id)!,
          value: item.after,
        })),
        field,
        field === "unitId" ? "UNIT_BATCH" : "LOCATION_BATCH",
        actor,
        `Lote ${id}: ${batch.targetLabel}`,
      );
      const updated = changes.length;
      await m.query(
        `UPDATE asset_batches SET status='APPLIED',items=$2,updated=$3,unchanged=$4,"appliedAt"=now() WHERE id=$1`,
        [id, JSON.stringify(changes), updated, unchanged],
      );
      await this.recordBatchEvent(m, id, 1, "APPLY", updated, actor);
      return { id, updated, unchanged };
    });
  }
  async batchHistory(offset = 0) {
    return this.db.query(
      `SELECT b.id,b.field,b."targetLabel",b.status,b.matched,b.skipped,b.updated,b.unchanged,b.revision,b."createdAt",b."appliedAt",b."undoneAt",b."redoneAt",u.name AS "userName",undo.name AS "undoneByName",redo.name AS "redoneByName" FROM asset_batches b JOIN users u ON u.id=b."userId" LEFT JOIN users undo ON undo.id=b."undoneBy" LEFT JOIN users redo ON redo.id=b."redoneBy" WHERE b.status!='PREVIEW' ORDER BY b."appliedAt" DESC,b.id LIMIT 25 OFFSET $1`,
      [offset],
    );
  }
  async batchEvents(id: string) {
    return this.db.query(
      `SELECT e.revision,e.action,e.count,e."createdAt",u.name AS "userName" FROM asset_batch_events e JOIN users u ON u.id=e."userId" WHERE e."batchId"=$1 ORDER BY e.revision`,
      [id],
    );
  }
  private async recordBatchEvent(
    m: EntityManager,
    id: string,
    revision: number,
    action: string,
    count: number,
    actor: Actor,
  ) {
    await m.query(
      `INSERT INTO asset_batch_events(id,"batchId",revision,action,count,"userId") VALUES($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), id, revision, action, count, actor.id],
    );
  }
  private async lockBatchAssets(
    m: EntityManager,
    items: { id: string; expectedVersion: number }[],
  ) {
    await m.query("SET LOCAL lock_timeout = '10s'");
    const records = items.length
      ? await m
          .getRepository(S.AssetSchema)
          .createQueryBuilder("a")
          .where("a.id = ANY(CAST(:ids AS uuid[]))", {
            ids: items.map((i) => i.id),
          })
          .orderBy("a.id", "ASC")
          .setLock("pessimistic_write")
          .getMany()
      : [];
    const assets = new Map(records.map((a) => [a.id, a]));
    if (records.length !== items.length)
      throw new ConflictException(
        "Um ativo não está mais disponível. Nenhuma alteração foi salva.",
      );
    for (const item of items)
      if (assets.get(item.id)!.version !== item.expectedVersion)
        throw new ConflictException(
          "Um ativo mudou após a operação anterior. Nenhuma alteração foi salva. Atualize a seleção ou consulte o histórico.",
        );
    return assets;
  }
  private async writeBatch(
    m: EntityManager,
    changes: { asset: Asset; value: string | null }[],
    field: "unitId" | "locationId",
    operation: string,
    actor: Actor,
    notes: string,
  ) {
    if (!["unitId", "locationId"].includes(field))
      throw new BadRequestException("Campo não permitido.");
    const now = new Date();
    for (let start = 0; start < changes.length; start += 500) {
      const chunk = changes.slice(start, start + 500);
      const values = chunk.map(({ asset, value }) => ({
        id: asset.id,
        expectedVersion: asset.version,
        value,
      }));
      const [result] = await m.query(
        `WITH changed AS (UPDATE assets a SET "${field}"=v.value,version=a.version+1,"updatedAt"=$2 FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,"expectedVersion" integer,value uuid) WHERE a.id=v.id AND a.version=v."expectedVersion" RETURNING a.id) SELECT count(*)::integer AS count FROM changed`,
        [JSON.stringify(values), now],
      );
      if (result.count !== chunk.length)
        throw new ConflictException(
          "O lote mudou durante o processamento. Nenhuma alteração foi salva.",
        );
      const movements = chunk.map(({ asset, value }) => ({
        id: randomUUID(),
        assetId: asset.id,
        userId: actor.id,
        operation,
        before: { ...asset },
        after: {
          ...asset,
          [field]: value,
          version: asset.version + 1,
          updatedAt: now,
        },
        notes,
        createdAt: now,
      }));
      await m.query(
        `INSERT INTO movements(id,"assetId","userId",operation,"before","after",notes,"createdAt") SELECT v.id,v."assetId",v."userId",v.operation,v."before",v."after",v.notes,v."createdAt" FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,"assetId" uuid,"userId" uuid,operation text,"before" jsonb,"after" jsonb,notes text,"createdAt" timestamptz)`,
        [JSON.stringify(movements)],
      );
    }
  }
  async undoBatch(id: string, actor: Actor) {
    return this.reverseBatch(id, actor, false);
  }
  async redoBatch(id: string, actor: Actor) {
    return this.reverseBatch(id, actor, true);
  }
  private async reverseBatch(id: string, actor: Actor, redo: boolean) {
    assertPermission(actor, redo ? "batches.redo" : "batches.undo");
    return this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout = '10s'");
      const [batch] = await m.query(
        "SELECT * FROM asset_batches WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (
        !batch ||
        batch.status !== (redo ? "UNDONE" : "APPLIED") ||
        !batch.updated
      )
        throw new ConflictException(
          redo
            ? "Este lote não pode ser refeito."
            : "Este lote não pode ser desfeito.",
        );
      const field = batch.field as "unitId" | "locationId";
      if (redo) {
        const target =
          field === "unitId"
            ? await m.getRepository(S.UnitSchema).findOne({
                where: { id: batch.targetId, active: true },
                lock: { mode: "pessimistic_read" },
              })
            : await m.getRepository(S.LocationSchema).findOne({
                where: { id: batch.targetId, active: true },
                lock: { mode: "pessimistic_read" },
              });
        if (!target)
          throw new BadRequestException(
            "O destino original está inativo ou indisponível. Nenhuma alteração foi salva.",
          );
      }
      const assets = await this.lockBatchAssets(
        m,
        batch.items.map((i: any) => ({
          id: i.id,
          expectedVersion: redo ? i.undoVersion : i.appliedVersion,
        })),
      );
      for (const item of batch.items) {
        const asset = assets.get(item.id)!;
        if (asset[field] !== (redo ? item.before : item.after))
          throw new ConflictException(
            "Um ativo mudou após o lote. Nenhuma alteração foi salva.",
          );
        if (redo) requireStatus(asset, ["I", "A"]);
      }
      await this.writeBatch(
        m,
        batch.items.map((i: any) => ({
          asset: assets.get(i.id)!,
          value: redo ? i.after : i.before,
        })),
        field,
        redo ? "BATCH_REDO" : "BATCH_UNDO",
        actor,
        `${redo ? "Refazer" : "Desfazer"} lote ${id}`,
      );
      const items = batch.items.map((i: any) => ({
        ...i,
        [redo ? "appliedVersion" : "undoVersion"]:
          assets.get(i.id)!.version + 1,
      }));
      const revision = batch.revision + 1;
      await m.query(
        `UPDATE asset_batches SET status=$2,items=$3,revision=$4,"${redo ? "redoneAt" : "undoneAt"}"=now(),"${redo ? "redoneBy" : "undoneBy"}"=$5 WHERE id=$1`,
        [
          id,
          redo ? "APPLIED" : "UNDONE",
          JSON.stringify(items),
          revision,
          actor.id,
        ],
      );
      await this.recordBatchEvent(
        m,
        id,
        revision,
        redo ? "REDO" : "UNDO",
        batch.updated,
        actor,
      );
      return { id, restored: batch.updated, revision };
    });
  }
  async available(
    id: string,
    expected: number,
    physical: number,
    actor: Actor,
  ) {
    return this.db.transaction(async (m) => {
      const asset = await this.locked(m, id, expected);
      requireStatus(asset, ["I", "A"]);
      if (!(await m.getRepository(S.PhotoSchema).countBy({ assetId: id })))
        throw new BadRequestException(
          "Anexe uma foto antes de disponibilizar.",
        );
      const before = { ...asset };
      asset.status = "D";
      asset.condition = conditionValue(physical);
      asset.availableAt = new Date();
      await this.save(m, asset, before, "AVAILABLE", actor);
      await this.notify(m, asset, "AVAILABLE");
      return asset;
    });
  }
  async notify(m: EntityManager, asset: Asset, kind: string) {
    await m.getRepository(S.OutboxSchema).save({
      id: randomUUID(),
      assetId: asset.id,
      kind,
      payload: {
        patrimony: asset.patrimony,
        description: asset.description,
        condition: asset.condition,
        availableAt: asset.availableAt,
      },
      status: "PENDING",
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    });
  }
  async reserve(
    id: string,
    expected: number,
    destinationUnitId: string,
    actor: Actor,
  ) {
    return this.db.transaction(async (m) => {
      const asset = await this.locked(m, id, expected);
      requireStatus(asset, ["D"]);
      if (
        !(await m
          .getRepository(S.UnitSchema)
          .findOneBy({ id: destinationUnitId, active: true }))
      )
        throw new BadRequestException("Unidade inativa ou inexistente.");
      if (
        await m
          .getRepository(S.ReservationSchema)
          .countBy({ assetId: id, status: In(["RESERVED", "IN_TRANSIT"]) })
      )
        throw new ConflictException("Ativo já reservado.");
      const reservation: Reservation = {
        id: randomUUID(),
        assetId: id,
        destinationUnitId,
        status: "RESERVED",
        createdBy: actor.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await m.getRepository(S.ReservationSchema).save(reservation);
      await this.save(
        m,
        asset,
        { ...asset },
        "RESERVE",
        actor,
        JSON.stringify(reservation),
      );
      return reservation;
    });
  }
  async reservation(
    id: string,
    action: "dispatch" | "complete" | "cancel",
    expected: number,
    actor: Actor,
  ) {
    return this.db.transaction(async (m) => {
      const reference = await m
        .getRepository(S.ReservationSchema)
        .findOneBy({ id });
      if (!reference) throw new NotFoundException();
      const asset = await this.locked(m, reference.assetId, expected);
      const reservation = (await m
        .getRepository(S.ReservationSchema)
        .findOneBy({ id }))!;
      requireStatus(asset, ["D"]);
      const before = { ...asset };
      if (action === "dispatch") {
        if (reservation.status !== "RESERVED") throw new ConflictException();
        reservation.status = "IN_TRANSIT";
      } else if (action === "complete") {
        if (reservation.status !== "IN_TRANSIT") throw new ConflictException();
        reservation.status = "COMPLETED";
        asset.status = "T";
      } else {
        if (!["RESERVED", "IN_TRANSIT"].includes(reservation.status))
          throw new ConflictException();
        reservation.status = "CANCELLED";
        asset.availableAt = new Date();
      }
      reservation.updatedAt = new Date();
      await m.getRepository(S.ReservationSchema).save(reservation);
      await this.save(
        m,
        asset,
        before,
        action.toUpperCase(),
        actor,
        JSON.stringify(reservation),
      );
      return reservation;
    });
  }
  async writeOff(
    ids: { id: string; expectedVersion: number }[],
    justification: string,
    actor: Actor,
  ) {
    return this.db.transaction(async (m) => {
      const result: Asset[] = [];
      for (const input of [...ids].sort((a, b) => a.id.localeCompare(b.id))) {
        const asset = await this.locked(m, input.id, input.expectedVersion);
        requireStatus(asset, ["B"]);
        const before = { ...asset };
        asset.status = "X";
        result.push(
          await this.save(m, asset, before, "WRITE_OFF", actor, justification),
        );
      }
      return result;
    });
  }
  async expire(now = new Date()) {
    return this.db.transaction(async (m) => {
      const days = Number(
        (
          await m
            .getRepository(S.SettingSchema)
            .findOneBy({ name: "PRAZO_BAIXA_DIAS" })
        )?.value ?? 20,
      );
      const candidates = await m
        .getRepository(S.AssetSchema)
        .findBy({ status: "D" });
      let count = 0;
      for (const candidate of candidates.sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        const asset = await this.locked(m, candidate.id);
        if (
          asset.status !== "D" ||
          !isOverdue(asset.availableAt, days, now) ||
          (await m.getRepository(S.ReservationSchema).countBy({
            assetId: asset.id,
            status: In(["RESERVED", "IN_TRANSIT"]),
          }))
        )
          continue;
        const before = { ...asset };
        asset.status = "B";
        await this.save(m, asset, before, "DEADLINE", null);
        await this.notify(m, asset, "WRITE_OFF_READY");
        count++;
      }
      return { count };
    });
  }
  async dashboard() {
    const groups = await this.db
      .getRepository(S.AssetSchema)
      .createQueryBuilder("a")
      .select("a.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("a.status")
      .getRawMany();
    const total = await this.db
      .getRepository(S.AssetSchema)
      .createQueryBuilder("a")
      .select("COALESCE(SUM(a.value),0)::text", "value")
      .getRawOne();
    return {
      totalValue: total.value,
      counts: Object.fromEntries(
        groups.map((g) => [g.status, Number(g.count)]),
      ),
      pendingDivergences: await this.db
        .getRepository(S.DivergenceSchema)
        .countBy({ status: "PENDING" }),
    };
  }
}
