<template>
  <SellfoxPageShell title="多平台利润报表">
    <template #actions>
      <n-button size="small">同步</n-button>
      <n-button size="small">导出</n-button>
      <n-button size="small">列设置</n-button>
    </template>

    <template #filters>
      <n-select size="small" placeholder="维度" :options="dimOpts" v-model:value="dim" style="width: 130px" />
      <n-select size="small" placeholder="平台" :options="platformOpts" clearable style="width: 130px" />
      <n-select size="small" placeholder="店铺" :options="shopOpts" clearable style="width: 150px" />
      <n-select size="small" placeholder="币种" :options="currencyOpts" v-model:value="currency" style="width: 110px" />
      <n-date-picker size="small" type="daterange" clearable style="width: 240px" />
      <n-button size="small" type="primary">查询</n-button>
    </template>

    <template #kpis>
      <div class="kpi-row">
        <div class="kpi-card highlight">
          <div class="kpi-label">销售额(US$)</div>
          <div class="kpi-value">1,580,432.50</div>
          <div class="kpi-foot">同比 <span class="up">+18.42%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">毛利润(US$)</div>
          <div class="kpi-value">412,560.20</div>
          <div class="kpi-foot">同比 <span class="up">+12.18%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">毛利率</div>
          <div class="kpi-value">26.10%</div>
          <div class="kpi-foot">环比 <span class="down">-1.34%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">净利润(US$)</div>
          <div class="kpi-value">187,920.80</div>
          <div class="kpi-foot">同比 <span class="up">+9.87%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">净利率</div>
          <div class="kpi-value">11.89%</div>
          <div class="kpi-foot">环比 <span class="up">+0.42%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">广告花费(US$)</div>
          <div class="kpi-value">76,210.40</div>
          <div class="kpi-foot">占比 4.82%</div>
        </div>
      </div>
    </template>

    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title">利润构成 · 按平台</div>
          <div class="card-sub">单位：US$</div>
        </div>
        <div class="bar-list">
          <div v-for="b in platformBars" :key="b.label" class="bar-row">
            <span class="bar-label">{{ b.label }}</span>
            <div class="bar-track"><div class="bar-fill" :style="{ width: b.pct + '%', background: b.color }"></div></div>
            <span class="bar-value">{{ b.value.toLocaleString() }}</span>
            <span class="bar-pct">{{ b.pct }}%</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">利润趋势 · 近 30 天</div>
          <div class="card-sub">单位：US$</div>
        </div>
        <svg viewBox="0 0 600 180" preserveAspectRatio="none" class="chart-svg">
          <polyline :points="trendLine" fill="none" stroke="#4f64f6" stroke-width="2" />
          <polyline :points="costLine" fill="none" stroke="#f0b429" stroke-width="2" stroke-dasharray="3,3" />
        </svg>
        <div class="legend-inline">
          <span><span class="line solid"></span>毛利润</span>
          <span><span class="line dashed"></span>广告花费</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-toolbar">
        <span class="muted">明细 · 共 {{ rows.length }} 条 · 演示数据</span>
        <div style="flex:1"></div>
        <n-button-group size="small">
          <n-button>导出明细</n-button>
          <n-button>对比上期</n-button>
        </n-button-group>
      </div>
      <n-data-table
        size="small"
        :columns="columns"
        :data="rows"
        :bordered="false"
        :pagination="pagination"
        :scroll-x="1400"
      />
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title">店铺利润排行</div>
          <div class="card-sub">近 30 天</div>
        </div>
        <table class="rank-table">
          <thead>
            <tr>
              <th style="width:28px">#</th>
              <th>店铺</th>
              <th>平台</th>
              <th class="r">销售额(US$)</th>
              <th class="r">净利润(US$)</th>
              <th class="r">净利率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in shopProfit" :key="s.shop">
              <td><span class="rank-no" :class="rankCls(i)">{{ i + 1 }}</span></td>
              <td>{{ s.shop }}</td>
              <td>{{ s.platform }}</td>
              <td class="r">{{ s.gmv.toLocaleString() }}</td>
              <td class="r" :class="s.profit >= 0 ? 'up' : 'down'">{{ s.profit.toLocaleString() }}</td>
              <td class="r" :class="s.margin > 12 ? 'up' : 'down'">{{ s.margin.toFixed(2) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">成本构成</div>
          <div class="card-sub">销售额占比</div>
        </div>
        <div class="bars-2">
          <div v-for="c in costBreak" :key="c.label" class="bar2-row">
            <span class="bar2-label">{{ c.label }}</span>
            <div class="bar2-track"><div class="bar2-fill" :style="{ width: c.pct + '%', background: c.color }"></div></div>
            <span class="bar2-val">{{ c.value.toLocaleString() }}</span>
            <span class="bar2-pct">{{ c.pct }}%</span>
          </div>
        </div>
        <div class="profit-summary">
          <div class="summary-row">
            <span>销售额</span>
            <strong>{{ summary.gmv.toLocaleString() }}</strong>
          </div>
          <div class="summary-row">
            <span>总成本</span>
            <strong>-{{ summary.cost.toLocaleString() }}</strong>
          </div>
          <div class="summary-row total">
            <span>净利润</span>
            <strong class="up">+{{ summary.net.toLocaleString() }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title">区域利润分布</div>
          <div class="card-sub">单位：US$</div>
        </div>
        <table class="rank-table">
          <thead><tr><th>区域</th><th class="r">销售额</th><th class="r">净利润</th><th class="r">净利率</th><th class="r">同比</th></tr></thead>
          <tbody>
            <tr v-for="r in regionProfit" :key="r.region">
              <td>{{ r.region }}</td>
              <td class="r">{{ r.gmv.toLocaleString() }}</td>
              <td class="r">{{ r.profit.toLocaleString() }}</td>
              <td class="r">{{ r.margin.toFixed(2) }}%</td>
              <td class="r" :class="r.yoy >= 0 ? 'up' : 'down'">{{ r.yoy >= 0 ? '+' : '' }}{{ r.yoy.toFixed(2) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">SKU 利润 TOP10</div>
          <div class="card-sub">按净利润</div>
        </div>
        <table class="rank-table">
          <thead><tr><th style="width:28px">#</th><th>SKU</th><th>平台</th><th class="r">销量</th><th class="r">净利润(US$)</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in skuProfit" :key="s.sku">
              <td><span class="rank-no" :class="rankCls(i)">{{ i + 1 }}</span></td>
              <td><div class="td-name">{{ s.name }}</div><div class="td-sub">{{ s.sku }}</div></td>
              <td>{{ s.platform }}</td>
              <td class="r">{{ s.qty.toLocaleString() }}</td>
              <td class="r up">{{ s.profit.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </SellfoxPageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NButtonGroup, NDataTable, NDatePicker, NSelect } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import SellfoxPageShell from '@/components/common/SellfoxPageShell.vue';

const dim = ref('platform');
const dimOpts = [
  { label: '按平台', value: 'platform' },
  { label: '按店铺', value: 'shop' },
  { label: '按 SKU', value: 'sku' },
];
const platformOpts = [{ label: 'Temu', value: 'temu' }, { label: 'Walmart', value: 'wm' }, { label: 'TikTok', value: 'tt' }];
const shopOpts = [{ label: '店铺A', value: 'a' }, { label: '店铺B', value: 'b' }];
const currency = ref('USD');
const currencyOpts = [{ label: 'USD', value: 'USD' }, { label: 'CNY', value: 'CNY' }];

const platformBars = [
  { label: 'Temu', value: 162340, pct: 39, color: '#6366f1' },
  { label: 'Walmart', value: 108510, pct: 26, color: '#22c55e' },
  { label: 'TikTok', value: 84120, pct: 20, color: '#f59e0b' },
  { label: 'AliExpress', value: 36120, pct: 9, color: '#ef4444' },
  { label: 'SHEIN', value: 21470, pct: 6, color: '#a78bfa' },
];

const trendLine = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 30; i++) {
    const x = (i / 29) * 600;
    const y = 160 - 60 - Math.sin(i / 4) * 25 - i * 0.8;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
})();
const costLine = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 30; i++) {
    const x = (i / 29) * 600;
    const y = 160 - 20 - Math.cos(i / 5) * 15 - i * 0.5;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
})();

interface Row {
  dim: string;
  gmv: number;
  cost: number;
  ad: number;
  fee: number;
  gross: number;
  net: number;
  margin: number;
}
const rows = computed<Row[]>(() => {
  const ds = ['Temu', 'Walmart', 'TikTok', 'AliExpress', 'SHEIN', 'eBay', 'Shopee', 'Lazada', 'MercadoLibre'];
  return ds.map((d, i) => {
    const gmv = 50000 + (i + 1) * 18230 + (i % 3) * 7700;
    const cost = Math.round(gmv * (0.4 + (i % 5) * 0.02));
    const ad = Math.round(gmv * (0.05 + (i % 4) * 0.01));
    const fee = Math.round(gmv * 0.12);
    const gross = gmv - cost;
    const net = gross - ad - fee;
    return {
      dim: d,
      gmv: Number(gmv.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      ad: Number(ad.toFixed(2)),
      fee: Number(fee.toFixed(2)),
      gross: Number(gross.toFixed(2)),
      net: Number(net.toFixed(2)),
      margin: Number(((net / gmv) * 100).toFixed(2)),
    };
  });
});

const columns: DataTableColumns<Row> = [
  { title: '维度', key: 'dim', width: 140, fixed: 'left' },
  { title: '销售额', key: 'gmv', align: 'right', render: (r) => r.gmv.toLocaleString() },
  { title: '商品成本', key: 'cost', align: 'right', render: (r) => r.cost.toLocaleString() },
  { title: '广告费', key: 'ad', align: 'right', render: (r) => r.ad.toLocaleString() },
  { title: '平台费用', key: 'fee', align: 'right', render: (r) => r.fee.toLocaleString() },
  { title: '毛利润', key: 'gross', align: 'right', render: (r) => r.gross.toLocaleString() },
  { title: '净利润', key: 'net', align: 'right', render: (r) => r.net.toLocaleString() },
  {
    title: '净利率', key: 'margin', align: 'right', width: 100,
    render: (r) => `${r.margin.toFixed(2)}%`,
  },
];

const pagination = { pageSize: 10 };

function rankCls(i: number) {
  if (i === 0) return 'rank-gold';
  if (i === 1) return 'rank-silver';
  if (i === 2) return 'rank-bronze';
  return '';
}

interface ShopProfit { shop: string; platform: string; gmv: number; profit: number; margin: number }
const shopProfit: ShopProfit[] = [
  { shop: '美区主店', platform: 'Walmart', gmv: 318420, profit: 52340, margin: 16.44 },
  { shop: 'TikTok US 旗舰', platform: 'TikTok', gmv: 248760, profit: 41280, margin: 16.59 },
  { shop: '德区 EU 店', platform: 'Temu', gmv: 196540, profit: 26800, margin: 13.64 },
  { shop: '日区 JP 店', platform: 'Shopee', gmv: 163210, profit: 18420, margin: 11.29 },
  { shop: '法区 FR 店', platform: 'AliExpress', gmv: 121230, profit: 12640, margin: 10.42 },
  { shop: 'UK 主店', platform: 'eBay', gmv: 102180, profit: 9820, margin: 9.61 },
  { shop: '巴西 BR 店', platform: 'MercadoLibre', gmv: 74520, profit: 6180, margin: 8.29 },
];

const costBreak = [
  { label: '商品成本', value: 656420, pct: 41.5, color: '#6366f1' },
  { label: '平台费用', value: 189651, pct: 12.0, color: '#22c55e' },
  { label: '物流运费', value: 142239, pct: 9.0, color: '#f59e0b' },
  { label: '广告投放', value: 76210, pct: 4.8, color: '#ef4444' },
  { label: '退款退货', value: 47413, pct: 3.0, color: '#a78bfa' },
  { label: '其他费用', value: 28100, pct: 1.8, color: '#94a3b8' },
];
const summary = {
  gmv: 1580432,
  cost: costBreak.reduce((a, c) => a + c.value, 0),
  net: 0,
};
summary.net = summary.gmv - summary.cost;

const regionProfit = [
  { region: '北美 (US/CA)', gmv: 458210, profit: 76340, margin: 16.66, yoy: 22.14 },
  { region: '欧洲 (DE/UK/FR/IT/ES)', gmv: 386520, profit: 48230, margin: 12.48, yoy: 8.42 },
  { region: '亚太 (JP/AU/KR)', gmv: 248760, profit: 26720, margin: 10.74, yoy: 14.58 },
  { region: '拉美 (MX/BR)', gmv: 142180, profit: 12320, margin: 8.66, yoy: -3.24 },
  { region: '中东 / 其他', gmv: 86420, profit: 6280, margin: 7.27, yoy: 18.92 },
];

const skuProfit = [
  { sku: 'SKU-B2034', name: '便携蓝牙音箱 户外防水', platform: 'TikTok', qty: 1640, profit: 14260 },
  { sku: 'SKU-F6082', name: '宠物自动喂食器 大容量', platform: 'TikTok', qty: 980, profit: 11466 },
  { sku: 'SKU-A1024', name: '家居收纳盒 大号 6 件套', platform: 'Walmart', qty: 1820, profit: 9420 },
  { sku: 'SKU-E5023', name: '瑜伽垫 加厚 6mm 防滑', platform: 'Walmart', qty: 1140, profit: 7980 },
  { sku: 'SKU-C3088', name: '不锈钢保温水壶 1L 双层', platform: 'Temu', qty: 1420, profit: 6390 },
  { sku: 'SKU-D4156', name: '车载手机支架 磁吸式', platform: 'Shopee', qty: 1280, profit: 4096 },
  { sku: 'SKU-H8052', name: 'LED 床头夜灯 触控调光', platform: 'AliExpress', qty: 840, profit: 4032 },
  { sku: 'SKU-G7041', name: '化妆刷 12 支套装', platform: 'MercadoLibre', qty: 920, profit: 3312 },
];
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding: 0 16px;
}
.kpi-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 6px;
  padding: 14px 16px;
}
.kpi-card.highlight { border-color: #4f64f6; }
.kpi-label { color: #6b7280; font-size: 12px; }
.kpi-value { font-size: 22px; font-weight: 700; color: #111827; margin: 6px 0 4px; }
.kpi-foot { font-size: 12px; color: #9ca3af; }
.kpi-foot .up { color: #18a058; }
.kpi-foot .down { color: #d03050; }

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 0 16px 12px;
}
.card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 6px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f2f5;
}
.card-title { font-size: 14px; font-weight: 600; color: #1f2937; }
.card-sub { font-size: 12px; color: #9ca3af; }
.bar-list { padding: 12px 14px; }
.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  font-size: 12px;
}
.bar-label { width: 100px; color: #6b7280; }
.bar-track { flex: 1; height: 10px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; }
.bar-value { width: 90px; text-align: right; font-weight: 600; }
.bar-pct { width: 60px; text-align: right; color: #9ca3af; }

.chart-svg { width: 100%; height: 200px; padding: 0 8px; }
.legend-inline {
  display: flex; gap: 16px; padding: 0 14px 12px;
  font-size: 12px; color: #6b7280;
}
.legend-inline .line { display: inline-block; width: 16px; height: 2px; vertical-align: middle; margin-right: 4px; }
.legend-inline .line.solid { background: #4f64f6; }
.legend-inline .line.dashed { background: linear-gradient(90deg, #f0b429 50%, transparent 50%); background-size: 6px 2px; }
.card .card-toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.muted { color: #9ca3af; font-size: 12px; }

.rank-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rank-table th, .rank-table td {
  padding: 8px 6px; text-align: left;
  border-bottom: 1px dashed #eef0f4;
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
.td-name { color: #1f2937; font-weight: 500; }
.td-sub { color: #9ca3af; font-size: 11px; }

.up { color: #18a058; }
.down { color: #d03050; }

.bars-2 { padding: 4px 14px; }
.bar2-row {
  display: grid;
  grid-template-columns: 100px 1fr 90px 60px;
  align-items: center; gap: 10px;
  padding: 6px 0; font-size: 12px;
}
.bar2-label { color: #6b7280; }
.bar2-track { height: 10px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.bar2-fill { height: 100%; }
.bar2-val { text-align: right; font-weight: 600; }
.bar2-pct { color: #9ca3af; text-align: right; }

.profit-summary {
  border-top: 1px dashed #eef0f4;
  padding: 10px 14px;
  margin-top: 6px;
}
.summary-row {
  display: flex; justify-content: space-between;
  padding: 4px 0; font-size: 13px;
  color: #4b5563;
}
.summary-row strong { color: #111827; }
.summary-row.total {
  border-top: 1px solid #f0f2f5;
  margin-top: 4px;
  padding-top: 8px;
  font-size: 14px;
}
.summary-row.total strong.up { color: #18a058; font-size: 16px; }
</style>
