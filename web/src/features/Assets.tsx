import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Assets({ state }: { state: AppState }) {
  const {
    token,
    section,
    busy,
    assets,
    locations,
    detail,
    filter,
    setFilter,
    admin,
    run,
    refreshDetail,
    form,
  } = state;
  return (
    <>
      {section === "assets" && !detail && (
        <>
          <div className="toolbar">
            <input
              aria-label="Patrimônio"
              placeholder="Patrimônio…"
              value={filter.patrimony}
              onChange={(e) =>
                setFilter({ ...filter, patrimony: e.target.value, offset: "0" })
              }
            />
            <input
              aria-label="Grupo"
              placeholder="Grupo patrimonial…"
              value={filter.group}
              onChange={(e) =>
                setFilter({ ...filter, group: e.target.value, offset: "0" })
              }
            />

            <input
              aria-label="Buscar descrição"
              placeholder="Buscar pela descrição…"
              value={filter.description}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  description: e.target.value,
                  offset: "0",
                })
              }
            />
            <select
              aria-label="Status"
              value={filter.status}
              onChange={(e) =>
                setFilter({ ...filter, status: e.target.value, offset: "0" })
              }
            >
              <option value="">Todos os status</option>
              {Object.entries(A.statusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              aria-label="Localização"
              value={filter.locationId}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  locationId: e.target.value,
                  offset: "0",
                })
              }
            >
              <option value="">Todas as localizações</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.description}
                </option>
              ))}
            </select>
          </div>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patrimônio</th>
                  <th>Descrição</th>
                  <th>Localização</th>
                  <th>Condição</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.patrimony}</td>
                    <td>
                      <strong>{a.description}</strong>
                      <small>{a.group}</small>
                    </td>
                    <td>
                      {locations.find((l) => l.id === a.locationId)
                        ?.description ?? "Não definida"}
                    </td>
                    <td>
                      {a.condition
                        ? "★".repeat(a.condition) + "☆".repeat(5 - a.condition)
                        : "Não avaliado"}
                    </td>
                    <td>
                      <span className={`badge status-${a.status}`}>
                        {A.statusLabels[a.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="link"
                        onClick={() => void run(() => refreshDetail(a.id), "")}
                      >
                        Detalhes →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assets.length === 0 && (
              <p className="empty">
                Nenhum ativo encontrado. Importe uma planilha ou ajuste os
                filtros.
              </p>
            )}
          </div>
          <div className="toolbar">
            <button
              className="secondary"
              disabled={Number(filter.offset) === 0}
              onClick={() =>
                setFilter({
                  ...filter,
                  offset: String(Math.max(0, Number(filter.offset) - 100)),
                })
              }
            >
              Anterior
            </button>
            <span>
              Página {Number(filter.offset) / 100 + 1} · {assets.length}{" "}
              registros
            </span>
            <button
              className="secondary"
              disabled={assets.length < 100}
              onClick={() =>
                setFilter({
                  ...filter,
                  offset: String(Number(filter.offset) + 100),
                })
              }
            >
              Próxima
            </button>
          </div>
          {admin && (
            <details className="panel">
              <summary>Cadastrar ativo manualmente</summary>
              <form
                className="grid-form"
                onSubmit={(e) => {
                  const b = form(e);
                  void run(() => A.request("assets", token, b));
                }}
              >
                {Object.entries(A.fieldLabels).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      type={key === "incorporationDate" ? "date" : "text"}
                      required
                    />
                  </label>
                ))}
                <button disabled={busy}>Cadastrar</button>
              </form>
            </details>
          )}
        </>
      )}
    </>
  );
}
