import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTemuApi, TemuApiError, type TemuCallContext, type TemuMethodSpec } from '../src/http-client';

describe('callTemuApi', () => {
  const ctx: TemuCallContext = {
    appKey: 'testkey',
    appSecret: 'testsecret',
    accessToken: 'testtoken',
    region: 'cn',
    shopId: '1',
  };
  const spec: TemuMethodSpec = {
    interfaceType: 'bg.mall.info.get',
    region: 'cn',
    requestUrl: '/openapi/router',
  };

  beforeEach(() => vi.restoreAllMocks());

  it('sends POST with signed body to correct gateway', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: { mallType: 'full' } })) as any,
    );
    await callTemuApi(ctx, spec, { foo: 'bar' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\//);  // gateway URL
    expect(url).toMatch(/\/openapi\/router$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe('bg.mall.info.get');
    expect(body.app_key).toBe('testkey');
    expect(body.access_token).toBe('testtoken');
    expect(body.data_type).toBe('JSON');
    expect(body.foo).toBe('bar');
    expect(body.sign).toMatch(/^[A-F0-9]{32}$/);
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns result on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: { x: 1 } })) as any,
    );
    const res = await callTemuApi<{}, { x: number }>(ctx, spec, {});
    expect(res.x).toBe(1);
  });

  it('throws TemuApiError on success:false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errorCode: 7000007, errorMsg: 'token expired' })) as any,
    );
    await expect(callTemuApi(ctx, spec, {})).rejects.toThrow(/7000007/);
  });

  it('retries on network error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: {} })) as any);
    await callTemuApi(ctx, spec, {});
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 7000005 (permission denied)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errorCode: 7000005 })) as any,
    );
    await expect(callTemuApi(ctx, spec, {})).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses PA gateway when region is pa', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: {} })) as any,
    );
    await callTemuApi({ ...ctx, region: 'pa' }, { ...spec, region: 'pa' }, {});
    const [url] = fetchMock.mock.calls[0] as [string];
    // The PA gateway should be different from CN gateway
    expect(url).not.toMatch(/kuajingmaihuo/);
  });
});
