import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Settings({ state }: { state: AppState }) {
  const { token, section, busy, settings, run, form } = state;
  return (
    <>
      {section === "settings" && (
        <>
          <div className="panel">
            <p>
              Prazo em dias corridos. E-mails múltiplos separados por vírgula.
              Reservas ativas suspendem o prazo; o cancelamento reinicia a
              contagem.
            </p>
            {settings.map((s) => (
              <form
                className="inline-form"
                key={s.name}
                onSubmit={(e) => {
                  const b = form(e);
                  void run(() =>
                    A.request("settings", token, {
                      name: s.name,
                      value: b.value,
                    }),
                  );
                }}
              >
                <label>
                  {s.name}
                  <input
                    name="value"
                    defaultValue={s.value}
                    required={s.name === "PRAZO_BAIXA_DIAS"}
                  />
                </label>
                <button disabled={busy}>Salvar</button>
              </form>
            ))}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void run(() => A.request("jobs/run", token, {}))}
            >
              Executar verificação de prazo e notificações
            </button>
          </div>
        </>
      )}
    </>
  );
}
