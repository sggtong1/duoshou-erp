import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AppModule } from '../src/app.module';

describe('App E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Satisfy env schema for bootstrap; dummy values OK since we don't hit DB in this test
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/test';
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.CREDS_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
