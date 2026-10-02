import { EditableRecord } from "./EditableRecord";
import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Units({ state }: { state: AppState }) {
  const { token, section, busy, units, admin, run, form } = state;
  return (
    <>
      {section === "units" && (
        <>
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td>{u.code}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {admin && (
                        <EditableRecord
                          state={state}
                          path={`units/${u.id}`}
                          fields={[
                            { name: "name", label: "Nome", value: u.name },
                            {
                              name: "email",
                              label: "E-mail",
                              value: u.email,
                              type: "email",
                            },
                          ]}
                        />
                      )}

                      {admin && (
                        <button
                          className="link"
                          onClick={() =>
                            void run(() =>
                              A.request(
                                `units/${u.id}`,
                                token,
                                { active: !u.active },
                                "PATCH",
                              ),
                            )
                          }
                        >
                          {u.active ? "Inativar" : "Ativar"}
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
                void run(() => A.request("units", token, b));
              }}
            >
              <h2>Nova unidade</h2>
              <label>
                Código
                <input name="code" required />
              </label>
              <label>
                Nome
                <input name="name" required />
              </label>
              <label>
                E-mail
                <input name="email" type="email" required />
              </label>
              <button disabled={busy}>Cadastrar unidade</button>
            </form>
          )}
        </>
      )}
    </>
  );
}
