import { HttpException } from "@nestjs/common";
export class AttemptLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  private nextCleanup = 0;
  constructor(private maximum = 10000) {}
  take(key: string, limit: number, period: number, now = Date.now()) {
    // A limpeza periódica evita percorrer milhares de contas a cada tentativa.
    if (now >= this.nextCleanup || this.entries.size >= this.maximum) {
      for (const [entryKey, entry] of this.entries)
        if (entry.until <= now) this.entries.delete(entryKey);
      this.nextCleanup = now + 30000;
    }
    let entry = this.entries.get(key);
    if (entry && entry.until <= now) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (this.entries.size >= this.maximum)
        throw new HttpException(
          "Limite temporário de autenticação. Aguarde.",
          429,
        );
      entry = { count: 0, until: now + period };
      this.entries.set(key, entry);
    }
    if (entry.count >= limit)
      throw new HttpException(
        "Muitas tentativas. Aguarde para tentar novamente.",
        429,
      );
    entry.count++;
  }
  clear(key: string) {
    this.entries.delete(key);
  }
}
