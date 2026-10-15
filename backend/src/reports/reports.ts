import { BadRequestException } from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { z } from "zod";
import * as XLSX from "xlsx";
import { AssetsService } from "../assets/assets.service";
import * as S from "../persistence/schemas";
import { parse, uuid } from "../validation";
export const reportNames: Record<string, string> = {
  byLocation: "Ativos",
  available: "Disponibilizados",
  transferred: "Transferidos",
  writtenOff: "Baixados",
  inventories: "Conferências de inventário",
  divergences: "Divergências",
  movements: "Histórico de movimentações",
};
const statuses: Record<string, string> = {
  I: "Incorporado",
  A: "Ativo",
  D: "Disponibilizado",
  B: "A baixar",
  T: "Transferido",
  X: "Baixado",
};
const operations: Record<string, string> = {
  INCLUSION: "Inclusão",
  IMPORT: "Importação",
  REIMPORT: "Atualização por planilha",
  LOCATION: "Atualização de localização",
  LOCATION_BATCH: "Localização em lote",
  UNIT_BATCH: "Unidade em lote",
  BATCH_REDO: "Reaplicação de lote",
  BATCH_UNDO: "Reversão de lote",
  AVAILABLE: "Disponibilização",
  RESERVE: "Reserva",
  RESERVED: "Reserva",
  CANCEL_RESERVATION: "Cancelamento de reserva",
  START_TRANSPORT: "Início do transporte",
  TRANSFER: "Transferência",
  TRANSFERRED: "Transferência",
  DISPATCH: "Início do transporte",
  TRANSPORT: "Início do transporte",
  CANCEL: "Cancelamento de reserva",
  COMPLETE: "Transferência concluída",
  DEADLINE: "Prazo expirado",
  DIVERGENCE: "Registro de divergência",
  DIVERGENCE_RESOLVED: "Resolução de divergência",
  WRITE_OFF: "Baixa definitiva",
  EXPIRE: "Prazo expirado",
  INVENTORY: "Conferência de inventário",
};
const types: Record<string, string> = {
  WRONG_LABEL: "Etiqueta incorreta",
  WRONG_ITEM: "Bem diferente",
  DUPLICATE: "Patrimônio duplicado",
  WRONG_LOCATION: "Localização incorreta",
  OTHER: "Outra divergência",
};
export type ReportCell = string | number | Date;
export type Report = {
  title: string;
  columns: string[];
  rows: ReportCell[][];
  filters: Record<string, string>;
  generatedAt: Date;
};
const querySchema = z
  .object({
    format: z.enum(["csv", "xlsx", "ods"]).default("csv"),
    status: z
      .union([z.enum(["I", "A", "D", "B", "T", "X"]), z.literal("")])
      .optional(),
    unitId: z.union([uuid, z.literal("none"), z.literal("")]).optional(),
    locationId: z.union([uuid, z.literal("none"), z.literal("")]).optional(),
    patrimony: z.string().max(100).optional(),
    description: z.string().max(255).optional(),
    group: z.string().max(100).optional(),
    dateFrom: z.union([z.iso.date(), z.literal("")]).optional(),
    dateTo: z.union([z.iso.date(), z.literal("")]).optional(),
  })
  .strict();
export class ReportsService {
  constructor(
    private db: DataSource,
    private assets: AssetsService,
  ) {}
  async build(kind: string, query: Record<string, string>): Promise<Report> {
    if (!reportNames[kind])
      throw new BadRequestException("Relatório inexistente.");
    const { format, dateFrom, dateTo, ...filters } = parse(querySchema, query);
    if (dateFrom && dateTo && dateFrom > dateTo)
      throw new BadRequestException(
        "A data inicial deve ser anterior ou igual à final.",
      );
    const forced: Record<string, "D" | "T" | "X"> = {
      available: "D",
      transferred: "T",
      writtenOff: "X",
    };
    if (forced[kind] && filters.status && filters.status !== forced[kind])
      throw new BadRequestException(
        "Status incompatível com o relatório escolhido.",
      );
    if (forced[kind]) filters.status = forced[kind];
    const [records, units, locations, users, inventories] = await Promise.all([
      this.assets.list(filters, true),
      this.db.getRepository(S.UnitSchema).find(),
      this.db.getRepository(S.LocationSchema).find(),
      this.db.getRepository(S.UserSchema).find(),
      this.db.getRepository(S.InventorySchema).find(),
    ]);
    const assetMap = new Map(records.map((a) => [a.id, a]));
    const reference = (code: string, label: string) =>
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(code) ? label : `${code} · ${label}`;
    const unitMap = new Map(
      units.map((u) => [u.id, reference(u.code, u.name)]),
    );
    const locationMap = new Map(
      locations.map((l) => [l.id, reference(l.code, l.description)]),
    );
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const unit = (id: string | null) =>
      id ? (unitMap.get(id) ?? "Unidade indisponível") : "Não vinculada";
    const location = (id: string | null) =>
      id ? (locationMap.get(id) ?? "Localização indisponível") : "Não definida";
    const user = (id: string | null) =>
      id ? (userMap.get(id) ?? "Usuário indisponível") : "Processo automático";
    const inventoryMap = new Map(
      inventories.map((i) => [
        i.id,
        `${location(i.locationId)} · ${displayCell(i.startedAt)}`,
      ]),
    );
    const readable = (text: string) =>
      text.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        (id) =>
          unitMap.get(id) ??
          locationMap.get(id) ??
          userMap.get(id) ??
          assetMap.get(id)?.patrimony ??
          "referência interna",
      );
    const noteText = (text: string) => {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          if (parsed.destinationUnitId)
            return `Destino: ${unit(parsed.destinationUnitId)}; Situação: ${{ RESERVED: "Reservada", IN_TRANSIT: "Em transporte", COMPLETED: "Concluída", CANCELLED: "Cancelada" }[parsed.status as "RESERVED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"] ?? "Não informada"}`;
          return "Detalhes adicionais disponíveis na auditoria do sistema";
        }
      } catch {}
      return readable(text);
    };
    const inPeriod = (value: Date | string) => {
      const day =
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? value
          : new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(value));
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    };
    const baseColumns = [
      "Patrimônio",
      "Descrição do bem",
      "Grupo patrimonial",
      "Unidade cadastrada",
      "Localização atual",
    ];
    const base = (id: string): ReportCell[] => {
      const a = assetMap.get(id)!;
      return [
        a.patrimony,
        a.description,
        a.group,
        unit(a.unitId),
        location(a.locationId),
      ];
    };
    let columns: string[],
      rows: ReportCell[][] = [];
    const ids = [...assetMap.keys()];
    if (kind === "movements") {
      columns = [
        ...baseColumns,
        "Data da movimentação",
        "Operação",
        "Responsável",
        "Alterações",
        "Observações",
      ];
      const changes = (
        before: Record<string, unknown> | null,
        after: Record<string, unknown>,
      ) => {
        const labels: Record<string, string> = {
          patrimony: "Patrimônio",
          description: "Descrição",
          group: "Grupo",
          originUnit: "Unidade original",
          unitId: "Unidade cadastrada",
          locationId: "Localização",
          status: "Status",
          condition: "Condição",
          value: "Valor",
          incorporationDate: "Incorporação",
        };
        const show = (key: string, v: unknown) =>
          key === "unitId"
            ? unit(v as string | null)
            : key === "locationId"
              ? location(v as string | null)
              : key === "status"
                ? (statuses[String(v)] ?? "Não informado")
                : v == null
                  ? "Não informado"
                  : readable(String(v));
        return (
          Object.entries(labels)
            .filter(([k]) => before?.[k] !== after[k])
            .map(
              ([k, label]) =>
                `${label}: ${show(k, before?.[k])} → ${show(k, after[k])}`,
            )
            .join("; ") || "Sem alteração cadastral"
        );
      };
      if (ids.length)
        rows = (
          await this.db.getRepository(S.MovementSchema).find({
            where: { assetId: In(ids) },
            order: { createdAt: "DESC", id: "ASC" },
          })
        )
          .filter((m) => inPeriod(m.createdAt))
          .map((m) => [
            ...base(m.assetId),
            m.createdAt,
            operations[m.operation] ?? m.operation,
            user(m.userId),
            changes(
              m.before as unknown as Record<string, unknown>,
              m.after as unknown as Record<string, unknown>,
            ),
            noteText(m.notes),
          ]);
    } else if (kind === "divergences") {
      columns = [
        ...baseColumns,
        "Localização conferida",
        "Tipo de divergência",
        "Descrição encontrada",
        "Observações",
        "Situação",
        "Resolução",
        "Responsável",
        "Registrada em",
        "Resolvida em",
      ];
      if (ids.length)
        rows = (
          await this.db.getRepository(S.DivergenceSchema).find({
            where: { assetId: In(ids) },
            order: { createdAt: "DESC", id: "ASC" },
          })
        )
          .filter((d) => inPeriod(d.createdAt))
          .map((d) => [
            ...base(d.assetId),
            location(d.locationId),
            types[d.type] ?? d.type,
            d.foundDescription,
            readable(d.notes),
            d.status === "PENDING" ? "Pendente" : "Resolvida",
            readable(d.resolution ?? ""),
            user(d.userId),
            d.createdAt,
            d.resolvedAt ?? "",
          ]);
    } else if (kind === "inventories") {
      columns = [
        ...baseColumns,
        "Inventário (local e início)",
        "Resultado",
        "Conferido por",
        "Data da conferência",
      ];
      if (ids.length)
        rows = (
          await this.db.getRepository(S.InventoryItemSchema).find({
            where: { assetId: In(ids) },
            order: { observedAt: "DESC", id: "ASC" },
          })
        )
          .filter((i) => inPeriod(i.observedAt))
          .map((i) => [
            ...base(i.assetId),
            inventoryMap.get(i.inventoryId) ?? "Inventário indisponível",
            i.result === "CONFIRMED"
              ? "Conferência correta"
              : "Com divergência",
            user(i.userId),
            i.observedAt,
          ]);
    } else {
      columns = [
        ...baseColumns,
        "Unidade original (planilha)",
        "Código único",
        "Data de incorporação",
        "Status",
        "Condição física",
        "Valor (R$)",
      ];
      rows = records
        .filter((a) => inPeriod(a.incorporationDate))
        .map((a) => [
          ...base(a.id),
          a.originUnit,
          a.uniqueCode,
          new Date(`${a.incorporationDate}T00:00:00Z`),
          statuses[a.status],
          a.condition ?? "Não avaliada",
          Number(a.value),
        ]);
    }
    const filterLabels: Record<string, string> = {
      patrimony: "Patrimônio contém",
      description: "Descrição contém",
      group: "Grupo contém",
      status: "Status",
      unitId: "Unidade cadastrada",
      locationId: "Localização atual",
    };
    const applied: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters))
      if (value)
        applied[filterLabels[key]] =
          key === "unitId"
            ? value === "none"
              ? "Sem unidade vinculada"
              : unit(value)
            : key === "locationId"
              ? value === "none"
                ? "Sem localização"
                : location(value)
              : key === "status"
                ? statuses[value]
                : value;
    if (dateFrom) applied["Data inicial"] = dateFrom;
    if (dateTo) applied["Data final"] = dateTo;
    applied["Referência do período"] = [
      "movements",
      "divergences",
      "inventories",
    ].includes(kind)
      ? "Data da movimentação, registro da divergência ou conferência; fuso de São Paulo"
      : "Data de incorporação";
    return {
      title: reportNames[kind],
      columns,
      rows,
      filters: applied,
      generatedAt: new Date(),
    };
  }
}
export function displayCell(value: ReportCell, column = ""): string {
  if (value instanceof Date && column === "Data de incorporação")
    return value.toISOString().slice(0, 10).split("-").reverse().join("/");
  if (value instanceof Date)
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(value);
  if (typeof value === "number" && column === "Valor (R$)")
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  return String(value);
}
export function csvReport(report: Report) {
  const cell = (value: ReportCell, column = "") => {
    let text =
      value instanceof Date
        ? displayCell(value, column)
        : typeof value === "number"
          ? (column === "Valor (R$)"
              ? value.toFixed(2)
              : String(value)
            ).replace(".", ",")
          : value;
    if (/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return (
    "\ufeff" +
    [report.columns, ...report.rows]
      .map((row) => row.map((v, c) => cell(v, report.columns[c])).join(";"))
      .join("\r\n")
  );
}
export function workbookReport(report: Report, format: "xlsx" | "ods"): Buffer {
  const book = XLSX.utils.book_new();
  // Date cells store Brazilian wall-clock time; numeric currency cells remain calculable.
  const values = report.rows.map((row) =>
    row.map((v, c) =>
      v instanceof Date
        ? (report.columns[c] === "Data de incorporação"
            ? v.getTime()
            : new Date(
                new Intl.DateTimeFormat("sv-SE", {
                  timeZone: "America/Sao_Paulo",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hourCycle: "h23",
                })
                  .format(v)
                  .replace(" ", "T") + "Z",
              ).getTime()) /
            86400000 +
          25569
        : v,
    ),
  );
  const sheet = XLSX.utils.aoa_to_sheet([report.columns, ...values], {
    dateNF: "dd/mm/yyyy hh:mm",
  });
  sheet["!cols"] = report.columns.map((c) => ({
    wch:
      c.includes("Descrição") || c === "Alterações" || c === "Observações"
        ? 60
        : c.includes("Unidade") ||
            c.includes("Localização") ||
            c.includes("Inventário")
          ? 35
          : 25,
  }));
  sheet["!autofilter"] = { ref: sheet["!ref"]! };
  report.rows.forEach((row, r) =>
    row.forEach((v, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: r + 1, c })];
      if (v instanceof Date)
        cell.z =
          report.columns[c] === "Data de incorporação"
            ? "dd/mm/yyyy"
            : "dd/mm/yyyy hh:mm";
      if (report.columns[c] === "Valor (R$)") cell.z = '"R$" #,##0.00';
    }),
  );
  const info = XLSX.utils.aoa_to_sheet([
    ["Relatório", report.title],
    ["Gerado em (São Paulo)", displayCell(report.generatedAt)],
    ["Quantidade de registros", report.rows.length],
    ...Object.entries(report.filters),
    [
      "Critérios",
      Object.keys(report.filters).length === 1
        ? "Todos os registros"
        : "Conforme filtros acima",
    ],
    [
      "Observação",
      "Unidade e localização correspondem ao cadastro atual. UUIDs internos não são exportados.",
    ],
    [
      "Datas",
      "Datas e horários seguem o fuso de São Paulo; incorporação é uma data civil.",
    ],
  ]);
  info["!cols"] = [{ wch: 32 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(book, sheet, "Dados");
  XLSX.utils.book_append_sheet(book, info, "Sobre o relatório");
  return XLSX.write(book, {
    bookType: format,
    type: "buffer",
    cellStyles: true,
    compression: true,
  });
}
