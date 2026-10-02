import { Inject } from "@nestjs/common";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { randomUUID } from "node:crypto";
import * as S from "../persistence/schemas";
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
  async list(filters: Record<string, string>, all = false) {
    const query = this.db.getRepository(S.AssetSchema).createQueryBuilder("a");
    for (const key of ["status", "locationId"])
      if (filters[key])
        query.andWhere(`a.${key} = :${key}`, { [key]: filters[key] });
    for (const key of ["patrimony", "description", "group"])
      if (filters[key])
        query.andWhere(`a.${key} ILIKE :${key}`, {
          [key]: `%${filters[key]}%`,
        });
    query.orderBy("a.patrimony");
    if (!all) {
      const offset = Number(filters.offset ?? 0),
        limit = Number(filters.limit ?? 1000);
      if (
        !Number.isInteger(offset) ||
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
  async create(input: Record<string, string>, actor: Actor) {
    return this.db.transaction(async (m) => {
      const now = new Date();
      const asset = m.getRepository(S.AssetSchema).create({
        ...input,
        id: randomUUID(),
        status: "A",
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
      requireStatus(asset, ["A"]);
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
  async available(
    id: string,
    expected: number,
    physical: number,
    actor: Actor,
  ) {
    return this.db.transaction(async (m) => {
      const asset = await this.locked(m, id, expected);
      requireStatus(asset, ["A"]);
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
    return {
      counts: Object.fromEntries(
        groups.map((g) => [g.status, Number(g.count)]),
      ),
      pendingDivergences: await this.db
        .getRepository(S.DivergenceSchema)
        .countBy({ status: "PENDING" }),
    };
  }
}
