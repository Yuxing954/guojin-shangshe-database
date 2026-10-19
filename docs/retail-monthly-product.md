# 社零月度产品

入口为 `retail-monthly-product.html`，全站侧栏与CPI月度产品并列。沿用CPI蓝白长图、标题、声明、月份/趋势范围选择、分月点评编辑、截图模式和3600像素宽PNG导出。

## 版面

四项同比（社零、除汽车、商品、餐饮）及较上月增速变化；当期金额、累计同比、季调环比；七段社零解读；16项限额以上商品同比；社零/除汽车及商品/餐饮两组历史趋势；来源与声明。长文字和品类数动态决定长图高度。

## 数据

复用 `observations.json` 与 `automatic-series.json` 的已有历史，本期原始披露、来源、季调修订和点评记录于 `data/products/retail-monthly-insights.json`。本文件不建立第二套历史库。下次共用历史收录本期后，金额和同比一致时合并，冲突则报错待核验。1—2月合并数据保留标签，不与单月计算增速差；缺失点不插值。分类只展示官方同比，不构造贡献值。

本次未发现9月消费专题解读，参考统计局1—8月解读的分析维度，但未转用其当期结论；9月正文依据2026-10-19社零表及经济运行稿，8月数据用于比较。研究判断独立标识。后续获得同月官方专题解读时，核对来源、时期与原因后更新，文字先提待复核PR，页面不自动生成AI点评。

验证：`node --test tests/retail-monthly.test.cjs tests/consumption-monthly.test.cjs` 与 `node tests/retail-monthly.browser.cjs`。
