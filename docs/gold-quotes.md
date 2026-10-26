# 金价 K 线

入口：`quotes.html#gold`，行情页的「金价 K线」。

- 标的：OANDA:XAUUSD，黄金现货/美元（伦敦金现），单位美元/金衡盎司。
- 图表：TradingView 官方 Advanced Chart 小组件；K线、OHLC、交易时间、市场状态与指标均直接由该组件提供。
- 周期：默认日K，可切换周K、月K；均线等指标通过图内「指标」菜单添加。
- 来源：https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA
- 组件文档：https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- 不保存或重算外部行情，不使用单一价格构造开高低收；不把COMEX连续合约替代现货。
- 金价切换时暂停股票轮询；返回股票、页面隐藏或退出时释放金价组件。初次连接失败显示重试和来源入口。外部行情时间与延迟状态由来源组件负责。
- 外部组件的图内刻度、样式和技术指标采用来源组件设置；站点保留来源标识。

验证：`node tests/gold-quotes.browser.cjs`；发布后额外回读外部组件真实画布与OANDA/黄金现货品种信息，不把iframe存在视为已取得行情。
