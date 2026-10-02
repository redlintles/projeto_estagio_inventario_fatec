import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { jwtSecret } from "./auth/auth";
async function main() {
  jwtSecret();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:5173").split(","),
  });
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle("Gestão Patrimonial Fatec")
    .setDescription(
      "Contrato da API. Exemplos de payloads e regras em docs/api.md.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, config),
  );
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
}
void main();
