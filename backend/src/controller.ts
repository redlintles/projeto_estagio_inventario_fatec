import { permissionKeys, normalizePermissions } from "./auth/permissions";
import { RequirePermissions, RequireAnyPermissions } from "./auth/auth";
import {
  ReportsService,
  csvReport,
  workbookReport,
  displayCell,
} from "./reports/reports";
import { Inject } from "@nestjs/common";
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  SetMetadata,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from "@nestjs/swagger";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { AuthService, Actor, Roles, hashPassword } from "./auth/auth";
import { AssetsService } from "./assets/assets.service";
import { InventoryService } from "./inventory/inventory.service";
import { ImportsService } from "./imports/imports.service";
import { FilesService } from "./files/files.service";
import { JobsService } from "./notifications/jobs.service";
import * as S from "./persistence/schemas";
import {
  parse,
  uuid,
  version,
  condition,
  note,
  assetInput,
  scanInput,
} from "./validation";
type AuthRequest = Request & { user: Actor };
const fileBody = {
  schema: {
    type: "object",
    properties: { file: { type: "string", format: "binary" } },
  },
} as const;
@ApiTags("Patrimônio")
@ApiBearerAuth()
@Controller()
export class ApiController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AssetsService) private readonly assets: AssetsService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(ImportsService) private readonly imports: ImportsService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(DataSource) private readonly db: DataSource,
  ) {}
  @Get("health") @SetMetadata("public", true) health() {
    return { status: "ok" };
  }
  @Post("auth/login")
  @SetMetadata("public", true)
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: { email: { type: "string" }, password: { type: "string" } },
    },
  })
  login(@Body() body: unknown, @Req() request: Request) {
    const input = parse(
      z.object({
        email: z.email().max(254),
        password: z.string().min(1).max(128),
      }),
      body,
    );
    return this.auth.login(
      input.email,
      input.password,
      request.ip ?? request.socket.remoteAddress ?? "unknown",
    );
  }
  @Post("auth/logout") async logout(@Req() r: AuthRequest) {
    await this.db
      .getRepository(S.UserSchema)
      .increment({ id: r.user.id }, "tokenVersion", 1);
    return { loggedOut: true };
  }
  @Get("auth/me") me(@Req() r: AuthRequest) {
    return r.user;
  }
  @Get("dashboard") @RequirePermissions("dashboard.view") dashboard() {
    return this.assets.dashboard();
  }
  @Get("assets") @RequirePermissions("assets.view") list(
    @Query() query: Record<string, string>,
  ) {
    return this.assets.list(query);
  }
  @Get("assets/:id") @RequirePermissions("assets.view") detail(
    @Param("id") id: string,
  ) {
    return this.assets.detail(parse(uuid, id));
  }
  @Post("assets") @RequirePermissions("assets.create") create(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const data = parse(
      assetInput
        .extend({
          value: assetInput.shape.value.optional(),
          previousAssetId: uuid.optional(),
        })
        .strict(),
      body,
    );
    const { previousAssetId, ...fields } = data;
    if (!previousAssetId && fields.value === undefined)
      throw new BadRequestException(
        "Informe o valor ou um ativo de referência para calcular o valor anterior + 1.",
      );
    const input = parse(assetInput, {
      ...fields,
      value: fields.value ?? "0.00",
    });
    return this.assets.create(input, r.user, previousAssetId);
  }
  @Post("assets/location-batch")
  @RequirePermissions("batches.location")
  locateBatch(@Body() body: unknown, @Req() r: AuthRequest) {
    const input = parse(
      z
        .object({
          locationId: uuid,
          assets: z
            .array(z.object({ id: uuid, expectedVersion: version }).strict())
            .min(1)
            .max(500),
        })
        .strict(),
      body,
    );
    return this.assets.locateBatch(input.assets, input.locationId, r.user);
  }
  @Post("assets/unit-batch")
  @RequirePermissions("batches.unit")
  assignUnitBatch(@Body() body: unknown, @Req() r: AuthRequest) {
    const input = parse(
      z
        .object({
          unitId: uuid,
          assets: z
            .array(z.object({ id: uuid, expectedVersion: version }).strict())
            .min(1)
            .max(500),
        })
        .strict(),
      body,
    );
    return this.assets.assignUnitBatch(input.assets, input.unitId, r.user);
  }
  @Post("asset-batches/selection")
  @RequireAnyPermissions(
    "batches.unit",
    "batches.location",
    "batches.undo",
    "batches.redo",
  )
  async batchSelection(@Body() body: unknown) {
    const input = parse(
      z.object({ filters: z.record(z.string(), z.string()) }).strict(),
      body,
    );
    const rows = await this.assets.list(input.filters, true);
    return {
      matched: rows.length,
      selected: rows.filter((a) => ["I", "A"].includes(a.status)).length,
    };
  }
  @Post("asset-batches/preview")
  @RequireAnyPermissions("batches.unit", "batches.location")
  previewBatch(@Body() body: unknown, @Req() r: AuthRequest) {
    const input = parse(
      z
        .object({
          field: z.enum(["unitId", "locationId"]),
          targetId: uuid,
          assets: z
            .array(z.object({ id: uuid, expectedVersion: version }).strict())
            .min(1)
            .max(500)
            .optional(),
          filters: z.record(z.string(), z.string()).optional(),
        })
        .strict(),
      body,
    );
    return this.assets.previewBatch(
      input.field,
      input.targetId,
      input.assets,
      input.filters,
      r.user,
    );
  }
  @Post("asset-batches/:id/apply")
  @RequireAnyPermissions("batches.unit", "batches.location")
  applyBatch(@Param("id") id: string, @Req() r: AuthRequest) {
    return this.assets.applyBatch(parse(uuid, id), r.user);
  }
  @Get("asset-batches")
  @RequireAnyPermissions(
    "batches.unit",
    "batches.location",
    "batches.undo",
    "batches.redo",
  )
  batchHistory(@Query("offset") offset = "0") {
    const value = Number(offset);
    if (!Number.isSafeInteger(value) || value < 0 || value > 10000000)
      throw new BadRequestException("Página inválida.");
    return this.assets.batchHistory(value);
  }
  @Post("asset-batches/:id/undo") @RequirePermissions("batches.undo") undoBatch(
    @Param("id") id: string,
    @Req() r: AuthRequest,
  ) {
    return this.assets.undoBatch(parse(uuid, id), r.user);
  }
  @Post("asset-batches/:id/redo") @RequirePermissions("batches.redo") redoBatch(
    @Param("id") id: string,
    @Req() r: AuthRequest,
  ) {
    return this.assets.redoBatch(parse(uuid, id), r.user);
  }
  @Get("asset-batches/:id/events")
  @RequireAnyPermissions(
    "batches.unit",
    "batches.location",
    "batches.undo",
    "batches.redo",
  )
  batchEvents(@Param("id") id: string) {
    return this.assets.batchEvents(parse(uuid, id));
  }
  @Post("assets/:id/location") @RequirePermissions("assets.location") locate(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z.object({ expectedVersion: version, locationId: uuid }).strict(),
      body,
    );
    return this.assets.locate(
      parse(uuid, id),
      b.expectedVersion,
      b.locationId,
      r.user,
    );
  }
  @Post("assets/:id/available")
  @RequirePermissions("assets.available")
  available(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z.object({ expectedVersion: version, condition }).strict(),
      body,
    );
    return this.assets.available(
      parse(uuid, id),
      b.expectedVersion,
      b.condition,
      r.user,
    );
  }
  @Post("assets/:id/reservations")
  @RequirePermissions("assets.reserve")
  reserve(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z.object({ expectedVersion: version, destinationUnitId: uuid }).strict(),
      body,
    );
    return this.assets.reserve(
      parse(uuid, id),
      b.expectedVersion,
      b.destinationUnitId,
      r.user,
    );
  }
  @Post("reservations/:id/:action")
  @RequirePermissions("assets.reserve")
  reservation(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(z.object({ expectedVersion: version }).strict(), body);
    return this.assets.reservation(
      parse(uuid, id),
      parse(z.enum(["dispatch", "complete", "cancel"]), action),
      b.expectedVersion,
      r.user,
    );
  }
  @Post("write-offs") @RequirePermissions("assets.writeOff") writeOff(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z
        .object({
          assets: z
            .array(z.object({ id: uuid, expectedVersion: version }))
            .min(1)
            .max(100),
          justification: z.string().trim().min(3).max(2000),
        })
        .strict(),
      body,
    );
    if (new Set(b.assets.map((a) => a.id)).size !== b.assets.length)
      throw new BadRequestException("Ativo duplicado.");
    return this.assets.writeOff(b.assets, b.justification, r.user);
  }
  @Get("locations") @RequirePermissions("locations.view") locations() {
    return this.db
      .getRepository(S.LocationSchema)
      .find({ order: { code: "ASC" } });
  }
  @Post("locations") @RequirePermissions("locations.manage") location(
    @Body() body: unknown,
  ) {
    const b = parse(
      z
        .object({
          code: z.string().min(1).max(50),
          description: z.string().min(1).max(255),
          building: z.string().max(100).default(""),
          floor: z.string().max(50).default(""),
          notes: note,
        })
        .strict(),
      body,
    );
    return this.db
      .getRepository(S.LocationSchema)
      .save({ id: randomUUID(), ...b, active: true });
  }
  @Patch("locations/:id")
  @RequirePermissions("locations.manage")
  updateLocation(@Param("id") id: string, @Body() body: unknown) {
    const b = parse(
      z
        .object({
          description: z.string().min(1).max(255).optional(),
          building: z.string().max(100).optional(),
          floor: z.string().max(50).optional(),
          notes: z.string().max(2000).optional(),
          active: z.boolean().optional(),
        })
        .strict(),
      body,
    );
    return this.db.getRepository(S.LocationSchema).update(parse(uuid, id), b);
  }
  @Get("units") @RequirePermissions("units.view") units() {
    return this.db.getRepository(S.UnitSchema).find({ order: { name: "ASC" } });
  }
  @Post("units") @RequirePermissions("units.manage") unit(
    @Body() body: unknown,
  ) {
    const b = parse(
      z
        .object({
          code: z.string().min(1).max(20),
          name: z.string().min(1).max(255),
          email: z.email().max(254),
        })
        .strict(),
      body,
    );
    return this.db
      .getRepository(S.UnitSchema)
      .save({ id: randomUUID(), ...b, active: true });
  }
  @Patch("units/:id") @RequirePermissions("units.manage") updateUnit(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const b = parse(
      z
        .object({
          name: z.string().min(1).max(255).optional(),
          email: z.email().max(254).optional(),
          active: z.boolean().optional(),
        })
        .strict(),
      body,
    );
    return this.db.getRepository(S.UnitSchema).update(parse(uuid, id), b);
  }
  @Get("users") @Roles("ADMIN") users() {
    return this.db.getRepository(S.UserSchema).find({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        permissions: true,
        primaryAdmin: true,
      },
    });
  }
  @Post("users") @Roles("ADMIN") user(@Body() body: unknown) {
    const b = parse(
      z
        .object({
          name: z.string().min(1).max(100),
          email: z.email().max(254),
          password: z.string().min(12).max(128),
          role: z.enum(["ADMIN", "PATRIMONIAL", "CONSULTA"]),
          permissions: z
            .array(z.enum(permissionKeys))
            .max(permissionKeys.length)
            .nullable()
            .optional(),
        })
        .strict(),
      body,
    );
    return this.createUser(b);
  }
  private async createUser(b: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "PATRIMONIAL" | "CONSULTA";
    permissions?: import("./auth/permissions").Permission[] | null;
  }) {
    const user = await this.db.getRepository(S.UserSchema).save({
      id: randomUUID(),
      name: b.name,
      email: b.email.toLowerCase(),
      passwordHash: hashPassword(b.password),
      role: b.role,
      permissions: b.permissions ? normalizePermissions(b.permissions) : null,
      active: true,
    });
    const { passwordHash, ...safe } = user;
    return safe;
  }
  @Patch("users/:id") @Roles("ADMIN") async updateUser(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z
        .object({
          active: z.boolean().optional(),
          role: z.enum(["ADMIN", "PATRIMONIAL", "CONSULTA"]).optional(),
          permissions: z
            .array(z.enum(permissionKeys))
            .max(permissionKeys.length)
            .nullable()
            .optional(),
          password: z.string().min(12).max(128).optional(),
        })
        .strict(),
      body,
    );
    if (
      id === r.user.id &&
      (b.active === false || (b.role && b.role !== "ADMIN"))
    )
      throw new BadRequestException(
        "Não remova seu próprio acesso administrativo.",
      );
    const { password, ...fields } = b;
    const targetId = parse(uuid, id);
    return this.db.transaction(async (m) => {
      const target = await m.getRepository(S.UserSchema).findOne({
        where: { id: targetId },
        lock: { mode: "pessimistic_write" },
      });
      if (!target) throw new BadRequestException("Usuário não encontrado.");
      if (
        target.primaryAdmin &&
        (r.user.id !== targetId ||
          b.active === false ||
          (b.role && b.role !== "ADMIN") ||
          b.permissions !== undefined)
      )
        throw new BadRequestException(
          "O administrador principal mantém acesso global. Somente ele pode alterar sua própria senha.",
        );
      const result = await m.getRepository(S.UserSchema).update(targetId, {
        ...fields,
        ...(fields.permissions
          ? { permissions: normalizePermissions(fields.permissions) }
          : {}),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
      });
      await m
        .getRepository(S.UserSchema)
        .increment({ id: targetId }, "tokenVersion", 1);
      return result;
    });
  }
  @Get("settings") @RequirePermissions("settings.manage") settings() {
    return this.db.getRepository(S.SettingSchema).find();
  }
  @Post("settings") @RequirePermissions("settings.manage") setting(
    @Body() body: unknown,
  ) {
    const b = parse(
      z
        .object({
          name: z.enum([
            "PRAZO_BAIXA_DIAS",
            "EMAIL_CPS",
            "EMAIL_DISPONIBILIZACAO",
          ]),
          value: z.string().max(4000),
        })
        .strict(),
      body,
    );
    if (b.name === "PRAZO_BAIXA_DIAS")
      parse(z.coerce.number().int().min(1).max(3650), b.value);
    else
      for (const email of b.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean))
        parse(z.email(), email);
    return this.db.getRepository(S.SettingSchema).save(b);
  }
  @Get("inventories") @RequirePermissions("inventories.view") inventories() {
    return this.db
      .getRepository(S.InventorySchema)
      .find({ order: { startedAt: "DESC" }, take: 500 });
  }
  @Post("inventories") @RequirePermissions("inventories.manage") start(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(z.object({ locationId: uuid }).strict(), body);
    return this.inventory.start(b.locationId, r.user);
  }
  @Get("inventories/:id")
  @RequirePermissions("inventories.view")
  inventoryDetail(@Param("id") id: string) {
    return this.inventory.detail(parse(uuid, id));
  }
  @Post("inventories/:id/scans") @RequirePermissions("inventories.manage") scan(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.inventory.onlineScan(
      parse(uuid, id),
      parse(scanInput, body),
      r.user,
    );
  }
  @Post("inventories/:id/close")
  @RequirePermissions("inventories.manage")
  close(@Param("id") id: string, @Req() r: AuthRequest) {
    return this.inventory.close(parse(uuid, id), r.user);
  }
  @Post("sync") @RequirePermissions("inventories.manage") sync(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z
        .object({ operationId: uuid, inventoryId: uuid, input: scanInput })
        .strict(),
      body,
    );
    return this.inventory.sync(b.operationId, b.inventoryId, b.input, r.user);
  }
  @Get("divergences") @RequirePermissions("divergences.view") divergences(
    @Query() q: Record<string, string>,
  ) {
    const query = this.db
      .getRepository(S.DivergenceSchema)
      .createQueryBuilder("d");
    for (const key of ["status", "type", "locationId"])
      if (q[key]) query.andWhere(`d.${key} = :${key}`, { [key]: q[key] });
    if (q.from)
      query.andWhere("d.createdAt >= :from", {
        from: parse(z.iso.date(), q.from),
      });
    if (q.to)
      query.andWhere("d.createdAt < :to::date + interval '1 day'", {
        to: parse(z.iso.date(), q.to),
      });
    return query.orderBy("d.createdAt", "DESC").take(5000).getMany();
  }
  @Post("divergences/:id/resolve")
  @RequirePermissions("divergences.resolve")
  resolve(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z
        .object({
          resolution: z.string().min(3).max(2000),
          newLocationId: uuid.optional(),
        })
        .strict(),
      body,
    );
    return this.inventory.resolve(
      parse(uuid, id),
      b.resolution,
      b.newLocationId,
      r.user,
    );
  }
  @Get("imports/template") @RequirePermissions("imports.manage") template(
    @Res() res: Response,
  ) {
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("modelo-ativos.xlsx")
      .send(this.imports.template());
  }
  @Post("imports/preview")
  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @ApiBody(fileBody)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 8 * 1024 * 1024,
        files: 1,
        fields: 1,
        parts: 2,
        fieldSize: 100,
      },
    }),
  )
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Req() r: AuthRequest,
    @Body() body: unknown,
  ) {
    if (!file) throw new BadRequestException("Selecione a planilha.");
    const { unitId } = parse(z.object({ unitId: uuid }).strict(), body);
    return this.imports.preview(file.buffer, file.originalname, r.user, unitId);
  }
  @Post("imports/:id/apply") @RequirePermissions("imports.manage") apply(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z
        .object({
          decisions: z
            .array(
              z.object({
                line: z.number().int().min(2),
                action: z.enum(["SKIP", "APPLY"]),
                fields: z
                  .array(
                    z.enum([
                      "patrimony",
                      "description",
                      "group",
                      "uniqueCode",
                      "originUnit",
                      "incorporationDate",
                      "value",
                      "status",
                      "unitId",
                    ]),
                  )
                  .max(9)
                  .optional(),
              }),
            )
            .max(10000),
        })
        .strict(),
      body,
    );
    return this.imports.apply(parse(uuid, id), b.decisions, r.user);
  }
  @Post("assets/:id/photos")
  @RequirePermissions("photos.upload")
  @ApiConsumes("multipart/form-data")
  @ApiBody(fileBody)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  photo(
    @Param("id") id: string,
    @Query("eventId") eventId: string | undefined,
    @Query("uploadId") uploadId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Req() r: AuthRequest,
  ) {
    return this.files.upload(
      parse(uuid, id),
      eventId ? parse(uuid, eventId) : undefined,
      file,
      r.user,
      uploadId ? parse(uuid, uploadId) : undefined,
    );
  }
  @Get("photos/:id") @RequirePermissions("assets.view") async photoGet(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { photo, path } = await this.files.get(parse(uuid, id));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(photo.mimeType).sendFile(path);
  }
  @Get("audit") @RequirePermissions("audit.view") audit() {
    return this.db
      .getRepository(S.MovementSchema)
      .find({ order: { createdAt: "DESC" }, take: 5000 });
  }
  @Get("notifications") @RequirePermissions("settings.manage") notifications() {
    return this.db
      .getRepository(S.OutboxSchema)
      .find({ order: { createdAt: "DESC" }, take: 500 });
  }
  @Post("jobs/run") @RequirePermissions("settings.manage") async jobsRun() {
    const expired = await this.assets.expire();
    return { ...expired, ...(await this.jobs.sendPending()) };
  }
  @Get("reports/:kind/preview")
  @RequirePermissions("reports.export")
  async reportPreview(
    @Param("kind") kind: string,
    @Query() query: Record<string, string>,
  ) {
    const report = await new ReportsService(this.db, this.assets).build(
      kind,
      query,
    );
    return {
      title: report.title,
      columns: report.columns,
      rows: report.rows
        .slice(0, 30)
        .map((row) => row.map((v, c) => displayCell(v, report.columns[c]))),
      count: report.rows.length,
      filters: report.filters,
    };
  }
  @Get("reports/:kind") @RequirePermissions("reports.export") async report(
    @Param("kind") kind: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const report = await new ReportsService(this.db, this.assets).build(
      kind,
      query,
    );
    const format = query.format ?? "csv";
    const mime = {
      csv: "text/csv; charset=utf-8",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ods: "application/vnd.oasis.opendocument.spreadsheet",
    }[format]!;
    res
      .type(mime)
      .attachment(
        `relatorio-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`,
      )
      .send(
        format === "csv"
          ? csvReport(report)
          : workbookReport(report, format as "xlsx" | "ods"),
      );
  }
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "\ufeff";
  const keys = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    let text =
      typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return (
    "\ufeff" +
    [
      keys.map(cell).join(";"),
      ...rows.map((row) => keys.map((k) => cell(row[k])).join(";")),
    ].join("\r\n")
  );
}
