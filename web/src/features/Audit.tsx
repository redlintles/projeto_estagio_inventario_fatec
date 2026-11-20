import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
import { MovementDetails, operationLabel } from "./MovementDetails";
export function Audit({ state }: { state: AppState }) {
  const { section, audit, locations, units } = state;
  return (
    <>
      {section === "audit" && (
        <div className="panel">
          <h2>Últimas movimentações</h2>
          {audit.map((m) => (
            <details key={m.id} className="timeline">
              <summary>
                {operationLabel(m.operation)} ·{" "}
                {new Date(m.createdAt).toLocaleString("pt-BR")}
              </summary>
              <p>Usuário: {m.userId ?? "Processo automático"}</p>
              <MovementDetails movement={m} context={{ locations, units }} />
            </details>
          ))}
        </div>
      )}
    </>
  );
}
