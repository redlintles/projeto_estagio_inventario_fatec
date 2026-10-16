import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { ExecutionContext } from "@nestjs/common";
import { Subject, of } from "rxjs";
import { hashPasswordAsync, verifyPasswordAsync } from "../src/auth/passwords";
import { ResourceLimitInterceptor } from "../src/resource-limit";
import { AttemptLimiter } from "../src/auth/rate-limit";

describe("Proteções de disponibilidade e senhas", () => {
  it("valida senhas antigas e novas sem exigir redefinição", async () => {
    const salt = "a".repeat(32);
    const legacy = `${salt}:${scryptSync("senha-legada", salt, 64).toString("hex")}`;
    expect(await verifyPasswordAsync("senha-legada", legacy)).toBe(true);
    expect(await verifyPasswordAsync("incorreta", legacy)).toBe(false);
    const current = await hashPasswordAsync("senha-atual");
    expect(current.startsWith("scrypt-v2:")).toBe(true);
    expect(await verifyPasswordAsync("senha-atual", current)).toBe(true);
    expect(await verifyPasswordAsync("incorreta", current)).toBe(false);
    expect(await verifyPasswordAsync("senha", "scrypt-v2:inválido")).toBe(
      false,
    );
  });

  it("recusa excesso de cálculos e libera capacidade ao terminar", async () => {
    const calculations = Array.from({ length: 4 }, () =>
      hashPasswordAsync("teste-concorrente"),
    );
    try {
      await expect(hashPasswordAsync("quinta-senha")).rejects.toThrow(
        "Autenticação ocupada",
      );
    } finally {
      await Promise.all(calculations);
    }
    await expect(hashPasswordAsync("nova-tentativa")).resolves.toMatch(
      /^scrypt-v2:/,
    );
  });

  it("libera operações pesadas em sucesso, falha e cancelamento", () => {
    const headers: Record<string, string> = {};
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({
          setHeader: (key: string, value: string) => {
            headers[key] = value;
          },
        }),
      }),
    } as ExecutionContext;
    const limiter = new ResourceLimitInterceptor();
    const first = new Subject();
    const second = new Subject();
    const subscription = limiter
      .intercept(context, { handle: () => first })
      .subscribe();
    limiter
      .intercept(context, { handle: () => second })
      .subscribe({ error: () => undefined });
    expect(() => limiter.intercept(context, { handle: () => of(1) })).toThrow(
      "processando arquivos",
    );
    expect(headers["Retry-After"]).toBe("15");
    subscription.unsubscribe();
    second.error(new Error("falha simulada"));
    expect(() =>
      limiter.intercept(context, {
        handle: () => {
          throw new Error("falha antes da resposta");
        },
      }),
    ).toThrow("falha antes");
    for (let index = 0; index < 3; index++)
      limiter.intercept(context, { handle: () => of(1) }).subscribe();
  });

  it("renova o contador expirado mesmo entre limpezas periódicas", () => {
    const limiter = new AttemptLimiter();
    limiter.take("conta", 1, 100, 0);
    expect(() => limiter.take("conta", 1, 100, 50)).toThrow();
    expect(() => limiter.take("conta", 1, 100, 101)).not.toThrow();
  });
});
