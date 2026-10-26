// Executado em um contêiner temporário; não exige Node instalado na máquina.
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
const host = process.argv[2];
if (
  !host ||
  !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)$/.test(host) ||
  host.length > 253
)
  throw new Error(
    "Informe somente o IP ou nome do servidor, sem https, porta ou barras.",
  );
const secret = (n) => randomBytes(n).toString("hex");
const config = [
  `SITE_HOST=${host}`,
  "TLS_MODE=internal",
  `POSTGRES_PASSWORD=${secret(24)}`,
  `JWT_SECRET=${secret(48)}`,
  "BOOTSTRAP_EMAIL=admin@fatec.local",
  `BOOTSTRAP_PASSWORD=${secret(12)}`,
  "SMTP_HOST=",
  "SMTP_PORT=587",
  "SMTP_SECURE=false",
  "SMTP_USER=",
  "SMTP_PASSWORD=",
  "SMTP_FROM=patrimonio@fatec.local",
  "",
].join("\n");
if (process.argv[3] === "--stdout") {
  process.stdout.write(config);
} else {
  mkdirSync("/config", { recursive: true, mode: 0o700 });
  if (!existsSync("/config/.env")) {
    writeFileSync("/config/.env", config, { flag: "wx", mode: 0o600 });
    console.log(
      "Configuração e senha inicial criadas em producao/.env. Guarde esse arquivo.",
    );
  } else console.log("Configuração existente preservada.");
}
