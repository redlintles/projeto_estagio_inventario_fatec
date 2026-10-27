// Mesmo assistente nos dois sistemas, executado pelo Node do Docker.
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
export const validHost = (value) =>
  value === "localhost" ||
  (/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(value) &&
    value.length <= 253 &&
    (!/^\d+(?:\.\d+){3}$/.test(value) || isIP(value) === 4) &&
    !value.includes(".."));
export const validEmail = (value) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) &&
  value.length <= 254;
export function loadConfig(directory) {
  return Object.fromEntries(
    readFileSync(path.join(directory, ".env"), "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
}
export async function setup({
  directory = "/config",
  platform = process.env.SETUP_OS || "linux",
  defaultHost = process.env.DEFAULT_HOST || "localhost",
  defaultPort = process.env.DEFAULT_PORT || "443",
  busyPorts = process.env.BUSY_PORTS || "",
  autoSupported = process.env.AUTO_SUPPORTED !== "false",
  input = process.stdin,
  output = process.stdout,
} = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (existsSync(path.join(directory, ".env"))) {
    output.write(
      "\nJa existe uma instalacao configurada. Vou iniciar sem trocar contas, senhas ou dados.\n",
    );
    const saved = loadConfig(directory);
    if (!existsSync(path.join(directory, "ACESSO.txt"))) {
      const password = saved.BOOTSTRAP_PASSWORD_B64
        ? Buffer.from(saved.BOOTSTRAP_PASSWORD_B64, "base64").toString("utf8")
        : saved.BOOTSTRAP_PASSWORD ||
          "Consulte o responsavel pela conta existente.";
      writeFileSync(
        path.join(directory, "ACESSO.txt"),
        `ACESSO INICIAL - ARQUIVO PRIVADO\nEndereco: https://${saved.SITE_HOST}${saved.SITE_PORT_SUFFIX || ""}\nUsuario: ${saved.BOOTSTRAP_EMAIL}\nSenha inicial: ${password}\nA senha pode ter sido alterada no portal desde a instalacao.\n`,
        { mode: 0o600 },
      );
    }
    return saved;
  }
  let muted = false;
  const echo = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) output.write(chunk);
      callback();
    },
  });
  const terminal = Boolean(input.isTTY && output.isTTY);
  const rl = createInterface({ input, output: echo, terminal, historySize: 0 });
  const iterator = rl[Symbol.asyncIterator]();
  async function ask(
    question,
    suggested,
    validate = () => true,
    help = "Confira o valor e tente novamente.",
    secret = false,
  ) {
    for (;;) {
      output.write(`${question} [${suggested}]: `);
      muted = secret;
      const answer = await iterator.next();
      muted = false;
      if (secret && terminal) output.write("\n");
      if (answer.done)
        throw new Error(
          "Instalacao cancelada: faltaram respostas. Abra o assistente novamente.",
        );
      const raw = secret ? answer.value : answer.value.trim();
      const value = raw || suggested;
      if (validate(value)) return value;
      output.write(help + "\n");
    }
  }
  const yes = (value) => /^(s|sim|n|nao|não)$/i.test(value);
  try {
    output.write(
      "\nPATRIMONIO FATEC - INSTALACAO\nPressione Enter para aceitar cada sugestao. Nao precisa conhecer codigo.\n\n",
    );
    const host = await ask(
      "Qual o endereco deste computador? Pode aceitar a sugestao",
      validHost(defaultHost) ? defaultHost : "localhost",
      validHost,
      "Use somente o nome ou IP do computador, sem https://, barras ou porta.",
    );
    const occupied = new Set(busyPorts.split(",").filter(Boolean));
    const port = await ask(
      "Em qual porta deseja abrir o sistema?",
      String(defaultPort),
      (value) =>
        /^\d+$/.test(value) &&
        Number(value) >= 1 &&
        Number(value) <= 65535 &&
        !occupied.has(String(Number(value))),
      "Escolha um numero livre de 1 a 65535. A porta informada pode estar ocupada.",
    );
    const email = (
      await ask(
        "Qual sera o usuario para entrar? Use um e-mail",
        "admin@fatec.local",
        validEmail,
        "Digite um e-mail, por exemplo responsavel@fatec.local.",
      )
    ).toLowerCase();
    const generated = randomBytes(12).toString("hex");
    let password;
    for (;;) {
      const choice = await ask(
        "Qual senha deseja? Enter cria uma senha segura",
        "gerar automaticamente",
        (value) =>
          value === "gerar automaticamente" ||
          (value.length >= 12 &&
            value.length <= 128 &&
            Buffer.byteLength(value, "utf8") <= 512 &&
            !/[\r\n\x00-\x1f\x7f]/.test(value)),
        "Use de 12 a 128 caracteres ou pressione Enter para gerar uma senha.",
        true,
      );
      if (choice === "gerar automaticamente") {
        password = generated;
        break;
      }
      const confirmation = await ask(
        "Digite a mesma senha novamente",
        "repetir a senha",
        (value) => value !== "repetir a senha",
        "Digite novamente a senha que escolheu.",
        true,
      );
      if (choice === confirmation) {
        password = choice;
        break;
      }
      output.write("As senhas ficaram diferentes. Vamos tentar novamente.\n");
    }
    if (platform === "windows")
      output.write(
        "No Windows, o inicio automatico acontece depois de entrar na sua conta.\n",
      );
    if (!autoSupported)
      output.write(
        "Este ambiente nao oferece inicio automatico suportado. A sugestao sera nao.\n",
      );
    const auto = await ask(
      platform === "windows"
        ? "Iniciar automaticamente quando entrar no Windows? (s/n)"
        : "Iniciar automaticamente quando ligar o computador? (s/n)",
      autoSupported ? "s" : "n",
      (value) => yes(value) && (autoSupported || /^n/i.test(value)),
      "Responda s para sim ou n para nao. O inicio automatico precisa ser suportado pelo sistema.",
    );
    output.write(
      "\nVou preparar o sistema, confiar no certificado HTTPS local e permitir acesso pela rede local.\nO computador podera pedir autorizacao de administrador. Seus dados ficarao nesta maquina.\n",
    );
    const confirm = await ask(
      "Posso configurar e iniciar agora? (s/n)",
      "s",
      yes,
      "Responda s ou n.",
    );
    if (/^n/i.test(confirm))
      throw new Error("Instalacao cancelada. Nenhuma configuracao foi salva.");
    const automatic = /^s/i.test(auto);
    const values = {
      SITE_HOST: host,
      HTTPS_PORT: String(Number(port)),
      SITE_PORT_SUFFIX: Number(port) === 443 ? "" : `:${Number(port)}`,
      BIND_ADDRESS:
        host === "localhost" || host.startsWith("127.")
          ? "127.0.0.1"
          : "0.0.0.0",
      TLS_MODE: "internal",
      POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
      JWT_SECRET: randomBytes(48).toString("hex"),
      BOOTSTRAP_EMAIL: email,
      BOOTSTRAP_PASSWORD_B64: Buffer.from(password, "utf8").toString("base64"),
      SETUP_AUTOSTART: automatic ? "s" : "n",
      RESTART_POLICY: automatic ? "unless-stopped" : "on-failure:5",
      SMTP_HOST: "",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      SMTP_FROM: "patrimonio@fatec.local",
    };
    // Todos os valores sao validados ou codificados. A senha nunca entra em interpolacao do Compose.
    const content =
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + "\n";
    const access = `ACESSO INICIAL - ARQUIVO PRIVADO\n\nEndereco: https://${host}${values.SITE_PORT_SUFFIX}\nUsuario: ${email}\nSenha inicial: ${password}\n\nGuarde este arquivo em lugar seguro. Nao compartilhe a pasta producao.\nSe mudar a senha no portal, a senha deste arquivo nao sera atualizada.\n`;
    writeFileSync(path.join(directory, "ACESSO.txt"), access, { mode: 0o600 });
    writeFileSync(path.join(directory, ".env"), content, {
      flag: "wx",
      mode: 0o600,
    });
    output.write(
      "Configuracao salva. Agora vou preparar e iniciar os componentes.\n",
    );
    return values;
  } finally {
    rl.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  setup({ directory: process.env.SETUP_CONFIG_DIR || "/config" }).catch(
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
