import { EntitySchema } from "typeorm";
import * as M from "../domain/model";
const id = { type: "uuid" as const, primary: true };
const text = { type: "text" as const };
const date = { type: "timestamptz" as const };
export const UserSchema = new EntitySchema<M.User>({
  name: "User",
  tableName: "users",
  columns: {
    id,
    name: text,
    email: { ...text, unique: true },
    passwordHash: text,
    role: text,
    active: { type: Boolean, default: true },
  },
});
export const LocationSchema = new EntitySchema<M.Location>({
  name: "Location",
  tableName: "locations",
  columns: {
    id,
    code: { ...text, unique: true },
    description: text,
    building: text,
    floor: text,
    notes: text,
    active: { type: Boolean, default: true },
  },
});
export const UnitSchema = new EntitySchema<M.Unit>({
  name: "Unit",
  tableName: "units",
  columns: {
    id,
    code: { ...text, unique: true },
    name: text,
    email: text,
    active: { type: Boolean, default: true },
  },
});
export const AssetSchema = new EntitySchema<M.Asset>({
  name: "Asset",
  tableName: "assets",
  columns: {
    id,
    patrimony: { type: "varchar", length: 20, unique: true },
    description: { type: "varchar", length: 255 },
    group: { type: "varchar", length: 100 },
    uniqueCode: { type: "varchar", length: 50, unique: true },
    originUnit: text,
    incorporationDate: { type: "date" },
    value: { type: "decimal", precision: 15, scale: 2 },
    status: { type: "varchar", length: 1 },
    locationId: { type: "uuid", nullable: true },
    condition: { type: "smallint", nullable: true },
    version: { type: "int", default: 1 },
    availableAt: { ...date, nullable: true },
    createdAt: date,
    updatedAt: date,
  },
});
export const ReservationSchema = new EntitySchema<M.Reservation>({
  name: "Reservation",
  tableName: "reservations",
  columns: {
    id,
    assetId: { type: "uuid" },
    destinationUnitId: { type: "uuid" },
    status: text,
    createdBy: { type: "uuid" },
    createdAt: date,
    updatedAt: date,
  },
});
export const MovementSchema = new EntitySchema<M.Movement>({
  name: "Movement",
  tableName: "movements",
  columns: {
    id,
    assetId: { type: "uuid" },
    userId: { type: "uuid", nullable: true },
    operation: text,
    before: { type: "jsonb", nullable: true },
    after: { type: "jsonb" },
    notes: text,
    createdAt: date,
  },
});
export const InventorySchema = new EntitySchema<M.Inventory>({
  name: "Inventory",
  tableName: "inventories",
  columns: {
    id,
    locationId: { type: "uuid" },
    userId: { type: "uuid" },
    status: text,
    startedAt: date,
    finishedAt: { ...date, nullable: true },
    expectedIds: { type: "jsonb" },
  },
});
export const InventoryItemSchema = new EntitySchema<M.InventoryItem>({
  name: "InventoryItem",
  tableName: "inventory_items",
  columns: {
    id,
    inventoryId: { type: "uuid" },
    assetId: { type: "uuid" },
    userId: { type: "uuid" },
    result: text,
    observedAt: date,
    createdAt: date,
  },
  uniques: [{ columns: ["inventoryId", "assetId"] }],
});
export const DivergenceSchema = new EntitySchema<M.Divergence>({
  name: "Divergence",
  tableName: "divergences",
  columns: {
    id,
    assetId: { type: "uuid" },
    inventoryId: { type: "uuid", nullable: true },
    locationId: { type: "uuid" },
    type: text,
    foundDescription: text,
    notes: text,
    status: text,
    resolution: { ...text, nullable: true },
    userId: { type: "uuid" },
    createdAt: date,
    resolvedAt: { ...date, nullable: true },
  },
});
export const PhotoSchema = new EntitySchema<M.Photo>({
  name: "Photo",
  tableName: "photos",
  columns: {
    id,
    assetId: { type: "uuid" },
    eventId: { type: "uuid", nullable: true },
    filename: text,
    mimeType: text,
    originalName: text,
    userId: { type: "uuid" },
    createdAt: date,
  },
});
export const SettingSchema = new EntitySchema<M.Setting>({
  name: "Setting",
  tableName: "settings",
  columns: { name: { ...text, primary: true }, value: text },
});
export const OutboxSchema = new EntitySchema<M.Outbox>({
  name: "Outbox",
  tableName: "outbox",
  columns: {
    id,
    assetId: { type: "uuid" },
    kind: text,
    payload: { type: "jsonb" },
    status: text,
    attempts: { type: "int", default: 0 },
    lastError: { ...text, nullable: true },
    createdAt: date,
    sentAt: { ...date, nullable: true },
  },
});
export const ImportBatchSchema = new EntitySchema<M.ImportBatch>({
  name: "ImportBatch",
  tableName: "import_batches",
  columns: {
    id,
    userId: { type: "uuid" },
    filename: text,
    rows: { type: "jsonb" },
    status: text,
    createdAt: date,
  },
});
export const SyncReceiptSchema = new EntitySchema<M.SyncReceipt>({
  name: "SyncReceipt",
  tableName: "sync_receipts",
  columns: {
    id,
    userId: { type: "uuid" },
    result: { type: "jsonb" },
    payloadHash: text,
    createdAt: date,
  },
});
export const schemas = [
  UserSchema,
  LocationSchema,
  UnitSchema,
  AssetSchema,
  ReservationSchema,
  MovementSchema,
  InventorySchema,
  InventoryItemSchema,
  DivergenceSchema,
  PhotoSchema,
  SettingSchema,
  OutboxSchema,
  ImportBatchSchema,
  SyncReceiptSchema,
];
