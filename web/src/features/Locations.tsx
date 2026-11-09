import React, { useState } from "react";
import * as A from "../api";
import { AppState } from "../app-state";

/** Campos editáveis de uma localização (sala) vinculada a uma unidade cadastrada. */
function LocationFields({
  location,
  units,
}: {
  location?: A.Location;
  units: A.Unit[];
}) {
  // Uma sala já vinculada a uma unidade inativa continua mostrando o vínculo atual.
  const choices = units.filter((u) => u.active || u.id === location?.unitId);
  return (
    <>
      <label>
        Unidade
        <select name="unitId" required defaultValue={location?.unitId ?? ""}>
          <option value="">Selecione a unidade</option>
          {choices.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} · {u.name}
              {!u.active ? " (inativa)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Código
        <input
          name="code"
          maxLength={50}
          required
          defaultValue={location?.code ?? ""}
          placeholder="Ex.: SALA-101"
        />
      </label>
      <label>
        Descrição
        <input
          name="description"
          maxLength={255}
          required
          defaultValue={location?.description ?? ""}
          placeholder="Ex.: Laboratório de Informática 1"
        />
      </label>
      <label>
        Prédio
        <input
          name="building"
          maxLength={100}
          defaultValue={location?.building ?? ""}
        />
      </label>
      <label>
        Andar
        <input
          name="floor"
          maxLength={50}
          defaultValue={location?.floor ?? ""}
        />
      </label>
      <label>
        Observações
        <input
          name="notes"
          maxLength={2000}
          defaultValue={location?.notes ?? ""}
        />
      </label>
    </>
  );
}

export function Locations({ state }: { state: AppState }) {
  const { token, section, busy, locations, units, can, run, form } = state;
  const admin = can("locations.manage");
  const [editing, setEditing] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState("");
  if (section !== "locations") return null;
  const unitName = (id: string | null) =>
    units.find((u) => u.id === id)?.name ?? "Sem unidade";
  const visible = locations.filter(
    (l) =>
      !unitFilter ||
      (unitFilter === "none" ? !l.unitId : l.unitId === unitFilter),
  );
  const withoutUnit = locations.filter((l) => !l.unitId).length;
  const remove = (l: A.Location) => {
    if (
      !window.confirm(
        `Excluir definitivamente a localização ${l.code} · ${l.description}? Localizações com histórico não podem ser excluídas; nesse caso, inative-a.`,
      )
    )
      return;
    void run(
      () => A.request(`locations/${l.id}`, token, undefined, "DELETE"),
      "Localização excluída.",
    );
  };
  return (
    <>
      {admin && withoutUnit > 0 && (
        <p className="notice">
          {withoutUnit} localização(ões) ainda sem unidade. Use "Editar" para
          vinculá-las a uma unidade cadastrada.
        </p>
      )}
      <div className="toolbar">
        <label>
          Unidade
          <select
            aria-label="Filtrar por unidade"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
          >
            <option value="">Todas as unidades</option>
            <option value="none">Sem unidade</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} · {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Prédio / andar</th>
              <th>Situação</th>
              {admin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {!visible.length && (
              <tr>
                <td colSpan={admin ? 6 : 5} className="empty">
                  Nenhuma localização cadastrada para este filtro.
                </td>
              </tr>
            )}
            {visible.map((l) =>
              editing === l.id ? (
                <tr key={l.id}>
                  <td colSpan={admin ? 6 : 5}>
                    <form
                      className="grid-form"
                      onSubmit={(e) => {
                        const values = form(e);
                        void run(async () => {
                          await A.request(
                            `locations/${l.id}`,
                            token,
                            values,
                            "PATCH",
                          );
                          setEditing(null);
                        }, "Localização atualizada.");
                      }}
                    >
                      <h3 style={{ gridColumn: "1 / -1" }}>Editar {l.code}</h3>
                      <LocationFields location={l} units={units} />
                      <div className="actions">
                        <button disabled={busy}>Salvar alterações</button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setEditing(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={l.id}>
                  <td>{unitName(l.unitId)}</td>
                  <td>{l.code}</td>
                  <td>{l.description}</td>
                  <td>
                    {[l.building, l.floor].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td>{l.active ? "Ativa" : "Inativa"}</td>
                  {admin && (
                    <td>
                      <div className="actions">
                        <button
                          className="link"
                          disabled={busy}
                          onClick={() => setEditing(l.id)}
                        >
                          Editar
                        </button>
                        <button
                          className="link"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                A.request(
                                  `locations/${l.id}`,
                                  token,
                                  { active: !l.active },
                                  "PATCH",
                                ),
                              l.active
                                ? "Localização inativada."
                                : "Localização reativada.",
                            )
                          }
                        >
                          {l.active ? "Inativar" : "Ativar"}
                        </button>
                        <button
                          className="link"
                          style={{ color: "#b54545" }}
                          disabled={busy}
                          onClick={() => remove(l)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {admin && (
        <form
          className="panel grid-form"
          onSubmit={(e) => {
            const values = form(e);
            const target = e.currentTarget;
            void run(async () => {
              await A.request("locations", token, values);
              target.reset();
            }, "Localização cadastrada.");
          }}
        >
          <h2>Nova localização</h2>
          {!units.some((u) => u.active) && (
            <p>Cadastre uma unidade antes de registrar as salas.</p>
          )}
          <LocationFields units={units} />
          <button disabled={busy || !units.some((u) => u.active)}>
            Cadastrar localização
          </button>
        </form>
      )}
    </>
  );
}
