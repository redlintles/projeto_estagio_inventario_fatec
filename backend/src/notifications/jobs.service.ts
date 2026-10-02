import { Inject } from "@nestjs/common";
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import nodemailer from "nodemailer";
import { resolve } from "node:path";
import * as S from "../persistence/schemas";
import { AssetsService } from "../assets/assets.service";
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private logger = new Logger("Jobs");
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AssetsService) private readonly assets: AssetsService,
  ) {}
  onModuleInit() {
    if (process.env.JOBS_ENABLED === "false") return;
    this.timer = setInterval(() => void this.tick(), 60000);
    void this.tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.assets.expire();
      await this.sendPending();
    } catch (e) {
      this.logger.error(
        e instanceof Error ? e.message : "Erro nas tarefas periódicas",
      );
    } finally {
      this.running = false;
    }
  }
  async sendPending() {
    if (!process.env.SMTP_HOST) return { sent: 0 };
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    let sent = 0;
    // SKIP LOCKED impede duas instâncias de processarem o mesmo e-mail ao mesmo tempo.
    for (let i = 0; i < 50; i++) {
      const handled = await this.db.transaction(async (m) => {
        const item = await m
          .getRepository(S.OutboxSchema)
          .createQueryBuilder("o")
          .where("o.status = :status", { status: "PENDING" })
          .orderBy("o.createdAt")
          .setLock("pessimistic_write")
          .setOnLocked("skip_locked")
          .getOne();
        if (!item) return false;
        const recipient = (
          await m.getRepository(S.SettingSchema).findOneBy({
            name:
              item.kind === "AVAILABLE"
                ? "EMAIL_DISPONIBILIZACAO"
                : "EMAIL_CPS",
          })
        )?.value;
        if (!recipient) return false;
        item.attempts++;
        try {
          const photos = await m
            .getRepository(S.PhotoSchema)
            .findBy({ assetId: item.assetId });
          await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: recipient,
            messageId: `<${item.id}@patrimonio.local>`,
            subject: `Patrimônio ${item.payload.patrimony}: ${item.kind === "AVAILABLE" ? "disponibilizado" : "a baixar"}`,
            text: `Patrimônio: ${item.payload.patrimony}\nDescrição: ${item.payload.description}\nCondição: ${item.payload.condition}/5\nDisponibilizado em: ${item.payload.availableAt}`,
            attachments: photos.map((p) => ({
              filename: p.filename,
              path: resolve(process.env.UPLOAD_DIR ?? "./uploads", p.filename),
            })),
          });
          item.status = "SENT";
          item.sentAt = new Date();
          item.lastError = null;
          sent++;
        } catch (e) {
          item.lastError = e instanceof Error ? e.message : "Falha SMTP";
        }
        await m.getRepository(S.OutboxSchema).save(item);
        return item.status === "SENT";
      });
      if (!handled) break;
    }
    return { sent };
  }
}
