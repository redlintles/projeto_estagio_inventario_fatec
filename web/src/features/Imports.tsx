import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Imports({ state }: { state: AppState }) {
  const {
    token,
    section,
    busy,
    batch,
    setBatch,
    decisions,
    setDecisions,
    run,
    units,
  } = state;
  const [selectedUnit, setSelectedUnit] = React.useState("");
  if (section !== "imports") return null;
  const resolved = batch?.rows.filter((row) => decisions[row.line]).length ?? 0;
  const display = (key: string, value: string) =>
    key === "status"
      ? (A.statusLabels[value] ?? value)
      : key === "unitId"
        ? (units.find((u) => u.id === value)?.name ?? "Não vinculada")
        : value;
  function choose(line: number, action: "SKIP" | "APPLY", fields: string[]) {
    setDecisions((previous) => ({ ...previous, [line]: { action, fields } }));
  }
  return (
    <>
      <div className="panel">
        <h2>Importar ou atualizar ativos</h2>
        <p>
          Ao selecionar o arquivo, os registros novos e válidos são importados
          automaticamente. Registros idênticos são mantidos. Somente dados
          conflitantes precisam da sua escolha; linhas inválidas são informadas
          separadamente.
        </p>
        <p>
          Código único pode se repetir. Use o modelo institucional com
          NroPatrimonio, Descrição do Bem, Grupo patrimonial, Código único,
          Unidade, Data de Incorporação, Status e Valor R$.
        </p>
        <button
          className="link"
          disabled={busy}
          onClick={() =>
            void run(
              () => A.download("imports/template", token, "modelo-ativos.xlsx"),
              "",
            )
          }
        >
          Baixar modelo de planilha →
        </button>
        <label className="import-upload">
          Unidade dos ativos desta planilha
          <select
            value={selectedUnit}
            disabled={busy}
            onChange={(e) => setSelectedUnit(e.target.value)}
          >
            <option value="">Selecione uma unidade cadastrada</option>
            {units
              .filter((u) => u.active)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} · {u.name}
                </option>
              ))}
          </select>
          <small>
            Selecione antes de carregar o arquivo. O campo Unidade original da
            planilha é preservado. Mudanças no vínculo de bens existentes
            aparecem como conflito.
          </small>
          {!units.some((u) => u.active) && (
            <small>
              Cadastre uma unidade ativa no menu Unidades para habilitar a
              importação.
            </small>
          )}
        </label>
        <label className="import-upload">
          Selecionar planilha para importar
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={
              busy || !units.some((u) => u.id === selectedUnit && u.active)
            }
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              const form = new FormData();
              form.set("file", file);
              form.set("unitId", selectedUnit);
              void run(async () => {
                const result = await A.request<A.ImportBatch>(
                  "imports/preview",
                  token,
                  form,
                );
                setBatch(result);
                setDecisions({});
              }, "Arquivo processado. Confira o resumo da importação.");
            }}
          />
        </label>
        {busy && (
          <p role="status">
            Processando… aguarde a confirmação antes de reenviar o arquivo.
          </p>
        )}
      </div>
      {batch && (
        <>
          <section
            className="panel import-summary"
            aria-label="Resumo da importação"
          >
            <h2>{batch.filename}</h2>
            {batch.unitName && (
              <p>
                Unidade selecionada: <strong>{batch.unitName}</strong>
              </p>
            )}
            <p>
              <strong>{batch.imported}</strong> novos importados automaticamente
              · <strong>{batch.unchanged}</strong> já estavam iguais ·{" "}
              <strong>{batch.rows.length}</strong> conflitos ·{" "}
              <strong>{batch.issues.length}</strong> linhas inválidas.
            </p>
            <p>
              Os registros novos já foram salvos, independentemente das escolhas
              abaixo.
            </p>
            {!batch.rows.length && (
              <p className="notice">
                Não há conflitos para revisar. Nenhuma confirmação adicional é
                necessária.
              </p>
            )}
          </section>
          {!!batch.issues.length && (
            <details className="panel import-issues">
              <summary>
                Ver {batch.issues.length} linhas não importadas por
                inconsistência
              </summary>
              <p>
                Corrija essas linhas na planilha e reenvie. Elas não foram
                gravadas.
              </p>
              {batch.issues.map((issue) => (
                <p key={issue.line}>
                  Linha {issue.line} · {issue.patrimony}:{" "}
                  {issue.errors.join(" · ")}
                </p>
              ))}
            </details>
          )}
          {!!batch.rows.length && (
            <>
              <div className="import-progress">
                <strong>
                  {resolved} de {batch.rows.length} conflitos com escolha
                  definida
                </strong>
                <span>
                  As escolhas de conflitos só são gravadas ao clicar em Salvar
                  escolhas.
                </span>
              </div>
              {batch.rows.map((row) => {
                const choice = decisions[row.line];
                const applying = choice?.action === "APPLY";
                const keeping = choice?.action === "SKIP";
                return (
                  <section
                    key={row.line}
                    className={`panel conflict import-conflict ${applying ? "choice-apply" : keeping ? "choice-keep" : "choice-pending"}`}
                    aria-label={`Conflito da linha ${row.line}`}
                  >
                    <h3>
                      Linha {row.line} · Patrimônio {row.incoming.patrimony}
                    </h3>
                    <div className="actions">
                      <button
                        className={keeping ? "decision-selected" : "secondary"}
                        aria-pressed={keeping}
                        disabled={busy}
                        onClick={() => choose(row.line, "SKIP", [])}
                      >
                        {" "}
                        {keeping ? "✓ " : ""}Manter atual / ignorar
                      </button>
                      <button
                        className={applying ? "decision-selected" : "secondary"}
                        aria-pressed={applying}
                        disabled={busy}
                        onClick={() =>
                          choose(row.line, "APPLY", row.differences)
                        }
                      >
                        {applying ? "✓ " : ""}Aceitar planilha
                      </button>
                    </div>
                    <p className="decision-feedback" role="status">
                      {applying
                        ? `✓ Usar planilha: ${choice.fields.length} campo(s) selecionado(s). Escolha pronta para salvar.`
                        : keeping
                          ? "✓ Manter dados atuais. Esta linha não será alterada ao salvar."
                          : "Escolha pendente: compare as diferenças e selecione uma opção."}
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Campo conflitante</th>
                          <th>Atual</th>
                          <th>Planilha</th>
                          <th>Usar planilha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.differences.map((key) => (
                          <tr
                            key={key}
                            className={
                              applying && choice.fields.includes(key)
                                ? "field-selected"
                                : ""
                            }
                          >
                            <td>{A.fieldLabels[key]}</td>
                            <td>{display(key, row.current?.[key] ?? "")}</td>
                            <td>{display(key, row.incoming[key])}</td>
                            <td>
                              <input
                                aria-label={`Importar ${key} da linha ${row.line}`}
                                type="checkbox"
                                disabled={busy}
                                checked={
                                  !!applying && choice.fields.includes(key)
                                }
                                onChange={(e) => {
                                  const current = applying ? choice.fields : [];
                                  const fields = e.target.checked
                                    ? [...current, key]
                                    : current.filter((field) => field !== key);
                                  choose(
                                    row.line,
                                    fields.length ? "APPLY" : "SKIP",
                                    fields,
                                  );
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}
              <div className="panel import-save">
                <p>
                  {resolved === batch.rows.length
                    ? "Todas as escolhas estão definidas. Salve para concluir a revisão."
                    : "Defina uma escolha para cada conflito para habilitar o salvamento."}
                </p>
                <button
                  disabled={busy || resolved !== batch.rows.length}
                  onClick={() =>
                    void run(async () => {
                      const result = await A.request<{ imported: number }>(
                        `imports/${batch.id}/apply`,
                        token,
                        {
                          decisions: batch.rows.map((row) => ({
                            line: row.line,
                            ...decisions[row.line],
                          })),
                        },
                      );
                      setBatch({ ...batch, rows: [] });
                      setDecisions({});
                    }, "Revisão concluída. As escolhas foram salvas; os novos registros já estavam importados.")
                  }
                >
                  Salvar escolhas ({resolved}/{batch.rows.length})
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
