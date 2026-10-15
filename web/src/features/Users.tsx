import React from "react";
import * as A from "../api";
import { AppState } from "../app-state";
import {
  permissionCatalog,
  normalizePermissions,
  roleDefaults,
  Permission,
} from "../permissions";
type Role = A.User["role"];
const roleNames: Record<Role, string> = {
  ADMIN: "Administrador — acesso global",
  PATRIMONIAL: "Responsável patrimonial",
  CONSULTA: "Consulta",
};
function PermissionPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Permission[];
  onChange: (p: Permission[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="permission-groups">
      {[...new Set(permissionCatalog.map((p) => p.group))].map((group) => (
        <fieldset key={group} disabled={disabled}>
          <legend>{group}</legend>
          {permissionCatalog
            .filter((p) => p.group === group)
            .map((p) => (
              <label className="permission-option" key={p.key}>
                <input
                  type="checkbox"
                  checked={value.includes(p.key)}
                  onChange={(e) =>
                    onChange(
                      normalizePermissions(
                        e.target.checked
                          ? [...value, p.key]
                          : value.filter((k) => k !== p.key),
                      ),
                    )
                  }
                />
                <span>{p.label}</span>
              </label>
            ))}
        </fieldset>
      ))}
    </div>
  );
}
function AccessFields({
  role,
  setRole,
  custom,
  setCustom,
  permissions,
  setPermissions,
  disabled = false,
}: {
  role: Role;
  setRole: (r: Role) => void;
  custom: boolean;
  setCustom: (v: boolean) => void;
  permissions: Permission[];
  setPermissions: (p: Permission[]) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <label>
        Modelo de acesso
        <select
          aria-label="Modelo de acesso"
          value={role}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value as Role;
            setRole(next);
            setPermissions([...roleDefaults[next]]);
            setCustom(false);
          }}
        >
          {Object.entries(roleNames).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {role === "ADMIN" ? (
        <p className="notice">
          Administradores têm acesso global e gerenciam os usuários. Para
          limitar tarefas, escolha Consulta ou Responsável patrimonial e
          personalize as permissões.
        </p>
      ) : (
        <>
          <label className="permission-option">
            <input
              type="checkbox"
              checked={custom}
              disabled={disabled}
              onChange={(e) => setCustom(e.target.checked)}
            />
            <span>Personalizar permissões deste usuário</span>
          </label>
          <p>
            As consultas necessárias são incluídas automaticamente ao conceder
            uma tarefa. Sem personalização, valem as permissões do modelo
            escolhido.
          </p>
          <PermissionPicker
            value={custom ? permissions : roleDefaults[role]}
            onChange={setPermissions}
            disabled={disabled || !custom}
          />
        </>
      )}
    </>
  );
}
function UserEditor({ account, state }: { account: A.User; state: AppState }) {
  const { token, user, busy, run, form } = state;
  const [role, setRole] = React.useState(account.role),
    [custom, setCustom] = React.useState(account.permissions != null),
    [permissions, setPermissions] = React.useState<Permission[]>(
      account.permissions ?? [...roleDefaults[account.role]],
    );
  React.useEffect(() => {
    setRole(account.role);
    setCustom(account.permissions != null);
    setPermissions(account.permissions ?? [...roleDefaults[account.role]]);
  }, [account]);
  const protectedAccount = !!account.primaryAdmin;
  return (
    <article className="panel user-access-card">
      <div className="asset-selection">
        <div>
          <h3>{account.name}</h3>
          <p>{account.email}</p>
        </div>
        <span className="badge">{account.active ? "Ativo" : "Inativo"}</span>
      </div>
      <p>
        <strong>
          {protectedAccount
            ? "Administrador principal"
            : roleNames[account.role]}
        </strong>
        {account.role !== "ADMIN" &&
          ` · ${account.permissions == null ? "Permissões do modelo" : `${account.permissions.length} permissões personalizadas`}`}
      </p>
      {protectedAccount && (
        <p>
          Esta conta mantém acesso global e não pode ser desativada nem ter suas
          permissões reduzidas.
        </p>
      )}
      {(!protectedAccount || account.id === user?.id) && (
        <details>
          <summary>
            Editar acesso{protectedAccount ? " e senha" : " e permissões"}
          </summary>
          <form
            className="user-access-form"
            onSubmit={(e) => {
              const values = form(e);
              void run(
                () =>
                  A.request(
                    `users/${account.id}`,
                    token,
                    {
                      ...(!protectedAccount
                        ? {
                            role,
                            permissions:
                              custom && role !== "ADMIN"
                                ? normalizePermissions(permissions)
                                : null,
                          }
                        : {}),
                      ...(values.password ? { password: values.password } : {}),
                    },
                    "PATCH",
                  ),
                "Acesso atualizado. As sessões anteriores do usuário foram invalidadas.",
              );
            }}
          >
            {!protectedAccount && (
              <AccessFields
                role={role}
                setRole={setRole}
                custom={custom}
                setCustom={setCustom}
                permissions={permissions}
                setPermissions={setPermissions}
                disabled={busy}
              />
            )}
            <label>
              Nova senha (opcional)
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
            </label>
            <div className="actions">
              <button disabled={busy}>Salvar acesso</button>
              {!protectedAccount && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || account.id === user?.id}
                  onClick={() =>
                    void run(
                      () =>
                        A.request(
                          `users/${account.id}`,
                          token,
                          { active: !account.active },
                          "PATCH",
                        ),
                      "Situação do usuário atualizada.",
                    )
                  }
                >
                  {account.active ? "Desativar usuário" : "Ativar usuário"}
                </button>
              )}
            </div>
          </form>
        </details>
      )}
    </article>
  );
}
export function Users({ state }: { state: AppState }) {
  const { token, section, busy, users, run, form } = state;
  const [role, setRole] = React.useState<Role>("CONSULTA"),
    [custom, setCustom] = React.useState(false),
    [permissions, setPermissions] = React.useState<Permission[]>([
      ...roleDefaults.CONSULTA,
    ]);
  if (section !== "users") return null;
  return (
    <>
      <section className="panel">
        <h2>Usuários e permissões</h2>
        <p>
          Defina quais tarefas cada pessoa pode executar. As permissões são
          verificadas pelo servidor em cada requisição. Administradores têm
          acesso global; somente administradores gerenciam contas e permissões.
        </p>
        <p>
          Alterar acesso, senha ou situação invalida as sessões anteriores do
          usuário. O administrador principal permanece protegido.
        </p>
      </section>
      <section className="users-access-list" aria-label="Usuários cadastrados">
        {users.map((u) => (
          <UserEditor key={u.id} account={u} state={state} />
        ))}
      </section>
      <details className="panel">
        <summary>Cadastrar novo usuário</summary>
        <form
          className="user-access-form"
          onSubmit={(e) => {
            const values = form(e);
            void run(
              () =>
                A.request("users", token, {
                  ...values,
                  role,
                  permissions:
                    custom && role !== "ADMIN"
                      ? normalizePermissions(permissions)
                      : null,
                }),
              "Usuário cadastrado com o acesso definido.",
            );
          }}
        >
          <div className="asset-filter-grid">
            <label>
              Nome
              <input name="name" required maxLength={100} disabled={busy} />
            </label>
            <label>
              E-mail
              <input
                type="email"
                name="email"
                required
                maxLength={254}
                disabled={busy}
              />
            </label>
            <label>
              Senha inicial
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
                disabled={busy}
              />
            </label>
          </div>
          <AccessFields
            role={role}
            setRole={setRole}
            custom={custom}
            setCustom={setCustom}
            permissions={permissions}
            setPermissions={setPermissions}
            disabled={busy}
          />
          <button disabled={busy}>Cadastrar usuário</button>
        </form>
      </details>
    </>
  );
}
