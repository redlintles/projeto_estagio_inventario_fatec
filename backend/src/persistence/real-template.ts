import { MigrationInterface, QueryRunner } from "typeorm";
export class RealTemplate1781000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    // PostgreSQL generated constraint names are discovered to support existing installations.
    const constraints = await q.query(
      `SELECT conname FROM pg_constraint WHERE conrelid='assets'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE ("uniqueCode")'`,
    );
    for (const row of constraints)
      await q.query(
        `ALTER TABLE assets DROP CONSTRAINT "${String(row.conname).replaceAll('"', '""')}"`,
      );
    await q.query(`CREATE INDEX asset_source_code ON assets("uniqueCode");
      ALTER TABLE assets DROP CONSTRAINT assets_status_check;
      ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK(status IN ('I','A','D','B','T','X'));
      ALTER TABLE users ADD COLUMN "tokenVersion" integer NOT NULL DEFAULT 0;`);
  }
  async down(q: QueryRunner) {
    // Refuse rollback when source data cannot fit the old schema, rather than changing it.
    await q.query(`ALTER TABLE assets ADD CONSTRAINT assets_unique_code_restore UNIQUE ("uniqueCode");
      ALTER TABLE assets DROP CONSTRAINT assets_status_check;
      ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK(status IN ('A','D','B','T','X'));
      DROP INDEX asset_source_code;
      ALTER TABLE users DROP COLUMN "tokenVersion";`);
  }
}
