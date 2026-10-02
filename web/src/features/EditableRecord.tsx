import React from "react";
import { AppState } from "../app-state";
import { request } from "../api";
interface EditField {
  name: string;
  label: string;
  value?: string;
  type?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
}
/** Formulário compartilhado para editar cadastros sem duplicar transporte/autenticação. */
export function EditableRecord({
  state,
  path,
  fields,
}: {
  state: AppState;
  path: string;
  fields: EditField[];
}) {
  return (
    <details>
      <summary>Editar cadastro</summary>
      <form
        className="grid-form"
        onSubmit={(event) => {
          const values = state.form(event);
          const body = Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => key !== "password" || value !== "",
            ),
          );
          void state.run(() => request(path, state.token, body, "PATCH"));
        }}
      >
        {fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.options ? (
              <select name={field.name} defaultValue={field.value}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={field.value ?? ""}
                required={!field.optional}
                minLength={field.type === "password" ? 12 : undefined}
                autoComplete={
                  field.type === "password" ? "new-password" : undefined
                }
              />
            )}
          </label>
        ))}
        <button disabled={state.busy}>Salvar alterações</button>
      </form>
    </details>
  );
}
