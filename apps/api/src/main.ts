import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
  await app.listen(env.PORT);
  console.log(`API listening on :${env.PORT} (env=${env.NODE_ENV})`);
}
bootstrap();
