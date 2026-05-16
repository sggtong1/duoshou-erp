# Pricing Operations Workbench UX

## Product Positioning

核价/调价模块是多平台聚合运营工具里的价格操作台。平台适配层当前先接 Temu，页面文案和信息架构保留扩展到其他平台的空间。

## Primary Workflow

```mermaid
flowchart LR
  A["进入价格操作台"] --> B["选择任务类型"]
  B --> C["核价单"]
  B --> D["调价单"]
  B --> E["SKU 供货价"]

  C --> C1["按平台/店铺/状态/关键词筛选"]
  C1 --> C2["查看建议价、申报价、站点、可议价状态"]
  C2 --> C3["批量同意"]
  C2 --> C4["批量拒绝并填写新报价/原因"]
  C3 --> C5["写回平台并更新本地状态"]
  C4 --> C5

  D --> D1["按平台/店铺/状态/单号/时间筛选"]
  D1 --> D2["查看调价原因、SKU 明细、原价、新价"]
  D2 --> D3["批量通过"]
  D2 --> D4["批量驳回并填写原因"]
  D3 --> D5["写回平台并刷新调价单列表"]
  D4 --> D5

  E --> E1["输入 SKU 或从单据侧栏带入"]
  E1 --> E2["查询供货价和站点价格"]
```

## Screen Layout

```mermaid
flowchart TB
  subgraph Page["价格操作台"]
    Header["顶部摘要: 待处理核价 / 待确认调价 / 今日已处理 / 异常数"]
    Tabs["分段视图: 核价单 | 调价单 | SKU 供货价"]
    Filter["筛选条: 平台、店铺、状态、关键词、时间"]
    Content["主表格: 多选、价格、站点、状态、更新时间、操作"]
    Side["右侧明细抽屉: 原始字段、SKU 明细、原因、平台返回结果"]
    ActionBar["底部批量操作条: 同意/通过、拒绝/驳回、刷新"]
  end
  Header --> Tabs --> Filter --> Content --> ActionBar
  Content --> Side
```

## Interaction Rules

- 核价单和调价单都默认显示待处理状态，避免运营先看到已完成历史。
- 写入动作必须二次确认；拒绝/驳回必须填写原因。
- 页面统一显示「平台」「店铺」「托管类型」「区域」，避免 Temu 细节渗透成产品边界。
- 单条操作与批量操作共用同一后端接口，降低行为差异。
- 平台返回失败时保留行级错误，不阻塞其他行继续处理。

## Temu Adapter Coverage

| Area | Temu API |
| --- | --- |
| 核价单查询 | `bg.price.review.page.query`, `bg.semi.price.review.page.query.order` |
| 核价单同意 | `bg.price.review.confirm`, `bg.semi.price.review.confirm.order` |
| 核价单拒绝 | `bg.price.review.reject`, `bg.semi.price.review.reject.order` |
| 调价单查询 | `bg.full.adjust.price.page.query`, `bg.semi.adjust.price.page.query`, `bg.semi.adjust.price.page.query.order` |
| 调价单审批 | `bg.full.adjust.price.batch.review`, `bg.semi.adjust.price.batch.review`, `bg.semi.adjust.price.batch.review.order` |
| 供货价查询 | `bg.goods.price.list.get`, `bg.glo.goods.price.list.get` |
