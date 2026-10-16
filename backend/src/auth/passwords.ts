import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";

// O formato guarda o custo junto da senha para permitir atualizações futuras.
const PASSWORD_OPTIONS = { N: 16384, r: 8, p: 5 };
const KEY_LENGTH = 64;
let activeCalculations = 0;

function encode(salt: string, key: Buffer) {
  return `scrypt-v2:${salt}:${key.toString("hex")}`;
}

// Usado apenas em inicializações e fixtures; as requisições usam a versão assíncrona.
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return encode(salt, scryptSync(password, salt, KEY_LENGTH, PASSWORD_OPTIONS));
}

function decode(hash: string) {
  const parts = hash.split(":");
  const current = parts.length === 3 && parts[0] === "scrypt-v2";
  const [salt, key] = current ? parts.slice(1) : parts;
  if (
    (!current && parts.length !== 2) ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(key ?? "")
  )
    return null;
  return {
    salt,
    key: Buffer.from(key, "hex"),
    options: current ? PASSWORD_OPTIONS : { N: 16384, r: 8, p: 1 },
  };
}

async function derivePassword(
  password: string,
  salt: string,
  options: typeof PASSWORD_OPTIONS,
) {
  // Recusar excesso é mais seguro que acumular cálculos e senhas na memória.
  if (activeCalculations >= 4)
    throw new ServiceUnavailableException(
      "Autenticação ocupada. Aguarde e tente novamente.",
    );
  activeCalculations++;
  try {
    const calculate = (parallelism: number) =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password,
          salt,
          KEY_LENGTH,
          { ...options, p: parallelism },
          (error, key) => (error ? reject(error) : resolve(key)),
        );
      });
    const key = await calculate(options.p);
    // Aproxima o trabalho das contas antigas e inexistentes sem mudar o hash legado.
    if (options.p === 1) await calculate(PASSWORD_OPTIONS.p - 1);
    return key;
  } finally {
    activeCalculations--;
  }
}

export async function hashPasswordAsync(password: string) {
  const salt = randomBytes(16).toString("hex");
  return encode(salt, await derivePassword(password, salt, PASSWORD_OPTIONS));
}

export async function verifyPasswordAsync(password: string, hash: string) {
  const decoded = decode(hash);
  if (!decoded) return false;
  return timingSafeEqual(
    await derivePassword(password, decoded.salt, decoded.options),
    decoded.key,
  );
}

export function verifyPassword(password: string, hash: string) {
  const decoded = decode(hash);
  return (
    !!decoded &&
    timingSafeEqual(
      scryptSync(password, decoded.salt, KEY_LENGTH, decoded.options),
      decoded.key,
    )
  );
}
