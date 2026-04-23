import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFiltersStore } from './filters';

describe('useFiltersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('defaults: platform=temu, timeRange=30d, region=null, shopIds=[]', () => {
    const s = useFiltersStore();
    expect(s.platform).toBe('temu');
    expect(s.timeRange).toBe('30d');
    expect(s.region).toBeNull();
    expect(s.shopIds).toEqual([]);
  });

  it('toQuery 生成后端 query 对象,空数组/null 过滤掉', () => {
    const s = useFiltersStore();
    expect(s.toQuery()).toEqual({ platform: 'temu', timeRange: '30d' });
    s.shopIds = ['a', 'b'];
    s.region = 'pa';
    expect(s.toQuery()).toEqual({ platform: 'temu', region: 'pa', shopIds: ['a', 'b'], timeRange: '30d' });
  });

  it('setTimeRange 拒绝 disabled 值 (本月/自定义)', () => {
    const s = useFiltersStore();
    s.setTimeRange('today');
    expect(s.timeRange).toBe('today');
    s.setTimeRange('month' as any);
    expect(s.timeRange).toBe('today');
  });

  it('setPlatform 拒绝 disabled 平台 (非 temu)', () => {
    const s = useFiltersStore();
    s.setPlatform('tiktok');
    expect(s.platform).toBe('temu');
  });

  it('setRegion 拒绝非 cn/pa', () => {
    const s = useFiltersStore();
    s.setRegion('us' as any);
    expect(s.region).toBeNull();
    s.setRegion('pa');
    expect(s.region).toBe('pa');
  });

  it('debouncedRefetch 300ms 内多次调用只触发一次', async () => {
    vi.useFakeTimers();
    const s = useFiltersStore();
    const handler = vi.fn();
    s.onChange(handler);
    s.setTimeRange('7d');
    s.setTimeRange('today');
    s.setTimeRange('30d');
    vi.advanceTimersByTime(299);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(handler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
