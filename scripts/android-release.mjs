// Ferramenta de entrega: requer Node, JDK e Android SDK na maquina de compilacao.
// O servidor e quem instala o APK nao precisam dessas ferramentas.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  renameSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const mobile = path.join(root, "mobile");
const windows = process.platform === "win32";
const privateDirectory = path.join(root, "producao", "assinatura-android");
const configuration = path.join(privateDirectory, "chave.json");
const keystore = path.join(privateDirectory, "patrimonio-release.p12");
const javaTool = (name) =>
  process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin", name + (windows ? ".exe" : ""))
    : name;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: mobile,
    stdio: "inherit",
    ...options,
  });
  if (result.error || result.status !== 0)
    throw Error(
      `Falha ao executar ${path.basename(command)}. A chave existente foi preservada.`,
    );
}
let temporary;
try {
  let sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk && existsSync(path.join(mobile, "local.properties"))) {
    sdk = readFileSync(path.join(mobile, "local.properties"), "utf8")
      .match(/^sdk\.dir=(.+)$/m)?.[1]
      ?.trim()
      .replaceAll("\\:", ":")
      .replaceAll("\\\\", "\\");
  }
  if (!sdk)
    throw Error(
      "Configure ANDROID_HOME ou mobile/local.properties com o caminho do SDK Android.",
    );
  const versions = readdirSync(path.join(sdk, "build-tools"))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const tools = path.join(sdk, "build-tools", versions.at(-1) || "35.0.0");
  const apksigner = path.join(tools, "lib", "apksigner.jar");
  const aapt = path.join(tools, "aapt" + (windows ? ".exe" : ""));
  if (!existsSync(apksigner) || !existsSync(aapt))
    throw Error("Instale Android SDK Build Tools antes de gerar o APK.");
  // Compila e verifica release antes de criar ou usar a chave permanente.
  run(javaTool("java"), [
    "-Dorg.gradle.appname=gradlew",
    "-classpath",
    path.join(mobile, "gradle", "wrapper", "gradle-wrapper.jar"),
    "org.gradle.wrapper.GradleWrapperMain",
    ":app:assembleRelease",
    ":app:testReleaseUnitTest",
    ":app:lintRelease",
    "--console=plain",
  ]);
  const output = path.join(mobile, "app", "build", "outputs", "apk", "release");
  const metadata = JSON.parse(
    readFileSync(path.join(output, "output-metadata.json"), "utf8"),
  );
  const artifact = metadata.elements[0];
  const unsigned = path.join(output, artifact.outputFile);
  mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
  if (!windows) chmodSync(privateDirectory, 0o700);
  if (existsSync(configuration) !== existsSync(keystore))
    throw Error(
      "A chave ou suas credenciais estao faltando. Restaure o backup completo de producao/assinatura-android; nao gere outra chave para substituir.",
    );
  let credentials;
  if (existsSync(configuration))
    credentials = JSON.parse(readFileSync(configuration, "utf8"));
  else {
    if (
      readdirSync(root).some((name) =>
        /^patrimonio-fatec-.*-release\.apk$/.test(name),
      )
    ) {
      throw Error(
        "Existe um APK de producao, mas a chave privada esta ausente. Restaure producao/assinatura-android do backup; nao crie outra assinatura.",
      );
    }
    credentials = {
      alias: "patrimonio-release",
      password: randomBytes(32).toString("hex"),
    };
    // Salva antes: se keytool for interrompido, nao sobrescreve uma chave parcial.
    writeFileSync(configuration, JSON.stringify(credentials, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    run(
      javaTool("keytool"),
      [
        "-genkeypair",
        "-keystore",
        keystore,
        "-storetype",
        "PKCS12",
        "-alias",
        credentials.alias,
        "-keyalg",
        "RSA",
        "-keysize",
        "3072",
        "-validity",
        "10000",
        "-dname",
        "CN=Patrimonio Android, O=Projeto Inventario, C=BR",
        "-storepass:env",
        "PATRIMONIO_SIGN_PASSWORD",
        "-keypass:env",
        "PATRIMONIO_SIGN_PASSWORD",
        "-noprompt",
      ],
      {
        env: { ...process.env, PATRIMONIO_SIGN_PASSWORD: credentials.password },
      },
    );
  }
  if (!windows) {
    chmodSync(configuration, 0o600);
    chmodSync(keystore, 0o600);
  }
  const target = path.join(
    root,
    `patrimonio-fatec-${artifact.versionName}-release.apk`,
  );
  temporary = target + ".tmp.apk";
  // Gradle entrega APK alinhado. A assinatura e feita somente depois do build.
  run(
    javaTool("java"),
    [
      "-jar",
      apksigner,
      "sign",
      "--ks",
      keystore,
      "--ks-key-alias",
      credentials.alias,
      "--ks-pass",
      "env:PATRIMONIO_SIGN_PASSWORD",
      "--key-pass",
      "env:PATRIMONIO_SIGN_PASSWORD",
      "--out",
      temporary,
      unsigned,
    ],
    {
      env: { ...process.env, PATRIMONIO_SIGN_PASSWORD: credentials.password },
    },
  );
  run(javaTool("java"), [
    "-jar",
    apksigner,
    "verify",
    "--verbose",
    "--print-certs",
    temporary,
  ]);
  const inspected = spawnSync(
    aapt,
    ["dump", "xmltree", temporary, "AndroidManifest.xml"],
    { encoding: "utf8" },
  );
  if (inspected.status !== 0)
    throw Error("Nao foi possivel conferir o manifesto do APK.");
  if (/android:debuggable[^\n]*0xffffffff/.test(inspected.stdout))
    throw Error("APK inesperadamente depuravel; entrega interrompida.");
  if (!/android:usesCleartextTraffic[^\n]*0x0\b/.test(inspected.stdout))
    throw Error("A versao de producao deve recusar HTTP.");
  // Recusa substituir uma entrega existente por outra identidade de assinatura.
  if (existsSync(target)) {
    const fingerprint = (file) => {
      const result = spawnSync(
        javaTool("java"),
        ["-jar", apksigner, "verify", "--print-certs", file],
        { encoding: "utf8" },
      );
      const digest = result.stdout?.match(
        /certificate SHA-256 digest: ([0-9a-f]+)/i,
      )?.[1];
      if (result.status !== 0 || !digest)
        throw Error(
          "Nao foi possivel conferir a assinatura da entrega anterior.",
        );
      return digest;
    };
    if (fingerprint(target) !== fingerprint(temporary))
      throw Error(
        "A chave atual e diferente da usada no APK anterior. A entrega anterior foi preservada; restaure a chave correta.",
      );
  }
  rmSync(temporary + ".idsig", { force: true });
  renameSync(temporary, target);
  temporary = undefined;
  writeFileSync(
    path.join(privateDirectory, "GUARDAR-EM-LOCAL-SEGURO.txt"),
    "CHAVE PRIVADA DE ASSINATURA ANDROID\n\nCopie esta pasta inteira para um backup externo protegido.\nEla contem a chave e a senha usadas nas atualizacoes do aplicativo de producao.\nNao envie para GitHub, e-mail ou chamados. Nao compartilhe no Download ZIP.\nPerder esta chave impede atualizacoes normais das instalacoes que usam esta assinatura.\nReutilize esta pasta ao gerar as proximas versoes.\n",
    { mode: 0o600 },
  );
  console.log(
    `\nAPK DE PRODUCAO: ${target}\nChave privada: producao/assinatura-android (fora do Git). Faca backup protegido dessa pasta.\nA assinatura de producao e diferente da debug. Sincronize pendencias antes de migrar de versao.`,
  );
} catch (error) {
  if (temporary) {
    rmSync(temporary, { force: true });
    rmSync(temporary + ".idsig", { force: true });
  }
  console.error(error.message);
  process.exitCode = 1;
}
