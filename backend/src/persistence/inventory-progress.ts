import { MigrationInterface, QueryRunner } from "typeorm";

export class InventoryProgress1786000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE inventories DROP CONSTRAINT inventories_status_check;
      ALTER TABLE inventories ADD CONSTRAINT inventories_status_check CHECK(status IN ('OPEN','CLOSED','CANCELLED'));
      ALTER TABLE inventory_items DROP CONSTRAINT inventory_items_result_check;
      ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_result_check CHECK(result IN ('CONFIRMED','DIVERGENCE','NOT_FOUND'));
      CREATE INDEX inventories_open_location ON inventories("locationId") WHERE status='OPEN';
      INSERT INTO settings(name,value) VALUES ('INVENTARIO_EXCLUSIVO_LOCAL','true') ON CONFLICT DO NOTHING;`);
  }
  async down(q: QueryRunner) {
    // Não converter cancelamentos/ausências silenciosamente em conferências.
    await q.query(`ALTER TABLE inventories DROP CONSTRAINT inventories_status_check;
      ALTER TABLE inventories ADD CONSTRAINT inventories_status_check CHECK(status IN ('OPEN','CLOSED'));
      ALTER TABLE inventory_items DROP CONSTRAINT inventory_items_result_check;
      ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_result_check CHECK(result IN ('CONFIRMED','DIVERGENCE'));
      DROP INDEX inventories_open_location;
      DELETE FROM settings WHERE name='INVENTARIO_EXCLUSIVO_LOCAL';`);
  }
}
