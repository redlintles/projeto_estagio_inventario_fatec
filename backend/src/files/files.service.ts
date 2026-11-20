import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import * as S from "../persistence/schemas";
import sharp from "sharp";
import { basename } from "node:path";
import { Actor } from "../auth/auth";
import { AssetsService } from "../assets/assets.service";
const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");
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
    let content: Buffer, jpeg: boolean;
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 16000000,
        failOn: "warning",
      });
      const meta = await image.metadata();
      if (
        !["jpeg", "png"].includes(meta.format ?? "") ||
        (meta.pages ?? 1) !== 1
      )
        throw new Error();
      jpeg = meta.format === "jpeg";
      // Decode/re-encode to reject fake headers and strip EXIF/location and embedded payloads.
      content = await (
        jpeg ? image.rotate().jpeg({ quality: 90 }) : image.rotate().png()
      ).toBuffer();
    } catch {
      throw new BadRequestException(
        "Use uma foto JPEG ou PNG válida com até 16 megapixels.",
      );
    }
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
          if (sha256(stored) !== sha256(content))
            throw new ConflictException(
              "Identificador de foto usado com outro conteúdo.",
            );
          return existing;
        }
        if (asset.status === "X")
          throw new ConflictException("Ativo baixado é somente histórico.");
        // Impede anexar a mesma imagem duas vezes ao mesmo ativo. O conteúdo é
        // comparado após a re-codificação, que é determinística para o mesmo arquivo.
        const duplicate = await this.findSameContent(m, assetId, content);
        if (duplicate) {
          // Reenvio do app (com uploadId) é tratado como idempotente para não
          // travar a fila de sincronização; no painel web o usuário é avisado.
          if (uploadId) return duplicate;
          throw new ConflictException(
            `Esta foto já está anexada a este ativo (${duplicate.originalName}).`,
          );
        }
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
        await writeFile(writtenPath, content, { mode: 0o600 });
        const photo = {
          id,
          assetId,
          eventId: eventId ?? null,
          filename,
          mimeType: jpeg ? "image/jpeg" : "image/png",
          originalName: basename(file.originalname)
            .replace(/[\x00-\x1f]/g, "")
            .slice(0, 150),
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
          `Foto adicionada: ${photo.originalName}`,
        );
        return photo;
      });
    } catch (error) {
      if (writtenPath) await unlink(writtenPath).catch(() => undefined);
      throw error;
    }
  }
  private async findSameContent(
    m: EntityManager,
    assetId: string,
    content: Buffer,
  ) {
    const digest = sha256(content);
    const photos = await m.getRepository(S.PhotoSchema).findBy({ assetId });
    for (const photo of photos) {
      const stored = await readFile(resolve(this.root(), photo.filename)).catch(
        () => null,
      );
      if (
        stored &&
        stored.length === content.length &&
        sha256(stored) === digest
      )
        return photo;
    }
    return null;
  }
  async remove(id: string, actor: Actor) {
    const reference = await this.db
      .getRepository(S.PhotoSchema)
      .findOneBy({ id });
    if (!reference) throw new NotFoundException("Foto não encontrada.");
    const removed = await this.db.transaction(async (m) => {
      const asset = await this.assets.locked(m, reference.assetId);
      const photo = await m.getRepository(S.PhotoSchema).findOneBy({ id });
      if (!photo) throw new NotFoundException("Foto não encontrada.");
      if (asset.status === "X")
        throw new ConflictException("Ativo baixado é somente histórico.");
      // A disponibilização exige foto: depois dela, o ativo não pode ficar sem nenhuma.
      if (
        !["I", "A"].includes(asset.status) &&
        (await m.getRepository(S.PhotoSchema).countBy({ assetId: asset.id })) <=
          1
      )
        throw new ConflictException(
          "Este ativo já foi disponibilizado e precisa manter ao menos uma foto. Envie a foto correta antes de excluir esta.",
        );
      await m.getRepository(S.PhotoSchema).delete({ id });
      await this.assets.audit(
        m,
        asset,
        { ...asset },
        "PHOTO_DELETE",
        actor,
        `Foto removida: ${photo.originalName}`,
      );
      return photo;
    });
    // O arquivo só é apagado depois do commit, para não perder a imagem se a transação falhar.
    await unlink(resolve(this.root(), removed.filename)).catch(() => undefined);
    return { id: removed.id, removed: true };
  }
  async get(id: string) {
    const photo = await this.db.getRepository(S.PhotoSchema).findOneBy({ id });
    if (!photo) throw new NotFoundException();
    return { photo, path: resolve(this.root(), photo.filename) };
  }
}
