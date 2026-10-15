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
    if ((error as { type?: string })?.type === "entity.too.large")
      return res
        .status(413)
        .json({ message: "Corpo da requisição excede o limite." });
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json(error.getResponse());
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (["55P03", "40P01", "40001"].includes(code ?? ""))
        return res
          .status(409)
          .json({
            message:
              "Registros em uso por outra operação. Atualize os dados e tente novamente.",
          });
      if (code === "23505")
        return res
          .status(409)
          .json({ message: "Patrimônio, código ou registro já existente." });
      if (code === "23503" || code === "23514")
        return res.status(400).json({
          message: "Dados incompatíveis com os cadastros ou regras existentes.",
        });
    }
    this.logger.error(
      error instanceof QueryFailedError
        ? "Falha de persistência (detalhes omitidos)."
        : "Falha interna (detalhes omitidos).",
    );
    return res
      .status(500)
      .json({ message: "Falha interna. Consulte o administrador." });
  }
}
