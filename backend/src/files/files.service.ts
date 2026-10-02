import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import * as S from "../persistence/schemas";
import { Actor } from "../auth/auth";
import { AssetsService } from "../assets/assets.service";
@Injectable()
export class FilesService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AssetsService) private readonly assets: AssetsService,
  ) {}
  root() {
    return resolve(process.env.UPLOAD_DIR ?? "./uploads");
  }
  async upload(
    assetId: string,
    eventId: string | undefined,
    file: Express.Multer.File,
    actor: Actor,
    uploadId?: string,
  ) {
    if (!file || file.size > 8 * 1024 * 1024)
      throw new BadRequestException("Foto ausente ou maior que 8 MB.");
    const jpeg =
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff;
    const png = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!jpeg && !png)
      throw new BadRequestException("Use uma imagem JPEG ou PNG.");
    let writtenPath: string | undefined;
    try {
      return await this.db.transaction(async (m) => {
        const asset = await this.assets.locked(m, assetId);
        const id = uploadId ?? randomUUID();
        const existing = await m.getRepository(S.PhotoSchema).findOneBy({ id });
        if (existing) {
          if (
            existing.assetId !== assetId ||
            existing.userId !== actor.id ||
            existing.eventId !== (eventId ?? null)
          )
            throw new ConflictException("Identificador de foto já utilizado.");
          const stored = await readFile(
            resolve(this.root(), existing.filename),
          );
          const hash = (buffer: Buffer) =>
            createHash("sha256").update(buffer).digest("hex");
          if (hash(stored) !== hash(file.buffer))
            throw new ConflictException(
              "Identificador de foto usado com outro conteúdo.",
            );
          return existing;
        }
        if (asset.status === "X")
          throw new ConflictException("Ativo baixado é somente histórico.");
        if (
          eventId &&
          !(await m
            .getRepository(S.DivergenceSchema)
            .findOneBy({ id: eventId, assetId }))
        )
          throw new BadRequestException("Evento não pertence ao ativo.");
        const filename = `${randomUUID()}.${jpeg ? "jpg" : "png"}`;
        await mkdir(this.root(), { recursive: true });
        writtenPath = resolve(this.root(), filename);
        await writeFile(writtenPath, file.buffer);
        const photo = {
          id,
          assetId,
          eventId: eventId ?? null,
          filename,
          mimeType: jpeg ? "image/jpeg" : "image/png",
          originalName: file.originalname,
          userId: actor.id,
          createdAt: new Date(),
        };
        await m.getRepository(S.PhotoSchema).save(photo);
        await this.assets.audit(
          m,
          asset,
          { ...asset },
          "PHOTO",
          actor,
          `Foto ${id}`,
        );
        return photo;
      });
    } catch (error) {
      if (writtenPath) await unlink(writtenPath).catch(() => undefined);
      throw error;
    }
  }
  async get(id: string) {
    const photo = await this.db.getRepository(S.PhotoSchema).findOneBy({ id });
    if (!photo) throw new NotFoundException();
    return { photo, path: resolve(this.root(), photo.filename) };
  }
}
