import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

import type { IncomingMessage } from 'http';
// Serialise Prisma Decimals as JSON numbers (amounts are < 2^53 with 2 dp).
(Prisma.Decimal.prototype as unknown as { toJSON(this: Prisma.Decimal): number }).toJSON = function (this: Prisma.Decimal) {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // selfie data-URLs and CSV imports; keep the raw bytes for webhook signature checks
  app.use(json({ limit: '6mb', verify: (req: IncomingMessage & { rawBody?: Buffer }, _res, buf) => { req.rawBody = buf; } }));

  const origins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], exposedHeaders: ['Content-Disposition'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('JantaHR API').setDescription('India-first HRMS').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT || 3002);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}${process.env.NODE_ENV !== 'production' ? ` (docs at /docs)` : ''}`);
}
bootstrap();
