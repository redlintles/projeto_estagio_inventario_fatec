import { Inject } from "@nestjs/common";
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import * as S from "../persistence/schemas";
import { Actor } from "../auth/auth";
import { AssetsService } from "../assets/assets.service";
import { ImportRow } from "../domain/model";
import { officialFields, compareFields } from "../domain/rules";
import { assetInput } from "../validation";
export const headers: Record<string, string> = {
  nro_patrimonio: "patrimony",
  descricao_bem: "description",
  grupo_patrimonial: "group",
  codigo_unico: "uniqueCode",
  unidade_origem: "originUnit",
  data_incorporacao: "incorporationDate",
  valor_bem: "value",
};
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
  async preview(buffer: Buffer, filename: string, actor: Actor) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch {
      throw new BadRequestException("Arquivo Excel inválido.");
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new BadRequestException("Planilha vazia.");
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });
    const columns = (grid.shift() ?? []).map((v) => String(v).trim());
    if (Object.keys(headers).some((h) => !columns.includes(h)))
      throw new BadRequestException({
        message: "Cabeçalhos obrigatórios ausentes.",
        expected: Object.keys(headers),
      });
    if (grid.length > 10000)
      throw new BadRequestException("Limite de 10.000 linhas por importação.");
    const rows: ImportRow[] = [],
      patrimonies = new Set<string>(),
      codes = new Set<string>();
    for (let i = 0; i < grid.length; i++) {
      const cells = grid[i];
      if (cells.every((v) => v === "")) continue;
      const incoming: Record<string, string> = {};
      for (const [head, key] of Object.entries(headers)) {
        const raw = cells[columns.indexOf(head)];
        incoming[key] =
          raw instanceof Date
            ? raw.toISOString().slice(0, 10)
            : String(raw).trim();
      }
      if (incoming.value)
        incoming.value = Number(incoming.value.replace(",", ".")).toFixed(2);
      const errors: string[] = [];
      const validation = assetInput.safeParse(incoming);
      if (!validation.success)
        errors.push(
          ...validation.error.issues.map(
            (e) => `${e.path.join(".")}: ${e.message}`,
          ),
        );
      if (patrimonies.has(incoming.patrimony) || codes.has(incoming.uniqueCode))
        errors.push("Patrimônio ou código duplicado no arquivo.");
      patrimonies.add(incoming.patrimony);
      codes.add(incoming.uniqueCode);
      const existing = await this.db
        .getRepository(S.AssetSchema)
        .findOneBy({ patrimony: incoming.patrimony });
      const codeOwner = await this.db
        .getRepository(S.AssetSchema)
        .findOneBy({ uniqueCode: incoming.uniqueCode });
      if (codeOwner && codeOwner.id !== existing?.id)
        errors.push("Código único pertence a outro patrimônio.");
      const current = existing
        ? Object.fromEntries(
            officialFields.map((key) => [key, String(existing[key])]),
          )
        : null;
      rows.push({
        line: i + 2,
        incoming,
        assetId: existing?.id ?? null,
        expectedVersion: existing?.version ?? null,
        current,
        differences: current ? compareFields(current, incoming) : [],
        errors,
      });
    }
    return this.db.getRepository(S.ImportBatchSchema).save({
      id: randomUUID(),
      userId: actor.id,
      filename,
      rows,
      status: "PREVIEW",
      createdAt: new Date(),
    });
  }
  async apply(id: string, decisions: ImportDecision[], actor: Actor) {
    return this.db.transaction(async (m) => {
      const batch = await m
        .getRepository(S.ImportBatchSchema)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!batch) throw new NotFoundException();
      if (batch.status !== "PREVIEW")
        throw new ConflictException("Importação já aplicada.");
      let imported = 0;
      if (new Set(decisions.map((d) => d.line)).size !== decisions.length)
        throw new BadRequestException("Decisão duplicada.");
      for (const decision of [...decisions].sort((a, b) =>
        (
          batch.rows.find((r) => r.line === a.line)?.assetId ?? ""
        ).localeCompare(
          batch.rows.find((r) => r.line === b.line)?.assetId ?? "",
        ),
      )) {
        const row = batch.rows.find((r) => r.line === decision.line);
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
          if (asset.status === "X")
            throw new ConflictException("Ativo baixado é somente histórico.");
          const before = { ...asset };
          const fields = decision.fields ?? row.differences;
          if (
            fields.some(
              (f) =>
                !officialFields.includes(f as (typeof officialFields)[number]),
            )
          )
            throw new BadRequestException("Campo não permitido.");
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
        } else {
          const now = new Date();
          const asset = m.getRepository(S.AssetSchema).create({
            ...row.incoming,
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
          await this.assets.audit(
            m,
            asset,
            null,
            "IMPORT",
            actor,
            `Linha ${row.line}`,
          );
        }
        imported++;
      }
      batch.status = "APPLIED";
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
          "250.00",
        ],
      ]),
      "Ativos",
    );
    return XLSX.write(book, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }
}
