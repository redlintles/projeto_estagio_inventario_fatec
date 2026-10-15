import { Inject } from "@nestjs/common";
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, In, LessThan } from "typeorm";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import * as S from "../persistence/schemas";
import { Actor } from "../auth/auth";
import { AssetsService } from "../assets/assets.service";
import { ImportRow } from "../domain/model";
import { officialFields, compareFields } from "../domain/rules";
import { assetInput } from "../validation";
import { headers, readSpreadsheet } from "./spreadsheet";
export { headers } from "./spreadsheet";
export interface ImportDecision {
  line: number;
  action: "SKIP" | "APPLY";
  fields?: string[];
}
@Injectable()
export class ImportsService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AssetsService) private readonly assets: AssetsService,
  ) {}
  async preview(
    buffer: Buffer,
    filename: string,
    actor: Actor,
    unitId?: string,
  ) {
    const parsed = readSpreadsheet(buffer);
    return this.db.transaction(async (m) => {
      // Serialize spreadsheet analyses so simultaneous uploads cannot insert the same new asset twice.
      await m.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "patrimonio-import",
      ]);
      await m
        .getRepository(S.ImportBatchSchema)
        .delete({ createdAt: LessThan(new Date(Date.now() - 86400000)) });
      const selectedUnit = unitId
        ? await m.getRepository(S.UnitSchema).findOne({
            where: { id: unitId, active: true },
            lock: { mode: "pessimistic_read" },
          })
        : null;
      if (unitId && !selectedUnit)
        throw new BadRequestException(
          "Selecione uma unidade ativa cadastrada.",
        );
      const comparisonFields = [...officialFields, "unitId"] as const;
      const existingRows = await m
        .getRepository(S.AssetSchema)
        .findBy({ patrimony: In(parsed.map((r) => r.incoming.patrimony)) });
      const existingByPatrimony = new Map(
        existingRows.map((asset) => [asset.patrimony, asset]),
      );
      const repetitions = new Map<string, number>();
      for (const row of parsed)
        repetitions.set(
          row.incoming.patrimony,
          (repetitions.get(row.incoming.patrimony) ?? 0) + 1,
        );
      const rows: ImportRow[] = [],
        issues: { line: number; patrimony: string; errors: string[] }[] = [];
      let imported = 0,
        unchanged = 0;
      for (const row of parsed) {
        const { incoming } = row,
          errors = [...row.errors];
        const existing = existingByPatrimony.get(incoming.patrimony);
        if ((repetitions.get(incoming.patrimony) ?? 0) > 1)
          errors.push(
            "NroPatrimonio repetido: nenhuma das linhas deste patrimônio foi importada.",
          );
        if (errors.length) {
          issues.push({
            line: row.line,
            patrimony: incoming.patrimony,
            errors,
          });
          continue;
        }
        incoming.unitId = unitId ?? existing?.unitId ?? "";
        if (!incoming.status) incoming.status = existing?.status ?? "I";
        if (!existing) {
          const now = new Date();
          const asset = m.getRepository(S.AssetSchema).create({
            ...incoming,
            id: randomUUID(),
            status: incoming.status as "I" | "X" | "A",
            unitId: unitId ?? null,
            locationId: null,
            condition: null,
            version: 1,
            availableAt: null,
            createdAt: now,
            updatedAt: now,
          });
          await m.getRepository(S.AssetSchema).insert(asset);
          await this.assets.audit(
            m,
            asset,
            null,
            "IMPORT",
            actor,
            `Planilha ${filename}; linha ${row.line}`,
          );
          imported++;
          continue;
        }
        const current = Object.fromEntries(
          comparisonFields.map((key) => [key, String(existing[key] ?? "")]),
        );
        const differences = comparisonFields.filter(
          (key) => current[key] !== incoming[key],
        );
        if (!differences.length) {
          unchanged++;
          continue;
        }
        rows.push({
          line: row.line,
          incoming,
          assetId: existing.id,
          expectedVersion: existing.version,
          current,
          differences,
          errors: [],
        });
      }
      const batch = await m.getRepository(S.ImportBatchSchema).save({
        id: randomUUID(),
        userId: actor.id,
        filename,
        rows,
        status: rows.length ? "PREVIEW" : "APPLIED",
        createdAt: new Date(),
      });
      return {
        ...batch,
        imported,
        unchanged,
        issues,
        unitId: unitId ?? null,
        unitName: selectedUnit?.name ?? null,
      };
    });
  }

  async apply(id: string, decisions: ImportDecision[], actor: Actor) {
    return this.db.transaction(async (m) => {
      const batch = await m
        .getRepository(S.ImportBatchSchema)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!batch || batch.userId !== actor.id) throw new NotFoundException();
      if (Date.now() - batch.createdAt.getTime() > 86400000)
        throw new ConflictException(
          "Prévia expirada. Analise a planilha novamente.",
        );
      if (batch.status !== "PREVIEW")
        throw new ConflictException("Importação já aplicada.");
      if (
        batch.rows.some(
          (row) => !row.assetId || row.errors.length || !row.differences.length,
        )
      )
        throw new ConflictException(
          "Reenvie o arquivo para importar automaticamente os registros novos.",
        );
      if (
        decisions.length !== batch.rows.length ||
        batch.rows.some((row) => !decisions.some((d) => d.line === row.line))
      )
        throw new BadRequestException(
          "Escolha uma opção para cada conflito antes de salvar.",
        );
      let imported = 0;
      if (new Set(decisions.map((d) => d.line)).size !== decisions.length)
        throw new BadRequestException("Decisão duplicada.");
      const rowsByLine = new Map(batch.rows.map((row) => [row.line, row]));
      for (const decision of [...decisions].sort((a, b) =>
        (rowsByLine.get(a.line)?.assetId ?? "").localeCompare(
          rowsByLine.get(b.line)?.assetId ?? "",
        ),
      )) {
        const row = rowsByLine.get(decision.line);
        if (!row) throw new BadRequestException("Linha inexistente.");
        if (decision.action === "SKIP") continue;
        if (row.errors.length)
          throw new BadRequestException(
            "Corrija as inconsistências antes de importar.",
          );
        if (row.assetId) {
          const asset = await this.assets.locked(
            m,
            row.assetId,
            row.expectedVersion!,
          );
          const before = { ...asset };
          const fields = decision.fields ?? row.differences;
          if (!fields.length)
            throw new BadRequestException(
              "Selecione um campo ou escolha Manter atual.",
            );
          if (
            fields.some(
              (f) =>
                ![...officialFields, "unitId"].includes(f) ||
                !row.differences.includes(f),
            )
          )
            throw new BadRequestException("Campo não permitido.");
          if (
            fields.includes("unitId") &&
            !(await m
              .getRepository(S.UnitSchema)
              .findOneBy({ id: row.incoming.unitId, active: true }))
          )
            throw new BadRequestException(
              "A unidade selecionada não está mais ativa. Reenvie a planilha.",
            );
          if (
            fields.includes("status") &&
            row.incoming.status !== asset.status
          ) {
            const activeReservations = await m
              .getRepository(S.ReservationSchema)
              .countBy({
                assetId: asset.id,
                status: In(["RESERVED", "IN_TRANSIT"]),
              });
            if (activeReservations)
              throw new ConflictException(
                "Cancele ou conclua a reserva antes de aplicar um status da planilha.",
              );
            asset.availableAt = null;
          }
          for (const key of fields)
            (asset as unknown as Record<string, unknown>)[key] =
              row.incoming[key];
          await this.assets.save(
            m,
            asset,
            before,
            "REIMPORT",
            actor,
            `Planilha ${batch.filename}; linha ${row.line}`,
          );
        }
        imported++;
      }
      batch.status = "APPLIED";
      batch.rows = [];
      await m.getRepository(S.ImportBatchSchema).save(batch);
      return { imported };
    });
  }
  template() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        Object.keys(headers),
        [
          "000001",
          "Mesa escolar",
          "Mobiliário",
          "000001",
          "FATEC",
          "2026-09-30",
          "Incorporado",
          "250.00",
        ],
      ]),
      "Ativos",
    );
    return XLSX.write(book, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }
}
