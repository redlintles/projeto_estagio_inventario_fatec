// A senha escolhida pode conter $, aspas, espacos e acentos sem interpolacao.
import { spawnSync } from "node:child_process";
const environment = { ...process.env };
if (environment.BOOTSTRAP_PASSWORD_B64)
  environment.BOOTSTRAP_PASSWORD = Buffer.from(
    environment.BOOTSTRAP_PASSWORD_B64,
    "base64",
  ).toString("utf8");
for (const args of [
  [
    "../node_modules/typeorm/cli.js",
    "migration:run",
    "-d",
    "dist/data-source.js",
  ],
  ["dist/bootstrap.js", "--if-needed"],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: environment,
  });
  if (result.error || result.status !== 0) {
    console.error(
      "Nao foi possivel preparar o banco. Consulte o log da inicializacao.",
    );
    process.exit(result.status || 1);
  }
}
