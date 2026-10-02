import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Imports({ state }: { state: AppState }) {
  const {
    token,
    section,
    error,
    busy,
    batch,
    setBatch,
    decisions,
    setDecisions,
    filter,
    run,
    form,
  } = state;
  return (
    <>
      {section === "imports" && (
        <>
          <div className="panel">
            <h2>Importar ou atualizar ativos</h2>
            <p>
              Compare a planilha com os registros atuais. Localizações, fotos e
              histórico são preservados.
            </p>
            <button
              className="link"
              onClick={() =>
                void run(
                  () =>
                    A.download("imports/template", token, "modelo-ativos.xlsx"),
                  "",
                )
              }
            >
              Baixar modelo de planilha →
            </button>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const b = await A.request<A.ImportBatch>(
                    "imports/preview",
                    token,
                    f,
                  );
                  setBatch(b);
                  setDecisions(
                    Object.fromEntries(
                      b.rows.map((r) => [
                        r.line,
                        {
                          action:
                            r.errors.length || r.current ? "SKIP" : "APPLY",
                          fields: r.differences,
                        },
                      ]),
                    ),
                  );
                }, "Prévia pronta. Revise cada conflito.");
              }}
            >
              <input type="file" name="file" accept=".xlsx,.xls" required />
              <button disabled={busy}>Analisar planilha</button>
            </form>
          </div>
          {batch && (
            <>
              <p>
                {batch.filename} · {batch.rows.length} registros
              </p>
              {batch.rows.map((row) => (
                <div key={row.line} className="panel conflict">
                  <h3>
                    Linha {row.line} · {row.incoming.patrimony}
                  </h3>
                  {row.errors.length > 0 ? (
                    <p className="error">{row.errors.join(" · ")}</p>
                  ) : (
                    <>
                      <div className="actions">
                        <button
                          className="secondary"
                          onClick={() =>
                            setDecisions({
                              ...decisions,
                              [row.line]: { action: "SKIP", fields: [] },
                            })
                          }
                        >
                          Manter atual / ignorar
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            setDecisions({
                              ...decisions,
                              [row.line]: {
                                action: "APPLY",
                                fields: row.differences,
                              },
                            })
                          }
                        >
                          Aceitar planilha
                        </button>
                        <span>
                          {decisions[row.line]?.action === "APPLY"
                            ? "Importar selecionados"
                            : "Manter atual"}
                        </span>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>Campo</th>
                            <th>Atual</th>
                            <th>Planilha</th>
                            <th>Usar planilha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(row.incoming).map(([key, value]) => (
                            <tr
                              key={key}
                              className={
                                row.differences.includes(key) ? "changed" : ""
                              }
                            >
                              <td>{A.fieldLabels[key]}</td>
                              <td>{row.current?.[key] ?? "Novo registro"}</td>
                              <td>{value}</td>
                              <td>
                                {row.current &&
                                  row.differences.includes(key) && (
                                    <input
                                      aria-label={`Importar ${key} da linha ${row.line}`}
                                      type="checkbox"
                                      checked={
                                        decisions[row.line]?.action ===
                                          "APPLY" &&
                                        decisions[row.line].fields.includes(key)
                                      }
                                      onChange={(e) => {
                                        const current =
                                          decisions[row.line]?.fields ?? [];
                                        setDecisions({
                                          ...decisions,
                                          [row.line]: {
                                            action: "APPLY",
                                            fields: e.target.checked
                                              ? [...current, key]
                                              : current.filter(
                                                  (f) => f !== key,
                                                ),
                                          },
                                        });
                                      }}
                                    />
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              ))}
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await A.request(`imports/${batch.id}/apply`, token, {
                      decisions: Object.entries(decisions).map(([line, d]) => ({
                        line: Number(line),
                        ...d,
                      })),
                    });
                    setBatch(null);
                  }, "Importação concluída.")
                }
              >
                Aplicar decisões
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}
