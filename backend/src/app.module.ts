import { Module } from "@nestjs/common";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { DataSource } from "typeorm";
import { dataSource } from "./data-source";
import { AuthService, AuthGuard } from "./auth/auth";
import { AssetsService } from "./assets/assets.service";
import { InventoryService } from "./inventory/inventory.service";
import { ImportsService } from "./imports/imports.service";
import { FilesService } from "./files/files.service";
import { JobsService } from "./notifications/jobs.service";
import { ApiController } from "./controller";
import { ErrorsFilter } from "./errors";
@Module({
  controllers: [ApiController],
  providers: [
    { provide: DataSource, useFactory: () => dataSource.initialize() },
    AuthService,
    AssetsService,
    InventoryService,
    ImportsService,
    FilesService,
    JobsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorsFilter },
  ],
})
export class AppModule {}
