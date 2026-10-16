import { it, expect, vi, afterEach } from "vitest";
import { request, formatMoney, download } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("propaga erro de conflito sem tratar como sucesso", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "O ativo mudou." }),
    }),
  );
  await expect(request("sync", "token", {})).rejects.toThrow("O ativo mudou.");
});
it("envia token e preserva payload JSON", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ id: "1" }) });
  vi.stubGlobal("fetch", fetch);
  await request("assets", "token", { condition: 5 });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ condition: 5 });
});

it("formata somas grandes sem perder centavos", () => {
  expect(formatMoney("99999999999999999.99")).toBe(
    "R$ 99.999.999.999.999.999,99",
  );
});

it("mostra o motivo da recusa de exportação ao usuário", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        message: "O relatório excede 20.000 bens ou registros.",
      }),
    }),
  );
  await expect(
    download("reports/byLocation", "token", "relatorio.xlsx"),
  ).rejects.toThrow("20.000");
});
it("trata erros HTML do proxy sem mostrar conteúdo técnico", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("HTML recebido");
      },
    }),
  );
  await expect(request("assets", "token")).rejects.toThrow("Confira a conexão");
});
