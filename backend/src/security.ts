import { INestApplication } from "@nestjs/common";
import { Request, Response, NextFunction, json, urlencoded } from "express";
export function secureHttp(app: INestApplication) {
  const server = app.getHttpAdapter().getInstance();
  server.disable("x-powered-by");
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      process.env.ENABLE_API_DOCS === "true" && req.path.startsWith("/api/docs")
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"
        : "default-src 'none'; frame-ancestors 'none'",
    );
    // Do not trust X-Forwarded-For for login limits; direct sockets are authoritative.
    next();
  });
  app.use(json({ limit: "3mb" }));
  app.use(urlencoded({ extended: false, limit: "32kb" }));
  // O parser roda antes das rotas; trate seu erro aqui para não devolver o texto recebido.
  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      const errorType = (error as { type?: string })?.type;
      if (errorType === "entity.parse.failed")
        return response
          .status(400)
          .json({ message: "JSON inválido. Confira os dados enviados." });
      if (errorType === "entity.too.large")
        return response
          .status(413)
          .json({ message: "Corpo da requisição excede o limite." });
      next(error);
    },
  );
}
