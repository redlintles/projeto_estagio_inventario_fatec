import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Settings({ state }: { state: AppState }) {
  const [disableWarning, setDisableWarning] = React.useState(false);
  const warningDialog = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    if (disableWarning) warningDialog.current?.showModal();
    else warningDialog.current?.close();
  }, [disableWarning]);
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
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                const value =
                  new FormData(e.currentTarget).get("exclusive") === "true"
                    ? "true"
                    : "false";
                if (value === "false") {
                  setDisableWarning(true);
                  return;
                }
                void run(() =>
                  A.request("settings", token, {
                    name: "INVENTARIO_EXCLUSIVO_LOCAL",
                    value,
                  }),
                );
              }}
            >
              <h2>Inventário exclusivo por localização</h2>
              <p>
                Ativado por padrão. Impede abrir outro inventário enquanto a
                sala possui uma sessão em andamento. A sala é liberada após
                sincronizar a conclusão ou o cancelamento.
              </p>
              <label>
                Bloqueio de inventários simultâneos
                <select
                  key={
                    settings.find(
                      (s) => s.name === "INVENTARIO_EXCLUSIVO_LOCAL",
                    )?.value ?? "true"
                  }
                  name="exclusive"
                  defaultValue={
                    settings.find(
                      (s) => s.name === "INVENTARIO_EXCLUSIVO_LOCAL",
                    )?.value ?? "true"
                  }
                  disabled={state.user?.role !== "ADMIN"}
                >
                  <option value="true">
                    Ativado — uma sessão por localização
                  </option>
                  <option value="false">
                    Desativado — permitir sessões simultâneas
                  </option>
                </select>
              </label>
              <button disabled={busy || state.user?.role !== "ADMIN"}>
                Salvar bloqueio
              </button>
              {settings.find((s) => s.name === "INVENTARIO_EXCLUSIVO_LOCAL")
                ?.value === "false" && (
                <p role="alert">
                  Atenção: o bloqueio está desativado. Coletas simultâneas podem
                  duplicar trabalho e gerar conflitos de versão e resultados
                  incompatíveis.
                </p>
              )}
            </form>
            <dialog
              ref={warningDialog}
              className="batch-confirmation"
              aria-labelledby="exclusive-warning"
              onCancel={(e) => {
                e.preventDefault();
                if (!busy) setDisableWarning(false);
              }}
            >
              <section className="batch-confirmation-content">
                <h2 id="exclusive-warning">
                  Desativar proteção contra concorrência?
                </h2>
                <p>
                  Mais de uma pessoa poderá inventariar a mesma sala ao mesmo
                  tempo. Isso pode causar trabalho duplicado, conflitos de
                  versão e resultados incompatíveis. Cada responsável deve
                  sincronizar e revisar suas pendências; a administração assume
                  a coordenação dessas sessões.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await A.request("settings", token, {
                        name: "INVENTARIO_EXCLUSIVO_LOCAL",
                        value: "false",
                      });
                      setDisableWarning(false);
                    })
                  }
                >
                  Confirmar desativação
                </button>
                <button
                  className="secondary"
                  onClick={() => setDisableWarning(false)}
                >
                  Manter proteção
                </button>
              </section>
            </dialog>
            {settings
              .filter((s) => s.name !== "INVENTARIO_EXCLUSIVO_LOCAL")
              .map((s) => (
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
