import { describe, it, expect } from 'vitest';
import { sign } from '../src/signing';

describe('sign', () => {
  it('produces 32-char uppercase hex MD5', () => {
    const result = sign({ a: '1' }, 'secret');
    expect(result).toMatch(/^[A-F0-9]{32}$/);
  });

  it('is deterministic for same input', () => {
    const params = { type: 'bg.goods.add', app_key: 'k', timestamp: '1700000000' };
    const s1 = sign(params, 'secret');
    const s2 = sign(params, 'secret');
    expect(s1).toBe(s2);
  });

  it('ignores empty/null/undefined values', () => {
    const base = { a: '1', b: '2' };
    const withEmpties = { ...base, c: '', d: null as any, e: undefined as any };
    expect(sign(base, 's')).toBe(sign(withEmpties, 's'));
  });

  it('ignores sign key if present in input', () => {
    const base = { a: '1', b: '2' };
    const withSign = { ...base, sign: 'ANY_OLD_VALUE' };
    expect(sign(base, 's')).toBe(sign(withSign, 's'));
  });

  it('sorts keys alphabetically', () => {
    // Different key order → same signature
    const s1 = sign({ b: '2', a: '1' }, 's');
    const s2 = sign({ a: '1', b: '2' }, 's');
    expect(s1).toBe(s2);
  });

  it('produces different signatures for different secrets', () => {
    expect(sign({ a: '1' }, 'sec1')).not.toBe(sign({ a: '1' }, 'sec2'));
  });

  it('regression-locks known output for fixed input', () => {
    // Locked value — update only if the algorithm intentionally changes.
    const params = { zebra: '1', apple: '2' };
    const result = sign(params, 's');
    const expected = '35600EDD53615FA773EE86B752F7148F'; // MD5('sapple2zebra1s')
    expect(result).toBe(expected);
  });

  it('JSON-stringifies object values', () => {
    // When a param is an object (e.g., data field), it should be stringified
    const withObj = { data: { nested: { a: 1 } } };
    const withStr = { data: JSON.stringify({ nested: { a: 1 } }) };
    expect(sign(withObj, 's')).toBe(sign(withStr, 's'));
  });

  it('matches Temu-documented example', () => {
    // From docs/references/temu/192__开发者文档_开发指南_签名规则.md
    // The doc shows a concrete pre-MD5 string and expected MD5 output BA49C39EFE53461582CC779CDA2ADB3E
    // Input (sorted by key, ASCII order):
    //   access_token = 1zz6vlvwq1kulyyyybkdy0bfwnlrgfls8e4ssefhxpanh1mltyodjacc
    //   app_key      = 47bb4bb7769e12d9f7aa93cf029fe529
    //   data_type    = JSON
    //   joinInfoList = [{"deliveryAddressType":1,"subPurchaseOrderSn":"WB2411113267800"}]
    //   timestamp    = 1739688901
    //   type         = bg.shiporder.staging.add
    //   app_secret   = ac0a3e952eaaa5b19c0e615c2ef497f50afa6e49
    const params = {
      access_token: '1zz6vlvwq1kulyyyybkdy0bfwnlrgfls8e4ssefhxpanh1mltyodjacc',
      app_key: '47bb4bb7769e12d9f7aa93cf029fe529',
      data_type: 'JSON',
      joinInfoList: [{ deliveryAddressType: 1, subPurchaseOrderSn: 'WB2411113267800' }],
      timestamp: '1739688901',
      type: 'bg.shiporder.staging.add',
    };
    const appSecret = 'ac0a3e952eaaa5b19c0e615c2ef497f50afa6e49';
    expect(sign(params, appSecret)).toBe('BA49C39EFE53461582CC779CDA2ADB3E');
  });

  it('matches hand-computed value for simple input', () => {
    // sandwich: "sa1s" → MD5 = 585B98956D9738EDEC5CBD8443F7A228
    const expected = '585B98956D9738EDEC5CBD8443F7A228';
    expect(sign({ a: '1' }, 's')).toBe(expected);
  });
});
