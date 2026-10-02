import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Reports({ state }: { state: AppState }) {
  const { token, section, inventories, divergences, run } = state;
  return (
    <>
      {section === "reports" && (
        <div className="panel">
          <h2>Exportar relatórios</h2>
          <p>
            Arquivos CSV compatíveis com planilhas. Os ativos baixados
            permanecem no histórico.
          </p>
          <div className="report-grid">
            {Object.entries({
              byLocation: "Ativos por localização",
              inventories: "Conferências de inventário",
              available: "Disponibilizados",
              transferred: "Transferidos",
              writtenOff: "Baixados",
              divergences: "Divergências",
              movements: "Histórico de movimentações",
            }).map(([kind, label]) => (
              <button
                key={kind}
                className="secondary"
                onClick={() =>
                  void run(
                    () => A.download(`reports/${kind}`, token, `${kind}.csv`),
                    "",
                  )
                }
              >
                {label} ↓
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
