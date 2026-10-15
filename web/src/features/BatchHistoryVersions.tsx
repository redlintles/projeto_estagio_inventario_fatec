import React from "react";
import { request } from "../api";
type Event = {
  revision: number;
  action: string;
  count: number;
  createdAt: string;
  userName: string;
};
export function BatchHistoryVersions({
  id,
  revision,
  token,
}: {
  id: string;
  revision: number;
  token: string;
}) {
  const [open, setOpen] = React.useState(false),
    [events, setEvents] = React.useState<Event[]>([]),
    [loading, setLoading] = React.useState(false),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    void request<Event[]>(`asset-batches/${id}/events`, token)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, revision, token, open]);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Ver versões do lote</summary>
      {open &&
        (loading ? (
          <p role="status">Carregando versões…</p>
        ) : error ? (
          <p role="alert">{error} Feche e reabra para tentar novamente.</p>
        ) : (
          events.map((event) => (
            <p key={event.revision}>
              v{event.revision} ·{" "}
              {(
                {
                  APPLY: "Aplicado",
                  UNDO: "Desfeito",
                  REDO: "Refeito",
                } as Record<string, string>
              )[event.action] ?? event.action}{" "}
              · {event.count} ativos · {event.userName} ·{" "}
              {new Date(event.createdAt).toLocaleString("pt-BR")}
            </p>
          ))
        ))}
    </details>
  );
}
