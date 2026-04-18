import crypto from 'node:crypto';

/**
 * Temu API request signing.
 *
 * Algorithm (per official Temu developer docs 签名规则):
 *   1. Drop `sign` key, undefined/null/empty-string values
 *   2. Sort remaining keys alphabetically (ASCII/lexicographic order)
 *   3. Concat: key1value1key2value2... (no separators)
 *   4. Sandwich: app_secret + concat + app_secret
 *   5. MD5, 32-char uppercase hex
 *
 * Non-string values are JSON.stringify'd before concatenation.
 * Only outer-layer keys are sorted; inner objects are stringified as-is.
 */
export function sign(params: Record<string, unknown>, appSecret: string): string {
  const pairs: Array<[string, string]> = [];

  for (const [k, v] of Object.entries(params)) {
    if (k === 'sign') continue;
    if (v === undefined || v === null) continue;
    const str = typeof v === 'string' ? v : JSON.stringify(v);
    if (str === '') continue;
    pairs.push([k, str]);
  }

  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const joined = pairs.map(([k, v]) => `${k}${v}`).join('');
  const payload = `${appSecret}${joined}${appSecret}`;

  return crypto.createHash('md5').update(payload, 'utf8').digest('hex').toUpperCase();
}
