import { effectivePermissions, Permission } from "./permissions";
import React, { useState, useEffect } from "react";
import * as A from "./api";
import { Section } from "./navigation";
export function usePatrimonio() {
  const [token, setToken] = useState(sessionStorage.getItem("token") ?? ""),
    [user, setUser] = useState<A.User | null>(null),
    [section, setSection] = useState<Section>("dashboard"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [assets, setAssets] = useState<A.Asset[]>([]),
    [locations, setLocations] = useState<A.Location[]>([]),
    [units, setUnits] = useState<A.Unit[]>([]),
    [detail, setDetail] = useState<A.AssetDetail | null>(null),
    [dashboard, setDashboard] = useState<{
      totalValue: string;
      counts: Record<string, number>;
      pendingDivergences: number;
    }>({ totalValue: "0.00", counts: {}, pendingDivergences: 0 }),
    [inventories, setInventories] = useState<A.Inventory[]>([]),
    [inventory, setInventory] = useState<A.Inventory | null>(null),
    [divergences, setDivergences] = useState<A.Divergence[]>([]),
    [users, setUsers] = useState<A.User[]>([]),
    [settings, setSettings] = useState<{ name: string; value: string }[]>([]),
    [audit, setAudit] = useState<A.Movement[]>([]),
    [batch, setBatch] = useState<A.ImportBatch | null>(null),
    [decisions, setDecisions] = useState<
      Record<number, { action: "SKIP" | "APPLY"; fields: string[] }>
    >({}),
    [filter, setFilter] = useState({
      patrimony: "",
      group: "",
      offset: "0",
      limit: "100",
      description: "",
      status: "",
      locationId: "",
      unitId: "",
    });
  const admin = user?.role === "ADMIN";
  const can = (permission: Permission) =>
    !!user && effectivePermissions(user).includes(permission);
  const operator =
    !!user &&
    effectivePermissions(user).some(
      (p) =>
        ![
          "locations.view",
          "units.view",
          "dashboard.view",
          "assets.view",
          "inventories.view",
          "divergences.view",
          "reports.export",
        ].includes(p),
    );
  function canAccessSection(target: Section) {
    const required: Partial<Record<Section, Permission>> = {
      locations: "locations.view",
      units: "units.view",
      dashboard: "dashboard.view",
      assets: "assets.view",
      inventories: "inventories.view",
      divergences: "divergences.view",
      imports: "imports.manage",
      settings: "settings.manage",
      reports: "reports.export",
      audit: "audit.view",
    };
    return target === "users"
      ? admin
      : required[target]
        ? can(required[target]!)
        : true;
  }
  useEffect(() => {
    if (user && !canAccessSection(section)) {
      setSection(
        (
          [
            "dashboard",
            "assets",
            "inventories",
            "divergences",
            "reports",
            "imports",
            "locations",
            "units",
            "settings",
            "audit",
            "users",
            "help",
          ] as Section[]
        ).find(canAccessSection) ?? "help",
      );
      setDetail(null);
    }
  }, [user, section]);
  async function run(
    action: () => Promise<unknown>,
    message = "Operação concluída.",
  ) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
      setNotice(message);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshDetail(id: string) {
    setDetail(await A.request<A.AssetDetail>(`assets/${id}`, token));
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    void A.request<A.User>("auth/me", token)
      .then(async (u) => {
        const allowed = effectivePermissions(u);
        const [l, n] = await Promise.all([
          allowed.includes("locations.view")
            ? A.request<A.Location[]>("locations", token)
            : Promise.resolve([]),
          allowed.includes("units.view")
            ? A.request<A.Unit[]>("units", token)
            : Promise.resolve([]),
        ]);
        if (active) {
          setUser(u);
          setLocations(l);
          setUnits(n);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, revision]);
  useEffect(() => {
    if (!token || !user || !canAccessSection(section)) return;
    let active = true;
    const load = async () => {
      switch (section) {
        case "dashboard": {
          const v = await A.request<typeof dashboard>("dashboard", token);
          if (active) setDashboard(v);
          break;
        }
        case "assets": {
          const v = await A.request<A.Asset[]>(
            `assets?${new URLSearchParams(filter)}`,
            token,
          );
          if (active) setAssets(v);
          break;
        }
        case "inventories": {
          const v = await A.request<A.Inventory[]>("inventories", token);
          if (active) setInventories(v);
          break;
        }
        case "divergences": {
          const v = await A.request<A.Divergence[]>("divergences", token);
          if (active) setDivergences(v);
          break;
        }
        case "users": {
          const v = await A.request<A.User[]>("users", token);
          if (active) setUsers(v);
          break;
        }
        case "settings": {
          const v = await A.request<typeof settings>("settings", token);
          if (active) setSettings(v);
          break;
        }
        case "audit": {
          const v = await A.request<A.Movement[]>("audit", token);
          if (active) setAudit(v);
          break;
        }
      }
    };
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [token, user?.id, section, revision, filter]);
  function form(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget)) as Record<
      string,
      string
    >;
  }
  function choose(newSection: Section) {
    setSection(newSection);
    setDetail(null);
    setError("");
    setNotice("");
  }

  return {
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
    can,
    canAccessSection,
    run,
    refreshDetail,
    form,
    choose,
  };
}
export type AppState = ReturnType<typeof usePatrimonio>;
