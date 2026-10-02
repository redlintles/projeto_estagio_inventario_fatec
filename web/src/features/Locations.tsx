import { EditableRecord } from "./EditableRecord";
import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Locations({ state }: { state: AppState }) {
  const { token, section, busy, locations, admin, run, form } = state;
  return (
    <>
      {section === "locations" && (
        <>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Prédio / andar</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td>{l.code}</td>
                    <td>{l.description}</td>
                    <td>
                      {admin && (
                        <EditableRecord
                          state={state}
                          path={`locations/${l.id}`}
                          fields={[
                            {
                              name: "description",
                              label: "Descrição",
                              value: l.description,
                            },
                            {
                              name: "building",
                              label: "Prédio",
                              value: l.building,
                              optional: true,
                            },
                            {
                              name: "floor",
                              label: "Andar",
                              value: l.floor,
                              optional: true,
                            },
                            {
                              name: "notes",
                              label: "Observação",
                              value: l.notes,
                              optional: true,
                            },
                          ]}
                        />
                      )}
                      {l.building} / {l.floor}
                    </td>
                    <td>{l.active ? "Ativa" : "Inativa"}</td>
                    <td>
                      {admin && (
                        <button
                          className="link"
                          onClick={() =>
                            void run(() =>
                              A.request(
                                `locations/${l.id}`,
                                token,
                                { active: !l.active },
                                "PATCH",
                              ),
                            )
                          }
                        >
                          {l.active ? "Inativar" : "Ativar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {admin && (
            <form
              className="panel grid-form"
              onSubmit={(e) => {
                const b = form(e);
                void run(() => A.request("locations", token, b));
              }}
            >
              <h2>Nova localização</h2>
              {[
                ["code", "Código"],
                ["description", "Descrição"],
                ["building", "Prédio"],
                ["floor", "Andar"],
                ["notes", "Observações"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    required={["code", "description"].includes(key)}
                  />
                </label>
              ))}
              <button disabled={busy}>Cadastrar localização</button>
            </form>
          )}
        </>
      )}
    </>
  );
}
