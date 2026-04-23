// Demo data to populate v1.1 dashboard placeholder zones while real APIs
// (orders, ads, live events) are not yet integrated. Every value here is
// surfaced in UI with a visible "演示" tag.

export const DEMO_KPIS = {
  gmvCents: 123456700,        // $1,234,567.00
  orderCount: 23456,
  netProfitCents: 12345600,   // $123,456.00
  grossProfitCents: 23456700, // $234,567.00
  grossMarginPct: 18.98,
  adSpendCents: 4567800,      // $45,678.00
  roas: 4.32,
};

// 7-day series for GMV / order overlays (most recent last)
export const DEMO_GMV_SERIES_USD = [68500, 54200, 61800, 71200, 66900, 83400, 82100];
export const DEMO_ORDER_SERIES = [2900, 2400, 2700, 3100, 2950, 3600, 3520];

// Platform GMV fill-in (USD) — applied when real backend returns 0 for non-Temu
export const DEMO_PLATFORM_GMV_USD: Record<string, number> = {
  tiktok: 456789,
  mercadolibre: 189234,
  shopee: 178901,
  amazon: 175076,
};

// Ad performance — 7-day series (most recent last)
export const DEMO_AD_DATES = ['05-13', '05-14', '05-15', '05-16', '05-17', '05-18', '05-19'];
export const DEMO_AD_ROAS   = [4.2, 4.1, 4.5, 4.3, 4.4, 4.6, 4.32];
export const DEMO_AD_ACOS   = [23.8, 24.4, 22.2, 23.3, 22.7, 21.8, 23.1];
export const DEMO_AD_TACOS  = [8.4, 8.7, 8.1, 8.2, 8.0, 7.8, 8.3];
export const DEMO_AD_CTR    = [2.45, 2.38, 2.52, 2.48, 2.55, 2.61, 2.45];

// Order conversion funnel (7-day cumulative)
export const DEMO_FUNNEL = [
  { name: '曝光',   value: 2456789 },
  { name: '点击',   value: 60345 },
  { name: '加购',   value: 18765 },
  { name: '下单',   value: 9876 },
  { name: '支付',   value: 6543 },
];

// Live activity feed — generated each mount with relative times
export interface DemoActivity {
  platform: string;
  event: string;
  skuTitle: string;
  shopName: string;
  amount: string;  // already formatted "$29.99"
  minutesAgo: number;
}
export const DEMO_LIVE_ACTIVITY: DemoActivity[] = [
  { platform: 'TikTok Shop',  event: '新订单', shopName: 'PowerNest',  skuTitle: '便携式迷你充电宝',     amount: '$29.99', minutesAgo: 2 },
  { platform: 'Amazon',       event: '新订单', shopName: 'MiniVolt',   skuTitle: '20000mAh 快充充电宝', amount: '$39.99', minutesAgo: 3 },
  { platform: 'Shopee',       event: '新订单', shopName: 'Lushina',    skuTitle: '蓝牙耳机',            amount: '$18.90', minutesAgo: 5 },
  { platform: 'MercadoLibre', event: '新订单', shopName: 'Novessy',    skuTitle: '电动牙刷',            amount: '$24.50', minutesAgo: 6 },
  { platform: 'Temu',         event: '新订单', shopName: 'PowerNest',  skuTitle: 'LED 化妆镜',           amount: '$22.80', minutesAgo: 8 },
];

// Demo shop rank — used to pad real shopRanking list when backend returns < 6 rows
export interface DemoShop {
  shopName: string;
  gmvUsd: number;
  changePct: number;
}
export const DEMO_SHOPS: DemoShop[] = [
  { shopName: 'PowerNest', gmvUsd: 345678, changePct: 15.23 },
  { shopName: 'MiniVolt',  gmvUsd: 234567, changePct: 10.45 },
  { shopName: 'Lushina',   gmvUsd: 198765, changePct: 8.76 },
  { shopName: 'Velbella',  gmvUsd: 156789, changePct: -2.34 },
  { shopName: 'Novessy',   gmvUsd: 123456, changePct: -1.23 },
  { shopName: 'Seloro',    gmvUsd: 98765,  changePct: 3.45 },
];

// Demo product rows — used to pad ProductDetailTable when real data is sparse
export interface DemoProduct {
  spuId: string;
  skuTitle: string;
  shopName: string;
  platform: string;
  region: string;
  gmvUsd: number;
  orderCount: number;
  grossProfitUsd: number;
  grossMarginPct: number;
  roas: number;
}
export const DEMO_PRODUCTS: DemoProduct[] = [
  { spuId: 'SPU1001', skuTitle: '便携式迷你充电宝',    shopName: 'PowerNest', platform: 'TikTok',      region: '美国',   gmvUsd: 45678, orderCount: 1234, grossProfitUsd: 10234, grossMarginPct: 22.45, roas: 4.32 },
  { spuId: 'SPU1002', skuTitle: '20000mAh 快充充电宝', shopName: 'MiniVolt',  platform: 'Amazon',      region: '美国',   gmvUsd: 38901, orderCount:  987, grossProfitUsd:  7845, grossMarginPct: 20.12, roas: 4.01 },
  { spuId: 'SPU1003', skuTitle: '无线蓝牙耳机',         shopName: 'Lushina',   platform: 'Shopee',      region: '东南亚', gmvUsd: 32456, orderCount:  876, grossProfitUsd:  6089, grossMarginPct: 18.76, roas: 3.85 },
  { spuId: 'SPU1004', skuTitle: 'LED 化妆镜',           shopName: 'Velbella',  platform: 'Temu',        region: '欧洲',   gmvUsd: 28765, orderCount:  765, grossProfitUsd:  7001, grossMarginPct: 24.33, roas: 4.75 },
  { spuId: 'SPU1005', skuTitle: '电动牙刷(声波)',       shopName: 'Novessy',   platform: 'MercadoLibre', region: '巴西', gmvUsd: 24567, orderCount:  654, grossProfitUsd:  4392, grossMarginPct: 17.89, roas: 3.12 },
];
