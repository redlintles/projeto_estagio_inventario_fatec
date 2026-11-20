import * as A from "./api";

/** Nomes legíveis das operações gravadas no histórico (tabela movements). */
export const operationLabels: Record<string, string> = {
  INCLUSION: "Cadastro manual",
  IMPORT: "Importação de planilha",
  REIMPORT: "Atualização por planilha",
  LOCATION: "Alteração de localização",
  LOCATION_BATCH: "Localização alterada em lote",
  UNIT_BATCH: "Unidade vinculada em lote",
  BATCH_UNDO: "Lote desfeito",
  BATCH_REDO: "Lote refeito",
  PHOTO: "Foto adicionada",
  PHOTO_DELETE: "Foto removida",
  AVAILABLE: "Ativo disponibilizado",
  RESERVE: "Reserva registrada",
  DISPATCH: "Transporte iniciado",
  COMPLETE: "Transferência concluída",
  CANCEL: "Reserva cancelada",
  WRITE_OFF: "Baixa definitiva",
  DEADLINE: "Prazo de disponibilização vencido",
  INVENTORY: "Conferido em inventário",
  DIVERGENCE: "Divergência registrada em inventário",
  DIVERGENCE_RESOLVED: "Divergência resolvida",
};

export function operationLabel(operation: string) {
  return operationLabels[operation] ?? operation;
}

/** Campos do ativo exibidos na comparação "antes / depois", em ordem. */
const changeLabels: Record<string, string> = {
  patrimony: "Patrimônio",
  description: "Descrição",
  group: "Grupo",
  uniqueCode: "Código único da planilha",
  originUnit: "Unidade de origem",
  incorporationDate: "Incorporação",
  value: "Valor",
  status: "Status",
  unitId: "Unidade",
  locationId: "Localização",
  condition: "Condição física",
  availableAt: "Disponibilizado em",
};

export interface HistoryContext {
  locations: Pick<A.Location, "id" | "code" | "description">[];
  units: Pick<A.Unit, "id" | "name">[];
}

const reservationStatus: Record<string, string> = {
  RESERVED: "aguardando transporte",
  IN_TRANSIT: "em transporte",
  COMPLETED: "transferência concluída",
  CANCELLED: "reserva cancelada",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Datas sem horário (ex.: incorporação) não devem mudar de dia pelo fuso.
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : date.toLocaleString("pt-BR");
}

export function formatField(
  key: string,
  value: unknown,
  context: HistoryContext,
): string {
  if (value === null || value === undefined || value === "") {
    if (key === "unitId") return "Não vinculada";
    if (key === "locationId") return "Sem localização";
    if (key === "condition") return "Não avaliado";
    return "—";
  }
  const text = String(value);
  switch (key) {
    case "status":
      return A.statusLabels[text] ?? text;
    case "unitId":
      return (
        context.units.find((u) => u.id === text)?.name ?? "Unidade removida"
      );
    case "locationId": {
      const location = context.locations.find((l) => l.id === text);
      return location ? A.locationLabel(location) : "Localização removida";
    }
    case "condition":
      return `${text}/5`;
    case "value":
      try {
        return A.formatMoney(text);
      } catch {
        return text;
      }
    case "incorporationDate":
    case "availableAt":
      return formatDate(text);
    default:
      return text;
  }
}

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/** Lista apenas os campos que mudaram, já com nomes e valores legíveis. */
export function describeChanges(
  movement: Pick<A.Movement, "before" | "after">,
  context: HistoryContext,
): FieldChange[] {
  const before = asRecord(movement.before);
  const after = asRecord(movement.after);
  if (!after) return [];
  const changes: FieldChange[] = [];
  for (const [key, label] of Object.entries(changeLabels)) {
    const old = before ? before[key] : undefined;
    const now = after[key];
    // Na criação do registro mostra só os campos preenchidos.
    if (!before && (now === null || now === undefined || now === "")) continue;
    if (before && JSON.stringify(old ?? null) === JSON.stringify(now ?? null))
      continue;
    changes.push({
      label,
      before: before ? formatField(key, old, context) : "",
      after: formatField(key, now, context),
    });
  }
  return changes;
}

/**
 * Observação legível. Registros antigos de reserva gravavam o objeto da
 * reserva em JSON e fotos antigas gravavam só o UUID; ambos são convertidos.
 */
export function describeNotes(notes: string, context: HistoryContext): string {
  const text = (notes ?? "").trim();
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (typeof data.destinationUnitId === "string") {
        const unit = formatField("unitId", data.destinationUnitId, context);
        const status = reservationStatus[String(data.status)];
        return `Unidade de destino: ${unit}${status ? ` · Situação: ${status}` : ""}`;
      }
      return "";
    } catch {
      return text;
    }
  }
  if (/^Foto [0-9a-f-]{36}$/i.test(text)) return "";
  const inventory = /^Inventário [0-9a-f-]{36}; observado em (.+)$/i.exec(text);
  if (inventory) return `Observado em ${formatDate(inventory[1])}`;
  return text;
}
