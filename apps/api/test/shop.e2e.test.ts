import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import crypto from 'node:crypto';
import { AppModule } from '../src/app.module';

const RUN = !!process.env.TEMU_FULL_TEST_1_APP_KEY && !!process.env.DATABASE_URL?.startsWith('postgresql://');

describe.skipIf(!RUN)('Shop connect E2E (requires Temu test creds + real DB)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.CREDS_ENCRYPTION_KEY ??= crypto.randomBytes(32).toString('base64');
    process.env.SUPABASE_URL ??= 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY ??= 'x';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'x';
    process.env.DEV_ORG_ID = crypto.randomUUID();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it('POST /api/shops returns shop with platformShopId=1052202882', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/shops')
      .send({
        appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
        appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
        accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
        shopType: 'full',
        region: 'cn',
        displayName: 'girl clothes smoke test',
      });
    expect(res.status).toBe(201);
    expect(res.body.platformShopId).toBe('1052202882');
  }, 30000);
});
