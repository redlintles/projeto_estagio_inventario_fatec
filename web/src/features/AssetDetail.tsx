import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function AssetDetail({ state }: { state: AppState }) {
  const {
    token,
    section,
    busy,
    assets,
    locations,
    units,
    detail,
    setDetail,
    filter,
    operator,
    run,
    refreshDetail,
    form,
  } = state;
  return (
    <>
      {section === "assets" && detail && (
        <>
          <button className="link" onClick={() => setDetail(null)}>
            ← Voltar aos ativos
          </button>
          <div className="panel">
            <div className="detail-heading">
              <div>
                <p className="eyebrow">PATRIMÔNIO {detail.patrimony}</p>
                <h2>{detail.description}</h2>
              </div>
              <span className={`badge status-${detail.status}`}>
                {A.statusLabels[detail.status]}
              </span>
            </div>
            <dl>
              {Object.entries(A.fieldLabels).map(([key, label]) => (
                <React.Fragment key={key}>
                  <dt>{label}</dt>
                  <dd>{String(detail[key as keyof A.AssetDetail])}</dd>
                </React.Fragment>
              ))}
            </dl>
            <p>
              Condição:{" "}
              {detail.condition ? `${detail.condition}/5` : "Não avaliado"} ·
              Versão {detail.version}
            </p>
          </div>
          {operator && detail.status !== "X" && (
            <div className="panel">
              <h2>Operações</h2>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    await A.request(`assets/${detail.id}/photos`, token, f);
                    await refreshDetail(detail.id);
                  });
                }}
              >
                <label>
                  Adicionar foto
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png"
                    required
                  />
                </label>
                <button disabled={busy}>Enviar foto</button>
              </form>
              {detail.status === "A" && (
                <>
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      const b = form(e);
                      void run(async () => {
                        await A.request(`assets/${detail.id}/location`, token, {
                          ...b,
                          expectedVersion: detail.version,
                        });
                        await refreshDetail(detail.id);
                      });
                    }}
                  >
                    <label>
                      Localização
                      <select name="locationId" required>
                        <option value="">Selecione</option>
                        {locations
                          .filter((l) => l.active)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.description}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button disabled={busy}>Atualizar localização</button>
                  </form>
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      const b = form(e);
                      void run(async () => {
                        await A.request(
                          `assets/${detail.id}/available`,
                          token,
                          {
                            expectedVersion: detail.version,
                            condition: Number(b.condition),
                          },
                        );
                        await refreshDetail(detail.id);
                      });
                    }}
                  >
                    <label>
                      Condição física
                      <select name="condition">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} / 5
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={busy}>Disponibilizar ativo</button>
                    <small>É necessário anexar uma foto.</small>
                  </form>
                </>
              )}
              {detail.status === "D" &&
                !detail.reservations.some((r) =>
                  ["RESERVED", "IN_TRANSIT"].includes(r.status),
                ) && (
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      const b = form(e);
                      void run(async () => {
                        await A.request(
                          `assets/${detail.id}/reservations`,
                          token,
                          { ...b, expectedVersion: detail.version },
                        );
                        await refreshDetail(detail.id);
                      });
                    }}
                  >
                    <label>
                      Unidade de destino
                      <select name="destinationUnitId" required>
                        <option value="">Selecione</option>
                        {units
                          .filter((u) => u.active)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button disabled={busy}>Registrar reserva</button>
                  </form>
                )}
              {detail.reservations
                .filter((r) => ["RESERVED", "IN_TRANSIT"].includes(r.status))
                .map((r) => (
                  <div className="reservation" key={r.id}>
                    <p>
                      Reserva para{" "}
                      {units.find((u) => u.id === r.destinationUnitId)?.name} ·{" "}
                      {r.status === "RESERVED"
                        ? "Aguardando transporte"
                        : "Em transporte"}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await A.request(
                            `reservations/${r.id}/${r.status === "RESERVED" ? "dispatch" : "complete"}`,
                            token,
                            { expectedVersion: detail.version },
                          );
                          await refreshDetail(detail.id);
                        })
                      }
                    >
                      {r.status === "RESERVED"
                        ? "Iniciar transporte"
                        : "Confirmar transferência"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await A.request(
                            `reservations/${r.id}/cancel`,
                            token,
                            { expectedVersion: detail.version },
                          );
                          await refreshDetail(detail.id);
                        })
                      }
                    >
                      Cancelar reserva
                    </button>
                    <small>
                      O prazo de baixa fica suspenso durante a reserva e o
                      transporte.
                    </small>
                  </div>
                ))}
              {detail.status === "B" && (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    const b = form(e);
                    void run(async () => {
                      await A.request("write-offs", token, {
                        assets: [
                          { id: detail.id, expectedVersion: detail.version },
                        ],
                        justification: b.justification,
                      });
                      await refreshDetail(detail.id);
                    });
                  }}
                >
                  <label>
                    Justificativa da baixa
                    <input name="justification" required minLength={3} />
                  </label>
                  <button className="danger" disabled={busy}>
                    Confirmar baixa definitiva
                  </button>
                </form>
              )}
            </div>
          )}
          <div className="panel">
            <h2>Fotos</h2>
            <div className="actions">
              {detail.photos.map((p) => (
                <button
                  key={p.id}
                  className="secondary"
                  onClick={() =>
                    void run(
                      () => A.download(`photos/${p.id}`, token, p.originalName),
                      "",
                    )
                  }
                >
                  {p.originalName}
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Histórico</h2>
            {detail.movements.map((m) => (
              <article className="timeline" key={m.id}>
                <strong>{m.operation}</strong>
                <time>{new Date(m.createdAt).toLocaleString("pt-BR")}</time>
                <p>{m.notes}</p>
                <details>
                  <summary>Dados antes e depois</summary>
                  <pre>
                    {JSON.stringify(
                      { antes: m.before, depois: m.after },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
