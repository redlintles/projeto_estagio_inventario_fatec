import { BadRequestException } from "@nestjs/common";
import { DataSource, EntitySchema, ObjectLiteral } from "typeorm";

export const MAX_REPORT_ROWS = 20000;
const ASSETS_PER_QUERY = 500;

export function assertReportSize(count: number) {
  if (count > MAX_REPORT_ROWS)
    throw new BadRequestException(
      "O relatório excede 20.000 bens ou registros. Restrinja os filtros e exporte em partes; nenhum arquivo parcial foi gerado.",
    );
}

// Filtrar no banco evita carregar todo o histórico para depois descartar as datas.
export async function readReportEvents<T extends ObjectLiteral>(
  database: DataSource,
  schema: EntitySchema<T>,
  assetIds: string[],
  dateColumn: "createdAt" | "observedAt",
  dateFrom?: string,
  dateTo?: string,
): Promise<T[]> {
  const records: T[] = [];
  for (let offset = 0; offset < assetIds.length; offset += ASSETS_PER_QUERY) {
    const query = database
      .getRepository(schema)
      .createQueryBuilder("event")
      .where("event.assetId IN (:...assetIds)", {
        assetIds: assetIds.slice(offset, offset + ASSETS_PER_QUERY),
      });
    if (dateFrom)
      query.andWhere(
        `event.${dateColumn} >= (CAST(:dateFrom AS date)::timestamp AT TIME ZONE 'America/Sao_Paulo')`,
        { dateFrom },
      );
    if (dateTo)
      query.andWhere(
        `event.${dateColumn} < ((CAST(:dateTo AS date) + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')`,
        { dateTo },
      );
    records.push(
      ...(await query
        .orderBy(`event.${dateColumn}`, "DESC")
        .addOrderBy("event.id", "ASC")
        .take(MAX_REPORT_ROWS + 1 - records.length)
        .getMany()),
    );
    assertReportSize(records.length);
  }
  // Cada consulta ordena seu bloco; esta etapa mantém a ordem do arquivo inteiro.
  return records.sort(
    (left, right) =>
      new Date(right[dateColumn]).getTime() -
        new Date(left[dateColumn]).getTime() ||
      String(left.id).localeCompare(String(right.id)),
  );
}
