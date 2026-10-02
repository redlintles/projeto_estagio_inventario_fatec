import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Divergences({ state }: { state: AppState }) {
  const {
    token,
    section,
    busy,
    setRevision,
    assets,
    locations,
    divergences,
    setDivergences,
    filter,
    operator,
    run,
    refreshDetail,
    form,
    choose,
  } = state;
  return (
    <>
      {section === "divergences" && (
        <>
          <div className="toolbar">
            <button
              className="secondary"
              onClick={() =>
                void run(
                  async () =>
                    setDivergences(
                      await A.request<A.Divergence[]>(
                        "divergences?status=PENDING",
                        token,
                      ),
                    ),
                  "",
                )
              }
            >
              Somente pendentes
            </button>
            <button
              className="secondary"
              onClick={() => setRevision((v) => v + 1)}
            >
              Todas
            </button>
          </div>
          {divergences.map((d) => (
            <div className="panel" key={d.id}>
              <span className="badge">
                {d.status === "PENDING" ? "Pendente" : "Resolvida"}
              </span>
              <h3>{d.foundDescription}</h3>
              <p>
                {d.type} ·{" "}
                {locations.find((l) => l.id === d.locationId)?.description}
              </p>
              <p>{d.notes}</p>
              <button
                className="link"
                onClick={() => {
                  choose("assets");
                  void run(() => refreshDetail(d.assetId), "");
                }}
              >
                Abrir ativo →
              </button>
              {operator && d.status === "PENDING" && (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    const b = form(e);
                    void run(() =>
                      A.request(`divergences/${d.id}/resolve`, token, {
                        resolution: b.resolution,
                        ...(b.newLocationId
                          ? { newLocationId: b.newLocationId }
                          : {}),
                      }),
                    );
                  }}
                >
                  <input
                    aria-label="Resolução"
                    name="resolution"
                    placeholder="Descreva o tratamento"
                    minLength={3}
                    required
                  />
                  <select
                    aria-label="Corrigir localização"
                    name="newLocationId"
                  >
                    <option value="">Preservar localização oficial</option>
                    {locations
                      .filter((l) => l.active)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.description}
                        </option>
                      ))}
                  </select>
                  <button disabled={busy}>Resolver divergência</button>
                </form>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}
