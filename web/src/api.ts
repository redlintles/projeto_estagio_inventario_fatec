export const apiUrl =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_URL ?? "http://localhost:3000/api";
export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PATRIMONIAL" | "CONSULTA";
  active?: boolean;
}
export interface Asset {
  id: string;
  patrimony: string;
  description: string;
  group: string;
  uniqueCode: string;
  originUnit: string;
  incorporationDate: string;
  value: string;
  status: string;
  locationId: string | null;
  condition: number | null;
  version: number;
  availableAt: string | null;
}
export interface Location {
  id: string;
  code: string;
  description: string;
  building: string;
  floor: string;
  notes: string;
  active: boolean;
}
export interface Unit {
  id: string;
  code: string;
  name: string;
  email: string;
  active: boolean;
}
export interface Reservation {
  id: string;
  assetId: string;
  destinationUnitId: string;
  status: string;
}
export interface Movement {
  id: string;
  operation: string;
  createdAt: string;
  notes: string;
  userId: string;
  before: unknown;
  after: unknown;
}
export interface Photo {
  id: string;
  originalName: string;
}
export interface AssetDetail extends Asset {
  movements: Movement[];
  photos: Photo[];
  reservations: Reservation[];
}
export interface Inventory {
  id: string;
  locationId: string;
  status: string;
  startedAt: string;
  missingIds?: string[];
  items?: { assetId: string; result: string }[];
}
export interface Divergence {
  id: string;
  assetId: string;
  type: string;
  foundDescription: string;
  notes: string;
  locationId: string;
  status: string;
  createdAt: string;
}
export interface ImportRow {
  line: number;
  incoming: Record<string, string>;
  current: Record<string, string> | null;
  differences: string[];
  errors: string[];
}
export interface ImportBatch {
  id: string;
  rows: ImportRow[];
  filename: string;
}
export const statusLabels: Record<string, string> = {
  A: "Ativo",
  D: "Disponibilizado",
  B: "A baixar",
  T: "Transferido",
  X: "Baixado",
};
export const fieldLabels: Record<string, string> = {
  patrimony: "Patrimônio",
  description: "Descrição",
  group: "Grupo",
  uniqueCode: "Código de barras",
  originUnit: "Unidade de origem",
  incorporationDate: "Incorporação",
  value: "Valor",
};
export async function request<T>(
  path: string,
  token: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(`${apiUrl}/${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(form ? {} : { "Content-Type": "application/json" }),
    },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ message: "Falha de comunicação." }));
    throw new Error(
      typeof data.message === "string" ? data.message : JSON.stringify(data),
    );
  }
  return response.json();
}
export async function download(path: string, token: string, filename: string) {
  const response = await fetch(`${apiUrl}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Não foi possível obter o arquivo.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
