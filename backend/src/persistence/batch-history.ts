import { MigrationInterface, QueryRunner } from "typeorm";
export class BatchHistory1783000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE asset_batches (
      id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id),
      field text NOT NULL, "targetId" uuid NOT NULL, "targetLabel" text NOT NULL,
      status text NOT NULL, items jsonb NOT NULL, filters jsonb,
      matched integer NOT NULL, skipped integer NOT NULL, updated integer NOT NULL DEFAULT 0,
      unchanged integer NOT NULL DEFAULT 0, "createdAt" timestamptz NOT NULL DEFAULT now(),
      "appliedAt" timestamptz, "undoneAt" timestamptz, "undoneBy" uuid REFERENCES users(id));
      CREATE INDEX asset_batches_date ON asset_batches("createdAt" DESC);`);
  }
  async down(q: QueryRunner) {
    await q.query("DROP TABLE asset_batches");
  }
}
