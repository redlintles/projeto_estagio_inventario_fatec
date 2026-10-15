import { MigrationInterface, QueryRunner } from "typeorm";
export class BatchRedo1785000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE asset_batches ADD COLUMN revision integer NOT NULL DEFAULT 1, ADD COLUMN "redoneAt" timestamptz, ADD COLUMN "redoneBy" uuid REFERENCES users(id);
    CREATE TABLE asset_batch_events(id uuid PRIMARY KEY,"batchId" uuid NOT NULL REFERENCES asset_batches(id),revision integer NOT NULL,action text NOT NULL,"userId" uuid NOT NULL REFERENCES users(id),count integer NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now(),UNIQUE("batchId",revision));
    INSERT INTO asset_batch_events SELECT gen_random_uuid(),id,1,'APPLY',"userId",updated,"appliedAt" FROM asset_batches WHERE status!='PREVIEW';
    INSERT INTO asset_batch_events SELECT gen_random_uuid(),id,2,'UNDO',COALESCE("undoneBy","userId"),updated,COALESCE("undoneAt","appliedAt") FROM asset_batches WHERE status='UNDONE';
    UPDATE asset_batches SET revision=2,items=(SELECT COALESCE(jsonb_agg(item || jsonb_build_object('undoVersion',(item->>'appliedVersion')::integer+1)),'[]'::jsonb) FROM jsonb_array_elements(items) item) WHERE status='UNDONE';`);
  }
  async down(q: QueryRunner) {
    await q.query(
      `DROP TABLE asset_batch_events; ALTER TABLE asset_batches DROP COLUMN revision,DROP COLUMN "redoneAt",DROP COLUMN "redoneBy"`,
    );
  }
}
