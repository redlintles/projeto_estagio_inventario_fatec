import { HttpException } from "@nestjs/common";
export class AttemptLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(private maximum = 10000) {}
  take(key: string, limit: number, period: number, now = Date.now()) {
    for (const [k, v] of this.entries)
      if (v.until <= now) this.entries.delete(k);
    let entry = this.entries.get(key);
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
