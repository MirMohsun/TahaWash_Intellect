import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // CORS configured below from CORS_ORIGINS env var.
    cors: false,
    bodyParser: true,
  });

  // CORS — env-driven allowlist. CORS_ORIGINS in env.schema.ts is parsed
  // from a comma-separated string into an array of origins. In dev we
  // default to the local Vite dev server URLs; in prod we set this to the
  // deployed admin domain(s) explicitly.
  const config = app.get(ConfigService<Env, true>);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Admin-Surface',
      'X-App-Version',
      'X-App-Platform',
    ],
    exposedHeaders: ['X-Row-Count', 'X-Capped'],
  });

  // Bind to 0.0.0.0 so Railway's container networking can reach the port.
  // (NestJS defaults to 127.0.0.1, which is loopback-only inside the container.)

  // Global request validation (powered by class-validator + zod schemas inline)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // OpenAPI / Swagger docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tahawash API')
    .setDescription('Backend API for the Tahawash self-service carwash platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('PORT', { infer: true });
  const env = config.get('NODE_ENV', { infer: true });

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[Tahawash backend] Listening on http://localhost:${port} (${env})`);
  // eslint-disable-next-line no-console
  console.log(`[Tahawash backend] API docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[Tahawash backend] Failed to start:', err);
  process.exit(1);
});
