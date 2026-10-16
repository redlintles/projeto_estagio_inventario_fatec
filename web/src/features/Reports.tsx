import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
const names: Record<string, string> = {
  byLocation: "Todos os ativos",
  available: "Disponibilizados",
  transferred: "Transferidos",
  writtenOff: "Baixados",
  inventories: "Conferências de inventário",
  divergences: "Divergências",
  movements: "Histórico de movimentações",
};
const empty = {
  patrimony: "",
  description: "",
  group: "",
  status: "",
  unitId: "",
  locationId: "",
  dateFrom: "",
  dateTo: "",
};
type Preview = {
  title: string;
  columns: string[];
  rows: string[][];
  count: number;
  filters: Record<string, string>;
};
export function Reports({ state }: { state: AppState }) {
  const { token, section, units, locations, busy, run } = state;
  const [kind, setKind] = React.useState("byLocation"),
    [format, setFormat] = React.useState("xlsx"),
    [filters, setFilters] = React.useState(empty),
    [preview, setPreview] = React.useState<Preview | null>(null);
  const fixed: Record<string, string> = {
    available: "D",
    transferred: "T",
    writtenOff: "X",
  };
  function update(key: keyof typeof empty, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPreview(null);
  }
  const query = new URLSearchParams({
    ...filters,
    status: fixed[kind] ?? filters.status,
    format,
  }).toString();
  if (section !== "reports") return null;
  return (
    <>
      <section className="panel" aria-label="Configurar relatório">
        <h2>Preparar relatório</h2>
        <p>
          Escolha o conteúdo, refine os critérios e confira a prévia antes de
          exportar. Os filtros abrangem todos os resultados, em todas as
          páginas. Cada solicitação aceita até 20.000 bens candidatos ou
          registros; acima disso, refine os filtros e exporte em partes.
        </p>
        <div className="asset-filter-grid">
          <label>
            Conteúdo do relatório
            <select
              aria-label="Conteúdo do relatório"
              value={kind}
              disabled={busy}
              onChange={(e) => {
                setKind(e.target.value);
                setPreview(null);
              }}
            >
              {Object.entries(names).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Formato do arquivo
            <select
              aria-label="Formato do arquivo"
              value={format}
              disabled={busy}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="ods">LibreOffice / OpenDocument (.ods)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </label>
        </div>
      </section>
      <section className="panel" aria-label="Filtros do relatório">
        <h2>Filtrar registros</h2>
        <p>
          {["inventories", "divergences", "movements"].includes(kind)
            ? "Unidade, localização e demais critérios do bem consideram o cadastro atual. O período corresponde à data da conferência, do registro da divergência ou da movimentação, no fuso de São Paulo."
            : "O período corresponde à data de incorporação do bem."}
        </p>
        <div className="asset-filter-grid">
          <label>
            Patrimônio contém
            <input
              aria-label="Patrimônio contém"
              value={filters.patrimony}
              maxLength={100}
              disabled={busy}
              onChange={(e) => update("patrimony", e.target.value)}
            />
          </label>
          <label>
            Descrição contém
            <input
              aria-label="Descrição contém"
              value={filters.description}
              maxLength={255}
              disabled={busy}
              onChange={(e) => update("description", e.target.value)}
            />
          </label>
          <label>
            Grupo patrimonial contém
            <input
              aria-label="Grupo patrimonial contém"
              value={filters.group}
              maxLength={100}
              disabled={busy}
              onChange={(e) => update("group", e.target.value)}
            />
          </label>
          <label>
            Status do ativo
            <select
              aria-label="Status do ativo"
              value={fixed[kind] ?? filters.status}
              disabled={busy || !!fixed[kind]}
              onChange={(e) => update("status", e.target.value)}
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
            Unidade cadastrada
            <select
              aria-label="Unidade cadastrada do relatório"
              value={filters.unitId}
              disabled={busy}
              onChange={(e) => update("unitId", e.target.value)}
            >
              <option value="">Todas as unidades</option>
              <option value="none">Sem unidade vinculada</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} · {u.name}
                  {!u.active ? " (inativa)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Localização atual
            <select
              aria-label="Localização do relatório"
              value={filters.locationId}
              disabled={busy}
              onChange={(e) => update("locationId", e.target.value)}
            >
              <option value="">Todas as localizações</option>
              <option value="none">Sem localização</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.description}
                  {!l.active ? " (inativa)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data inicial
            <input
              type="date"
              aria-label="Data inicial"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              disabled={busy}
              onChange={(e) => update("dateFrom", e.target.value)}
            />
          </label>
          <label>
            Data final
            <input
              type="date"
              aria-label="Data final"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              disabled={busy}
              onChange={(e) => update("dateTo", e.target.value)}
            />
          </label>
        </div>
        <div className="actions report-actions">
          <button
            disabled={busy}
            onClick={() =>
              void run(
                async () =>
                  setPreview(
                    await A.request<Preview>(
                      `reports/${kind}/preview?${query}`,
                      token,
                    ),
                  ),
                "",
              )
            }
          >
            Visualizar prévia
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setFilters(empty);
              setPreview(null);
            }}
          >
            Limpar filtros
          </button>
        </div>
      </section>
      <section className="panel" aria-label="Exportar relatório">
        <h2>Conferir e exportar</h2>
        <p>
          Os arquivos usam patrimônio, nomes de responsáveis, unidades e
          localizações, sem colunas de UUID ou objetos técnicos. XLSX e ODS
          incluem dados numéricos, datas, larguras de coluna e uma aba com os
          critérios da exportação. CSV contém uma tabela simples com cabeçalhos
          em português.
        </p>
        {!preview ? (
          <p>
            Use Visualizar prévia para conferir a quantidade e uma amostra dos
            registros.
          </p>
        ) : (
          <>
            <p role="status">
              <strong>{preview.count} registros encontrados.</strong> A amostra
              abaixo mostra até 30; a exportação inclui todos os resultados.
            </p>
            <dl className="report-criteria">
              {Object.entries(preview.filters).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {preview.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <button
          disabled={busy || !preview}
          onClick={() =>
            void run(
              () =>
                A.download(
                  `reports/${kind}?${query}`,
                  token,
                  `relatorio-${kind}.${format}`,
                ),
              "Relatório exportado.",
            )
          }
        >
          Exportar {format.toUpperCase()}
        </button>
        <p>
          A exportação consulta os dados novamente; alterações feitas após a
          prévia serão refletidas no arquivo. Arquivos vazios preservam os
          cabeçalhos.
        </p>
      </section>
    </>
  );
}
