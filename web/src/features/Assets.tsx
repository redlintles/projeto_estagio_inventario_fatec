import React from "react";
import { BatchHistoryVersions } from "./BatchHistoryVersions";
import { BatchConfirmation } from "./BatchConfirmation";
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
    can,
    units,
    setError,
    run,
    refreshDetail,
    form,
  } = state;
  const operator = can("batches.unit") || can("batches.location");
  const batchAccess = operator || can("batches.undo") || can("batches.redo");
  const [previousId, setPreviousId] = React.useState("");
  const [selected, setSelected] = React.useState<Record<string, number>>({});
  const [batchResult, setBatchResult] = React.useState("");
  const [batchLocation, setBatchLocation] = React.useState("");
  const [batchUnit, setBatchUnit] = React.useState("");
  const eligible = assets.filter((a) => ["I", "A"].includes(a.status));
  const [allSelection, setAllSelection] = React.useState<{
    matched: number;
    selected: number;
  } | null>(null);
  const [history, setHistory] = React.useState<
    {
      id: string;
      field: string;
      targetLabel: string;
      status: string;
      updated: number;
      unchanged: number;
      userName: string;
      appliedAt: string;
      undoneAt: string | null;
      undoneByName: string | null;
      revision: number;
      redoneAt: string | null;
      redoneByName: string | null;
    }[]
  >([]);
  const [historyOffset, setHistoryOffset] = React.useState(0);
  const [confirmation, setConfirmation] = React.useState<{
    action: "apply" | "undo" | "redo";
    id: string;
    field: string;
    targetLabel: string;
    changed: number;
    selected?: number;
    unchanged?: number;
    skipped?: number;
  } | null>(null);
  const [confirmationError, setConfirmationError] = React.useState("");
  React.useEffect(() => {
    setConfirmation(null);
    setConfirmationError("");
  }, [section]);
  function confirmBatch() {
    if (!confirmation || busy) return;
    const current = confirmation;
    setConfirmationError("");
    void run(
      async () => {
        try {
          if (current.action === "apply") {
            const result = await A.request<{
              updated: number;
              unchanged: number;
            }>(`asset-batches/${current.id}/apply`, token, {});
            setBatchResult(
              `${result.updated} ativos alterados; ${result.unchanged} já possuíam este valor. Consulte o histórico para desfazer.`,
            );
          } else {
            await A.request(
              `asset-batches/${current.id}/${current.action}`,
              token,
              {},
            );
            setBatchResult(
              `${current.action === "redo" ? "Lote refeito" : "Lote desfeito"}: ${current.changed} ativos restaurados.`,
            );
          }
          setSelected({});
          setAllSelection(null);
          setHistoryOffset(0);
          setConfirmation(null);
        } catch (e) {
          setConfirmationError((e as Error).message);
          throw e;
        }
      },
      current.action === "undo"
        ? "Alteração em lote desfeita."
        : current.action === "redo"
          ? "Alteração em lote refeita."
          : "",
    );
  }
  const count = allSelection?.selected ?? Object.keys(selected).length;
  React.useEffect(() => {
    if (section !== "assets" || !batchAccess || busy) return;
    let active = true;
    A.request<typeof history>(`asset-batches?offset=${historyOffset}`, token)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [section, batchAccess, busy, token, historyOffset]);
  async function applySelected(
    field: "unitId" | "locationId",
    targetId: string,
  ) {
    await run(async () => {
      const preview = await A.request<{
        id: string;
        changed: number;
        selected: number;
        skipped: number;
        unchanged: number;
        targetLabel: string;
      }>("asset-batches/preview", token, {
        field,
        targetId,
        ...(allSelection
          ? { filters: filter }
          : {
              assets: Object.entries(selected).map(([id, expectedVersion]) => ({
                id,
                expectedVersion,
              })),
            }),
      });
      setConfirmationError("");
      setConfirmation({ ...preview, action: "apply", field });
    }, "");
  }
  React.useEffect(() => {
    setSelected({});
    setAllSelection(null);
  }, [
    filter.patrimony,
    filter.description,
    filter.group,
    filter.status,
    filter.locationId,
    filter.unitId,
    section,
  ]);
  function selectAsset(asset: A.Asset, checked: boolean) {
    if (checked && !selected[asset.id] && count >= 500) {
      setError("Selecione no máximo 500 ativos por lote.");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[asset.id] = asset.version;
      else delete next[asset.id];
      return next;
    });
  }
  return (
    <>
      {section === "assets" && confirmation && (
        <BatchConfirmation
          title={
            confirmation.action === "undo"
              ? "Desfazer alteração em lote?"
              : confirmation.action === "redo"
                ? "Refazer alteração em lote?"
                : "Confirmar alteração em lote?"
          }
          confirmLabel={
            confirmation.action === "undo"
              ? "Sim, desfazer lote"
              : confirmation.action === "redo"
                ? "Sim, refazer lote"
                : "Confirmar alteração"
          }
          busy={busy}
          error={confirmationError}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmBatch}
        >
          <p className="batch-confirmation-count">
            <strong>{confirmation.changed}</strong> ativos{" "}
            {confirmation.action === "undo"
              ? "serão restaurados"
              : "serão alterados"}
            .
          </p>
          <dl className="batch-confirmation-summary">
            <dt>Campo</dt>
            <dd>
              {confirmation.field === "unitId"
                ? "Unidade cadastrada"
                : "Localização"}
            </dd>
            <dt>
              {confirmation.action === "undo"
                ? "Destino do lote original"
                : "Novo valor"}
            </dt>
            <dd>{confirmation.targetLabel}</dd>
            {confirmation.action === "apply" && (
              <>
                <dt>Selecionados</dt>
                <dd>{confirmation.selected}</dd>
                <dt>Já possuem este valor</dt>
                <dd>{confirmation.unchanged}</dd>
                <dt>Ignorados por status</dt>
                <dd>{confirmation.skipped}</dd>
              </>
            )}
          </dl>
          <p>
            {confirmation.action === "undo"
              ? "Os valores anteriores de cada ativo serão restaurados. Se algum ativo tiver mudado após o lote, nada será desfeito."
              : confirmation.action === "redo"
                ? "Os mesmos ativos receberão novamente o valor original do lote. Se algum ativo tiver mudado após a reversão ou se o destino estiver inativo, nada será alterado."
                : "A operação será registrada no histórico e poderá ser desfeita se os ativos não sofrerem alterações posteriores."}
          </p>
        </BatchConfirmation>
      )}
      {section === "assets" && !detail && (
        <>
          <section
            className="panel asset-filters"
            aria-label="Filtros de ativos"
          >
            <h2>Filtrar ativos</h2>
            <div className="asset-filter-grid">
              <label>
                Patrimônio
                <input
                  aria-label="Patrimônio"
                  placeholder="Patrimônio…"
                  value={filter.patrimony}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      patrimony: e.target.value,
                      offset: "0",
                    })
                  }
                />
              </label>
              <label>
                Grupo
                <input
                  aria-label="Grupo"
                  placeholder="Grupo patrimonial…"
                  value={filter.group}
                  onChange={(e) =>
                    setFilter({ ...filter, group: e.target.value, offset: "0" })
                  }
                />
              </label>

              <label>
                Buscar descrição
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
              </label>
              <label>
                Status
                <select
                  aria-label="Status"
                  value={filter.status}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      status: e.target.value,
                      offset: "0",
                    })
                  }
                >
                  <option value="">Todos os status</option>
                  {Object.entries(A.statusLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Localização
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
                  <option value="none">Sem localização</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.description}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unidade cadastrada
                <select
                  aria-label="Unidade cadastrada"
                  value={filter.unitId}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      unitId: e.target.value,
                      offset: "0",
                    })
                  }
                >
                  <option value="">Todas as unidades</option>
                  <option value="none">Sem unidade vinculada</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          {operator && (
            <section
              className="panel asset-batch"
              aria-label="Alterações em lote"
            >
              <div className="asset-selection">
                <div>
                  <h2>Alterações em lote</h2>
                  <p>
                    <strong>{count} ativos selecionados</strong> ·{" "}
                    {allSelection
                      ? "todos os resultados dos filtros"
                      : "seleção manual"}
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={busy || !count}
                  onClick={() => {
                    setSelected({});
                    setAllSelection(null);
                    setBatchResult("");
                  }}
                >
                  Limpar seleção
                </button>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await A.request<{
                      matched: number;
                      selected: number;
                    }>("asset-batches/selection", token, { filters: filter });
                    setSelected({});
                    setAllSelection(result);
                    setBatchResult("");
                  }, "")
                }
              >
                Selecionar tudo com os filtros atuais
              </button>
              {allSelection && (
                <p role="status">
                  {allSelection.selected} ativos elegíveis selecionados em todas
                  as páginas; {allSelection.matched - allSelection.selected}{" "}
                  ignorados por status.
                </p>
              )}
              <p>
                Marque os bens Incorporados ou Ativos na tabela. A seleção é
                mantida ao paginar e limpa ao mudar os filtros. Cada ação abaixo
                aplica apenas o campo indicado.
              </p>
              <div className="asset-batch-grid">
                {can("batches.unit") && (
                  <section
                    className="asset-batch-card"
                    aria-label="Unidade em lote"
                  >
                    <h3>Vincular unidade</h3>
                    <p>
                      Defina a unidade cadastrada dos bens selecionados. O campo
                      Unidade original da planilha é preservado.
                    </p>
                    <label>
                      Unidade para o lote
                      <select
                        aria-label="Unidade para o lote"
                        value={batchUnit}
                        disabled={busy}
                        onChange={(e) => setBatchUnit(e.target.value)}
                      >
                        <option value="">Selecione uma unidade ativa</option>
                        {units
                          .filter((u) => u.active)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.code} · {u.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      disabled={
                        busy ||
                        !count ||
                        !can("batches.unit") ||
                        !units.some((u) => u.id === batchUnit && u.active)
                      }
                      onClick={() => void applySelected("unitId", batchUnit)}
                    >
                      Aplicar unidade a {count} ativos
                    </button>
                  </section>
                )}
                {can("batches.location") && (
                  <section
                    className="asset-batch-card"
                    aria-label="Localização em lote"
                  >
                    <h3>Definir localização</h3>
                    <p>
                      Informe a sala ou espaço onde os bens selecionados se
                      encontram.
                    </p>
                    <label>
                      Localização para o lote
                      <select
                        aria-label="Localização para o lote"
                        value={batchLocation}
                        disabled={busy}
                        onChange={(e) => setBatchLocation(e.target.value)}
                      >
                        <option value="">
                          Selecione uma localização ativa
                        </option>
                        {locations
                          .filter((l) => l.active)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code} · {l.description}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      disabled={
                        busy ||
                        !count ||
                        !can("batches.location") ||
                        !locations.some(
                          (l) => l.id === batchLocation && l.active,
                        )
                      }
                      onClick={() =>
                        void applySelected("locationId", batchLocation)
                      }
                    >
                      Aplicar localização a {count} ativos
                    </button>
                  </section>
                )}
              </div>
              {batchResult && (
                <p role="status" className="notice">
                  {batchResult}
                </p>
              )}
              {can("locations.manage") && (
                <details className="asset-location-create">
                  <summary>Cadastrar uma localização agora</summary>
                  <form
                    className="asset-location-form"
                    onSubmit={(e) => {
                      const values = form(e);
                      void run(async () => {
                        const location = await A.request<A.Location>(
                          "locations",
                          token,
                          values,
                        );
                        setBatchLocation(location.id);
                      }, "Localização cadastrada. Aplique-a ao lote selecionado.");
                    }}
                  >
                    <label>
                      Código da nova localização
                      <input name="code" maxLength={50} required />
                    </label>
                    <label>
                      Descrição da nova localização
                      <input name="description" maxLength={255} required />
                    </label>
                    <button disabled={busy}>Cadastrar localização</button>
                  </form>
                </details>
              )}
            </section>
          )}
          {batchAccess && (
            <details className="panel asset-batch-history">
              <summary>Histórico de alterações em lote</summary>
              <p>
                Cada operação guarda os valores anteriores e as versões dos
                ativos. Desfazer restaura todo o lote; alterações posteriores em
                qualquer ativo impedem a reversão. Lotes anteriores à
                implantação deste histórico continuam na auditoria individual.
              </p>
              {!history.length && <p>Nenhuma operação nesta página.</p>}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data / responsável</th>
                      <th>Alteração</th>
                      <th>Resultado</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          {new Date(h.appliedAt).toLocaleString("pt-BR")}
                          <small>{h.userName}</small>
                          <small className="mono">{h.id}</small>
                        </td>
                        <td>
                          {h.field === "unitId" ? "Unidade" : "Localização"}:{" "}
                          {h.targetLabel}
                        </td>
                        <td>
                          {h.updated} alterados · {h.unchanged} mantidos
                          <small>Versão do lote: {h.revision}</small>
                          {h.status === "APPLIED" && h.redoneAt && (
                            <small>
                              Refeito em{" "}
                              {new Date(h.redoneAt).toLocaleString("pt-BR")} por{" "}
                              {h.redoneByName}
                            </small>
                          )}
                          <BatchHistoryVersions
                            id={h.id}
                            revision={h.revision}
                            token={token}
                          />
                          {h.status === "UNDONE" && (
                            <small>
                              Desfeito em{" "}
                              {new Date(h.undoneAt!).toLocaleString("pt-BR")}{" "}
                              por {h.undoneByName}
                            </small>
                          )}
                        </td>
                        <td>
                          <button
                            className="secondary"
                            disabled={
                              busy ||
                              !h.updated ||
                              (h.status === "UNDONE"
                                ? !can("batches.redo")
                                : !can("batches.undo"))
                            }
                            onClick={() => {
                              setConfirmationError("");
                              setConfirmation({
                                action: h.status === "UNDONE" ? "redo" : "undo",
                                id: h.id,
                                field: h.field,
                                targetLabel: h.targetLabel,
                                changed: h.updated,
                              });
                            }}
                          >
                            {h.status === "UNDONE"
                              ? "Refazer lote"
                              : "Desfazer lote"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy || !historyOffset}
                  onClick={() =>
                    setHistoryOffset(Math.max(0, historyOffset - 25))
                  }
                >
                  Lotes mais recentes
                </button>
                <button
                  className="secondary"
                  disabled={busy || history.length < 25}
                  onClick={() => setHistoryOffset(historyOffset + 25)}
                >
                  Lotes mais antigos
                </button>
              </div>
            </details>
          )}
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  {operator && (
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Selecionar ativos elegíveis desta página"
                        disabled={busy || !!allSelection || !eligible.length}
                        checked={
                          eligible.length > 0 &&
                          (!!allSelection ||
                            eligible.every((a) => selected[a.id] !== undefined))
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelected((current) => {
                            const next = { ...current };
                            for (const asset of eligible) {
                              if (checked && Object.keys(next).length < 500)
                                next[asset.id] = asset.version;
                              else if (!checked) delete next[asset.id];
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                  )}
                  <th>Patrimônio</th>
                  <th>Descrição</th>
                  <th>Unidade</th>
                  <th>Localização</th>
                  <th>Condição</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    {operator && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar patrimônio ${a.patrimony}`}
                          disabled={
                            busy ||
                            !!allSelection ||
                            !["I", "A"].includes(a.status)
                          }
                          checked={
                            (!!allSelection && ["I", "A"].includes(a.status)) ||
                            selected[a.id] !== undefined
                          }
                          onChange={(e) => selectAsset(a, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="mono">{a.patrimony}</td>
                    <td>
                      <strong>{a.description}</strong>
                      <small>{a.group}</small>
                    </td>
                    <td>
                      {units.find((u) => u.id === a.unitId)?.name ??
                        "Não vinculada"}
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
          {can("assets.create") && (
            <details className="panel">
              <summary>Cadastrar ativo manualmente</summary>
              <form
                className="grid-form"
                onSubmit={(e) => {
                  const b = form(e);
                  void run(() =>
                    A.request("assets", token, {
                      ...b,
                      ...(previousId ? { previousAssetId: previousId } : {}),
                    }),
                  );
                }}
              >
                {Object.entries(A.fieldLabels)
                  .filter(([key]) => !["status", "unitId"].includes(key))
                  .map(([key, label]) => (
                    <label key={key}>
                      {label}
                      {key === "value" && previousId ? (
                        <span>
                          Calculado no servidor: valor do ativo de referência +
                          R$ 1,00.
                        </span>
                      ) : (
                        <input
                          name={key}
                          type={key === "incorporationDate" ? "date" : "text"}
                          required
                        />
                      )}
                    </label>
                  ))}
                <label>
                  Unidade cadastrada
                  <select name="unitId" required>
                    <option value="">Selecione uma unidade</option>
                    {units
                      .filter((u) => u.active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Status inicial
                  <select name="status">
                    <option value="I">Incorporado</option>
                    <option value="A">Ativo</option>
                    <option value="X">Baixado</option>
                  </select>
                </label>
                <label>
                  Cálculo do valor
                  <select
                    value={previousId}
                    onChange={(e) => setPreviousId(e.target.value)}
                  >
                    <option value="">Informar valor manualmente</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        Valor de {a.patrimony} + R$ 1,00
                      </option>
                    ))}
                  </select>
                  <small>
                    Escolha um ativo da página atual como referência para o
                    cálculo da planilha. O total da base é atualizado
                    automaticamente.
                  </small>
                </label>
                <button disabled={busy}>Cadastrar</button>
              </form>
            </details>
          )}
        </>
      )}
    </>
  );
}
