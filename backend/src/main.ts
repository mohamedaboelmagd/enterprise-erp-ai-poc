import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { DomainExceptionFilter } from "./http/domain.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(helmet());
  app.use((req: { headers: Record<string, string | undefined> }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const id = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("x-request-id", id);
    next();
  });
  app.useGlobalFilters(new DomainExceptionFilter());

  const docs = new DocumentBuilder()
    .setTitle("Enterprise ERP API")
    .setDescription(
      "Self-hosted multi-tenant ERP: finance (invoices and approvals), HR (leave), procurement (purchase orders), an append-only audit log, and a pluggable AI assistant. All sample names in the seed data are fictional.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, docs));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
