import { it, expect, vi, afterEach } from "vitest";
import { request } from "./api";
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
