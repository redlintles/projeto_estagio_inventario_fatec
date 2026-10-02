import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Dashboard({ state }: { state: AppState }) {
  const {
    section,
    assets,
    dashboard,
    inventories,
    divergences,
    filter,
    setFilter,
    choose,
  } = state;
  return (
    <>
      {section === "dashboard" && (
        <>
          <p className="subtitle">
            Acompanhe o patrimônio e as pendências da unidade.
          </p>
          <div className="cards">
            {Object.entries(A.statusLabels).map(([key, label]) => (
              <button
                className="stat"
                key={key}
                onClick={() => {
                  setFilter({ ...filter, status: key, offset: "0" });
                  choose("assets");
                }}
              >
                <span>{label}</span>
                <strong>{dashboard.counts[key] ?? 0}</strong>
                <small>Ver ativos →</small>
              </button>
            ))}
            <button
              className="stat warning"
              onClick={() => choose("divergences")}
            >
              <span>Divergências pendentes</span>
              <strong>{dashboard.pendingDivergences}</strong>
              <small>Revisar registros →</small>
            </button>
          </div>
          <div className="panel">
            <h2>Uma rotina com rastreabilidade</h2>
            <p>
              Importe a base patrimonial, confira os ativos por localização e
              acompanhe cada movimentação. Os registros históricos permanecem
              disponíveis após a baixa.
            </p>
            <div className="actions">
              <button onClick={() => choose("assets")}>Consultar ativos</button>
              <button
                className="secondary"
                onClick={() => choose("inventories")}
              >
                Abrir inventários
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
