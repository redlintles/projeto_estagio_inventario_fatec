export type Role = "ADMIN" | "PATRIMONIAL" | "CONSULTA";
export type AssetStatus = "A" | "D" | "B" | "T" | "X";
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
}
export interface Location {
  id: string;
  code: string;
  description: string;
  building: string;
  floor: string;
  notes: string;
  active: boolean;
}
export interface Unit {
  id: string;
  code: string;
  name: string;
  email: string;
  active: boolean;
}
export interface Asset {
  id: string;
  patrimony: string;
  description: string;
  group: string;
  uniqueCode: string;
  originUnit: string;
  incorporationDate: string;
  value: string;
  status: AssetStatus;
  locationId: string | null;
  condition: number | null;
  version: number;
  availableAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface Reservation {
  id: string;
  assetId: string;
  destinationUnitId: string;
  status: "RESERVED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface Movement {
  id: string;
  assetId: string;
  userId: string | null;
  operation: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  notes: string;
  createdAt: Date;
}
export interface Inventory {
  id: string;
  locationId: string;
  userId: string;
  status: "OPEN" | "CLOSED";
  startedAt: Date;
  finishedAt: Date | null;
  expectedIds: string[];
}
export interface InventoryItem {
  id: string;
  inventoryId: string;
  assetId: string;
  userId: string;
  result: "CONFIRMED" | "DIVERGENCE";
  observedAt: Date;
  createdAt: Date;
}
export interface Divergence {
  id: string;
  assetId: string;
  inventoryId: string | null;
  locationId: string;
  type: string;
  foundDescription: string;
  notes: string;
  status: "PENDING" | "RESOLVED";
  resolution: string | null;
  userId: string;
  createdAt: Date;
  resolvedAt: Date | null;
}
export interface Photo {
  id: string;
  assetId: string;
  eventId: string | null;
  filename: string;
  mimeType: string;
  originalName: string;
  userId: string;
  createdAt: Date;
}
export interface Setting {
  name: string;
  value: string;
}
export interface Outbox {
  id: string;
  assetId: string;
  kind: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "SENT";
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
}
export interface ImportBatch {
  id: string;
  userId: string;
  filename: string;
  rows: ImportRow[];
  status: "PREVIEW" | "APPLIED";
  createdAt: Date;
}
export interface ImportRow {
  line: number;
  incoming: Record<string, string>;
  assetId: string | null;
  expectedVersion: number | null;
  current: Record<string, string> | null;
  differences: string[];
  errors: string[];
}
export interface SyncReceipt {
  id: string;
  userId: string;
  result: Record<string, unknown>;
  payloadHash: string;
  createdAt: Date;
}
