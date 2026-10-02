import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
export function Inventories({ state }: { state: AppState }) {
  const {
    token,
    section,
    busy,
    assets,
    locations,
    inventories,
    inventory,
    setInventory,
    filter,
    operator,
    run,
    form,
  } = state;
  return (
    <>
      {section === "inventories" && (
        <>
          <div className="panel">
            <h2>Conferência por localização</h2>
            <p>
              Prepare os inventários antes de ir a uma sala sem internet. O
              aplicativo mantém as leituras no aparelho até a sincronização.
            </p>
            {operator && (
              <form
                className="inline-form"
                onSubmit={(e) => {
                  const b = form(e);
                  void run(async () =>
                    setInventory(
                      await A.request<A.Inventory>("inventories", token, b),
                    ),
                  );
                }}
              >
                <select name="locationId" required>
                  <option value="">Selecione uma localização</option>
                  {locations
                    .filter((l) => l.active)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.description}
                      </option>
                    ))}
                </select>
                <button disabled={busy}>Iniciar inventário</button>
              </form>
            )}
          </div>
          {inventories.map((i) => (
            <button
              className="inventory-row"
              key={i.id}
              onClick={() =>
                void run(
                  async () =>
                    setInventory(
                      await A.request<A.Inventory>(
                        `inventories/${i.id}`,
                        token,
                      ),
                    ),
                  "",
                )
              }
            >
              <strong>
                {locations.find((l) => l.id === i.locationId)?.description}
              </strong>
              <span>
                {new Date(i.startedAt).toLocaleString("pt-BR")} ·{" "}
                {i.status === "OPEN" ? "Aberto" : "Encerrado"}
              </span>
            </button>
          ))}
          {inventory && (
            <div className="panel">
              <h2>Inventário {inventory.id.slice(0, 8)}</h2>
              <p>
                {inventory.items?.length ?? 0} conferidos ·{" "}
                {inventory.missingIds?.length ?? 0} esperados ainda não
                conferidos
              </p>
              {inventory.status === "OPEN" && operator && (
                <>
                  <form
                    className="grid-form"
                    onSubmit={(e) => {
                      const b = form(e);
                      void run(async () => {
                        const candidates = await A.request<A.Asset[]>(
                          `assets?patrimony=${encodeURIComponent(b.patrimony)}`,
                          token,
                        );
                        const asset = candidates.find(
                          (a) => a.patrimony === b.patrimony,
                        );
                        if (!asset)
                          throw new Error("Patrimônio não encontrado.");
                        await A.request(
                          `inventories/${inventory.id}/scans`,
                          token,
                          {
                            assetId: asset.id,
                            expectedVersion: asset.version,
                            observedAt: new Date().toISOString(),
                            ...(b.type
                              ? {
                                  divergence: {
                                    type: b.type,
                                    foundDescription: b.foundDescription,
                                    notes: b.notes,
                                  },
                                }
                              : {}),
                          },
                        );
                        setInventory(
                          await A.request<A.Inventory>(
                            `inventories/${inventory.id}`,
                            token,
                          ),
                        );
                      });
                    }}
                  >
                    <label>
                      Patrimônio
                      <input name="patrimony" required />
                    </label>
                    <label>
                      Divergência
                      <select name="type">
                        <option value="">Conferência correta</option>
                        <option value="WRONG_LOCATION">
                          Localização incorreta
                        </option>
                        <option value="WRONG_LABEL">Etiqueta incorreta</option>
                        <option value="WRONG_ITEM">Bem diferente</option>
                        <option value="DUPLICATE">Patrimônio duplicado</option>
                        <option value="OTHER">Outra</option>
                      </select>
                    </label>
                    <label>
                      Descrição encontrada
                      <input name="foundDescription" />
                    </label>
                    <label>
                      Observação
                      <input name="notes" />
                    </label>
                    <button disabled={busy}>Registrar conferência</button>
                  </form>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        async () =>
                          setInventory(
                            await A.request<A.Inventory>(
                              `inventories/${inventory.id}/close`,
                              token,
                            ),
                          ),
                        "Inventário encerrado. Leituras pendentes no celular não serão aceitas.",
                      )
                    }
                  >
                    Encerrar inventário
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
