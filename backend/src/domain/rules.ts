import { ConflictException, BadRequestException } from "@nestjs/common";
import { Asset, AssetStatus } from "./model";
export function checkVersion(asset: Asset, expected: number) {
  if (asset.version !== expected)
    throw new ConflictException({
      message: "O ativo mudou. Revise os dados atuais antes de reenviar.",
      current: asset,
    });
}
export function requireStatus(asset: Asset, allowed: AssetStatus[]) {
  if (!allowed.includes(asset.status))
    throw new ConflictException(
      "Operação incompatível com o estado atual do ativo.",
    );
}
export function conditionValue(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5)
    throw new BadRequestException("Condição deve ser um inteiro de 1 a 5.");
  return value;
}
export function isOverdue(
  availableAt: Date | null,
  days: number,
  now = new Date(),
) {
  return (
    availableAt !== null &&
    now.getTime() - availableAt.getTime() > days * 86400000
  );
}
export const officialFields = [
  "patrimony",
  "description",
  "group",
  "uniqueCode",
  "originUnit",
  "incorporationDate",
  "value",
] as const;
export function compareFields(
  current: Record<string, string>,
  incoming: Record<string, string>,
) {
  return officialFields.filter((key) => current[key] !== incoming[key]);
}
