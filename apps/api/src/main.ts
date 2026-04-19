import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

// Load .env.<NODE_ENV> (defaults to .env.development in dev).
// Must run before loadEnv() / any NestJS module constructor.
loadDotenv({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
  await app.listen(env.PORT);
  console.log(`API listening on :${env.PORT} (env=${env.NODE_ENV})`);
}
bootstrap();
