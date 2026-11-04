import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { setup, loadConfig } from "./production-setup.mjs";
function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "fatec setup "));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
async function run(directory, responses, options = {}) {
  let output = "";
  const sink = new Writable({
    write(chunk, encoding, callback) {
      output += chunk;
      callback();
    },
  });
  const values = await setup({
    directory,
    input: Readable.from([responses]),
    output: sink,
    defaultHost: "192.168.1.50",
    ...options,
  });
  return { values, output };
}
test("Enter aceita os padroes sem expor a senha e salva arquivos privados", async (t) => {
  const directory = fixture(t);
  const { values, output } = await run(directory, "\n\n\n\n\n\n");
  assert.equal(values.HTTP_PORT, "8080");
  assert.equal(values.BOOTSTRAP_EMAIL, "admin@fatec.local");
  assert.equal(values.SETUP_AUTOSTART, "s");
  assert.equal(values.RESTART_POLICY, "unless-stopped");
  assert.equal(Buffer.from(values.BOOTSTRAP_PASSWORD_B64, "base64").length, 24);
  assert.equal(values.JWT_SECRET.length, 96);
  assert.equal(values.POSTGRES_PASSWORD.length, 48);
  const access = readFileSync(path.join(directory, "ACESSO.txt"), "utf8");
  assert.match(access, /http:\/\/192\.168\.1\.50/);
  assert.ok(
    !output.includes(
      Buffer.from(values.BOOTSTRAP_PASSWORD_B64, "base64").toString(),
    ),
  );
  if (process.platform !== "win32")
    assert.equal(statSync(path.join(directory, ".env")).mode & 0o777, 0o600);
});
test("porta, conta e senha especial funcionam sem interpolacao ou injecao", async (t) => {
  const directory = fixture(t);
  const password = "Senha $HOME # ' \\ acao á! 123";
  const { values } = await run(
    directory,
    `servidor.fatec.local\n8443\nMaria@Fatec.local\n${password}\n${password}\nn\ns\n`,
    { platform: "windows" },
  );
  assert.equal(values.SITE_PORT_SUFFIX, ":8443");
  assert.equal(values.HTTP_PORT, "8443");
  assert.equal(values.BOOTSTRAP_EMAIL, "maria@fatec.local");
  assert.equal(
    Buffer.from(values.BOOTSTRAP_PASSWORD_B64, "base64").toString(),
    password,
  );
  assert.equal(values.RESTART_POLICY, "on-failure:5");
  assert.ok(
    !readFileSync(path.join(directory, ".env"), "utf8").includes(password),
  );
});
test("valida host, porta ocupada e usuario, repetindo apenas a pergunta invalida", async (t) => {
  const directory = fixture(t);
  const { values, output } = await run(
    directory,
    "https://errado/x\nlocalhost\n0\n443\n8443\ninvalido\nadmin@fatec.local\n\nn\ns\n",
    { busyPorts: "443" },
  );
  assert.equal(values.SITE_HOST, "localhost");
  assert.equal(values.BIND_ADDRESS, "127.0.0.1");
  assert.equal(values.HTTP_PORT, "8443");
  assert.match(output, /Escolha um numero livre/);
});
test("senha curta e confirmacao divergente nao sao aceitas", async (t) => {
  const directory = fixture(t);
  const { values, output } = await run(
    directory,
    "\n\n\ncurta\nsenha longa 123\nsenha errada\nsenha longa 456\nsenha longa 456\nn\ns\n",
  );
  assert.equal(
    Buffer.from(values.BOOTSTRAP_PASSWORD_B64, "base64").toString(),
    "senha longa 456",
  );
  assert.match(output, /As senhas ficaram diferentes/);
});
test("cancelar nao salva configuracao ou acesso", async (t) => {
  const directory = fixture(t);
  await assert.rejects(
    run(directory, "\n\n\n\nn\nn\n"),
    /Nenhuma configuracao/,
  );
  assert.ok(!existsSync(path.join(directory, ".env")));
  assert.ok(!existsSync(path.join(directory, "ACESSO.txt")));
});
test("fim da entrada nao confirma a instalacao", async (t) => {
  const directory = fixture(t);
  await assert.rejects(run(directory, "localhost\n"), /cancelada/);
  assert.ok(!existsSync(path.join(directory, ".env")));
});
test("reexecucao preserva todas as credenciais sem novas perguntas", async (t) => {
  const directory = fixture(t);
  await run(directory, "\n\n\n\nn\ns\n");
  const previous = readFileSync(path.join(directory, ".env"), "utf8");
  const { output } = await run(directory, "");
  assert.equal(readFileSync(path.join(directory, ".env"), "utf8"), previous);
  assert.match(output, /sem trocar contas/);
  assert.doesNotMatch(output, /Qual o endereco/);
});
test("Linux sem autostart suportado oferece nao e rejeita sim", async (t) => {
  const directory = fixture(t);
  const { values, output } = await run(directory, "\n\n\n\ns\nn\ns\n", {
    autoSupported: false,
  });
  assert.equal(values.SETUP_AUTOSTART, "n");
  assert.match(output, /precisa ser suportado/);
});
test("instalacao antiga pode ser retomada sem redefinir senha", async (t) => {
  const directory = fixture(t);
  const original =
    "SITE_HOST=localhost\nBOOTSTRAP_EMAIL=existente@fatec.local\nBOOTSTRAP_PASSWORD=antiga-segura-123\n";
  writeFileSync(path.join(directory, ".env"), original);
  await run(directory, "");
  assert.equal(loadConfig(directory).SITE_SCHEME, "http");
  assert.equal(loadConfig(directory).SITE_HOST, "192.168.1.50");
  assert.equal(
    readFileSync(path.join(directory, ".env.before-http"), "utf8"),
    original,
  );
  assert.equal(loadConfig(directory).BOOTSTRAP_PASSWORD, "antiga-segura-123");
  assert.match(
    readFileSync(path.join(directory, "ACESSO.txt"), "utf8"),
    /existente@fatec.local/,
  );
});
test("converte HTTPS antigo para LAN sem perder segredos e atualiza acesso", async (t) => {
  const directory = fixture(t);
  const original =
    "SITE_HOST=192.168.0.25\nHTTPS_PORT=443\nTLS_MODE=internal\nPOSTGRES_PASSWORD=preservar-banco\nJWT_SECRET=preservar-token\nBOOTSTRAP_EMAIL=admin@fatec.local\nBOOTSTRAP_PASSWORD=senha-preservada\n";
  writeFileSync(path.join(directory, ".env"), original);
  writeFileSync(
    path.join(directory, "ACESSO.txt"),
    "Endereco: https://192.168.0.25\nSenha inicial: senha-preservada\n",
  );
  const { values } = await run(directory, "", { defaultPort: "8081" });
  assert.equal(values.SITE_HOST, "192.168.0.25");
  assert.equal(values.HTTP_PORT, "8081");
  assert.equal(values.GATEWAY_ADDRESS, ":80");
  assert.equal(values.BIND_ADDRESS, "0.0.0.0");
  assert.equal(values.POSTGRES_PASSWORD, "preservar-banco");
  assert.equal(values.JWT_SECRET, "preservar-token");
  assert.match(
    readFileSync(path.join(directory, "ACESSO.txt"), "utf8"),
    /http:\/\/192\.168\.0\.25:8081/,
  );
  const converted = readFileSync(path.join(directory, ".env"), "utf8");
  await run(directory, "");
  assert.equal(readFileSync(path.join(directory, ".env"), "utf8"), converted);
  assert.equal(
    readFileSync(path.join(directory, ".env.before-http"), "utf8"),
    original,
  );
});
