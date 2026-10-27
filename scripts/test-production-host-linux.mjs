// Testa a geracao do servico e os pedidos de privilegio sem alterar a maquina.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
const source = fileURLToPath(new URL("../", import.meta.url));
const root = mkdtempSync(path.join(tmpdir(), "fatec host % espacos "));
try {
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "producao"));
  mkdirSync(path.join(root, "bin"));
  cpSync(
    path.join(source, "scripts", "production-host-linux.sh"),
    path.join(root, "scripts", "production-host-linux.sh"),
  );
  writeFileSync(
    path.join(root, "producao", ".env"),
    "HTTPS_PORT=58443\nBIND_ADDRESS=0.0.0.0\nSETUP_AUTOSTART=s\n",
  );
  writeFileSync(path.join(root, "producao", "certificado-local.crt"), "TESTE");
  const stub = `#!/bin/bash
set -eu
name=$(basename "$0")
printf '%s %s\\n' "$name" "$*" >> "$FIXTURE/calls"
case "$name" in
 sudo) if [[ \${1:-} == -v ]]; then exit 0; fi; exec "$@" ;;
 install) if [[ \${*: -1} == */fatec-patrimonio.service ]]; then cp "$3" "$FIXTURE/generated.service"; fi ;;
 ip) if [[ "$*" == *default* ]]; then echo 'default via 192.168.1.1 dev eth0'; else echo '192.168.1.0/24 dev eth0 scope link'; fi ;;
 ufw) if [[ \${1:-} == status ]]; then echo 'Status: active'; fi ;;
esac
`;
  for (const name of [
    "sudo",
    "install",
    "systemctl",
    "docker",
    "update-ca-certificates",
    "ip",
    "ufw",
  ])
    writeFileSync(path.join(root, "bin", name), stub, { mode: 0o755 });
  const result = spawnSync("bash", ["scripts/production-host-linux.sh"], {
    cwd: root,
    env: {
      ...process.env,
      FIXTURE: root,
      PATH: path.join(root, "bin") + ":" + process.env.PATH,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const unit = readFileSync(path.join(root, "generated.service"), "utf8");
  assert.match(unit, /Requires=docker.service/);
  assert.match(unit, /up --no-build --pull never/);
  assert.match(unit, /fatec host %% espacos/);
  assert.doesNotMatch(unit, /WorkingDirectory=/);
  const calls = readFileSync(path.join(root, "calls"), "utf8");
  assert.match(calls, /update-ca-certificates/);
  assert.match(
    calls,
    /ufw allow from 192.168.1.0\/24 to any port 58443 proto tcp/,
  );
  assert.match(
    calls,
    /systemctl enable docker.service fatec-patrimonio.service/,
  );
  console.log(
    "PASS Linux: certificado, firewall local e servico de boot gerado com caminhos contendo espacos e %. Comandos administrativos simulados.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
