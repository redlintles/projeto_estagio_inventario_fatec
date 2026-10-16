// Execute somente contra a instalação de teste; o roteiro cadastra uma localização.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.SMOKE_WEB_URL ?? "http://localhost:5174";
const email = process.env.SMOKE_EMAIL,
  password = process.env.SMOKE_PASSWORD;
if (!email || !password)
  throw new Error(
    "Configure SMOKE_EMAIL e SMOKE_PASSWORD da instalação de teste.",
  );
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("/tmp/fatec-web-qa", { recursive: true });
try {
  await page.goto(base);
  await page.screenshot({ path: "/tmp/fatec-web-qa/login.png" });
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("heading", { name: "Visão geral", exact: true })
    .waitFor();
  await page.screenshot({
    path: "/tmp/fatec-web-qa/dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ativos", exact: true }).click();
  await page.locator("tbody tr:visible").first().waitFor();
  await page.getByRole("button", { name: "Detalhes →" }).first().click();
  await page.getByRole("heading", { name: "Histórico", exact: true }).waitFor();
  await page.getByRole("button", { name: "Localizações", exact: true }).click();
  await page
    .locator("form.panel.grid-form:visible")
    .getByLabel("Código", { exact: true })
    .fill(`QA-${Date.now()}`);
  await page
    .locator("form.panel.grid-form:visible")
    .getByLabel("Descrição", { exact: true })
    .fill("Sala de teste do portal");
  await page.getByRole("button", { name: "Cadastrar localização" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Operação concluída" })
    .waitFor();
  await page
    .getByRole("cell", { name: "Sala de teste do portal", exact: true })
    .last()
    .waitFor();
  for (const name of [
    "Unidades",
    "Usuários",
    "Parâmetros",
    "Divergências",
    "Inventários",
    "Relatórios",
    "Auditoria",
    "Importar planilha",
    "Ajuda",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  }
  await page
    .getByRole("heading", { name: "Portal e coleta no celular" })
    .waitFor();
  await page
    .getByRole("heading", { name: "Seu perfil e as permissões" })
    .waitFor();
  await page.screenshot({ path: "/tmp/fatec-web-qa/ajuda.png" });
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  await page
    .getByRole("button", { name: "Visualizar prévia", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "registros encontrados" })
    .waitFor();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar XLSX", exact: true })
    .click();
  const report = await downloadEvent;
  assert.match(report.suggestedFilename(), /\.xlsx$/);
  assert.equal(await report.failure(), null);
  await page
    .getByRole("button", { name: "Importar planilha", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/fatec-web-qa/importacao.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.screenshot({
    path: "/tmp/fatec-web-qa/responsivo.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Portal validado: login, indicadores, consulta, histórico, cadastro, navegação e viewport mobile.",
  );
} catch (error) {
  await page
    .screenshot({ path: "/tmp/fatec-web-qa/falha.png" })
    .catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
