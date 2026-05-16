export interface OperationNavLeaf {
  label: string;
  route: string;
}

export interface OperationNavGroup {
  title: string;
  children: OperationNavLeaf[];
}

export interface OperationNavItem {
  label: string;
  route?: string;
  groups: OperationNavGroup[];
}

const routeOverrides: Record<string, string> = {
  '商品/商品管理/商品列表': '/products',
  '销售/产品管理/产品库存同步': '/inventory-alerts',
  '销售/产品管理/Temu核价': '/pricing-ops',
  '广告/广告看板/Walmart广告看板': '/ads-analysis',
  '广告/广告管理/Walmart': '/ads-analysis',
  '广告/广告管理/TikTok': '/ads-analysis',
  '广告/广告管理/Temu(全托管)': '/ads-analysis',
  '平台仓/库存/Temu库存': '/inventory-alerts',
  '仓库/库存/库存明细': '/inventory-alerts',
  '数据/数据分析/多平台看板': '/',
  '数据/数据分析/销量统计': '/sales-analysis',
  '数据/数据分析/Temu产品分析': '/product-analysis',
  '数据/数据分析/TikTok产品分析': '/product-analysis',
  '数据/数据分析/Walmart产品分析': '/product-analysis',
  '数据/主题分析/Temu经营看板': '/',
  '数据/报告中心/报告中心': '/reports',
  '财务/利润管理/多平台利润报表': '/profit-analysis',
  '财务/利润管理/Temu利润报表': '/profit-analysis',
  '财务/利润管理/TikTok利润报表': '/profit-analysis',
  '财务/利润管理/Walmart利润报表': '/profit-analysis',
  '设置/系统设置/业务设置': '/settings',
  '设置/系统设置/汇率设置': '/settings',
  '设置/店铺管理/店铺授权': '/shops',
};

function moduleSlug(top: string, group: string, label: string) {
  return encodeURIComponent(`${top}-${group}-${label}`);
}

function routeFor(top: string, group: string, label: string) {
  const key = `${top}/${group}/${label}`;
  return routeOverrides[key] ?? `/modules/${moduleSlug(top, group, label)}?top=${encodeURIComponent(top)}&group=${encodeURIComponent(group)}&module=${encodeURIComponent(label)}`;
}

function group(top: string, title: string, children: string[]): OperationNavGroup {
  return {
    title,
    children: children.map((label) => ({ label, route: routeFor(top, title, label) })),
  };
}

export const operationNavItems: OperationNavItem[] = [
  {
    label: '商品',
    groups: [
      group('商品', '商品管理', ['商品列表', '多属性列表', '辅料管理']),
      group('商品', '配对管理', ['配对列表']),
      group('商品', '新品', ['新品开发']),
      group('商品', '基础信息', ['图片管理', '商品分类', '品牌管理', '属性管理', '质检模板', '自定义字段']),
    ],
  },
  {
    label: '销售',
    groups: [
      group('销售', '在线产品', ['Temu', 'Walmart', 'TikTok', 'SHEIN', 'eBay', 'AliExpress', 'MercadoLibre', 'Shopee', 'Lazada', 'Shopify', 'Rakuten', 'Cdiscount', 'OTTO', 'Ozon', 'Coupang']),
      group('销售', '产品管理', ['产品库存同步', 'Temu核价', 'Temu活动申报']),
    ],
  },
  {
    label: '订单',
    groups: [
      group('订单', '订单管理', ['全部订单', '订单处理', '售后订单', '测评订单']),
      group('订单', '订单规则', ['审单规则', '赠品规则', '合单规则', '拆单规则', '物流规则', '地址配置', '标发规则']),
      group('订单', '其他功能', ['提交平台', '物流组包', '物流追踪', '物流对账', '采购建议', '未上网单']),
    ],
  },
  {
    label: '广告',
    groups: [
      group('广告', '广告看板', ['Walmart广告看板']),
      group('广告', '广告管理', ['Walmart', 'TikTok', 'Temu(全托管)']),
      group('广告', '流量分析', ['Walmart热门搜索趋势']),
      group('广告', '智能工具', ['Walmart分时策略']),
      group('广告', '广告资产', ['资产库']),
    ],
  },
  {
    label: '平台仓',
    groups: [
      group('平台仓', '库存', ['Walmart库存', 'Temu库存', 'FBT库存', 'FULL库存', 'AliExpress库存', 'Wayfair CG库存']),
      group('平台仓', '货件', ['Walmart货件', 'Temu备货单', 'Temu发货台', 'Temu货件', 'SHEIN备货单', 'SHEIN货件', 'AliExpress入仓邀约', 'AliExpress JIT备货', 'AliExpress仓发备货', 'AliExpress货件', 'TikTok备货单', 'TikTok发货台', 'TikTok送货管理', 'FBT货件']),
      group('平台仓', '发货', ['多平台发货单', '头程分摊']),
      group('平台仓', '退货', ['退货管理']),
    ],
  },
  {
    label: '仓库',
    groups: [
      group('仓库', '库存', ['仓库列表', '库存明细', '库龄报表', '库存流水', '全仓库存']),
      group('仓库', '发货管理', ['波次管理', '二次分拣', '扫描验货', '称重发货']),
      group('仓库', '收货管理', ['收货单']),
      group('仓库', '海外仓', ['海外仓备货单', '三方仓库存']),
      group('仓库', '成本补录', ['成本补录单']),
      group('仓库', '出入库', ['其他入库', '其他出库', '调整单', '盘点单']),
      group('仓库', '装箱管理', ['装箱管理', '扫描装箱']),
    ],
  },
  {
    label: '物流',
    groups: [
      group('物流', '头程物流', ['物流商列表', '头程物流']),
      group('物流', '自发货物流', ['物流管理', '运费模板', '地址管理']),
    ],
  },
  {
    label: '数据',
    groups: [
      group('数据', '数据分析', ['多平台看板', '销量统计', 'Temu产品分析', 'TikTok产品分析', 'Walmart产品分析', 'SHEIN产品分析']),
      group('数据', '主题分析', ['Temu备货单分析', 'Temu经营看板', 'Temu上新看板']),
      group('数据', '报告中心', ['报告中心']),
    ],
  },
  {
    label: '财务',
    groups: [
      group('财务', '请付款', ['请款池', '请款单', '付款单', '收款单']),
      group('财务', '利润管理', ['多平台利润报表', 'Temu利润报表', 'TikTok利润报表', 'Walmart利润报表']),
      group('财务', '结算管理', ['Temu结算中心', 'TikTok结算中心', 'SHEIN结算中心']),
      group('财务', '成本管理', ['费用管理', '批次成本']),
    ],
  },
  {
    label: '工具',
    groups: [
      group('工具', '打印工具', ['打印模板', '导出模板', '打印标签（模板）']),
      group('工具', '达人管理', ['TikTok达人管理']),
    ],
  },
  {
    label: '设置',
    groups: [
      group('设置', '账号管理', ['子账号', '角色管理', '数据范围管理']),
      group('设置', '系统设置', ['业务设置', '汇率设置']),
      group('设置', '审批管理', ['审批工作台', '审批设置']),
      group('设置', '店铺管理', ['店铺授权', '1688账号管理', '自定义店铺']),
      group('设置', '插件管理', ['任务中心']),
      group('设置', '套餐管理', ['套餐购买']),
      group('设置', '日志管理', ['操作日志']),
    ],
  },
];
