import { InventoryProgress1786000000000 } from "./persistence/inventory-progress";
import { BatchRedo1785000000000 } from "./persistence/batch-redo";
import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { schemas } from "./persistence/schemas";
import { Initial1780000000000 } from "./persistence/migration";
import { RealTemplate1781000000000 } from "./persistence/real-template";
import { AssetUnit1782000000000 } from "./persistence/asset-unit";
import { BatchHistory1783000000000 } from "./persistence/batch-history";
import { UserPermissions1784000000000 } from "./persistence/user-permissions";
export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: schemas,
  migrations: [
    Initial1780000000000,
    RealTemplate1781000000000,
    AssetUnit1782000000000,
    BatchHistory1783000000000,
    UserPermissions1784000000000,
    BatchRedo1785000000000,
    InventoryProgress1786000000000,
  ],
  synchronize: false,
  logging: false,
  connectTimeoutMS: 10000,
  // Uma falha de rede ou consulta presa não deve ocupar conexões indefinidamente.
  extra: {
    max: 10,
    idleTimeoutMillis: 30000,
    statement_timeout: 60000,
    idle_in_transaction_session_timeout: 60000,
  },
});
