import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from "@nestjs/common";
import { finalize } from "rxjs";

let activeOperations = 0;
const MAX_ACTIVE_OPERATIONS = 2;

@Injectable()
export class ResourceLimitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    // Planilhas, fotos e relatórios dividem a memória da mesma máquina.
    if (activeOperations >= MAX_ACTIVE_OPERATIONS) {
      context.switchToHttp().getResponse().setHeader("Retry-After", "15");
      throw new ServiceUnavailableException(
        "O servidor está processando arquivos. Aguarde alguns segundos e tente novamente.",
      );
    }
    activeOperations++;
    try {
      return next.handle().pipe(finalize(() => activeOperations--));
    } catch (error) {
      activeOperations--;
      throw error;
    }
  }
}
