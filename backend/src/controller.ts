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
  login(@Body() body: unknown) {
    const input = parse(
      z.object({ email: z.email(), password: z.string().min(1).max(128) }),
      body,
    );
    return this.auth.login(input.email, input.password);
  }
  @Get("auth/me") me(@Req() r: AuthRequest) {
    return r.user;
  }
  @Get("dashboard") dashboard() {
    return this.assets.dashboard();
  }
  @Get("assets") list(@Query() query: Record<string, string>) {
    return this.assets.list(query);
  }
  @Get("assets/:id") detail(@Param("id") id: string) {
    return this.assets.detail(parse(uuid, id));
  }
  @Post("assets") @Roles("ADMIN") create(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.assets.create(parse(assetInput, body), r.user);
  }
  @Post("assets/:id/location") @Roles("PATRIMONIAL") locate(
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
  @Post("assets/:id/available") @Roles("PATRIMONIAL") available(
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
  @Post("assets/:id/reservations") @Roles("PATRIMONIAL") reserve(
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
  @Post("reservations/:id/:action") @Roles("PATRIMONIAL") reservation(
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
  @Post("write-offs") @Roles("PATRIMONIAL") writeOff(
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
  @Get("locations") locations() {
    return this.db
      .getRepository(S.LocationSchema)
      .find({ order: { code: "ASC" } });
  }
  @Post("locations") @Roles("ADMIN") location(@Body() body: unknown) {
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
  @Patch("locations/:id") @Roles("ADMIN") updateLocation(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
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
  @Get("units") units() {
    return this.db.getRepository(S.UnitSchema).find({ order: { name: "ASC" } });
  }
  @Post("units") @Roles("ADMIN") unit(@Body() body: unknown) {
    const b = parse(
      z
        .object({
          code: z.string().min(1).max(20),
          name: z.string().min(1).max(255),
          email: z.email(),
        })
        .strict(),
      body,
    );
    return this.db
      .getRepository(S.UnitSchema)
      .save({ id: randomUUID(), ...b, active: true });
  }
  @Patch("units/:id") @Roles("ADMIN") updateUnit(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const b = parse(
      z
        .object({
          name: z.string().min(1).max(255).optional(),
          email: z.email().optional(),
          active: z.boolean().optional(),
        })
        .strict(),
      body,
    );
    return this.db.getRepository(S.UnitSchema).update(parse(uuid, id), b);
  }
  @Get("users") @Roles("ADMIN") users() {
    return this.db.getRepository(S.UserSchema).find({
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }
  @Post("users") @Roles("ADMIN") user(@Body() body: unknown) {
    const b = parse(
      z
        .object({
          name: z.string().min(1).max(100),
          email: z.email(),
          password: z.string().min(12).max(128),
          role: z.enum(["ADMIN", "PATRIMONIAL", "CONSULTA"]),
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
  }) {
    const user = await this.db.getRepository(S.UserSchema).save({
      id: randomUUID(),
      name: b.name,
      email: b.email.toLowerCase(),
      passwordHash: hashPassword(b.password),
      role: b.role,
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
    return this.db.getRepository(S.UserSchema).update(parse(uuid, id), {
      ...fields,
      ...(password ? { passwordHash: hashPassword(password) } : {}),
    });
  }
  @Get("settings") @Roles("ADMIN") settings() {
    return this.db.getRepository(S.SettingSchema).find();
  }
  @Post("settings") @Roles("ADMIN") setting(@Body() body: unknown) {
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
  @Get("inventories") inventories() {
    return this.db
      .getRepository(S.InventorySchema)
      .find({ order: { startedAt: "DESC" }, take: 500 });
  }
  @Post("inventories") @Roles("PATRIMONIAL") start(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(z.object({ locationId: uuid }).strict(), body);
    return this.inventory.start(b.locationId, r.user);
  }
  @Get("inventories/:id") inventoryDetail(@Param("id") id: string) {
    return this.inventory.detail(parse(uuid, id));
  }
  @Post("inventories/:id/scans") @Roles("PATRIMONIAL") scan(
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
  @Post("inventories/:id/close") @Roles("PATRIMONIAL") close(
    @Param("id") id: string,
    @Req() r: AuthRequest,
  ) {
    return this.inventory.close(parse(uuid, id), r.user);
  }
  @Post("sync") @Roles("PATRIMONIAL") sync(
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
  @Get("divergences") divergences(@Query() q: Record<string, string>) {
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
  @Post("divergences/:id/resolve") @Roles("PATRIMONIAL") resolve(
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
  @Get("imports/template") @Roles("ADMIN") template(@Res() res: Response) {
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("modelo-ativos.xlsx")
      .send(this.imports.template());
  }
  @Post("imports/preview")
  @Roles("ADMIN")
  @ApiConsumes("multipart/form-data")
  @ApiBody(fileBody)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  preview(@UploadedFile() file: Express.Multer.File, @Req() r: AuthRequest) {
    if (!file) throw new BadRequestException("Selecione a planilha.");
    return this.imports.preview(file.buffer, file.originalname, r.user);
  }
  @Post("imports/:id/apply") @Roles("ADMIN") apply(
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
                fields: z.array(z.string()).optional(),
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
  @Roles("PATRIMONIAL")
  @ApiConsumes("multipart/form-data")
  @ApiBody(fileBody)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
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
  @Get("photos/:id") async photoGet(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { photo, path } = await this.files.get(parse(uuid, id));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(photo.mimeType).sendFile(path);
  }
  @Get("audit") @Roles("ADMIN") audit() {
    return this.db
      .getRepository(S.MovementSchema)
      .find({ order: { createdAt: "DESC" }, take: 5000 });
  }
  @Get("notifications") @Roles("ADMIN") notifications() {
    return this.db
      .getRepository(S.OutboxSchema)
      .find({ order: { createdAt: "DESC" }, take: 500 });
  }
  @Post("jobs/run") @Roles("ADMIN") async jobsRun() {
    const expired = await this.assets.expire();
    return { ...expired, ...(await this.jobs.sendPending()) };
  }
  @Get("reports/:kind") async report(
    @Param("kind") kind: string,
    @Query("locationId") locationId: string | undefined,
    @Res() res: Response,
  ) {
    let rows: unknown[];
    if (kind === "movements")
      rows = await this.db
        .getRepository(S.MovementSchema)
        .find({ order: { createdAt: "DESC" } });
    else if (kind === "divergences")
      rows = await this.db.getRepository(S.DivergenceSchema).find();
    else if (kind === "inventories")
      rows = await this.db.getRepository(S.InventoryItemSchema).find();
    else {
      const status: Record<string, string> = {
        available: "D",
        transferred: "T",
        writtenOff: "X",
        byLocation: "A",
      };
      if (!status[kind])
        throw new BadRequestException("Relatório inexistente.");
      rows = await this.assets.list(
        {
          status: status[kind],
          ...(locationId ? { locationId: parse(uuid, locationId) } : {}),
        },
        true,
      );
    }
    res
      .type("text/csv; charset=utf-8")
      .attachment(`${kind}.csv`)
      .send(toCsv(rows as Record<string, unknown>[]));
  }
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "\ufeff";
  const keys = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    let text =
      typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
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
