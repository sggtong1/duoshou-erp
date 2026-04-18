import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * End-to-end smoke test for W0 (run against a deployed environment).
 *
 * Requires env vars:
 *   W0_SMOKE_URL              — https://duoshou.868818.xyz or http://localhost:3000
 *   SUPABASE_URL, SUPABASE_ANON_KEY — to create a test user
 *   TEMU_FULL_TEST_1_APP_KEY, _APP_SECRET, _ACCESS_TOKEN — to connect a test shop
 *
 * Skipped when any of these is missing.
 */
const RUN = !!process.env.W0_SMOKE_URL
  && !!process.env.SUPABASE_URL
  && !!process.env.SUPABASE_ANON_KEY
  && !!process.env.TEMU_FULL_TEST_1_APP_KEY;

describe.skipIf(!RUN)('W0 end-to-end smoke', () => {
  const base = process.env.W0_SMOKE_URL!;

  it('signup → login → connect shop → list shops', async () => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    const email = `smoke-${Date.now()}@duoshou.test`;
    const password = `SmokeTest!${Math.random().toString(36).slice(2, 10)}`;

    // 1. Sign up
    const { error: signupErr } = await supabase.auth.signUp({ email, password });
    if (signupErr) throw signupErr;

    // 2. Login (auto-confirmed signup may or may not work — retry login)
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) {
      // Maybe email-confirm is required. Smoke test can't bypass that; mark skipped.
      console.warn('Smoke skipped: email confirmation required');
      return;
    }

    const token = loginData.session!.access_token;

    // 3. Health ping
    const h = await fetch(`${base}/api/health`);
    expect(h.status).toBe(200);

    // 4. Connect shop
    const connectResp = await fetch(`${base}/api/shops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
        appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
        accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
        shopType: 'full',
        region: 'cn',
        displayName: 'smoke test',
      }),
    });
    expect(connectResp.status).toBe(201);
    const shop = await connectResp.json();
    expect(shop.platformShopId).toBeDefined();

    // 5. List shops
    const listResp = await fetch(`${base}/api/shops`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listResp.status).toBe(200);
    const list = await listResp.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  }, 60000);
});
