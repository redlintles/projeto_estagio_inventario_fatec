import { describe, it, expect } from "vitest";
import {
  checkVersion,
  conditionValue,
  isOverdue,
  compareFields,
} from "../src/domain/rules";
import { hashPassword, verifyPassword } from "../src/auth/auth";
import { toCsv } from "../src/controller";
import { Asset } from "../src/domain/model";
describe("Regras patrimoniais", () => {
  it("aceita somente condição inteira de 1 a 5", () => {
    for (const value of [0, 6, 2.5, -1])
      expect(() => conditionValue(value)).toThrow();
    expect(conditionValue(5)).toBe(5);
  });
  it("respeita estritamente dias > prazo, e não >=", () => {
    const date = new Date("2026-09-01T12:00:00Z");
    expect(isOverdue(date, 20, new Date("2026-09-21T12:00:00Z"))).toBe(false);
    expect(isOverdue(date, 20, new Date("2026-09-21T12:00:01Z"))).toBe(true);
  });
  it("rejeita edição sobre versão antiga", () => {
    expect(() => checkVersion({ version: 3 } as Asset, 2)).toThrow();
  });
  it("não considera campos internos na reimportação", () => {
    expect(
      compareFields(
        { description: "Mesa", locationId: "sala1" },
        { description: "Mesa", locationId: "sala2" },
      ),
    ).toEqual([]);
  });
  it("protege senhas com salt individual", () => {
    const a = hashPassword("uma-senha-longa"),
      b = hashPassword("uma-senha-longa");
    expect(a).not.toBe(b);
    expect(verifyPassword("uma-senha-longa", a)).toBe(true);
    expect(verifyPassword("errada", a)).toBe(false);
  });
  it("neutraliza fórmula em CSV e escapa aspas", () => {
    expect(toCsv([{ name: '=HYPERLINK("url")' }])).toContain("'=");
    expect(toCsv([{ name: 'a"b' }])).toContain('a""b');
  });
});
