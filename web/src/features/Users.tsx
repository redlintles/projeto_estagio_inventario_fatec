import { EditableRecord } from "./EditableRecord";
import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Users({ state }: { state: AppState }) {
  const { token, user, section, busy, users, run, form } = state;
  return (
    <>
      {section === "users" && (
        <>
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      {
                        <EditableRecord
                          state={state}
                          path={`users/${u.id}`}
                          fields={[
                            {
                              name: "role",
                              label: "Perfil",
                              value: u.role,
                              options: [
                                { value: "ADMIN", label: "Administrador" },
                                {
                                  value: "PATRIMONIAL",
                                  label: "Responsável patrimonial",
                                },
                                { value: "CONSULTA", label: "Consulta" },
                              ],
                            },
                            {
                              name: "password",
                              label: "Nova senha (opcional)",
                              type: "password",
                              optional: true,
                            },
                          ]}
                        />
                      }

                      <button
                        className="link"
                        disabled={busy || u.id === user?.id}
                        onClick={() =>
                          void run(() =>
                            A.request(
                              `users/${u.id}`,
                              token,
                              { active: !u.active },
                              "PATCH",
                            ),
                          )
                        }
                      >
                        {u.active ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="panel grid-form"
            onSubmit={(e) => {
              const b = form(e);
              void run(() => A.request("users", token, b));
            }}
          >
            <h2>Novo usuário</h2>
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              E-mail
              <input type="email" name="email" required />
            </label>
            <label>
              Senha inicial
              <input
                type="password"
                name="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Perfil
              <select name="role">
                <option value="CONSULTA">Consulta</option>
                <option value="PATRIMONIAL">Responsável patrimonial</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <button disabled={busy}>Cadastrar usuário</button>
          </form>
        </>
      )}
    </>
  );
}
