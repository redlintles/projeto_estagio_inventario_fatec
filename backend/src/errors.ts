import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from "@nestjs/common";
import { QueryFailedError } from "typeorm";
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger("API");
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json(error.getResponse());
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (code === "23505")
        return res
          .status(409)
          .json({ message: "Patrimônio, código ou registro já existente." });
      if (code === "23503" || code === "23514")
        return res.status(400).json({
          message: "Dados incompatíveis com os cadastros ou regras existentes.",
        });
    }
    this.logger.error(error instanceof Error ? error.stack : "Erro interno");
    return res
      .status(500)
      .json({ message: "Falha interna. Consulte o administrador." });
  }
}
