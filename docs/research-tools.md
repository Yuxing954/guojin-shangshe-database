# A股投研工具入口核验

核验日期：2026-11-06。入口位于共享侧栏原“国家队持仓 / 数据来源与说明”区域；原持仓与ETF资金流并列，精选入口集中于tools.html。移动端沿用“产品”菜单进入投研工具。

逐站口径、数据日期与证据链接见data/research-tools.json；数据来源与说明页的“投研工具”模块读取同一记录。此记录是人工核验快照，不承诺持续日更。

|网站|用途|核验时数据|源码情况|
|---|---|---|---|
|[国家队持仓](https://h-jett.github.io/etf-radar/index.html)|ETF持有人 · 十大流通股东|行情 2026-11-04 · 持有人报告期 2025-12-31|[GitHub 源码公开](https://github.com/H-Jett/etf-radar)|
|[国家队ETF资金流](https://wwww1998.github.io/national-team-etf-flow/)|观察池ETF净申赎 · 指数归集|数据 2026-11-05|[GitHub 源码公开](https://github.com/wwww1998/national-team-etf-flow)|
|[市场与行业拥挤度](https://qrq3838.github.io/a-share-market-sentiment-dashboard/)|成交集中度 · 行业成交占比 · 风格|成交 2026-11-05 · 融资模块另列日期|[GitHub 页面与数据公开](https://github.com/qrq3838/a-share-market-sentiment-dashboard)|
|[ETF申赎与资金流](https://owen434.github.io/broad-index-dashboard/etf_flow_dashboard.html)|宽基与行业ETF · 同类合并 · CSV|数据 2026-11-05|[GitHub 源码公开](https://github.com/Owen434/broad-index-dashboard)|
|[股指期货会员持仓](https://owen434.github.io/broad-index-dashboard/cffex_net_position.html)|中信期货 · 前20会员 · 四品种|数据 2026-11-05|[GitHub 源码公开](https://github.com/Owen434/broad-index-dashboard)|
|[A股行业热力图](https://dapan.app/)|行业涨跌结构 · 多周期 · 自选|盘中行情 · 核验日 2026-11-06|[GitHub 开源 · MIT](https://github.com/wenyuanw/a-share-heatmap)|
|[两融与波动率观测](https://marketvix.org/)|融资余额 · 杠杆比例 · 波动率估算|数据 2026-11-05 · 部分功能收费|未找到公开GitHub仓库|

## 筛选与边界

- 国家队ETF净申赎与机构真实交易分开；期货会员席位与单一机构身份分开。
- qrq3838主模块新于融资模块；H-Jett行情日期新于持有人报告期。日期逐模块标注。
- Owen434的README快照旧于实际HTML，资金流分位以实际页面的绝对值120日口径为准。
- DateData虽有拥挤度/轮动界面，但未能核实实际加载后的数据日期和清楚的计算口径，暂不收录。
- qjr1997/fear-greed-index的README注明最新2026-04-10，未通过近期更新标准，暂不收录。
- 767313977/zhifujing公开页面是介绍页，完整工具需自部署，未纳入直接使用入口。
- 北向专题未找到同时满足可直接用、近期更新和口径可核验的小站。不能沿用旧版实时净买入展示；港交所2024年调整了披露机制，季度持股并非每日持股。核验依据：[港交所通知](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/HKSCC/2024/cc_HKSCC_NOM_217_2024.pdf)。
- GitHub源码公开不自动表示授予开源许可证；只有核实许可证的项目明确标为MIT。MarketVIX未找到公开仓库，免费与Pro范围分开。

## 验证范围

源站真实浏览加载、日期、交互与项目说明交叉核验，未逐笔复核上游数据。本站只增加跳转入口，不接入外站脚本、账户、追踪参数或数据采集。
