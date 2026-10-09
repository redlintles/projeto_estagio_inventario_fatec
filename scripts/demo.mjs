import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { networkInterfaces } from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, ".demo");
const envFile = path.join(directory, ".env");
const action = process.argv[2] ?? "start";
if (!["start", "lan", "stop"].includes(action)) {
  console.error("Use npm run demo, npm run demo:lan ou npm run demo:stop.");
  process.exit(1);
}
const lan = action === "lan";
const environment = {
  ...process.env,
  ...(lan ? { DEMO_BIND_ADDRESS: "0.0.0.0" } : {}),
};
function run(args) {
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: "inherit",
    env: environment,
  });
  if (result.error)
    console.error(
      "Instale o Docker com Compose e inicie o Docker antes de executar a demonstração.",
    );
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
run(["compose", "version"]);
mkdirSync(directory, { recursive: true, mode: 0o700 });
try {
  writeFileSync(
    envFile,
    [
      `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`,
      `JWT_SECRET=${randomBytes(48).toString("hex")}`,
      "BOOTSTRAP_EMAIL=admin@fatec.local",
      `BOOTSTRAP_PASSWORD=${randomBytes(12).toString("hex")}`,
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
const compose = [
  "compose",
  "--project-name",
  "fatec-demo",
  "--env-file",
  envFile,
  "-f",
  "infra/compose.yaml",
  "-f",
  "infra/compose.demo.yaml",
];
if (action === "stop") {
  run([...compose, "down"]);
  console.log(
    "Demonstração parada. Banco e credenciais preservados para a próxima execução.",
  );
} else {
  run([...compose, "up", "--build", "-d"]);
  if (lan) {
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === "IPv4" && !entry.internal)
          console.log(
            `API para o celular na rede local: http://${entry.address}:3000/api`,
          );
      }
    }
  }
  run([
    ...compose,
    "exec",
    "-T",
    "backend",
    "node",
    "dist/bootstrap.js",
    "--if-needed",
  ]);
  const config = Object.fromEntries(
    readFileSync(envFile, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  console.log(
    `\nDemonstração pronta: http://localhost:8080\nLogin: ${config.BOOTSTRAP_EMAIL}\nSenha: ${config.BOOTSTRAP_PASSWORD}\n\nPara parar: npm run demo:stop\nCredenciais locais: .demo/.env`,
  );
}
