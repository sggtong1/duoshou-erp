import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Platform, Region, TimeRange, DashboardSummaryQuery } from '@/api-client/dashboard.api';

const ENABLED_PLATFORMS: Platform[] = ['temu'];
const ENABLED_REGIONS: Region[] = ['cn', 'pa'];
const ENABLED_TIME_RANGES: TimeRange[] = ['today', '7d', '30d'];

type ChangeHandler = () => void;

export const useFiltersStore = defineStore('filters', () => {
  const platform = ref<Platform>('temu');
  const shopIds = ref<string[]>([]);
  const region = ref<Region | null>(null);
  const timeRange = ref<TimeRange>('30d');

  const handlers = new Set<ChangeHandler>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function fire() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      handlers.forEach((h) => h());
    }, 300);
  }

  function setPlatform(v: Platform) {
    if (!ENABLED_PLATFORMS.includes(v)) return;
    platform.value = v;
    fire();
  }
  function setRegion(v: Region | null) {
    if (v !== null && !ENABLED_REGIONS.includes(v)) return;
    region.value = v;
    fire();
  }
  function setShopIds(v: string[]) {
    shopIds.value = v;
    fire();
  }
  function setTimeRange(v: TimeRange) {
    if (!ENABLED_TIME_RANGES.includes(v)) return;
    timeRange.value = v;
    fire();
  }

  function onChange(fn: ChangeHandler) {
    handlers.add(fn);
    return () => handlers.delete(fn);
  }

  function toQuery(): DashboardSummaryQuery {
    const q: DashboardSummaryQuery = { platform: platform.value, timeRange: timeRange.value };
    if (region.value) q.region = region.value;
    if (shopIds.value.length) q.shopIds = [...shopIds.value];
    return q;
  }

  return { platform, shopIds, region, timeRange, setPlatform, setRegion, setShopIds, setTimeRange, onChange, toQuery };
});

export const FILTER_PLATFORMS: ReadonlyArray<{ value: Platform; label: string; disabled: boolean; reason?: string }> = [
  { value: 'tiktok',       label: 'TikTok Shop',   disabled: true,  reason: 'TikTok Shop:接入中,v2 支持' },
  { value: 'temu',         label: 'Temu',          disabled: false },
  { value: 'mercadolibre', label: 'MercadoLibre',  disabled: true,  reason: 'MercadoLibre:接入中,v2 支持' },
  { value: 'shopee',       label: 'Shopee',        disabled: true,  reason: 'Shopee:接入中,v2 支持' },
  { value: 'amazon',       label: 'Amazon',        disabled: true,  reason: 'Amazon:接入中,v2 支持' },
];

export const FILTER_REGIONS: ReadonlyArray<{ value: Region | '__site__'; label: string; disabled: boolean; reason?: string }> = [
  { value: 'cn',       label: '中国仓 (CN)', disabled: false },
  { value: 'pa',       label: '海外仓 (PA)', disabled: false },
  { value: '__site__', label: '美国',        disabled: true, reason: '美国站点:v1.2 支持 siteId 筛选' },
  { value: '__site__', label: '巴西',        disabled: true, reason: '巴西站点:v1.2 支持 siteId 筛选' },
  { value: '__site__', label: '墨西哥',       disabled: true, reason: '墨西哥站点:v1.2 支持 siteId 筛选' },
  { value: '__site__', label: '东南亚',       disabled: true, reason: '东南亚站点:v1.2 支持 siteId 筛选' },
  { value: '__site__', label: '欧洲',        disabled: true, reason: '欧洲站点:v1.2 支持 siteId 筛选' },
];

export const FILTER_TIME_RANGES: ReadonlyArray<{ value: TimeRange | '__month__' | '__custom__'; label: string; disabled: boolean; reason?: string }> = [
  { value: 'today',     label: '今日',    disabled: false },
  { value: '7d',        label: '近 7 天', disabled: false },
  { value: '30d',       label: '近 30 天', disabled: false },
  { value: '__month__', label: '本月',    disabled: true, reason: '本月:需日级时序数据,v1.2 支持' },
  { value: '__custom__', label: '自定义',  disabled: true, reason: '自定义时间:需日级时序数据,v1.2 支持' },
];
