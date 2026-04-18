import { describe, it, expect } from 'vitest';

describe('HomePage sanity', () => {
  it('module imports without errors', async () => {
    const mod = await import('./HomePage.vue');
    expect(mod.default).toBeDefined();
  }, 15000);
});
