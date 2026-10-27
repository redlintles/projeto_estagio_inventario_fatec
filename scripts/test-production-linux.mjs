// Executa instalar.sh real a partir de uma pasta extraida (sem .git e sem npm).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
if (process.platform !== "linux") throw Error("Execute em Linux.");
const source = fileURLToPath(new URL("../", import.meta.url));
const root = mkdtempSync(path.join(tmpdir(), "fatec linux zip "));
try {
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "bin"));
  for (const name of ["instalar.sh", "producao.sh"])
    cpSync(path.join(source, name), path.join(root, name));
  for (const name of ["production-setup.mjs"])
    cpSync(
      path.join(source, "scripts", name),
      path.join(root, "scripts", name),
    );
  writeFileSync(
    path.join(root, "scripts", "production-host-linux.sh"),
    "#!/bin/sh\nprintf host-ok > producao/host-ok\n",
  );
  writeFileSync(
    path.join(root, "bin", "docker"),
    `#!${process.execPath}
import {appendFileSync,writeFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const args=process.argv.slice(2);appendFileSync('calls',JSON.stringify(args)+'\\n');
if(process.env.FAIL_DOCKER && args.includes('up')) process.exit(42);
if(args[0]==='info') { console.log('[]'); process.exit(0); }
if(args.includes('version')) { console.log('2.29.6'); process.exit(0); }
if(args[0]==='run') {
 const assignments={}; for(let i=0;i<args.length;i++) if(args[i]==='-e') {const at=args[i+1].indexOf('=');assignments[args[i+1].slice(0,at)]=args[i+1].slice(at+1);}
 const result=spawnSync(process.execPath,['scripts/production-setup.mjs'],{env:{...process.env,...assignments,SETUP_CONFIG_DIR:path.join(process.cwd(),'producao')},stdio:'inherit'});
 if(result.error) console.error(result.error); process.exit(result.status??1);
}
if(args.includes('cp')) writeFileSync('producao/certificado-local.crt','TESTE');
`,
    { mode: 0o755 },
  );
  for (const tool of ["ip", "ss", "xdg-open"])
    writeFileSync(path.join(root, "bin", tool), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
  const env = {
    ...process.env,
    PATH: path.join(root, "bin") + ":" + process.env.PATH,
  };
  const password = "Senha $HOME # ' \\ acao á! 123";
  const run = (input, more = {}) =>
    spawnSync("bash", ["instalar.sh"], {
      cwd: root,
      env: { ...env, ...more },
      input,
      encoding: "utf8",
      timeout: 60000,
    });
  let result = run(
    `localhost\n58443\noperador@fatec.local\n${password}\n${password}\nn\ns\n`,
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    result.stdout,
    /INSTALAÇÃO CONCLUÍDA: https:\/\/localhost:58443/,
  );
  assert.ok(existsSync(path.join(root, "producao", "host-ok")));
  const config = readFileSync(path.join(root, "producao", ".env"), "utf8");
  const encoded = config.match(/^BOOTSTRAP_PASSWORD_B64=(.*)$/m)[1];
  assert.equal(Buffer.from(encoded, "base64").toString(), password);
  result = run("");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(
    readFileSync(path.join(root, "producao", ".env"), "utf8"),
    config,
  );
  result = run("", { FAIL_DOCKER: "1" });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /INSTALAÇÃO CONCLUÍDA/);
  console.log(
    "PASS Linux ZIP: perguntas, senha especial, porta, preparacao, reexecucao e falha do Docker. Ajustes privilegiados simulados.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
