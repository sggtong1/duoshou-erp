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

  // CORS_ORIGIN 支持逗号分隔多 origin + chrome-extension://* 通配
  // 例：http://localhost:5173,http://localhost:5180,http://mac-mini:5180,chrome-extension://*
  const allowed = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  const allowChromeExt = allowed.includes('chrome-extension://*');
  app.enableCors({
    origin(reqOrigin, cb) {
      // 同源 / 无 origin（如 server-to-server 或 curl）一律放行
      if (!reqOrigin) return cb(null, true);
      if (allowed.includes(reqOrigin)) return cb(null, true);
      if (allowChromeExt && reqOrigin.startsWith('chrome-extension://')) return cb(null, true);
      cb(new Error(`CORS: origin ${reqOrigin} not allowed`), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  await app.listen(env.PORT);
  console.log(`API listening on :${env.PORT} (env=${env.NODE_ENV})`);
}
bootstrap();
