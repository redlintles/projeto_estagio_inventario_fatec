import { ForbiddenException } from "@nestjs/common";
import { Role } from "../domain/model";
export const permissionCatalog = [
  { key: "locations.view", group: "Consulta", label: "Consultar localizações" },
  { key: "units.view", group: "Consulta", label: "Consultar unidades" },
  {
    key: "dashboard.view",
    group: "Consulta",
    label: "Visualizar indicadores e totais",
  },
  {
    key: "assets.view",
    group: "Consulta",
    label: "Consultar ativos, fotos e histórico individual",
  },
  {
    key: "inventories.view",
    group: "Consulta",
    label: "Consultar inventários",
  },
  {
    key: "divergences.view",
    group: "Consulta",
    label: "Consultar divergências",
  },
  {
    key: "reports.export",
    group: "Consulta",
    label: "Consultar e exportar relatórios",
  },
  {
    key: "assets.create",
    group: "Ativos",
    label: "Cadastrar ativos manualmente",
  },
  {
    key: "assets.location",
    group: "Ativos",
    label: "Alterar localização individual",
  },
  { key: "photos.upload", group: "Ativos", label: "Adicionar fotos" },
  {
    key: "assets.available",
    group: "Movimentações",
    label: "Disponibilizar ativos",
  },
  {
    key: "assets.reserve",
    group: "Movimentações",
    label: "Reservar, transportar e transferir ativos",
  },
  {
    key: "assets.writeOff",
    group: "Movimentações",
    label: "Realizar baixa definitiva",
  },
  {
    key: "batches.unit",
    group: "Alterações em lote",
    label: "Vincular unidade em lote",
  },
  {
    key: "batches.location",
    group: "Alterações em lote",
    label: "Alterar localização em lote",
  },
  {
    key: "batches.undo",
    group: "Alterações em lote",
    label: "Desfazer lotes de unidade e localização",
  },
  {
    key: "batches.redo",
    group: "Alterações em lote",
    label: "Refazer lotes de unidade e localização",
  },
  {
    key: "inventories.manage",
    group: "Inventário",
    label: "Iniciar, conferir, sincronizar e encerrar inventários",
  },
  {
    key: "divergences.resolve",
    group: "Inventário",
    label: "Resolver divergências",
  },
  {
    key: "imports.manage",
    group: "Cadastros",
    label: "Importar planilhas e resolver conflitos",
  },
  {
    key: "locations.manage",
    group: "Cadastros",
    label: "Cadastrar e editar localizações",
  },
  {
    key: "units.manage",
    group: "Cadastros",
    label: "Cadastrar e editar unidades",
  },
  {
    key: "audit.view",
    group: "Administração",
    label: "Consultar auditoria global",
  },
  {
    key: "settings.manage",
    group: "Administração",
    label: "Alterar parâmetros e executar rotinas de notificação",
  },
] as const;
export type Permission = (typeof permissionCatalog)[number]["key"];
export const permissionKeys = permissionCatalog.map((p) => p.key);
const reads: Permission[] = [
  "locations.view",
  "units.view",
  "dashboard.view",
  "assets.view",
  "inventories.view",
  "divergences.view",
  "reports.export",
];
export const roleDefaults: Record<Role, Permission[]> = {
  ADMIN: [...permissionKeys],
  CONSULTA: reads,
  PATRIMONIAL: [
    ...reads,
    "assets.location",
    "photos.upload",
    "assets.available",
    "assets.reserve",
    "assets.writeOff",
    "batches.unit",
    "batches.location",
    "batches.undo",
    "batches.redo",
    "inventories.manage",
    "divergences.resolve",
  ],
};
export function normalizePermissions(input: Permission[]): Permission[] {
  const result = new Set(input);
  for (const key of input) {
    if (
      key.startsWith("assets.") ||
      key.startsWith("batches.") ||
      key === "photos.upload"
    )
      result.add("assets.view");
    if (key === "inventories.manage") {
      result.add("inventories.view");
      result.add("assets.view");
    }
    if (key === "divergences.resolve") {
      result.add("divergences.view");
      result.add("assets.view");
    }
  }
  if (result.has("locations.manage")) result.add("locations.view");
  if (result.has("units.manage")) result.add("units.view");
  if (result.has("imports.manage")) result.add("assets.view");
  if (
    result.has("assets.view") ||
    result.has("inventories.view") ||
    result.has("divergences.view") ||
    result.has("reports.export")
  ) {
    result.add("locations.view");
    result.add("units.view");
  }
  return permissionKeys.filter((k) => result.has(k));
}
export function effectivePermissions(user: {
  role: Role;
  permissions?: Permission[] | null;
}) {
  return user.role === "ADMIN"
    ? [...permissionKeys]
    : normalizePermissions(user.permissions ?? roleDefaults[user.role]);
}

export function assertPermission(
  actor: { role: Role; permissions?: Permission[] },
  permission: Permission,
) {
  if (!effectivePermissions(actor).includes(permission))
    throw new ForbiddenException("Você não tem permissão para esta tarefa.");
}
