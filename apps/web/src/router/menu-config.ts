export interface MenuLeaf {
  key: string;
  label: string;
  path: string;
  badge?: 'NEW' | 'HOT';
}

export interface MenuGroup {
  key: string;
  label: string;
  icon?: string;
  children: MenuLeaf[];
}

export interface MenuRoot {
  key: string;
  label: string;
  groups: MenuGroup[];
}

export const MENU_TREE: MenuRoot[] = [
  {
    key: 'product',
    label: '商品',
    groups: [
      {
        key: 'product-mgmt', label: '商品管理', icon: 'box',
        children: [
          { key: 'product-list', label: '商品列表', path: '/products' },
          { key: 'multi-attr-list', label: '多属性列表', path: '/products/multi-attr' },
          { key: 'aux-mgmt', label: '辅料管理', path: '/products/aux' },
        ],
      },
      {
        key: 'pair-mgmt', label: '配对管理', icon: 'link',
        children: [
          { key: 'pair-list', label: '配对列表', path: '/products/pair-list' },
        ],
      },
      {
        key: 'new-product', label: '新品', icon: 'plus',
        children: [
          { key: 'new-product-dev', label: '新品开发', path: '/products/new-dev' },
        ],
      },
      {
        key: 'base-info', label: '基础信息', icon: 'info',
        children: [
          { key: 'image-mgmt', label: '图片管理', path: '/products/images' },
          { key: 'category', label: '商品分类', path: '/products/category' },
          { key: 'brand', label: '品牌管理', path: '/products/brand' },
          { key: 'attribute', label: '属性管理', path: '/products/attribute' },
          { key: 'qc-template', label: '质检模板', path: '/products/qc-template' },
          { key: 'custom-field', label: '自定义字段', path: '/products/custom-field' },
        ],
      },
    ],
  },
  {
    key: 'sales',
    label: '销售',
    groups: [
      {
        key: 'online', label: '在线产品', icon: 'shop',
        children: [
          { key: 'sales-temu', label: 'Temu', path: '/sales/online/temu' },
          { key: 'sales-walmart', label: 'Walmart', path: '/sales/online/walmart' },
          { key: 'sales-tiktok', label: 'TikTok', path: '/sales/online/tiktok' },
          { key: 'sales-shein', label: 'SHEIN', path: '/sales/online/shein' },
          { key: 'sales-ebay', label: 'eBay', path: '/sales/online/ebay' },
          { key: 'sales-ali', label: 'AliExpress', path: '/sales/online/aliexpress' },
          { key: 'sales-mercado', label: 'MercadoLibre', path: '/sales/online/mercadolibre' },
          { key: 'sales-shopee', label: 'Shopee', path: '/sales/online/shopee' },
          { key: 'sales-lazada', label: 'Lazada', path: '/sales/online/lazada' },
          { key: 'sales-shopify', label: 'Shopify', path: '/sales/online/shopify' },
          { key: 'sales-rakuten', label: 'Rakuten', path: '/sales/online/rakuten' },
          { key: 'sales-cdiscount', label: 'Cdiscount', path: '/sales/online/cdiscount' },
          { key: 'sales-otto', label: 'OTTO', path: '/sales/online/otto' },
          { key: 'sales-ozon', label: 'Ozon', path: '/sales/online/ozon' },
          { key: 'sales-coupang', label: 'Coupang', path: '/sales/online/coupang' },
        ],
      },
      {
        key: 'product-mgmt-sales', label: '产品管理', icon: 'sync',
        children: [
          { key: 'stock-sync', label: '产品库存同步', path: '/sales/stock-sync' },
          { key: 'temu-pricing', label: 'Temu核价', path: '/sales/temu-pricing', badge: 'NEW' },
          { key: 'temu-activity', label: 'Temu活动申报', path: '/sales/temu-activity', badge: 'NEW' },
        ],
      },
    ],
  },
  {
    key: 'order',
    label: '订单',
    groups: [
      {
        key: 'order-mgmt', label: '订单管理', icon: 'order',
        children: [
          { key: 'all-orders', label: '全部订单', path: '/orders/all' },
          { key: 'order-process', label: '订单处理', path: '/orders/process' },
          { key: 'after-sales', label: '售后订单', path: '/orders/after-sales' },
          { key: 'review-orders', label: '测评订单', path: '/orders/review' },
        ],
      },
      {
        key: 'order-rule', label: '订单规则', icon: 'rule',
        children: [
          { key: 'audit-rule', label: '审单规则', path: '/orders/rules/audit' },
          { key: 'gift-rule', label: '赠品规则', path: '/orders/rules/gift' },
          { key: 'merge-rule', label: '合单规则', path: '/orders/rules/merge' },
          { key: 'split-rule', label: '拆单规则', path: '/orders/rules/split' },
          { key: 'logistics-rule', label: '物流规则', path: '/orders/rules/logistics' },
          { key: 'address-config', label: '地址配置', path: '/orders/rules/address' },
          { key: 'mark-rule', label: '标发规则', path: '/orders/rules/mark' },
        ],
      },
      {
        key: 'order-other', label: '其他功能', icon: 'misc',
        children: [
          { key: 'submit-platform', label: '提交平台', path: '/orders/submit-platform' },
          { key: 'pkg-combine', label: '物流组包', path: '/orders/pkg-combine' },
          { key: 'logistics-track', label: '物流追踪', path: '/orders/logistics-track' },
          { key: 'logistics-recon', label: '物流对账', path: '/orders/logistics-recon' },
          { key: 'purchase-advice', label: '采购建议', path: '/orders/purchase-advice' },
          { key: 'offline-orders', label: '未上网单', path: '/orders/offline' },
        ],
      },
    ],
  },
  {
    key: 'ads',
    label: '广告',
    groups: [
      {
        key: 'ad-board', label: '广告看板', icon: 'chart',
        children: [
          { key: 'walmart-ad-board', label: 'Walmart广告看板', path: '/ads/board/walmart' },
        ],
      },
      {
        key: 'ad-mgmt', label: '广告管理', icon: 'ad',
        children: [
          { key: 'ad-walmart', label: 'Walmart', path: '/ads/walmart' },
          { key: 'ad-tiktok', label: 'TikTok', path: '/ads/tiktok', badge: 'NEW' },
          { key: 'ad-temu', label: 'Temu(全托管)', path: '/ads/temu', badge: 'NEW' },
        ],
      },
      {
        key: 'traffic', label: '流量分析', icon: 'flow',
        children: [
          { key: 'walmart-trends', label: 'Walmart热门搜索趋势', path: '/ads/walmart-trends' },
        ],
      },
      {
        key: 'smart-tool', label: '智能工具', icon: 'tool',
        children: [
          { key: 'walmart-schedule', label: 'Walmart分时策略', path: '/ads/walmart-schedule' },
        ],
      },
      {
        key: 'ad-asset', label: '广告资产', icon: 'asset',
        children: [
          { key: 'asset-library', label: '资产库', path: '/ads/asset-library' },
        ],
      },
    ],
  },
  {
    key: 'fulfillment',
    label: '平台仓',
    groups: [
      {
        key: 'pf-stock', label: '库存', icon: 'stock',
        children: [
          { key: 'pf-walmart-stock', label: 'Walmart库存', path: '/fulfillment/stock/walmart' },
          { key: 'pf-temu-stock', label: 'Temu库存', path: '/fulfillment/stock/temu' },
          { key: 'pf-fbt-stock', label: 'FBT库存', path: '/fulfillment/stock/fbt' },
          { key: 'pf-full-stock', label: 'FULL库存', path: '/fulfillment/stock/full' },
          { key: 'pf-ali-stock', label: 'AliExpress库存', path: '/fulfillment/stock/aliexpress' },
          { key: 'pf-wayfair-stock', label: 'Wayfair CG库存', path: '/fulfillment/stock/wayfair' },
        ],
      },
      {
        key: 'pf-shipment', label: '货件', icon: 'truck',
        children: [
          { key: 'pf-walmart-ship', label: 'Walmart货件', path: '/fulfillment/shipment/walmart' },
          { key: 'pf-temu-prep', label: 'Temu备货单', path: '/fulfillment/shipment/temu-prep' },
          { key: 'pf-temu-dispatch', label: 'Temu发货台', path: '/fulfillment/shipment/temu-dispatch' },
          { key: 'pf-temu-ship', label: 'Temu货件', path: '/fulfillment/shipment/temu' },
          { key: 'pf-shein-prep', label: 'SHEIN备货单', path: '/fulfillment/shipment/shein-prep' },
          { key: 'pf-shein-ship', label: 'SHEIN货件', path: '/fulfillment/shipment/shein' },
          { key: 'pf-ali-invite', label: 'AliExpress入仓邀约', path: '/fulfillment/shipment/ali-invite' },
          { key: 'pf-ali-jit', label: 'AliExpress JIT备货', path: '/fulfillment/shipment/ali-jit' },
          { key: 'pf-ali-warehouse', label: 'AliExpress仓发备货', path: '/fulfillment/shipment/ali-warehouse' },
          { key: 'pf-ali-ship', label: 'AliExpress货件', path: '/fulfillment/shipment/ali-ship' },
          { key: 'pf-tt-prep', label: 'TikTok备货单', path: '/fulfillment/shipment/tiktok-prep' },
          { key: 'pf-tt-dispatch', label: 'TikTok发货台', path: '/fulfillment/shipment/tiktok-dispatch' },
          { key: 'pf-tt-delivery', label: 'TikTok送货管理', path: '/fulfillment/shipment/tiktok-delivery' },
          { key: 'pf-fbt-ship', label: 'FBT货件', path: '/fulfillment/shipment/fbt' },
        ],
      },
      {
        key: 'pf-deliver', label: '发货', icon: 'send',
        children: [
          { key: 'multi-pf-deliver', label: '多平台发货单', path: '/fulfillment/deliver/multi' },
          { key: 'head-cost-split', label: '头程分摊', path: '/fulfillment/deliver/head-cost' },
        ],
      },
      {
        key: 'pf-return', label: '退货', icon: 'return',
        children: [
          { key: 'return-mgmt', label: '退货管理', path: '/fulfillment/return' },
        ],
      },
    ],
  },
  {
    key: 'warehouse',
    label: '仓库',
    groups: [
      {
        key: 'wh-stock', label: '库存', icon: 'wh-stock',
        children: [
          { key: 'wh-list', label: '仓库列表', path: '/warehouse/list' },
          { key: 'wh-stock-detail', label: '库存明细', path: '/warehouse/stock-detail' },
          { key: 'wh-age', label: '库龄报表', path: '/warehouse/age' },
          { key: 'wh-stock-flow', label: '库存流水', path: '/warehouse/stock-flow' },
          { key: 'wh-all-stock', label: '全仓库存', path: '/warehouse/all-stock' },
        ],
      },
      {
        key: 'wh-ship-mgmt', label: '发货管理', icon: 'wh-ship',
        children: [
          { key: 'wh-wave', label: '波次管理', path: '/warehouse/wave' },
          { key: 'wh-resort', label: '二次分拣', path: '/warehouse/resort' },
          { key: 'wh-scan-check', label: '扫描验货', path: '/warehouse/scan-check' },
          { key: 'wh-weigh-ship', label: '称重发货', path: '/warehouse/weigh-ship' },
        ],
      },
      {
        key: 'wh-receive', label: '收货管理', icon: 'receive',
        children: [
          { key: 'wh-receive-list', label: '收货单', path: '/warehouse/receive', badge: 'NEW' },
        ],
      },
      {
        key: 'wh-overseas', label: '海外仓', icon: 'globe',
        children: [
          { key: 'wh-oversea-prep', label: '海外仓备货单', path: '/warehouse/overseas/prep' },
          { key: 'wh-third-party', label: '三方仓库存', path: '/warehouse/overseas/third-party' },
        ],
      },
      {
        key: 'wh-cost', label: '成本补录', icon: 'cost',
        children: [
          { key: 'wh-cost-supp', label: '成本补录单', path: '/warehouse/cost-supp' },
        ],
      },
      {
        key: 'wh-inout', label: '出入库', icon: 'inout',
        children: [
          { key: 'wh-other-in', label: '其他入库', path: '/warehouse/other-in' },
          { key: 'wh-other-out', label: '其他出库', path: '/warehouse/other-out' },
          { key: 'wh-adjust', label: '调整单', path: '/warehouse/adjust' },
          { key: 'wh-stocktake', label: '盘点单', path: '/warehouse/stocktake' },
        ],
      },
      {
        key: 'wh-pack', label: '装箱管理', icon: 'pack',
        children: [
          { key: 'wh-pack-mgmt', label: '装箱管理', path: '/warehouse/pack/mgmt' },
          { key: 'wh-scan-pack', label: '扫描装箱', path: '/warehouse/pack/scan' },
        ],
      },
    ],
  },
  {
    key: 'logistics',
    label: '物流',
    groups: [
      {
        key: 'head-logistics', label: '头程物流', icon: 'head-l',
        children: [
          { key: 'carrier-list', label: '物流商列表', path: '/logistics/carrier' },
          { key: 'head-l', label: '头程物流', path: '/logistics/head' },
        ],
      },
      {
        key: 'self-logistics', label: '自发货物流', icon: 'self-l',
        children: [
          { key: 'logistics-mgmt', label: '物流管理', path: '/logistics/self/mgmt' },
          { key: 'freight-template', label: '运费模板', path: '/logistics/self/freight' },
          { key: 'address-mgmt', label: '地址管理', path: '/logistics/self/address' },
        ],
      },
    ],
  },
  {
    key: 'data',
    label: '数据',
    groups: [
      {
        key: 'data-analysis', label: '数据分析', icon: 'data',
        children: [
          { key: 'multi-platform-board', label: '多平台看板', path: '/' },
          { key: 'sales-stat', label: '销量统计', path: '/data/sales-stat' },
          { key: 'temu-product-an', label: 'Temu产品分析', path: '/data/temu-product' },
          { key: 'tt-product-an', label: 'TikTok产品分析', path: '/data/tiktok-product' },
          { key: 'walmart-product-an', label: 'Walmart产品分析', path: '/data/walmart-product' },
          { key: 'shein-product-an', label: 'SHEIN产品分析', path: '/data/shein-product', badge: 'NEW' },
        ],
      },
      {
        key: 'topic-analysis', label: '主题分析', icon: 'topic',
        children: [
          { key: 'temu-prep-an', label: 'Temu备货单分析', path: '/data/temu-prep' },
          { key: 'temu-op-board', label: 'Temu经营看板', path: '/data/temu-op-board', badge: 'NEW' },
          { key: 'temu-launch-board', label: 'Temu上新看板', path: '/data/temu-launch-board', badge: 'NEW' },
        ],
      },
      {
        key: 'report-center', label: '报告中心', icon: 'report',
        children: [
          { key: 'reports', label: '报告中心', path: '/data/reports' },
        ],
      },
    ],
  },
  {
    key: 'finance',
    label: '财务',
    groups: [
      {
        key: 'payment', label: '请付款', icon: 'pay',
        children: [
          { key: 'payment-pool', label: '请款池', path: '/finance/pool' },
          { key: 'payment-req', label: '请款单', path: '/finance/req' },
          { key: 'payment-pay', label: '付款单', path: '/finance/pay' },
          { key: 'payment-recv', label: '收款单', path: '/finance/recv' },
        ],
      },
      {
        key: 'profit', label: '利润管理', icon: 'profit',
        children: [
          { key: 'profit-multi', label: '多平台利润报表', path: '/finance/profit/multi' },
          { key: 'profit-temu', label: 'Temu利润报表', path: '/finance/profit/temu', badge: 'HOT' },
          { key: 'profit-tt', label: 'TikTok利润报表', path: '/finance/profit/tiktok' },
          { key: 'profit-walmart', label: 'Walmart利润报表', path: '/finance/profit/walmart' },
        ],
      },
      {
        key: 'settle', label: '结算管理', icon: 'settle',
        children: [
          { key: 'settle-temu', label: 'Temu结算中心', path: '/finance/settle/temu', badge: 'NEW' },
          { key: 'settle-tt', label: 'TikTok结算中心', path: '/finance/settle/tiktok' },
          { key: 'settle-shein', label: 'SHEIN结算中心', path: '/finance/settle/shein' },
        ],
      },
      {
        key: 'cost', label: '成本管理', icon: 'cost-2',
        children: [
          { key: 'expense', label: '费用管理', path: '/finance/expense' },
          { key: 'batch-cost', label: '批次成本', path: '/finance/batch-cost', badge: 'NEW' },
        ],
      },
    ],
  },
  {
    key: 'tools',
    label: '工具',
    groups: [
      {
        key: 'print', label: '打印工具', icon: 'printer',
        children: [
          { key: 'print-template', label: '打印模板', path: '/tools/print/template' },
          { key: 'export-template', label: '导出模板', path: '/tools/print/export-template' },
          { key: 'label-template', label: '打印标签（模板）', path: '/tools/print/label-template' },
        ],
      },
      {
        key: 'kol', label: '达人管理', icon: 'star',
        children: [
          { key: 'tiktok-kol', label: 'TikTok达人管理', path: '/tools/kol/tiktok' },
        ],
      },
    ],
  },
  {
    key: 'settings',
    label: '设置',
    groups: [
      {
        key: 'account', label: '账号管理', icon: 'user',
        children: [
          { key: 'sub-account', label: '子账号', path: '/settings/sub-account' },
          { key: 'role', label: '角色管理', path: '/settings/role' },
          { key: 'data-scope', label: '数据范围管理', path: '/settings/data-scope' },
        ],
      },
      {
        key: 'sys-set', label: '系统设置', icon: 'gear',
        children: [
          { key: 'biz-set', label: '业务设置', path: '/settings/biz' },
          { key: 'fx-set', label: '汇率设置', path: '/settings/fx' },
        ],
      },
      {
        key: 'approval', label: '审批管理', icon: 'check',
        children: [
          { key: 'approval-workspace', label: '审批工作台', path: '/settings/approval/workspace' },
          { key: 'approval-config', label: '审批设置', path: '/settings/approval/config' },
        ],
      },
      {
        key: 'shop-set', label: '店铺管理', icon: 'shop',
        children: [
          { key: 'shop-auth', label: '店铺授权', path: '/shops' },
          { key: '1688-account', label: '1688账号管理', path: '/settings/shop/1688' },
          { key: 'custom-shop', label: '自定义店铺', path: '/settings/shop/custom' },
        ],
      },
      {
        key: 'plugin', label: '插件管理', icon: 'plugin',
        children: [
          { key: 'task-center', label: '任务中心', path: '/settings/plugin/task' },
        ],
      },
      {
        key: 'package', label: '套餐管理', icon: 'package',
        children: [
          { key: 'package-buy', label: '套餐购买', path: '/settings/package/buy' },
        ],
      },
      {
        key: 'log', label: '日志管理', icon: 'log',
        children: [
          { key: 'op-log', label: '操作日志', path: '/settings/log' },
        ],
      },
    ],
  },
];

export function flattenLeaves(): MenuLeaf[] {
  const out: MenuLeaf[] = [];
  for (const root of MENU_TREE) {
    for (const g of root.groups) {
      for (const c of g.children) out.push(c);
    }
  }
  return out;
}

export function findRootByPath(path: string): MenuRoot | null {
  for (const root of MENU_TREE) {
    for (const g of root.groups) {
      for (const c of g.children) {
        if (c.path === path || path.startsWith(c.path + '/')) return root;
      }
    }
  }
  return null;
}

export function findLeafByPath(path: string): MenuLeaf | null {
  for (const root of MENU_TREE) {
    for (const g of root.groups) {
      for (const c of g.children) {
        if (c.path === path) return c;
      }
    }
  }
  return null;
}
