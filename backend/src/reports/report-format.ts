import * as XLSX from "xlsx";
import type { Report, ReportCell } from "./reports";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const spreadsheetDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function displayCell(value: ReportCell, column = ""): string {
  if (value instanceof Date && column === "Data de incorporação")
    return value.toISOString().slice(0, 10).split("-").reverse().join("/");
  if (value instanceof Date) return dateTimeFormatter.format(value);
  if (typeof value === "number" && column === "Valor (R$)")
    return currencyFormatter.format(value);
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
      .map((row) =>
        row
          .map((value, columnIndex) => cell(value, report.columns[columnIndex]))
          .join(";"),
      )
      .join("\r\n")
  );
}
export function workbookReport(report: Report, format: "xlsx" | "ods"): Buffer {
  const book = XLSX.utils.book_new();
  // As datas seguem o horário de São Paulo; valores continuam sendo números na planilha.
  const values = report.rows.map((row) =>
    row.map((value, columnIndex) =>
      value instanceof Date
        ? (report.columns[columnIndex] === "Data de incorporação"
            ? value.getTime()
            : new Date(
                spreadsheetDateFormatter.format(value).replace(" ", "T") + "Z",
              ).getTime()) /
            86400000 +
          25569
        : value,
    ),
  );
  const sheet = XLSX.utils.aoa_to_sheet([report.columns, ...values], {
    dateNF: "dd/mm/yyyy hh:mm",
  });
  sheet["!cols"] = report.columns.map((columnName) => ({
    wch:
      columnName.includes("Descrição") ||
      columnName === "Alterações" ||
      columnName === "Observações"
        ? 60
        : columnName.includes("Unidade") ||
            columnName.includes("Localização") ||
            columnName.includes("Inventário")
          ? 35
          : 25,
  }));
  sheet["!autofilter"] = { ref: sheet["!ref"]! };
  report.rows.forEach((row, rowIndex) =>
    row.forEach((value, columnIndex) => {
      const cell =
        sheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
      if (value instanceof Date)
        cell.z =
          report.columns[columnIndex] === "Data de incorporação"
            ? "dd/mm/yyyy"
            : "dd/mm/yyyy hh:mm";
      if (report.columns[columnIndex] === "Valor (R$)")
        cell.z = '"R$" #,##0.00';
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
