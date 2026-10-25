# 全国社零看板

入口 `national-retail.html`，在宏观数据中与核心指标、地方社零、FedWatch、Polymarket并列。数据复用消费原始披露、社零月度产品当期披露和共用自动历史，读取顺序与社零月度产品一致。

四项核心读数、社零/除汽车趋势、商品/餐饮或城镇/乡村拉动、16项限额以上品类排序；完整数据默认折叠，保留CSV和来源。支持当月（1—2月合并）与累计、历史月份和趋势区间。查询条件保留在URL。

测算模型在 `scripts/national-retail-model.js`，页面只展示模型结果。公式和边界见 `data/national-retail-notes.json`，统一在 `data-notes.html#national-retail` 展示。同比是原披露名义增速，拉动是按金额与原披露同比反推可比基数的近似测算，保留两组总量拆解的舍入差异，不归一化。限额以上品类不是全国全口径拆解，品类拉动不合计为全国增速。未单独披露1月及缺失月份不补造。

验证：`node --test tests/national-retail.test.cjs` 与 `node tests/macro-compact.browser.cjs`；宏观原有中美双组及五种宽度、地方社零、FedWatch下载/展开和导航回归保持。
