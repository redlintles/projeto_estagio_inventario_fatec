import { it, expect } from "vitest";
import { describeChanges, describeNotes, operationLabel } from "./history";
const context = {
  locations: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      code: "S10",
      description: "Sala 10",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      code: "LAB2",
      description: "Laboratório 2",
    },
  ],
  units: [{ id: "33333333-3333-3333-3333-333333333333", name: "Fatec Cotia" }],
};
const base = {
  id: "a",
  patrimony: "123",
  description: "Mesa",
  status: "A",
  locationId: "11111111-1111-1111-1111-111111111111",
  unitId: null,
  condition: null,
  availableAt: null,
  version: 1,
  updatedAt: "2026-11-01T10:00:00.000Z",
};
it("mostra só os campos alterados com nomes legíveis, sem JSON", () => {
  const changes = describeChanges(
    {
      before: base,
      after: {
        ...base,
        status: "D",
        condition: 4,
        locationId: "22222222-2222-2222-2222-222222222222",
        version: 2,
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
    },
    context,
  );
  expect(changes.map((c) => c.label)).toEqual([
    "Status",
    "Localização",
    "Condição física",
  ]);
  expect(changes[0]).toMatchObject({
    before: "Ativo",
    after: "Disponibilizado",
  });
  expect(changes[1]).toMatchObject({
    before: "S10 - Sala 10",
    after: "LAB2 - Laboratório 2",
  });
  expect(changes[2]).toMatchObject({ before: "Não avaliado", after: "4/5" });
});
it("registro de foto não lista mudanças", () => {
  expect(describeChanges({ before: base, after: base }, context)).toEqual([]);
});
it("converte observações antigas gravadas como JSON", () => {
  expect(
    describeNotes(
      JSON.stringify({
        id: "r",
        destinationUnitId: "33333333-3333-3333-3333-333333333333",
        status: "IN_TRANSIT",
      }),
      context,
    ),
  ).toBe("Unidade de destino: Fatec Cotia · Situação: em transporte");
  expect(
    describeNotes("Foto 0b7f6a8e-5c1d-4f7a-9e0b-1a2b3c4d5e6f", context),
  ).toBe("");
  expect(describeNotes("Justificativa qualquer", context)).toBe(
    "Justificativa qualquer",
  );
});
it("traduz códigos de operação", () => {
  expect(operationLabel("AVAILABLE")).toBe("Ativo disponibilizado");
  expect(operationLabel("PHOTO_DELETE")).toBe("Foto removida");
  expect(operationLabel("DESCONHECIDA")).toBe("DESCONHECIDA");
});
