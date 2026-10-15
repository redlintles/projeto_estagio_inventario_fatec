import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  csvReport,
  workbookReport,
  displayCell,
  Report,
} from "../src/reports/reports";
const report: Report = {
  title: "Ativos",
  columns: [
    "Patrimônio",
    "Descrição do bem",
    "Data de incorporação",
    "Valor (R$)",
  ],
  rows: [
    [
      "000123",
      '=HYPERLINK("malicioso")',
      new Date("2026-09-01T00:00:00Z"),
      125.5,
    ],
  ],
  filters: { Unidade: "Fatec" },
  generatedAt: new Date("2026-10-15T15:30:00Z"),
};
describe("Exportação legível de relatórios", () => {
  it("mantém CSV seguro com cabeçalhos mesmo vazio, acentos, decimais e datas civis", () => {
    const csv = csvReport(report);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain('"000123"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"125,50"');
    expect(csv).toContain('"01/09/2026"');
    expect(csvReport({ ...report, rows: [] })).toContain("Patrimônio");
    expect(displayCell(new Date("2026-10-15T02:30:00Z"))).toContain(
      "14/10/2026",
    );
  });
  for (const format of ["xlsx", "ods"] as const)
    it(`gera ${format} com células numéricas, texto seguro, datas e critérios`, () => {
      const data = workbookReport(report, format);
      expect(data.subarray(0, 2).toString()).toBe("PK");
      const book = XLSX.read(data, { type: "buffer", cellNF: true });
      expect(book.SheetNames).toEqual(["Dados", "Sobre o relatório"]);
      const sheet = book.Sheets.Dados;
      expect(sheet.A2.v).toBe("000123");
      expect(sheet.A2.t).toBe("s");
      expect(sheet.B2.f).toBeUndefined();
      expect(sheet.B2.t).toBe("s");
      expect(sheet.D2.t).toBe("n");
      expect(sheet.D2.v).toBe(125.5);
      expect(XLSX.SSF.format("dd/mm/yyyy", sheet.C2.v)).toBe("01/09/2026");
      expect(
        XLSX.utils
          .sheet_to_json(book.Sheets["Sobre o relatório"], { header: 1 })
          .flat(),
      ).toContain("Fatec");
      const empty = XLSX.read(workbookReport({ ...report, rows: [] }, format), {
        type: "buffer",
      });
      expect(empty.Sheets.Dados.A1.v).toBe("Patrimônio");
    });
});
