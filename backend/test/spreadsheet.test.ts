import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  headers,
  readSpreadsheet,
  money,
  plusOne,
} from "../src/imports/spreadsheet";
import { AttemptLimiter } from "../src/auth/rate-limit";
function file(rows: unknown[][], mutate?: (s: XLSX.WorkSheet) => void) {
  const sheet = XLSX.utils.aoa_to_sheet([Object.keys(headers), ...rows]);
  mutate?.(sheet);
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, sheet, "Base");
  return XLSX.write(w, { type: "buffer", bookType: "xlsx" });
}
const row = [
  123,
  "Mesa fictícia",
  "Mobiliário",
  "0001/26",
  "270",
  46174,
  "Incorporado",
  1,
];
describe("Modelo institucional e limites de importação", () => {
  it("preserva cabeçalhos, códigos compartilhados, datas Excel e caches de fórmulas sem executá-las", () => {
    const result = readSpreadsheet(
      file(
        [
          row,
          [124, ...row.slice(1, 6), "Baixado", 2],
          ["Total", null, null, null, null, null, null, 3],
        ],
        (s) => {
          s.A2.z = "#,##0.00";
          s.H3 = { t: "n", v: 2, f: "H2+1" };
          s.H4 = { t: "n", v: 3, f: "SUM(H2:H3)" };
        },
      ),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.errors)).toEqual([[], []]);
    expect(result[0].incoming).toMatchObject({
      patrimony: "123",
      uniqueCode: "0001/26",
      incorporationDate: "2026-06-01",
      value: "1.00",
      status: "I",
    });
    expect(result[1].incoming.status).toBe("X");
  });
  it("não descarta linha inválida e preserva zeros à esquerda", () => {
    const result = readSpreadsheet(
      file(
        [
          ["000001", ...row.slice(1)],
          [125, ...row.slice(1)],
        ],
        (s) => {
          s.G3.v = "Desconhecido";
        },
      ),
    );
    expect(result[0].incoming.patrimony).toBe("000001");
    expect(result[1].line).toBe(3);
    expect(result[1].errors.length).toBeGreaterThan(0);
  });
  it("recusa patrimônio repetido e cabeçalho duplicado sem escolher silenciosamente", () => {
    expect(readSpreadsheet(file([row, row]))[1].errors).toContain(
      "NroPatrimonio repetido: conciliação ambígua. Revise o arquivo.",
    );
    expect(() =>
      readSpreadsheet(
        file([row], (s) => {
          s.B1.v = "NroPatrimonio";
        }),
      ),
    ).toThrow();
  });
  it("exige cache de fórmula e recusa arquivo disfarçado ou dimensão excessiva", () => {
    expect(
      readSpreadsheet(
        file([row], (s) => {
          s.H2 = { t: "n", f: "H1+1" };
        }),
      )[0].errors.length,
    ).toBeGreaterThan(0);
    expect(() => readSpreadsheet(Buffer.from("not an Excel file"))).toThrow();
    expect(() =>
      readSpreadsheet(
        file([row], (s) => {
          s["!ref"] = "A1:AG3";
        }),
      ),
    ).toThrow();
  });
  it("rejeita zip com tamanho real descompactado acima do declarado", () => {
    const buffer = file([row]);
    const tampered = Buffer.from(buffer);
    const central = tampered.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    tampered.writeUInt32LE(40 * 1024 * 1024, central + 24);
    expect(() => readSpreadsheet(tampered)).toThrow();
  });
  it("calcula valores nativamente sem imprecisão de centavos", () => {
    expect(money("R$ 1.234,56")).toBe("1234.56");
    expect(plusOne("12.99")).toBe("13.99");
    expect(() => money("1,2,3")).toThrow();
    expect(() => money("=H2+1")).toThrow();
    expect(() => money("-1")).toThrow();
  });
});
describe("Limitação de autenticação", () => {
  it("limita tentativas antes do hash, expira contadores e limita crescimento", () => {
    const l = new AttemptLimiter(1);
    l.take("a", 1, 100, 0);
    expect(() => l.take("a", 1, 100, 10)).toThrow();
    expect(() => l.take("b", 1, 100, 10)).toThrow();
    expect(() => l.take("b", 1, 100, 101)).not.toThrow();
  });
});
