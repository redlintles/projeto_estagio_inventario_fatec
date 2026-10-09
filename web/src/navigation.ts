export type Section =
  | "dashboard"
  | "assets"
  | "inventories"
  | "divergences"
  | "imports"
  | "locations"
  | "units"
  | "users"
  | "settings"
  | "reports"
  | "audit"
  | "help";
export const sections: Record<Section, string> = {
  dashboard: "Visão geral",
  assets: "Ativos",
  inventories: "Inventários",
  divergences: "Divergências",
  imports: "Importar planilha",
  locations: "Localizações",
  units: "Unidades",
  users: "Usuários",
  settings: "Parâmetros",
  reports: "Relatórios",
  audit: "Auditoria",
  help: "Ajuda",
};
