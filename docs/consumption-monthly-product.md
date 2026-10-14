# 社零与CPI月度产品

入口：consumption-monthly-product.html。沿用酒店周度产品的蓝白研究长图、点评、截图模式及3600像素宽PNG导出。数据共享 consumption-macro/observations.json 和 macro/automatic-series.json，使用 ConsumptionMacro.mergeAutomatic 合并，不另建数据快照或录入流程。

默认取两项都有数据的最新月；选单边月份时保留另一项空值。社零月度/1—2月合并、累计分列。网上商品仅累计；分品类为限额以上单位。CPI的value即同比涨跌幅，mom即环比；核心CPI扣除食品能源。趋势缺期断线，不插值。数据更新沿用 docs/macro-update-guide.md。

页面点评不永久保存；原始披露读取失败保留当前已展示数据。自动补充历史失败时使用原始披露并显示错误状态。来源链接按实际使用记录生成，发布日期单独展示。

测试：node --test tests/consumption-monthly.test.cjs；node tests/consumption-monthly.browser.cjs。浏览器测试核验月份、点评、真实PNG尺寸、失败恢复、手机与截图模式。
