import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Localizações (salas) passam a pertencer a uma unidade cadastrada.
 * A coluna é anulável para preservar salas antigas; a API exige unidade em novos cadastros.
 * Se houver exatamente uma unidade, as salas existentes são vinculadas a ela.
 */
export class LocationUnit1787000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE locations ADD COLUMN "unitId" uuid REFERENCES units(id);
      UPDATE locations SET "unitId"=(SELECT id FROM units LIMIT 1)
        WHERE "unitId" IS NULL AND (SELECT count(*) FROM units)=1;
      ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_code_key;
      CREATE UNIQUE INDEX locations_unit_code ON locations("unitId", code) WHERE "unitId" IS NOT NULL;
      CREATE UNIQUE INDEX locations_code_without_unit ON locations(code) WHERE "unitId" IS NULL;
      CREATE INDEX location_unit ON locations("unitId");`);
  }
  async down(q: QueryRunner) {
    // Falha se duas unidades usarem o mesmo código de sala: resolva antes de reverter.
    await q.query(`DROP INDEX location_unit; DROP INDEX locations_code_without_unit; DROP INDEX locations_unit_code;
      ALTER TABLE locations ADD CONSTRAINT locations_code_key UNIQUE(code);
      ALTER TABLE locations DROP COLUMN "unitId";`);
  }
}
