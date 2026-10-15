import { MigrationInterface, QueryRunner } from "typeorm";
export class AssetUnit1782000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE assets ADD COLUMN "unitId" uuid REFERENCES units(id); CREATE INDEX asset_unit ON assets("unitId");`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP INDEX asset_unit; ALTER TABLE assets DROP COLUMN "unitId";`,
    );
  }
}
