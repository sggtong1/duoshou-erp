import { config as loadDotenv } from 'dotenv';
import crypto from 'node:crypto';

loadDotenv({ path: '.env.development' });

const APP_KEY = process.env.TEMU_FULL_TEST_1_APP_KEY;
const APP_SECRET = process.env.TEMU_FULL_TEST_1_APP_SECRET;
const ACCESS_TOKEN = process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN;
const SHOP_ID = process.env.TEMU_FULL_TEST_1_SHOP_ID;

const GATEWAYS = {
  cn: 'https://openapi.kuajingmaihuo.com',
  pa: 'https://openapi-b-partner.temu.com',
};

function sign(params, secret) {
  const pairs = Object.entries(params)
    .filter(([k, v]) => k !== 'sign' && v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const joined = pairs.map(([k, v]) => `${k}${v}`).join('');
  return crypto.createHash('md5').update(secret + joined + secret, 'utf8').digest('hex').toUpperCase();
}

async function call(region, interfaceType, extraParams = {}) {
  const body = {
    type: interfaceType,
    app_key: APP_KEY,
    access_token: ACCESS_TOKEN,
    data_type: 'JSON',
    timestamp: String(Math.floor(Date.now() / 1000)),
    version: 'V1',
    ...extraParams,
  };
  body.sign = sign(body, APP_SECRET);
  const r = await fetch(GATEWAYS[region] + '/openapi/router', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return { httpStatus: r.status, ...j };
}

console.log('=== Temu token scope diagnostic ===');
console.log('shop_id:', SHOP_ID, 'app_key:', APP_KEY.slice(0, 10) + '...');

// 1. Check token info on both gateways
for (const region of ['cn', 'pa']) {
  const iface = region === 'pa' ? 'bg.open.accesstoken.info.get.global' : 'bg.open.accesstoken.info.get';
  console.log(`\n[${region}] ${iface}`);
  try {
    const r = await call(region, iface);
    console.log('  success:', r.success, 'errorCode:', r.errorCode, 'errorMsg:', r.errorMsg);
    if (r.success && r.result) {
      const api = r.result.apiList ?? r.result.apiInfoList ?? r.result.authorizedApiList ?? [];
      console.log('  shop/mall id:', r.result.mallId ?? r.result.shopId ?? r.result.uniqueId ?? '(not shown)');
      console.log('  authorized apis count:', Array.isArray(api) ? api.length : 'n/a');
      if (Array.isArray(api)) {
        const goodsApis = api.filter((x) => {
          const name = typeof x === 'string' ? x : (x.apiName ?? x.interfaceType ?? x.type ?? '');
          return name && /goods|glo.goods/.test(name);
        });
        console.log('  goods-related apis:');
        for (const x of goodsApis.slice(0, 20)) {
          console.log('    -', typeof x === 'string' ? x : JSON.stringify(x));
        }
      } else {
        console.log('  raw result keys:', Object.keys(r.result || {}));
        console.log('  raw result:', JSON.stringify(r.result).slice(0, 500));
      }
    }
  } catch (e) {
    console.log('  ERR:', e.message);
  }
}

// 2. Check bg.mall.info.get (already worked on cn during W0 — re-verify)
console.log('\n[cn] bg.mall.info.get (control — should work)');
console.log(' ', JSON.stringify(await call('cn', 'bg.mall.info.get')));

// 3. Try bg.goods.add on CN with minimal (will almost certainly fail but tells us the error mode)
console.log('\n[cn] bg.goods.add (expect 7000016 or validation error)');
const cnAdd = await call('cn', 'bg.goods.add', { productName: 'diag-probe' });
console.log('  errorCode:', cnAdd.errorCode, 'errorMsg:', cnAdd.errorMsg);

// 4. Try bg.glo.goods.add on PA
console.log('\n[pa] bg.glo.goods.add (expect 7000016 or validation error)');
const paAdd = await call('pa', 'bg.glo.goods.add', { productName: 'diag-probe' });
console.log('  errorCode:', paAdd.errorCode, 'errorMsg:', paAdd.errorMsg);

// 5. Try bg.goods.cats.get on both (category read) — we already know cn version returned categoryDTOList earlier
console.log('\n[cn] bg.goods.cats.get (already confirmed working earlier)');
const cnCats = await call('cn', 'bg.goods.cats.get', { parentCatId: 0 });
console.log('  errorCode:', cnCats.errorCode, 'has result:', !!cnCats.result);

console.log('\n=== diagnostic complete ===');
