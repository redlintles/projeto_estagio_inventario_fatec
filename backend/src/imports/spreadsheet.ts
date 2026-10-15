import { BadRequestException } from "@nestjs/common";
import { inflateRawSync } from "node:zlib";
import * as XLSX from "xlsx";
import { assetInput } from "../validation";

export const headers: Record<string, string> = {
  NroPatrimonio: "patrimony",
  "Descrição do Bem": "description",
  "Grupo patrimonial": "group",
  "Código único": "uniqueCode",
  Unidade: "originUnit",
  "Data de Incorporação": "incorporationDate",
  Status: "status",
  "Valor R$": "value",
};
const legacy: Record<string, string> = {
  nro_patrimonio: "patrimony",
  descricao_bem: "description",
  grupo_patrimonial: "group",
  codigo_unico: "uniqueCode",
  unidade_origem: "originUnit",
  data_incorporacao: "incorporationDate",
  valor_bem: "value",
};
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases = new Map(
  Object.entries({ ...headers, ...legacy }).map(([h, k]) => [normalize(h), k]),
);

// Validate real decompressed sizes before SheetJS opens OOXML. Never execute formulas or external links.
export function checkWorkbookSize(buffer: Buffer) {
  if (buffer.length > 8 * 1024 * 1024)
    throw new Error("Arquivo maior que 8 MB.");
  if (buffer.readUInt32LE(0) !== 0x04034b50) {
    if (
      !buffer
        .subarray(0, 8)
        .equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]))
    )
      throw new Error("Use XLSX ou XLS.");
    return;
  }
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Excel inválido.");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16),
    total = 0;
  if (count > 512 || count === 0)
    throw new Error("Arquivo contém entradas demais.");
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Excel inválido.");
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10);
    const packed = buffer.readUInt32LE(offset + 20),
      unpacked = buffer.readUInt32LE(offset + 24);
    const local = buffer.readUInt32LE(offset + 42);
    if (
      flags & 1 ||
      unpacked > 16 * 1024 * 1024 ||
      total + unpacked > 32 * 1024 * 1024
    )
      throw new Error("Excel excede o limite descompactado de 32 MB.");
    if (buffer.readUInt32LE(local) !== 0x04034b50)
      throw new Error("Excel inválido.");
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + packed > buffer.length) throw new Error("Excel incompleto.");
    const data = buffer.subarray(start, start + packed);
    const size =
      method === 0
        ? data.length
        : method === 8
          ? inflateRawSync(data, { maxOutputLength: 16 * 1024 * 1024 }).length
          : -1;
    if (size !== unpacked) throw new Error("Excel inválido.");
    total += size;
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
}
function text(cell?: XLSX.CellObject) {
  if (!cell || cell.v == null) return "";
  if (cell.t === "e") throw new Error("Célula contém erro do Excel.");
  if (cell.t === "n" && /^0+$/.test(String(cell.z ?? "")))
    return XLSX.SSF.format(cell.z!, cell.v);
  return String(cell.v).trim();
}
export function money(value: unknown): string {
  let s = String(value ?? "")
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (s.includes(",")) {
    if (!/^(?:\d{1,3}(?:\.\d{3})*|\d+),\d{1,2}$/.test(s))
      throw new Error("Valor monetário inválido.");
    s = s.replaceAll(".", "").replace(",", ".");
  }
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(s))
    throw new Error("Valor deve ser positivo, com até duas casas decimais.");
  const [whole, cents = ""] = s.split(".");
  return `${BigInt(whole)}.${cents.padEnd(2, "0")}`;
}
export function plusOne(value: string) {
  const [whole, cents] = money(value).split(".");
  return money(`${BigInt(whole) + 1n}.${cents}`);
}
function date(cell: XLSX.CellObject | undefined, date1904: boolean) {
  if (cell?.t === "n") {
    const d = XLSX.SSF.parse_date_code(Number(cell.v), { date1904 });
    if (!d || d.y < 1900 || (d.y === 1900 && d.m === 2 && d.d === 29))
      throw new Error("Data Excel inválida.");
    return `${d.y.toString().padStart(4, "0")}-${d.m.toString().padStart(2, "0")}-${d.d.toString().padStart(2, "0")}`;
  }
  const s = text(cell),
    match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : s;
}
export function readSpreadsheet(buffer: Buffer) {
  try {
    if (buffer.length < 8) throw new Error("Arquivo Excel inválido.");
    checkWorkbookSize(buffer);
    const book = XLSX.read(buffer, {
      type: "buffer",
      cellNF: true,
      cellFormula: true,
      sheetRows: 10003,
    });
    if (book.SheetNames.length !== 1)
      throw new Error("Envie uma planilha com uma única aba de ativos.");
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet?.["!ref"]) throw new Error("Planilha vazia.");
    const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
    if (range.e.r > 10001 || range.e.c > 31)
      throw new Error("Limite de 10.000 ativos e 32 colunas.");
    const columns = new Map<string, number>();
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = aliases.get(
        normalize(text(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })])),
      );
      if (key) {
        if (columns.has(key)) throw new Error(`Cabeçalho duplicado: ${key}`);
        columns.set(key, c);
      }
    }
    const modern = columns.has("status");
    if (Object.values(legacy).some((k) => !columns.has(k)))
      throw new Error(
        `Cabeçalhos obrigatórios: ${Object.keys(headers).join(", ")}`,
      );
    const rows: {
      line: number;
      incoming: Record<string, string>;
      errors: string[];
    }[] = [];
    const seen = new Set<string>();
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const cell = (key: string): XLSX.CellObject | undefined =>
        sheet[XLSX.utils.encode_cell({ r, c: columns.get(key)! })];
      if ([...columns.keys()].every((k) => cell(k)?.v == null)) continue;
      // Only the structurally empty footer is skipped; a legitimate asset named Total is not.
      if (
        r === range.e.r &&
        normalize(text(cell("patrimony"))) === "total" &&
        [
          "description",
          "group",
          "uniqueCode",
          "originUnit",
          "incorporationDate",
          "status",
        ].every((k) => !columns.has(k) || !text(cell(k)))
      )
        continue;
      const incoming: Record<string, string> = {},
        errors: string[] = [];
      for (const key of columns.keys()) {
        try {
          if (key === "incorporationDate")
            incoming[key] = date(cell(key), !!book.Workbook?.WBProps?.date1904);
          else if (key === "value") {
            if (cell(key)?.f && cell(key)?.v == null)
              throw new Error(
                "Recalcule e salve no Excel: fórmula sem resultado armazenado.",
              );
            incoming[key] = money(cell(key)?.v);
          } else if (key === "patrimony" && cell(key)?.t === "n") {
            if (!Number.isSafeInteger(cell(key)?.v) || Number(cell(key)?.v) < 0)
              throw new Error(
                "Identificador numérico inválido; use texto para identificadores longos.",
              );
            incoming[key] = text(cell(key));
          } else incoming[key] = text(cell(key));
        } catch (e) {
          incoming[key] = "";
          errors.push(`${key}: ${(e as Error).message}`);
        }
      }
      if (modern) {
        const source = normalize(incoming.status);
        incoming.status =
          source === "incorporado" ? "I" : source === "baixado" ? "X" : "";
        if (!incoming.status)
          errors.push("Status: use Incorporado ou Baixado.");
      }
      const valid = assetInput.safeParse(incoming);
      if (!valid.success)
        errors.push(
          ...valid.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        );
      if (seen.has(incoming.patrimony))
        errors.push(
          "NroPatrimonio repetido: conciliação ambígua. Revise o arquivo.",
        );
      seen.add(incoming.patrimony);
      // Old files preserve existing operational status; modern files are authoritative.
      rows.push({ line: r + 1, incoming, errors });
    }
    if (!rows.length) throw new Error("Nenhum ativo encontrado.");
    if (rows.length > 10000) throw new Error("Limite de 10.000 ativos.");
    return rows;
  } catch (e) {
    throw new BadRequestException(
      e instanceof Error ? e.message : "Excel inválido.",
    );
  }
}
