// Prova de instalacao real: contêineres e volumes exclusivos, descartados no final.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import https from "node:https";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { setup } from "./production-setup.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(path.join(tmpdir(), "fatec-compose-test-"));
const project = `fatec-installer-test-${process.pid}`;
const server = net.createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const password = "Teste $HOME # ' \\ produção 123";
await setup({
  directory,
  defaultHost: "localhost",
  input: Readable.from([
    `\n${port}\noperador@fatec.local\n${password}\n${password}\nn\ns\n`,
  ]),
  output: new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  }),
});
const compose = [
  "compose",
  "-p",
  project,
  "--env-file",
  path.join(directory, ".env"),
  "-f",
  "infra/compose.production.yaml",
];
function docker(args) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 600000,
  });
  if (result.error || result.status !== 0)
    throw Error(
      `Docker falhou: ${args.slice(0, 2).join(" ")}\n${result.stderr?.slice(-5000) || result.error}`,
    );
  return result.stdout.trim();
}
let ca;
function request(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "localhost",
        agent: false,
        port,
        path: url,
        ca,
        method: body ? "POST" : "GET",
        headers: {
          Origin: `https://localhost:${port}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(Error("Timeout HTTPS")));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
try {
  docker([
    ...compose,
    "up",
    "--build",
    "-d",
    "--wait",
    "--wait-timeout",
    "300",
  ]);
  docker([
    ...compose,
    "cp",
    "gateway:/data/caddy/pki/authorities/local/root.crt",
    path.join(directory, "root.crt"),
  ]);
  ca = readFileSync(path.join(directory, "root.crt"));
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).status, "ok");
  const login = () =>
    request("/api/auth/login", { email: "operador@fatec.local", password });
  let response = await login();
  assert.equal(
    response.status,
    201,
    "Login deve aceitar as credenciais escolhidas",
  );
  assert.equal(
    response.headers["access-control-allow-origin"],
    `https://localhost:${port}`,
  );
  for (const service of ["database", "backend", "web"]) {
    const id = docker([...compose, "ps", "-q", service]);
    assert.equal(docker(["port", id]), "", `${service} exposto diretamente`);
  }
  const gateway = docker([...compose, "ps", "-q", "gateway"]);
  assert.equal(
    docker([
      "inspect",
      "--format",
      "{{.HostConfig.RestartPolicy.Name}}",
      gateway,
    ]),
    "on-failure",
  );
  docker([...compose, "stop", "gateway", "web", "backend"]);
  docker([...compose, "up", "-d", "--wait", "--wait-timeout", "300"]);
  response = await login();
  assert.equal(
    response.status,
    201,
    "Login deve aceitar as credenciais escolhidas",
  );
  console.log(
    "PASS Docker real: migrations, conta/senha personalizada com simbolos, porta personalizada, HTTPS validado, CORS, portas privadas, autostart desativado e dados preservados apos reiniciar.",
  );
} finally {
  docker([...compose, "down", "--volumes"]);
  rmSync(directory, { recursive: true, force: true });
}
