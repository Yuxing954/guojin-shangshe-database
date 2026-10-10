# 图表交互与免税同比

所有入口加载 `scripts/site-charts.js` 和 `scripts/site-charts.css`。新图表使用 `SiteCharts.attach(container, points)`；points 提供真实 SVG 坐标 x/y 和含期间、单位的 text，不能由曲线反推数值。简单 SVG 的 circle/rect 保留原始 title 可自动接入。

- 整图区按最近横轴位置显示该期数据；多条序列同一期间合并展示。
- 点击或手机点按固定，再点相同期间或 Esc 取消；左右键移动，Home/End 到两端。
- 切换指标后重新 attach，旧图监听和提示会清理；缩放使用 SVG 实际坐标变换。
- 日期、单位、口径、来源和缺失含义由数据模块提供；未知值保留 —。
- 字体、提示框、十字线使用共用样式。不同单位和多条序列的颜色仍保留语义。

## 免税月度同比

缺少同比时，以同月同口径的（本期 / 上年同期 - 1）×100 计算；已兼容的来源同比保留。行业生成器在来源优先级筛选后计算，记录分子、分母、期间和各自 sourceId，不把旧来源的同比硬拼到新来源的金额上。

`scripts/dutyfree_yoy.py` 由 `build_industry_snapshot.py` 自动调用；结果与计算依据分别存入 `data/industry/overview.json` 和 `data/dutyfree/monthly-calculations.json`。增量更新会跟踪计算模块的变化。免税专题加载完整 CSV 后用 `dutyfree-monthly-model.js` 补齐原表缺失同比，范围筛选在计算之后，当前范围导出带计算标记和依据。

缺基期、基期为零、累计与月度不一致均不计算。[海南政策从 2011-04-20 实施](https://www.gov.cn/xinwen/2019-04/20/content_5384792.htm)，因此 2011-04 不是完整经营月：2012-04 可保留算术比值，但提示明确该基期限制。原始 CSV 不改写，以保留来源值。

验证：`node --test tests/dutyfree-monthly.test.cjs`、`python -m unittest discover -s tests -p 'test_dutyfree_yoy.py'`、`node tests/site-charts.browser.cjs`。
