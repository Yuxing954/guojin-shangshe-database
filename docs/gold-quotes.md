# 黄金价格

入口：`quotes.html#gold`，行情页的「黄金价格」。

- 标的：OANDA:XAUUSD，黄金现货/美元（伦敦金现），单位美元/金衡盎司。
- 合约单位核验：https://www.shfe.com.cn/regulation/exchangerules/productrules/202512/t20251231_829960.html （第四条，人民币/克）。
- 国内沪金：SHFE:AU1!，上期所黄金期货连续合约，单位人民币/克。TradingView 对该品种不开放嵌入，且要求在其站内登录；提供直达链接 https://www.tradingview.com/symbols/SHFE-AU1%21/ ，本站不展示空白图表或虚构OHLC，不把国际金价人民币换算值当作国内沪金。
- 图表：TradingView 官方 Advanced Chart 小组件；K线、OHLC、交易时间、市场状态与指标均直接由该组件提供。
- 周期：默认日K，可切换周K、月K；均线等指标通过图内「指标」菜单添加。
- 来源：https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA
- 组件文档：https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- 不保存或重算外部行情，不使用单一价格构造开高低收；不把COMEX连续合约替代现货。
- 金价切换时暂停股票轮询；返回股票、页面隐藏或退出时释放金价组件。初次连接失败显示重试和来源入口。切换国内沪金同样释放伦敦金现组件，隐藏不适用的周期与刷新控件。外部行情时间与延迟状态由来源组件负责。
- 外部组件的图内刻度、样式和技术指标采用来源组件设置；站点保留来源标识。

验证：`node tests/gold-quotes.browser.cjs`；发布后额外回读外部组件真实画布与OANDA/黄金现货品种信息，不把iframe存在视为已取得行情。
