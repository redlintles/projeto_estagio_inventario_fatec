import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { schemas } from "./persistence/schemas";
import { Initial1780000000000 } from "./persistence/migration";
export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: schemas,
  migrations: [Initial1780000000000],
  synchronize: false,
  logging: false,
});
export default dataSource;
