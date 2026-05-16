<template>
  <div class="mp-board">
    <div class="banner">
      <span class="banner-tag">公告</span>
      <span>「入局AI 高效增长」6.10 深圳，AI 千人峰会！</span>
      <a class="banner-link">点击立即报名~</a>
    </div>

    <div class="filter-row">
      <n-select size="small" v-model:value="platform" :options="platformOpts" placeholder="全部平台" style="width: 140px" />
      <n-select size="small" v-model:value="site" :options="siteOpts" placeholder="全部站点" style="width: 140px" />
      <n-select size="small" v-model:value="shop" :options="shopOpts" placeholder="全部店铺" style="width: 160px" />
      <n-select size="small" v-model:value="currency" :options="currencyOpts" style="width: 100px" />
      <div style="flex:1"></div>
      <n-icon size="18" style="color:#9ca3af"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 21l-4.34-4.34A8 8 0 1 0 4 11a8 8 0 0 0 13.66 5.66L22 21l-1 0z"/></svg></n-icon>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>实时销量 <span class="chev">›</span></div>
          <div class="card-tabs">
            <button class="tab active">站点今日</button>
            <button class="tab">近24小时</button>
          </div>
        </div>
        <div class="kpi-grid">
          <div class="kpi-cell">
            <div class="kpi-label">销量</div>
            <div class="kpi-value">{{ realtime.qty.toLocaleString() }}</div>
            <div class="kpi-sub">昨日：{{ realtime.qtyYesterday }}</div>
            <div class="kpi-sub">上周同日：{{ realtime.qtyLastWeek }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">销售额(US$)</div>
            <div class="kpi-value">{{ realtime.gmv.toFixed(2) }}</div>
            <div class="kpi-sub">昨日：{{ realtime.gmvYesterday.toFixed(2) }}</div>
            <div class="kpi-sub">上周同日：{{ realtime.gmvLastWeek.toFixed(2) }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">订单量</div>
            <div class="kpi-value">{{ realtime.orders.toLocaleString() }}</div>
            <div class="kpi-sub">昨日：{{ realtime.ordersYesterday }}</div>
            <div class="kpi-sub">上周同日：{{ realtime.ordersLastWeek }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">商品均价(US$)</div>
            <div class="kpi-value">{{ realtime.avgPrice.toFixed(2) }}</div>
            <div class="kpi-sub">昨日：{{ realtime.avgPriceYesterday.toFixed(2) }}</div>
            <div class="kpi-sub">上周同日：{{ realtime.avgPriceLastWeek.toFixed(2) }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">取消订单数</div>
            <div class="kpi-value">{{ realtime.cancel }}</div>
            <div class="kpi-sub">昨日：{{ realtime.cancelYesterday }}</div>
            <div class="kpi-sub">上周同日：{{ realtime.cancelLastWeek }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar green"></span>自发货订单 <span class="chev">›</span></div>
          <div class="muted">实时</div>
        </div>
        <div class="kpi-grid kpi-grid-3">
          <div class="kpi-cell">
            <div class="kpi-label">剩余发货&lt;1天</div>
            <div class="kpi-value">{{ selfShip.lessThanDay }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">待审核</div>
            <div class="kpi-value">{{ selfShip.toAudit }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">待处理</div>
            <div class="kpi-value">{{ selfShip.toProcess }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">物流下单</div>
            <div class="kpi-value">{{ selfShip.toShip }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">待打单</div>
            <div class="kpi-value">{{ selfShip.toPrint }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>销售趋势</div>
          <div class="card-tabs">
            <button class="tab" :class="{ active: trendRange === 'today' }" @click="trendRange = 'today'">站点今日</button>
            <button class="tab" :class="{ active: trendRange === '7d' }" @click="trendRange = '7d'">近7天</button>
            <button class="tab" :class="{ active: trendRange === '30d' }" @click="trendRange = '30d'">近30天</button>
            <button class="tab" :class="{ active: trendRange === 'lm' }" @click="trendRange = 'lm'">上月</button>
            <button class="tab" :class="{ active: trendRange === 'year' }" @click="trendRange = 'year'">今年</button>
          </div>
        </div>
        <div class="kpi-mini-row">
          <div v-for="m in trendMetrics" :key="m.label" class="kpi-mini" :class="{ active: trendMetric === m.key }" @click="trendMetric = m.key">
            <div class="kpi-mini-label">{{ m.label }}</div>
            <div class="kpi-mini-value">{{ m.value }}</div>
            <div class="kpi-mini-sub">
              <span>环比 {{ m.mom >= 0 ? '+' : '' }}{{ m.mom.toFixed(2) }}%</span>
              <span>同比 {{ m.yoy >= 0 ? '+' : '' }}{{ m.yoy.toFixed(2) }}%</span>
            </div>
          </div>
        </div>
        <div class="chart-area">
          <svg viewBox="0 0 600 180" preserveAspectRatio="none" class="chart-svg">
            <polyline :points="trendPath" fill="none" stroke="#22c55e" stroke-width="2" />
            <polyline :points="trendBars" fill="#fde68a" stroke="none" opacity="0.55" />
          </svg>
          <div class="axis">
            <span v-for="d in trendDates" :key="d">{{ d }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>销售分布</div>
          <div class="card-tabs">
            <n-select size="tiny" v-model:value="distMode" :options="distModeOpts" style="width:90px" />
            <button class="tab" :class="{ active: distMetric === 'qty' }" @click="distMetric = 'qty'">销量</button>
            <button class="tab" :class="{ active: distMetric === 'order' }" @click="distMetric = 'order'">订单量</button>
            <button class="tab" :class="{ active: distMetric === 'gmv' }" @click="distMetric = 'gmv'">销售额</button>
          </div>
        </div>
        <div class="donut-wrap">
          <div class="donut">
            <div class="donut-inner">
              <div class="donut-val">{{ realtime.qty.toLocaleString() }}</div>
              <div class="donut-label">销量</div>
            </div>
          </div>
          <div class="legend">
            <div v-for="l in distLegend" :key="l.label" class="legend-row">
              <span class="dot" :style="{ background: l.color }"></span>
              <span class="legend-label">{{ l.label }}</span>
              <span class="legend-val">{{ l.value.toLocaleString() }}</span>
              <span class="legend-pct">({{ l.pct }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>订单分布</div>
          <div class="card-tabs">
            <button class="tab">站点今日</button>
            <button class="tab active">近7天</button>
            <button class="tab">近14天</button>
            <button class="tab">近28天</button>
          </div>
        </div>
        <div class="bar-list">
          <div v-for="b in orderBars" :key="b.label" class="bar-row">
            <span class="bar-label">{{ b.label }}</span>
            <div class="bar-track"><div class="bar-fill" :style="{ width: b.pct + '%', background: b.color }"></div></div>
            <span class="bar-value">{{ b.value.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>库存情况</div>
          <div class="card-tabs">
            <button class="tab active">数量</button>
            <button class="tab">货值</button>
          </div>
        </div>
        <div class="kpi-grid kpi-grid-3">
          <div class="kpi-cell">
            <div class="kpi-label">在仓库存</div>
            <div class="kpi-value">{{ stock.inStock.toLocaleString() }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">在途库存</div>
            <div class="kpi-value">{{ stock.inTransit.toLocaleString() }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">海外仓库存</div>
            <div class="kpi-value">{{ stock.overseas.toLocaleString() }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">滞销库存</div>
            <div class="kpi-value warn">{{ stock.dead.toLocaleString() }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">缺货预警</div>
            <div class="kpi-value warn">{{ stock.shortage.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============== Screen 2: 排行 / TOP / 区域 / 广告 ============== -->
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>店铺销售排行</div>
          <div class="card-tabs">
            <button class="tab active">近7天</button>
            <button class="tab">近30天</button>
            <button class="tab">本月</button>
          </div>
        </div>
        <table class="rank-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>店铺</th>
              <th>平台</th>
              <th class="r">销量</th>
              <th class="r">销售额(US$)</th>
              <th class="r">环比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in shopRank" :key="s.shop">
              <td><span class="rank-no" :class="rankClass(i)">{{ i + 1 }}</span></td>
              <td>{{ s.shop }}</td>
              <td>{{ s.platform }}</td>
              <td class="r">{{ s.qty.toLocaleString() }}</td>
              <td class="r">{{ s.gmv.toLocaleString() }}</td>
              <td class="r" :class="s.mom >= 0 ? 'up' : 'down'">
                {{ s.mom >= 0 ? '+' : '' }}{{ s.mom.toFixed(2) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>SKU 销量 TOP10</div>
          <div class="card-tabs">
            <button class="tab" :class="{ active: topMetric === 'qty' }" @click="topMetric = 'qty'">销量</button>
            <button class="tab" :class="{ active: topMetric === 'gmv' }" @click="topMetric = 'gmv'">销售额</button>
            <button class="tab" :class="{ active: topMetric === 'profit' }" @click="topMetric = 'profit'">利润</button>
          </div>
        </div>
        <div class="sku-list">
          <div v-for="(s, i) in skuTop" :key="s.sku" class="sku-row">
            <div class="sku-rank" :class="rankClass(i)">{{ i + 1 }}</div>
            <div class="sku-thumb">{{ s.cat }}</div>
            <div class="sku-info">
              <div class="sku-name" :title="s.name">{{ s.name }}</div>
              <div class="sku-sub">{{ s.sku }} · {{ s.shop }}</div>
            </div>
            <div class="sku-bar-wrap">
              <div class="sku-bar" :style="{ width: s.pct + '%' }"></div>
            </div>
            <div class="sku-value">{{ topMetricFormatter(s) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>区域销售分布</div>
          <div class="card-tabs">
            <button class="tab" :class="{ active: regionMetric === 'qty' }" @click="regionMetric = 'qty'">销量</button>
            <button class="tab" :class="{ active: regionMetric === 'gmv' }" @click="regionMetric = 'gmv'">销售额</button>
          </div>
        </div>
        <div class="region-wrap">
          <div class="region-map">
            <div v-for="r in regionData" :key="r.code" class="region-tile" :style="{ background: heatColor(r.value) }" :title="`${r.name} · ${r.value}`">
              <div class="region-code">{{ r.code }}</div>
              <div class="region-name">{{ r.name }}</div>
              <div class="region-val">{{ r.value.toLocaleString() }}</div>
            </div>
          </div>
          <div class="region-legend">
            <span class="legend-dot" style="background:#dbeafe"></span><span>低</span>
            <span class="legend-dot" style="background:#93c5fd"></span><span>中</span>
            <span class="legend-dot" style="background:#3b82f6"></span><span>高</span>
            <span class="legend-dot" style="background:#1d4ed8"></span><span>顶级</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>广告投放概览</div>
          <div class="card-tabs">
            <button class="tab active">近7天</button>
            <button class="tab">近30天</button>
          </div>
        </div>
        <div class="kpi-grid kpi-grid-3">
          <div class="kpi-cell">
            <div class="kpi-label">广告花费(US$)</div>
            <div class="kpi-value">{{ ad.spend.toLocaleString() }}</div>
            <div class="kpi-sub">环比 <span :class="ad.spendMom >= 0 ? 'up' : 'down'">{{ ad.spendMom >= 0 ? '+' : '' }}{{ ad.spendMom.toFixed(2) }}%</span></div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">广告销售额</div>
            <div class="kpi-value">{{ ad.gmv.toLocaleString() }}</div>
            <div class="kpi-sub">环比 <span :class="ad.gmvMom >= 0 ? 'up' : 'down'">{{ ad.gmvMom >= 0 ? '+' : '' }}{{ ad.gmvMom.toFixed(2) }}%</span></div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">ROAS</div>
            <div class="kpi-value">{{ ad.roas.toFixed(2) }}</div>
            <div class="kpi-sub">广告费占比 {{ ad.acos.toFixed(2) }}%</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">曝光</div>
            <div class="kpi-value">{{ ad.impr.toLocaleString() }}</div>
            <div class="kpi-sub">CTR {{ ad.ctr.toFixed(2) }}%</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">点击</div>
            <div class="kpi-value">{{ ad.clicks.toLocaleString() }}</div>
            <div class="kpi-sub">CPC US$ {{ ad.cpc.toFixed(2) }}</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-label">广告订单</div>
            <div class="kpi-value">{{ ad.orders.toLocaleString() }}</div>
            <div class="kpi-sub">CVR {{ ad.cvr.toFixed(2) }}%</div>
          </div>
        </div>
        <div class="ad-platforms">
          <div v-for="p in ad.byPlatform" :key="p.label" class="ad-pf-row">
            <span class="ad-pf-label">{{ p.label }}</span>
            <div class="ad-pf-bar"><div class="ad-pf-fill" :style="{ width: p.pct + '%', background: p.color }"></div></div>
            <span class="ad-pf-value">{{ p.value.toLocaleString() }}</span>
            <span class="ad-pf-roas">ROAS {{ p.roas.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ============== Screen 3: 异常预警 + 商品明细大表 ============== -->
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar yellow"></span>异常预警</div>
          <div class="card-tabs">
            <button class="tab active">全部</button>
            <button class="tab">未处理</button>
          </div>
        </div>
        <div class="alert-list">
          <div v-for="a in alerts" :key="a.id" class="alert-row" :class="`sev-${a.level}`">
            <span class="alert-tag">{{ a.tag }}</span>
            <span class="alert-text">{{ a.text }}</span>
            <span class="alert-time">{{ a.time }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>近期活动</div>
          <a class="more">更多 ›</a>
        </div>
        <div class="activity-list">
          <div v-for="a in activities" :key="a.id" class="activity-row">
            <span class="activity-dot" :style="{ background: a.color }"></span>
            <span class="activity-text">{{ a.text }}</span>
            <span class="activity-time">{{ a.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title"><span class="bar"></span>商品明细 · 全维度</div>
        <div class="card-tabs">
          <button class="tab">导出</button>
          <button class="tab">列设置</button>
          <button class="tab active">近7天</button>
          <button class="tab">近30天</button>
        </div>
      </div>
      <div class="big-table-wrap">
        <table class="big-table">
          <thead>
            <tr>
              <th>图片</th>
              <th>品名 / SKU</th>
              <th>平台</th>
              <th>店铺 / 站点</th>
              <th>分类</th>
              <th class="r">本地仓可用</th>
              <th class="r">海外仓可用</th>
              <th class="r">销量</th>
              <th class="r">平均销量</th>
              <th class="r">订单量</th>
              <th class="r">销售额</th>
              <th class="r">净销售额</th>
              <th class="r">退货率</th>
              <th class="r">退款率</th>
              <th class="r">换货率</th>
              <th class="r">商品均价</th>
              <th class="r">运费</th>
              <th class="r">采购成本</th>
              <th class="r">毛利率</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in productDetail" :key="r.sku">
              <td><div class="thumb">{{ r.cat[0] }}</div></td>
              <td>
                <div class="td-name" :title="r.name">{{ r.name }}</div>
                <div class="td-sub">{{ r.sku }}</div>
              </td>
              <td>{{ r.platform }}</td>
              <td>{{ r.shop }}</td>
              <td>{{ r.cat }}</td>
              <td class="r">{{ r.localStock }}</td>
              <td class="r">{{ r.overseasStock }}</td>
              <td class="r">{{ r.qty }}</td>
              <td class="r">{{ r.avgQty.toFixed(1) }}</td>
              <td class="r">{{ r.orders }}</td>
              <td class="r">{{ r.gmv.toFixed(2) }}</td>
              <td class="r">{{ r.netGmv.toFixed(2) }}</td>
              <td class="r" :class="r.returnRate > 5 ? 'warn' : ''">{{ r.returnRate.toFixed(2) }}%</td>
              <td class="r" :class="r.refundRate > 3 ? 'warn' : ''">{{ r.refundRate.toFixed(2) }}%</td>
              <td class="r">{{ r.exchangeRate.toFixed(2) }}%</td>
              <td class="r">{{ r.avgPrice.toFixed(2) }}</td>
              <td class="r">{{ r.freight.toFixed(2) }}</td>
              <td class="r">{{ r.cost.toFixed(2) }}</td>
              <td class="r" :class="r.margin < 15 ? 'warn' : 'up'">{{ r.margin.toFixed(2) }}%</td>
              <td><a class="op-link">详情</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="big-table-foot">
        <span class="muted">共 {{ productDetail.length }} 条 · 演示数据</span>
        <div style="flex:1"></div>
        <div class="page-nav">
          <button>‹</button>
          <span class="page-cur">1</span><span>2</span><span>3</span>
          <button>›</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { NIcon, NSelect } from 'naive-ui';

const platform = ref<string | null>(null);
const site = ref<string | null>(null);
const shop = ref<string | null>(null);
const currency = ref('USD');

const platformOpts = [{ label: '全部平台', value: '' }, { label: 'Temu', value: 'temu' }, { label: 'Walmart', value: 'walmart' }, { label: 'TikTok', value: 'tiktok' }];
const siteOpts = [{ label: '全部站点', value: '' }, { label: '美国', value: 'us' }, { label: '德国', value: 'de' }, { label: '日本', value: 'jp' }];
const shopOpts = [{ label: '全部店铺', value: '' }, { label: '店铺A', value: 'a' }, { label: '店铺B', value: 'b' }];
const currencyOpts = [{ label: 'USD', value: 'USD' }, { label: 'CNY', value: 'CNY' }, { label: 'EUR', value: 'EUR' }];

const realtime = {
  qty: 975, qtyYesterday: 0, qtyLastWeek: 0,
  gmv: 0, gmvYesterday: 0, gmvLastWeek: 0,
  orders: 975, ordersYesterday: 0, ordersLastWeek: 0,
  avgPrice: 0, avgPriceYesterday: 0, avgPriceLastWeek: 0,
  cancel: 0, cancelYesterday: 0, cancelLastWeek: 0,
};
const selfShip = { lessThanDay: 0, toAudit: 0, toProcess: 0, toShip: 0, toPrint: 0 };

type TrendRange = 'today' | '7d' | '30d' | 'lm' | 'year';
type TrendMetric = 'qty' | 'order' | 'gmv' | 'net';
const trendRange = ref<TrendRange>('7d');
const trendMetric = ref<TrendMetric>('qty');
const trendMetrics = computed<{ key: TrendMetric; label: string; value: string; mom: number; yoy: number }[]>(() => [
  { key: 'qty', label: '销量', value: '975', mom: 0, yoy: 0 },
  { key: 'order', label: '订单量', value: '975', mom: 0, yoy: 0 },
  { key: 'gmv', label: '销售额(US$)', value: '0.00', mom: 0, yoy: 0 },
  { key: 'net', label: '净销售额(US$)', value: '0.00', mom: 0, yoy: 0 },
]);
const trendDates = ['2026-05-09', '2026-05-11', '2026-05-13', '2026-05-15'];
const trendPath = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * 600;
    const y = 180 - Math.max(8, Math.pow(i / 6, 2.6) * 170);
    pts.push([x, y]);
  }
  return pts.map((p) => p.join(',')).join(' ');
})();
const trendBars = '0,180 600,180 600,178 0,178';

const distMode = ref('platform');
const distMode_unused = computed(() => distMode.value);
void distMode_unused;
const distModeOpts = [{ label: '平台', value: 'platform' }, { label: '站点', value: 'site' }, { label: '店铺', value: 'shop' }];
const distMetric = ref<'qty' | 'order' | 'gmv'>('qty');
const distLegend = computed(() => [
  { label: 'Temu全托管', value: 975, pct: 100, color: '#6366f1' },
]);

const orderBars = [
  { label: '已发货', value: 720, pct: 90, color: '#22c55e' },
  { label: '待发货', value: 180, pct: 22, color: '#fbbf24' },
  { label: '已取消', value: 30, pct: 4, color: '#9ca3af' },
  { label: '退款中', value: 12, pct: 2, color: '#ef4444' },
  { label: '已退款', value: 8, pct: 1, color: '#a78bfa' },
];

const stock = { inStock: 12450, inTransit: 3200, overseas: 5500, dead: 320, shortage: 56 };

function rankClass(i: number) {
  if (i === 0) return 'rank-gold';
  if (i === 1) return 'rank-silver';
  if (i === 2) return 'rank-bronze';
  return '';
}

interface ShopRank { shop: string; platform: string; qty: number; gmv: number; mom: number }
const shopRank: ShopRank[] = [
  { shop: '美区主店', platform: 'Walmart', qty: 4820, gmv: 138420.50, mom: 18.42 },
  { shop: 'TikTok US 旗舰', platform: 'TikTok', qty: 3960, gmv: 98765.20, mom: 24.31 },
  { shop: '德区 EU 店', platform: 'Temu', qty: 3210, gmv: 76540.10, mom: 8.92 },
  { shop: '日区 JP 店', platform: 'Shopee', qty: 2870, gmv: 63210.40, mom: -4.21 },
  { shop: '法区 FR 店', platform: 'AliExpress', qty: 2120, gmv: 51230.80, mom: 11.42 },
  { shop: 'UK 主店', platform: 'eBay', qty: 1980, gmv: 42180.90, mom: -1.24 },
  { shop: '巴西 BR 店', platform: 'MercadoLibre', qty: 1540, gmv: 34520.00, mom: 5.62 },
];

type TopMetric = 'qty' | 'gmv' | 'profit';
const topMetric = ref<TopMetric>('qty');
interface SkuTop { sku: string; name: string; cat: string; shop: string; qty: number; gmv: number; profit: number; pct: number }
const skuTop: SkuTop[] = [
  { sku: 'SKU-A1024', name: '家居收纳盒 大号 6 件套', cat: '家居', shop: '美区主店', qty: 1820, gmv: 31420.00, profit: 9420, pct: 100 },
  { sku: 'SKU-B2034', name: '便携蓝牙音箱 户外防水', cat: '3C', shop: 'TikTok US', qty: 1640, gmv: 49120.00, profit: 14260, pct: 90 },
  { sku: 'SKU-C3088', name: '不锈钢保温水壶 1L 双层', cat: '家居', shop: '德区 EU', qty: 1420, gmv: 21300.00, profit: 6390, pct: 78 },
  { sku: 'SKU-D4156', name: '车载手机支架 磁吸式', cat: '3C', shop: '日区 JP', qty: 1280, gmv: 12800.00, profit: 4096, pct: 70 },
  { sku: 'SKU-E5023', name: '瑜伽垫 加厚 6mm 防滑', cat: '运动', shop: '美区主店', qty: 1140, gmv: 22800.00, profit: 7980, pct: 63 },
  { sku: 'SKU-F6082', name: '宠物自动喂食器 大容量', cat: '宠物', shop: 'TikTok US', qty: 980, gmv: 38220.00, profit: 11466, pct: 54 },
  { sku: 'SKU-G7041', name: '化妆刷 12 支套装', cat: '美妆', shop: '巴西 BR', qty: 920, gmv: 11040.00, profit: 3312, pct: 51 },
  { sku: 'SKU-H8052', name: 'LED 床头夜灯 触控调光', cat: '家居', shop: '法区 FR', qty: 840, gmv: 12600.00, profit: 4032, pct: 46 },
  { sku: 'SKU-I9013', name: '运动腰包 防泼水跑步包', cat: '运动', shop: 'UK 主店', qty: 760, gmv: 9120.00, profit: 2736, pct: 42 },
  { sku: 'SKU-J0117', name: '收纳挂袋 透明多层', cat: '家居', shop: '德区 EU', qty: 700, gmv: 7000.00, profit: 2100, pct: 38 },
];

function topMetricFormatter(s: SkuTop) {
  if (topMetric.value === 'qty') return s.qty.toLocaleString();
  if (topMetric.value === 'gmv') return 'US$ ' + s.gmv.toLocaleString();
  return 'US$ ' + s.profit.toLocaleString();
}

const regionMetric = ref<'qty' | 'gmv'>('qty');
const regionData = [
  { code: 'US', name: '美国', value: 4820 },
  { code: 'DE', name: '德国', value: 3210 },
  { code: 'UK', name: '英国', value: 1980 },
  { code: 'FR', name: '法国', value: 2120 },
  { code: 'JP', name: '日本', value: 2870 },
  { code: 'CA', name: '加拿大', value: 1240 },
  { code: 'AU', name: '澳大利亚', value: 940 },
  { code: 'BR', name: '巴西', value: 1540 },
  { code: 'MX', name: '墨西哥', value: 820 },
  { code: 'ES', name: '西班牙', value: 1180 },
  { code: 'IT', name: '意大利', value: 1020 },
  { code: 'NL', name: '荷兰', value: 760 },
];
function heatColor(v: number) {
  if (v > 4000) return '#1d4ed8';
  if (v > 2500) return '#3b82f6';
  if (v > 1500) return '#93c5fd';
  return '#dbeafe';
}

const ad = {
  spend: 76210.40, spendMom: -3.21,
  gmv: 412560.20, gmvMom: 14.82,
  roas: 5.41, acos: 18.48,
  impr: 8234100, ctr: 1.84,
  clicks: 151430, cpc: 0.50,
  orders: 6420, cvr: 4.24,
  byPlatform: [
    { label: 'Walmart', value: 32420.10, roas: 6.42, pct: 96, color: '#6366f1' },
    { label: 'TikTok', value: 21860.30, roas: 5.12, pct: 76, color: '#22c55e' },
    { label: 'Temu', value: 14520.50, roas: 4.81, pct: 60, color: '#f59e0b' },
    { label: 'AliExpress', value: 7410.20, roas: 3.92, pct: 36, color: '#ef4444' },
  ],
};

interface Alert { id: string; tag: string; text: string; time: string; level: 'high' | 'mid' | 'low' }
const alerts: Alert[] = [
  { id: '1', tag: '低库存', text: 'SKU-A1024 美国仓可用 < 7 天，建议补货 1200 件', time: '5 分钟前', level: 'high' },
  { id: '2', tag: '差评', text: '美区主店 收到 1 星差评，关联订单 SO20260083', time: '12 分钟前', level: 'mid' },
  { id: '3', tag: '退款', text: 'TikTok US 旗舰 退款率本周升至 5.6%', time: '38 分钟前', level: 'mid' },
  { id: '4', tag: '价格', text: 'Temu 核价 12 个 SKU 待处理，建议价低于成本', time: '1 小时前', level: 'high' },
  { id: '5', tag: '同步失败', text: 'AliExpress 货件 3 单同步失败，需重试', time: '2 小时前', level: 'low' },
  { id: '6', tag: '广告超支', text: 'Walmart 广告日预算超支 12%', time: '3 小时前', level: 'mid' },
];

const activities = [
  { id: '1', color: '#22c55e', text: '运营 张三 已批准 8 个 Temu 核价单', time: '10 分钟前' },
  { id: '2', color: '#3b82f6', text: '系统 自动同步 Walmart 货件状态', time: '20 分钟前' },
  { id: '3', color: '#f59e0b', text: '运营 李四 推送 32 条新品到 TikTok Shop', time: '45 分钟前' },
  { id: '4', color: '#a78bfa', text: '财务 王五 完成本月 Temu 结算对账', time: '1 小时前' },
  { id: '5', color: '#22c55e', text: '运营 赵六 批量发货 124 单', time: '2 小时前' },
];

interface ProductDetailRow {
  sku: string; name: string; platform: string; shop: string; cat: string;
  localStock: number; overseasStock: number;
  qty: number; avgQty: number; orders: number;
  gmv: number; netGmv: number;
  returnRate: number; refundRate: number; exchangeRate: number;
  avgPrice: number; freight: number; cost: number; margin: number;
}
const productDetail: ProductDetailRow[] = (() => {
  const cats = ['家居', '3C', '美妆', '运动', '宠物', '户外', '服饰'];
  const platforms = ['Temu', 'Walmart', 'TikTok', 'SHEIN', 'AliExpress', 'Shopee', 'eBay'];
  const shops = ['美区主店', 'TikTok US 旗舰', '德区 EU 店', '日区 JP 店', '法区 FR 店', 'UK 主店', '巴西 BR 店'];
  return Array.from({ length: 10 }, (_, i) => {
    const qty = 200 + (i * 47 % 1800);
    const avgPrice = Number((8 + (i * 1.7 % 24)).toFixed(2));
    const gmv = Number((qty * avgPrice).toFixed(2));
    const cost = Number((avgPrice * (0.42 + (i % 5) * 0.03)).toFixed(2));
    const freight = Number((avgPrice * 0.08).toFixed(2));
    const netGmv = Number((gmv * 0.92).toFixed(2));
    const returnRate = Number(((i % 5) * 1.4 + 1.2).toFixed(2));
    const margin = Number((((avgPrice - cost - freight) / avgPrice) * 100).toFixed(2));
    return {
      sku: 'SKU-' + (10000 + i * 13 + 7),
      name: `多平台共用商品 ${i + 1} 演示款`,
      platform: platforms[i % 7],
      shop: shops[i % 7],
      cat: cats[i % 7],
      localStock: 50 + (i * 31 % 800),
      overseasStock: 30 + (i * 19 % 400),
      qty,
      avgQty: Number((qty / 7).toFixed(1)),
      orders: Math.floor(qty * 0.85),
      gmv,
      netGmv,
      returnRate,
      refundRate: Number(((i % 4) * 0.8 + 0.5).toFixed(2)),
      exchangeRate: Number(((i % 3) * 0.4 + 0.3).toFixed(2)),
      avgPrice,
      freight,
      cost,
      margin,
    };
  });
})();
</script>

<style scoped>
.mp-board {
  padding: 12px 16px 16px;
}
.banner {
  background: #fffbeb;
  color: #92400e;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.banner-tag {
  background: #f59e0b;
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
}
.banner-link { color: #2563eb; cursor: pointer; }

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  border: 1px solid #eef0f4;
}

.grid {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}
.grid-2 { grid-template-columns: 1fr 1fr; }

.card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  padding: 12px 14px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.bar {
  width: 4px; height: 14px; background: #4f64f6; border-radius: 2px;
}
.bar.green { background: #22c55e; }
.chev { color: #9ca3af; }
.card-tabs {
  display: flex;
  gap: 4px;
  align-items: center;
}
.tab {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: none;
  border: 0;
  color: #6b7280;
  cursor: pointer;
}
.tab.active {
  color: #4f64f6;
  background: #eef2ff;
}
.muted { color: #9ca3af; font-size: 12px; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.kpi-grid-3 {
  grid-template-columns: repeat(5, 1fr);
}
.kpi-cell .kpi-label { color: #6b7280; font-size: 12px; }
.kpi-cell .kpi-value { font-size: 22px; font-weight: 700; color: #111827; margin: 4px 0; }
.kpi-cell .kpi-value.warn { color: #d97706; }
.kpi-cell .kpi-sub { color: #9ca3af; font-size: 11px; }

.kpi-mini-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  overflow-x: auto;
}
.kpi-mini {
  flex: 1;
  min-width: 130px;
  border: 1px solid #eef0f4;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
}
.kpi-mini.active { border-color: #f0b429; background: #fffaf0; }
.kpi-mini-label { font-size: 12px; color: #6b7280; }
.kpi-mini-value { font-size: 18px; font-weight: 600; margin: 4px 0; }
.kpi-mini-sub { font-size: 11px; color: #9ca3af; display: flex; gap: 8px; }

.chart-area { margin-top: 8px; }
.chart-svg { width: 100%; height: 200px; }
.axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

.donut-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
}
.donut {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: conic-gradient(#4f64f6 0% 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.donut-inner {
  width: 110px; height: 110px;
  border-radius: 50%;
  background: #fff;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.donut-val { font-size: 22px; font-weight: 700; }
.donut-label { font-size: 12px; color: #6b7280; }
.legend { flex: 1; }
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed #f0f2f5;
  font-size: 13px;
}
.legend-row .dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { flex: 1; color: #4b5563; }
.legend-val { font-weight: 600; color: #111827; }
.legend-pct { color: #9ca3af; font-size: 12px; }

.bar-list { padding: 8px 0; }
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.bar-label { width: 80px; font-size: 12px; color: #6b7280; }
.bar-track { flex: 1; height: 10px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; }
.bar-value { width: 70px; text-align: right; font-size: 12px; font-weight: 600; }

.bar.yellow { background: #f59e0b; }
.more { color: #6b7280; font-size: 12px; cursor: pointer; }

/* ---- 排行表 ---- */
.rank-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rank-table th, .rank-table td {
  padding: 8px 6px; text-align: left; border-bottom: 1px dashed #eef0f4;
}
.rank-table th { color: #9ca3af; font-weight: 500; font-size: 12px; }
.rank-table td.r, .rank-table th.r { text-align: right; }
.rank-no {
  display: inline-flex;
  width: 22px; height: 22px;
  border-radius: 4px;
  align-items: center; justify-content: center;
  font-size: 12px;
  background: #f3f4f6; color: #6b7280;
}
.rank-no.rank-gold { background: #f59e0b; color: #fff; }
.rank-no.rank-silver { background: #9ca3af; color: #fff; }
.rank-no.rank-bronze { background: #d97706; color: #fff; }
.up { color: #18a058; }
.down { color: #d03050; }

/* ---- SKU TOP ---- */
.sku-list { padding: 4px 0; }
.sku-row {
  display: grid;
  grid-template-columns: 28px 40px 1fr 100px 80px;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f2f5;
  font-size: 13px;
}
.sku-rank {
  width: 22px; height: 22px;
  border-radius: 4px;
  background: #f3f4f6; color: #6b7280;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.sku-rank.rank-gold { background: #f59e0b; color: #fff; }
.sku-rank.rank-silver { background: #9ca3af; color: #fff; }
.sku-rank.rank-bronze { background: #d97706; color: #fff; }
.sku-thumb {
  width: 36px; height: 36px;
  border-radius: 6px;
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  color: #4f46e5;
  font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.sku-info { min-width: 0; }
.sku-name { color: #111827; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sku-sub { color: #9ca3af; font-size: 11px; }
.sku-bar-wrap { height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
.sku-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.sku-value { text-align: right; font-weight: 600; color: #111827; }

/* ---- 区域 ---- */
.region-wrap { padding: 4px 0; }
.region-map {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.region-tile {
  border-radius: 6px;
  padding: 10px 12px;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0,0,0,0.15);
}
.region-tile .region-code { font-size: 11px; opacity: 0.8; }
.region-tile .region-name { font-size: 13px; font-weight: 600; margin: 2px 0; }
.region-tile .region-val { font-size: 15px; font-weight: 700; }
.region-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 0;
  font-size: 11px;
  color: #6b7280;
}
.legend-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 2px;
  margin-right: 2px;
}
.legend-dot + span { margin-right: 8px; }

/* ---- 广告平台分布 ---- */
.ad-platforms { padding: 8px 0 0; border-top: 1px dashed #eef0f4; margin-top: 10px; }
.ad-pf-row {
  display: grid;
  grid-template-columns: 90px 1fr 100px 90px;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
}
.ad-pf-label { color: #6b7280; }
.ad-pf-bar { height: 8px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
.ad-pf-fill { height: 100%; }
.ad-pf-value { text-align: right; font-weight: 600; }
.ad-pf-roas { color: #6b7280; text-align: right; }

/* ---- 异常预警 ---- */
.alert-list { padding: 4px 0; }
.alert-row {
  display: grid;
  grid-template-columns: 70px 1fr 80px;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f2f5;
  font-size: 13px;
}
.alert-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
  background: #f3f4f6;
  color: #6b7280;
  text-align: center;
}
.sev-high .alert-tag { background: #fee2e2; color: #b91c1c; }
.sev-mid .alert-tag { background: #fef3c7; color: #b45309; }
.sev-low .alert-tag { background: #dbeafe; color: #1d4ed8; }
.alert-text { color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alert-time { text-align: right; color: #9ca3af; font-size: 11px; }

/* ---- 活动 ---- */
.activity-list { padding: 4px 0; }
.activity-row {
  display: grid;
  grid-template-columns: 12px 1fr 80px;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f2f5;
  font-size: 13px;
}
.activity-dot { width: 8px; height: 8px; border-radius: 50%; }
.activity-text { color: #1f2937; }
.activity-time { text-align: right; color: #9ca3af; font-size: 11px; }

/* ---- 商品明细大表 ---- */
.big-table-wrap { overflow-x: auto; }
.big-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 1700px;
}
.big-table thead {
  background: #f9fafb;
}
.big-table th, .big-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f0f2f5;
  text-align: left;
  white-space: nowrap;
}
.big-table th { color: #6b7280; font-weight: 500; }
.big-table td.r, .big-table th.r { text-align: right; }
.big-table td.warn { color: #d97706; }
.big-table td.up { color: #18a058; }
.big-table .thumb {
  width: 36px; height: 36px;
  border-radius: 4px;
  background: linear-gradient(135deg, #fef3c7, #fbbf24);
  color: #92400e;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 600;
  font-size: 14px;
}
.td-name { font-weight: 500; color: #1f2937; }
.td-sub { color: #9ca3af; font-size: 11px; }
.op-link { color: #4f64f6; cursor: pointer; }
.big-table-foot {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-top: 1px solid #f0f2f5;
  font-size: 12px;
}
.muted { color: #9ca3af; }
.page-nav { display: flex; align-items: center; gap: 4px; }
.page-nav button {
  border: 1px solid #e5e7eb;
  background: #fff;
  width: 28px; height: 28px;
  border-radius: 4px;
  cursor: pointer;
}
.page-nav span {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #4b5563;
}
.page-nav .page-cur { background: #4f64f6; color: #fff; }
</style>
