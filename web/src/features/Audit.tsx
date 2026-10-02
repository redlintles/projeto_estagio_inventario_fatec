import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Audit({ state }: { state: AppState }) {
  const { section, audit } = state;
  return (
    <>
      {section === "audit" && (
        <div className="panel">
          <h2>Últimas movimentações</h2>
          {audit.map((m) => (
            <details key={m.id} className="timeline">
              <summary>
                {m.operation} · {new Date(m.createdAt).toLocaleString("pt-BR")}
              </summary>
              <p>
                Usuário: {m.userId ?? "Processo automático"} · {m.notes}
              </p>
              <pre>
                {JSON.stringify({ antes: m.before, depois: m.after }, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
