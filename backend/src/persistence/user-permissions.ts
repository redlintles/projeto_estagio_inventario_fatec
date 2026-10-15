import { MigrationInterface, QueryRunner } from "typeorm";
export class UserPermissions1784000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE users ADD COLUMN permissions jsonb DEFAULT NULL, ADD COLUMN "primaryAdmin" boolean NOT NULL DEFAULT false;
    CREATE UNIQUE INDEX users_primary_admin ON users("primaryAdmin") WHERE "primaryAdmin"=true;
    ALTER TABLE users ADD CONSTRAINT primary_admin_access CHECK (NOT "primaryAdmin" OR (role='ADMIN' AND active=true));`);
    await q.query(
      `UPDATE users SET "primaryAdmin"=true WHERE id=(SELECT id FROM users WHERE role='ADMIN' AND active=true ORDER BY (email=$1) DESC,id LIMIT 1)`,
      [(process.env.BOOTSTRAP_EMAIL ?? "admin@fatec.local").toLowerCase()],
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `ALTER TABLE users DROP CONSTRAINT primary_admin_access; DROP INDEX users_primary_admin; ALTER TABLE users DROP COLUMN permissions, DROP COLUMN "primaryAdmin"`,
    );
  }
}
