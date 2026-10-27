// Testa o iniciador real com Windows PowerShell 5.1 e cmd.exe.
// Apenas o executável Docker é substituído: não instala Docker Desktop/WSL.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
if (process.platform !== "win32")
  throw new Error("Execute este teste em Windows.");
const source = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), "fatec windows "));
const root = path.join(temporary, "projeto com espacos");
const bin = path.join(temporary, "mock docker");
mkdirSync(root);
mkdirSync(bin);
mkdirSync(path.join(root, "scripts"));
for (const name of [
  "production.ps1",
  "production-config.mjs",
  "production-autostart.ps1",
  "production-setup.mjs",
  "production-install.ps1",
  "production-host.ps1",
])
  cpSync(path.join(source, "scripts", name), path.join(root, "scripts", name));
for (const name of [
  "INSTALAR.cmd",
  "INICIAR-PRODUCAO.cmd",
  "PARAR-PRODUCAO.cmd",
  "BACKUP-PRODUCAO.cmd",
  "ATIVAR-INICIO-AUTOMATICO.cmd",
  "DESATIVAR-INICIO-AUTOMATICO.cmd",
])
  cpSync(path.join(source, name), path.join(root, name));
writeFileSync(
  path.join(root, "scripts", "production-host.ps1"),
  "Set-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'producao/host-ok') -Value 'OK'\nexit 0\n",
);
const log = path.join(temporary, "docker-calls.jsonl");
const fake = String.raw`
import {appendFileSync, readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const args = process.argv.slice(2);
appendFileSync(process.env.MOCK_DOCKER_LOG, JSON.stringify(args)+'\n');
if (process.env.MOCK_DOCKER_FAIL && args.join(' ').includes(process.env.MOCK_DOCKER_FAIL)) {
 console.error('Falha simulada do Docker'); process.exit(42);
}
if (args[0] === 'run') {
 if(args.some(arg=>arg.includes('production-setup.mjs'))) {
  const assignments={}; for(let i=0;i<args.length;i++) if(args[i]==='-e') {const at=args[i+1].indexOf('=');assignments[args[i+1].slice(0,at)]=args[i+1].slice(at+1);}
  const result=spawnSync(process.execPath,[path.join(process.cwd(),'scripts','production-setup.mjs')],{env:{...process.env,...assignments,SETUP_CONFIG_DIR:path.join(process.cwd(),'producao')},stdio:'inherit'});
  if(result.error) console.error(result.error); process.exit(result.status??1);
 }
 const host = args[args.indexOf('/setup.mjs')+1];
 const result = spawnSync(process.execPath, [path.join(process.cwd(),'scripts','production-config.mjs'), host, '--stdout'], {encoding:'utf8'});
 if(result.status !== 0) {process.stderr.write(result.stderr); process.exit(result.status || 1);}
 mkdirSync('producao', {recursive:true});
 const file = path.join('producao','.env');
 if(!existsSync(file)) writeFileSync(file, result.stdout, {flag:'wx'});
}
if (args[0] === 'compose' && args[1] === 'version') {console.log('2.29.6');process.exit(0);}
if (args[0] === 'compose') {
 const commands = args.slice(5); // --env-file FILE -f FILE
 if (commands[0] === 'version') {console.log('2.29.6');}
 if (commands[0] === 'cp') {
  const destination=commands[2];
  if(commands[1].endsWith('root.crt')) writeFileSync(destination, 'CERTIFICADO DE TESTE');
  else if(commands[1].endsWith('fatec-backup.dump')) writeFileSync(destination, Buffer.from([80,71,68,77,80,0,255,128,10,13]));
  else if(commands[1].endsWith('/data/caddy')) {mkdirSync(destination,{recursive:true});writeFileSync(path.join(destination,'authority'),'TESTE');}
 }
 if(commands[0] === 'run') {
  const mount=commands[commands.indexOf('--volume')+1];
  const destination=mount.slice(0,-':/backup'.length);
  writeFileSync(path.join(destination,'fotos.tar.gz'),Buffer.from([31,139,0,255]));
 }
}
`;
writeFileSync(path.join(bin, "docker.mjs"), fake);
writeFileSync(
  path.join(bin, "docker.cmd"),
  `@echo off\r\n"${process.execPath}" "%~dp0docker.mjs" %*\r\nexit /b %ERRORLEVEL%\r\n`,
);
const environment = {
  ...process.env,
  PATH: `${bin};${process.env.PATH}`,
  MOCK_DOCKER_LOG: log,
};
const configPath = path.join(root, "producao", ".env");
const calls = () =>
  existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse)
    : [];
const clearCalls = () => writeFileSync(log, "");
function run(
  action,
  { fail = "", input = "", wrapper = false, automatic = false } = {},
) {
  const args = wrapper
    ? ["/d", "/c", action]
    : [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(root, "scripts", "production.ps1"),
        "-Acao",
        action,
      ];
  if (automatic) args.push("-Automatico", "-EsperaDockerSegundos", "1");
  const result = spawnSync(wrapper ? "cmd.exe" : "powershell.exe", args, {
    cwd: root,
    env: { ...environment, MOCK_DOCKER_FAIL: fail },
    input,
    encoding: "utf8",
    timeout: 60000,
  });
  assert.ifError(result.error);
  return result;
}
function success(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS: ${name}`);
}
try {
  test("PowerShell 5.1 do Windows", () => {
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
      { encoding: "utf8" },
    );
    assert.match(result.stdout, /^5\.1\./);
  });
  test("primeira inicializacao por CMD em caminho com espacos", () => {
    success(
      run("INICIAR-PRODUCAO.cmd", {
        wrapper: true,
        input: "192.168.1.50\r\n\r\n",
      }),
    );
    const config = readFileSync(configPath, "utf8");
    assert.match(config, /SITE_HOST=192\.168\.1\.50/);
    assert.match(config, /JWT_SECRET=[0-9a-f]{96}/);
    assert.match(config, /BOOTSTRAP_PASSWORD=[0-9a-f]{24}/);
    assert.ok(existsSync(path.join(root, "producao", "certificado-local.crt")));
    const generation = calls().find((args) => args[0] === "run");
    assert.ok(
      generation.some(
        (arg) =>
          arg.includes("projeto com espacos") && arg.endsWith("target=/config"),
      ),
    );
    assert.ok(calls().some((args) => args.includes("--wait")));
  });
  test("reinicializacao preserva credenciais", () => {
    const before = readFileSync(configPath, "utf8");
    clearCalls();
    success(run("iniciar"));
    assert.equal(readFileSync(configPath, "utf8"), before);
    assert.ok(!calls().some((args) => args[0] === "run"));
  });
  test("status e logs", () => {
    clearCalls();
    success(run("status"));
    success(run("logs"));
    assert.ok(calls().some((args) => args.slice(-2).join(" ") === "ps -a"));
    assert.ok(calls().some((args) => args.includes("--tail=100")));
  });
  test("parada por CMD preserva configuracao", () => {
    const before = readFileSync(configPath, "utf8");
    clearCalls();
    success(run("PARAR-PRODUCAO.cmd", { wrapper: true, input: "\r\n" }));
    assert.equal(readFileSync(configPath, "utf8"), before);
    assert.ok(calls().some((args) => args.at(-1) === "stop"));
    assert.ok(
      !calls().some(
        (args) => args.includes("--volumes") || args.includes("down"),
      ),
    );
  });
  test("backup por CMD preserva bytes binarios e copia configuracao", () => {
    clearCalls();
    success(run("BACKUP-PRODUCAO.cmd", { wrapper: true, input: "\r\n" }));
    const cpCall = calls().find((args) =>
      args.includes("database:/tmp/fatec-backup.dump"),
    );
    assert.ok(cpCall);
    assert.deepEqual(
      readFileSync(path.join(root, cpCall.at(-1))),
      Buffer.from([80, 71, 68, 77, 80, 0, 255, 128, 10, 13]),
    );
    const folder = path.dirname(path.join(root, cpCall.at(-1)));
    assert.equal(
      readFileSync(path.join(folder, "config.env"), "utf8"),
      readFileSync(configPath, "utf8"),
    );
    assert.deepEqual(
      readFileSync(path.join(folder, "fotos.tar.gz")),
      Buffer.from([31, 139, 0, 255]),
    );
    assert.ok(existsSync(path.join(folder, "caddy", "authority")));
    const stop = calls().findIndex((args) => args.includes("stop"));
    const dump = calls().findIndex((args) => args.includes("pg_dump"));
    assert.ok(stop >= 0 && dump > stop);
  });
  test("erro do Docker retorna falha ao CMD", () => {
    clearCalls();
    const result = run("INICIAR-PRODUCAO.cmd", {
      wrapper: true,
      input: "\r\n",
      fail: "up --build",
    });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.ok(
      !calls().some((args) =>
        args.includes("gateway:/data/caddy/pki/authorities/local/root.crt"),
      ),
    );
  });
  test("falha de backup nao anuncia sucesso nem reinicia", () => {
    const result = run("backup", { fail: "pg_dump" });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /Backup concluido/);
  });
  test("Docker indisponivel interrompe antes do Compose", () => {
    clearCalls();
    assert.notEqual(run("iniciar", { fail: "info --format" }).status, 0);
    assert.equal(calls().length, 1);
  });
  test("certificado publico nao tenta copiar autoridade local", () => {
    const before = readFileSync(configPath, "utf8");
    writeFileSync(
      configPath,
      before.replace("TLS_MODE=internal", "TLS_MODE=ti@example.org"),
    );
    clearCalls();
    success(run("iniciar"));
    assert.ok(
      !calls().some((args) =>
        args.includes("gateway:/data/caddy/pki/authorities/local/root.crt"),
      ),
    );
  });
  test("inicio automatico usa imagens existentes e registra a tentativa", () => {
    clearCalls();
    success(run("iniciar", { automatic: true }));
    const up = calls().find((args) => args.includes("up"));
    assert.ok(up.includes("--no-build") && up.includes("never"));
    assert.ok(!up.includes("--build"));
    assert.ok(
      existsSync(path.join(root, "producao", "inicializacao-automatica.log")),
    );
  });
  test("inicio automatico espera e informa timeout do Docker", () => {
    clearCalls();
    const result = run("iniciar", { automatic: true, fail: "info --format" });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Docker nao ficou pronto/);
    assert.ok(calls().length >= 2);
    assert.ok(!calls().some((args) => args.includes("up")));
  });
  test("atalho automatico aponta para o projeto e pode ser removido", () => {
    const getShortcut = String.raw`
      $path = Join-Path ([Environment]::GetFolderPath('Startup')) 'Fatec Patrimonio.lnk'
      if (-not (Test-Path $path)) { throw 'Atalho nao encontrado' }
      $link = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
      if ($link.Arguments -notlike '*-Automatico*') { throw 'Modo automatico ausente' }
      if ($link.Arguments -notlike '*projeto com espacos*') { throw 'Caminho incorreto' }
      if ($link.WindowStyle -ne 7) { throw 'Janela nao minimizada' }
      Write-Output $link.Arguments
    `;
    try {
      success(
        run("ATIVAR-INICIO-AUTOMATICO.cmd", { wrapper: true, input: "\r\n" }),
      );
      const result = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-Command", getShortcut],
        { encoding: "utf8" },
      );
      success(result);
    } finally {
      success(
        run("DESATIVAR-INICIO-AUTOMATICO.cmd", {
          wrapper: true,
          input: "\r\n",
        }),
      );
    }
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "if (Test-Path (Join-Path ([Environment]::GetFolderPath('Startup')) 'Fatec Patrimonio.lnk')) { exit 1 }",
      ],
      { encoding: "utf8" },
    );
    success(result);
  });
  test("endereco invalido falha sem criar configuracao", () => {
    rmSync(configPath);
    clearCalls();
    assert.notEqual(
      run("iniciar", { input: "https://invalido/caminho\r\n" }).status,
      0,
    );
    assert.ok(!existsSync(configPath));
  });
  test("parada sem instalacao nao gera credenciais", () => {
    clearCalls();
    assert.notEqual(run("parar").status, 0);
    assert.ok(!existsSync(configPath));
    assert.ok(!calls().some((args) => args[0] === "run"));
  });
  test("inicio automatico sem configuracao falha sem pedir endereco", () => {
    clearCalls();
    const result = run("iniciar", { automatic: true });
    assert.notEqual(result.status, 0);
    assert.ok(!existsSync(configPath));
    assert.equal(calls().length, 0);
  });
  test("assistente INSTALAR a partir de ZIP configura e inicia em uma unica chamada", () => {
    const password = "Minha senha $HOME # ' \\ ação 123";
    clearCalls();
    const result = run("INSTALAR.cmd", {
      wrapper: true,
      input: `localhost\r\n58443\r\noperador@fatec.local\r\n${password}\r\n${password}\r\nn\r\ns\r\n\r\n`,
    });
    success(result);
    assert.match(
      result.stdout,
      /INSTALACAO CONCLUIDA: https:\/\/localhost:58443/,
    );
    const env = readFileSync(configPath, "utf8");
    assert.match(env, /BOOTSTRAP_EMAIL=operador@fatec.local/);
    assert.equal(
      Buffer.from(
        env.match(/^BOOTSTRAP_PASSWORD_B64=(.*)$/m)[1],
        "base64",
      ).toString(),
      password,
    );
    assert.ok(existsSync(path.join(root, "producao", "ACESSO.txt")));
    assert.ok(existsSync(path.join(root, "producao", "host-ok")));
    const next = run("INSTALAR.cmd", { wrapper: true, input: "\r\n" });
    success(next);
    assert.equal(readFileSync(configPath, "utf8"), env);
  });
  test("scripts de ajustes do Windows passam pelo parser PowerShell 5.1", () => {
    for (const name of ["production-host.ps1", "production-install.ps1"]) {
      const file = path.join(source, "scripts", name).replaceAll("'", "''");
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `$errors=$null; $tokens=$null; $null=[System.Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$tokens,[ref]$errors); if($errors.Count){$errors;exit 1}`,
        ],
        { encoding: "utf8" },
      );
      success(result);
    }
  });
  console.log(
    `${passed} testes Windows passaram. Docker simulado; Docker Desktop/WSL nao exercitados.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
