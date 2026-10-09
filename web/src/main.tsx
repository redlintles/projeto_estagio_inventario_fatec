import React from "react";
import { createRoot } from "react-dom/client";
import * as A from "./api";
import { usePatrimonio } from "./app-state";
import { sections, Section } from "./navigation";
import "./style.css";
import { Dashboard } from "./features/Dashboard";
import { Assets } from "./features/Assets";
import { AssetDetail } from "./features/AssetDetail";
import { Imports } from "./features/Imports";
import { Inventories } from "./features/Inventories";
import { Divergences } from "./features/Divergences";
import { Locations } from "./features/Locations";
import { Units } from "./features/Units";
import { Users } from "./features/Users";
import { Settings } from "./features/Settings";
import { Reports } from "./features/Reports";
import { Audit } from "./features/Audit";
import { Help } from "./features/Help";
function App() {
  const state = usePatrimonio();
  const {
    token,
    setToken,
    user,
    setUser,
    section,
    setSection,
    error,
    setError,
    notice,
    setNotice,
    busy,
    setBusy,
    revision,
    setRevision,
    assets,
    setAssets,
    locations,
    setLocations,
    units,
    setUnits,
    detail,
    setDetail,
    dashboard,
    setDashboard,
    inventories,
    setInventories,
    inventory,
    setInventory,
    divergences,
    setDivergences,
    users,
    setUsers,
    settings,
    setSettings,
    audit,
    setAudit,
    batch,
    setBatch,
    decisions,
    setDecisions,
    filter,
    setFilter,
    admin,
    operator,
    run,
    refreshDetail,
    form,
    choose,
  } = state;
  if (!token || !user)
    return (
      <main className="login">
        <div className="login-brand">
          <span className="brand-icon">P</span>
          <p>FATEC · GESTÃO PATRIMONIAL</p>
          <h1>
            Cada ativo.
            <br />
            Uma história registrada.
          </h1>
          <p>Inventário, movimentação e controle do patrimônio da unidade.</p>
        </div>
        <form
          className="login-card"
          onSubmit={(e) => {
            const b = form(e);
            void run(async () => {
              const result = await A.request<{ token: string; user: A.User }>(
                "auth/login",
                "",
                b,
              );
              sessionStorage.setItem("token", result.token);
              setToken(result.token);
              setUser(result.user);
            }, "");
          }}
        >
          <h2>Acessar o sistema</h2>
          <label>
            E-mail
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>Entrar</button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {token && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                sessionStorage.removeItem("token");
                setToken("");
              }}
            >
              Voltar ao login
            </button>
          )}
        </form>
      </main>
    );
  return (
    <div className="layout">
      <aside>
        <div className="brand">
          <span className="brand-icon">P</span>
          <div>
            Patrimônio<small>FATEC · UNIDADE DE ENSINO</small>
          </div>
        </div>
        <nav>
          {(Object.keys(sections) as Section[])
            .filter(
              (s) =>
                admin || !["imports", "users", "settings", "audit"].includes(s),
            )
            .map((s) => (
              <button
                key={s}
                aria-current={section === s ? "page" : undefined}
                className={section === s ? "selected" : ""}
                onClick={() => choose(s)}
              >
                {sections[s]}
              </button>
            ))}
        </nav>
        <div className="account">
          <strong>{user.name}</strong>
          <small>{user.role}</small>
          <button
            onClick={() => {
              sessionStorage.removeItem("token");
              setToken("");
              setUser(null);
            }}
          >
            Sair
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">GESTÃO PATRIMONIAL</p>
            <h1>{sections[section]}</h1>
          </div>
          <span className="unit-label">Unidade de ensino</span>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        <Dashboard state={state} />
        <Assets state={state} />
        <AssetDetail state={state} />
        <Imports state={state} />
        <Inventories state={state} />
        <Divergences state={state} />
        <Locations state={state} />
        <Units state={state} />
        <Users state={state} />
        <Settings state={state} />
        <Reports state={state} />
        <Audit state={state} />
        <Help state={state} />
        <footer>
          Gestão patrimonial · Histórico preservado · Uso interno da unidade
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
