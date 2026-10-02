import { MigrationInterface, QueryRunner } from "typeorm";
export class Initial1780000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE users (id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, "passwordHash" text NOT NULL, role text NOT NULL CHECK(role IN ('ADMIN','PATRIMONIAL','CONSULTA')), active boolean NOT NULL DEFAULT true);
 CREATE TABLE locations (id uuid PRIMARY KEY, code text UNIQUE NOT NULL, description text NOT NULL, building text NOT NULL, floor text NOT NULL, notes text NOT NULL, active boolean NOT NULL DEFAULT true);
 CREATE TABLE units (id uuid PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, email text NOT NULL, active boolean NOT NULL DEFAULT true);
 CREATE TABLE assets (id uuid PRIMARY KEY, patrimony varchar(20) UNIQUE NOT NULL, description varchar(255) NOT NULL, "group" varchar(100) NOT NULL, "uniqueCode" varchar(50) UNIQUE NOT NULL, "originUnit" text NOT NULL, "incorporationDate" date NOT NULL, value decimal(15,2) NOT NULL CHECK(value>=0), status varchar(1) NOT NULL CHECK(status IN ('A','D','B','T','X')), "locationId" uuid REFERENCES locations(id), condition smallint CHECK(condition BETWEEN 1 AND 5), version int NOT NULL DEFAULT 1, "availableAt" timestamptz, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL);
 CREATE TABLE reservations (id uuid PRIMARY KEY, "assetId" uuid NOT NULL REFERENCES assets(id), "destinationUnitId" uuid NOT NULL REFERENCES units(id), status text NOT NULL CHECK(status IN ('RESERVED','IN_TRANSIT','COMPLETED','CANCELLED')), "createdBy" uuid NOT NULL REFERENCES users(id), "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL);
 CREATE UNIQUE INDEX one_active_reservation ON reservations("assetId") WHERE status IN ('RESERVED','IN_TRANSIT');
 CREATE TABLE movements (id uuid PRIMARY KEY, "assetId" uuid NOT NULL REFERENCES assets(id), "userId" uuid REFERENCES users(id), operation text NOT NULL, before jsonb, after jsonb NOT NULL, notes text NOT NULL, "createdAt" timestamptz NOT NULL);
 CREATE TABLE inventories (id uuid PRIMARY KEY, "locationId" uuid NOT NULL REFERENCES locations(id), "userId" uuid NOT NULL REFERENCES users(id), status text NOT NULL CHECK(status IN ('OPEN','CLOSED')), "startedAt" timestamptz NOT NULL, "finishedAt" timestamptz, "expectedIds" jsonb NOT NULL);
 CREATE TABLE inventory_items (id uuid PRIMARY KEY, "inventoryId" uuid NOT NULL REFERENCES inventories(id), "assetId" uuid NOT NULL REFERENCES assets(id), "userId" uuid NOT NULL REFERENCES users(id), result text NOT NULL CHECK(result IN ('CONFIRMED','DIVERGENCE')), "observedAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL, UNIQUE("inventoryId","assetId"));
 CREATE TABLE divergences (id uuid PRIMARY KEY, "assetId" uuid NOT NULL REFERENCES assets(id), "inventoryId" uuid REFERENCES inventories(id), "locationId" uuid NOT NULL REFERENCES locations(id), type text NOT NULL, "foundDescription" text NOT NULL, notes text NOT NULL, status text NOT NULL CHECK(status IN ('PENDING','RESOLVED')), resolution text, "userId" uuid NOT NULL REFERENCES users(id), "createdAt" timestamptz NOT NULL, "resolvedAt" timestamptz);
 CREATE TABLE photos (id uuid PRIMARY KEY, "assetId" uuid NOT NULL REFERENCES assets(id), "eventId" uuid, filename text NOT NULL, "mimeType" text NOT NULL, "originalName" text NOT NULL, "userId" uuid NOT NULL REFERENCES users(id), "createdAt" timestamptz NOT NULL);
 CREATE TABLE settings (name text PRIMARY KEY, value text NOT NULL);
 CREATE TABLE outbox (id uuid PRIMARY KEY, "assetId" uuid NOT NULL REFERENCES assets(id), kind text NOT NULL, payload jsonb NOT NULL, status text NOT NULL CHECK(status IN ('PENDING','SENT')), attempts int NOT NULL DEFAULT 0, "lastError" text, "createdAt" timestamptz NOT NULL, "sentAt" timestamptz);
 CREATE TABLE import_batches (id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id), filename text NOT NULL, rows jsonb NOT NULL, status text NOT NULL CHECK(status IN ('PREVIEW','APPLIED')), "createdAt" timestamptz NOT NULL);
 CREATE TABLE sync_receipts (id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id), result jsonb NOT NULL, "payloadHash" text NOT NULL, "createdAt" timestamptz NOT NULL);
 CREATE INDEX asset_location ON assets("locationId"); CREATE INDEX asset_status ON assets(status);
 CREATE INDEX movement_asset ON movements("assetId","createdAt");
 INSERT INTO settings VALUES ('PRAZO_BAIXA_DIAS','20'),('EMAIL_CPS',''),('EMAIL_DISPONIBILIZACAO','');`);
  }
  async down(q: QueryRunner) {
    await q.query(
      "DROP TABLE sync_receipts,import_batches,outbox,settings,photos,divergences,inventory_items,inventories,movements,reservations,assets,units,locations,users",
    );
  }
}
