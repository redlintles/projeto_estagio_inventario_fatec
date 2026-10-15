import { describe, it, expect } from "vitest";
import {
  permissionCatalog,
  normalizePermissions,
  effectivePermissions,
  assertPermission,
  roleDefaults,
} from "../src/auth/permissions";
import * as web from "../../web/src/permissions";
describe("Permissões por tarefa", () => {
  it("mantém o catálogo e os modelos iguais no portal e servidor", () => {
    expect(web.permissionCatalog).toEqual(permissionCatalog);
    expect(web.roleDefaults).toEqual(roleDefaults);
  });
  it("diferencia ausência de personalização de nenhuma permissão", () => {
    expect(
      effectivePermissions({ role: "CONSULTA", permissions: null }),
    ).toContain("assets.view");
    expect(effectivePermissions({ role: "CONSULTA", permissions: [] })).toEqual(
      [],
    );
    expect(
      effectivePermissions({ role: "ADMIN", permissions: [] }),
    ).toHaveLength(permissionCatalog.length);
  });
  it("inclui consultas dependentes sem conceder outras operações", () => {
    const input = normalizePermissions(["batches.unit"]);
    expect(input).toContain("assets.view");
    expect(input).toContain("units.view");
    expect(input).not.toContain("batches.location");
    expect(input).not.toContain("batches.undo");
    expect(() =>
      assertPermission(
        { role: "PATRIMONIAL", permissions: [] },
        "batches.unit",
      ),
    ).toThrow();
  });
});
