import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { randomUUID } from "node:crypto";
import * as S from "../persistence/schemas";
import { Location } from "../domain/model";

export interface LocationInput {
  code: string;
  description: string;
  building: string;
  floor: string;
  notes: string;
  unitId: string;
}

@Injectable()
export class LocationsService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  list() {
    return this.db
      .getRepository(S.LocationSchema)
      .find({ order: { code: "ASC" } });
  }

  async create(input: LocationInput) {
    return this.db.transaction(async (m) => {
      await this.requireUnit(m, input.unitId);
      await this.requireFreeCode(m, input.unitId, input.code);
      return m
        .getRepository(S.LocationSchema)
        .save({ id: randomUUID(), ...input, active: true });
    });
  }

  async update(
    id: string,
    input: Partial<LocationInput & { active: boolean }>,
  ) {
    return this.db.transaction(async (m) => {
      const location = await m
        .getRepository(S.LocationSchema)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!location) throw new NotFoundException("Localização não encontrada.");
      const unitId = input.unitId ?? location.unitId;
      const code = input.code ?? location.code;
      if (input.unitId !== undefined && input.unitId !== location.unitId)
        await this.requireUnit(m, input.unitId);
      if (unitId !== location.unitId || code !== location.code)
        await this.requireFreeCode(m, unitId, code, id);
      if (input.active === false)
        await this.requireNoOpenInventory(
          m,
          id,
          "Há um inventário em andamento nesta localização. Conclua ou cancele antes de inativá-la.",
        );
      const updated: Location = { ...location, ...input };
      return m.getRepository(S.LocationSchema).save(updated);
    });
  }

  /**
   * Exclusão definitiva só é permitida para cadastros sem histórico.
   * Salas já usadas por bens, inventários, divergências, movimentações ou lotes
   * devem ser inativadas, para não apagar a rastreabilidade.
   */
  async remove(id: string) {
    return this.db.transaction(async (m) => {
      const location = await m
        .getRepository(S.LocationSchema)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!location) throw new NotFoundException("Localização não encontrada.");
      const [usage] = (await m.query(
        `SELECT
          (SELECT count(*) FROM assets WHERE "locationId"=$1)::int AS assets,
          (SELECT count(*) FROM inventories WHERE "locationId"=$1)::int AS inventories,
          (SELECT count(*) FROM divergences WHERE "locationId"=$1)::int AS divergences,
          (SELECT count(*) FROM movements WHERE before->>'locationId'=$2 OR after->>'locationId'=$2)::int AS movements,
          (SELECT count(*) FROM asset_batches WHERE "targetId"=$1 OR items::text LIKE '%' || $2 || '%')::int AS batches`,
        [id, id],
      )) as Record<string, number>[];
      const labels: Record<string, string> = {
        assets: "bens",
        inventories: "inventários",
        divergences: "divergências",
        movements: "movimentações",
        batches: "lotes",
      };
      const used = Object.entries(usage)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${count} ${labels[key]}`);
      if (used.length)
        throw new ConflictException(
          `Esta localização possui histórico (${used.join(", ")}) e não pode ser excluída. Inative-a para impedir novos usos e preservar a rastreabilidade.`,
        );
      await m.getRepository(S.LocationSchema).delete({ id });
      return { id, deleted: true };
    });
  }

  private async requireUnit(m: EntityManager, unitId: string) {
    if (
      !(await m
        .getRepository(S.UnitSchema)
        .findOneBy({ id: unitId, active: true }))
    )
      throw new BadRequestException("Selecione uma unidade ativa cadastrada.");
  }

  private async requireFreeCode(
    m: EntityManager,
    unitId: string | null,
    code: string,
    ignoreId?: string,
  ) {
    const rows = (await m.query(
      `SELECT id FROM locations WHERE code=$1 AND "unitId" IS NOT DISTINCT FROM $2 AND ($3::uuid IS NULL OR id<>$3) LIMIT 1`,
      [code, unitId, ignoreId ?? null],
    )) as unknown[];
    if (rows.length)
      throw new ConflictException(
        "Já existe uma localização com este código nesta unidade.",
      );
  }

  private async requireNoOpenInventory(
    m: EntityManager,
    locationId: string,
    message: string,
  ) {
    if (
      await m
        .getRepository(S.InventorySchema)
        .existsBy({ locationId, status: "OPEN" })
    )
      throw new ConflictException(message);
  }
}
