# 商社研究网站

网站采用六个一级导航：首页、行业数据、宏观数据、财报日历、观点纪要、实时行情。数据浏览器与历史工具位于辅助入口。所有活跃页面共用 site-ui.js、site-shell.js、site.css；专题样式之后加载 site-polish.css。具体显示约定见 [全站显示规范](./site-presentation.md)。

| 页面 | 功能与本轮统一 |
| --- | --- |
| index.html | 研究观察、五类行业关键指标、最新研究；共用导航，修复旧锚点与查询参数顺序。 |
| industry.html | 五行业、指标、趋势、区间与历史来源；时间范围和显示口径刷新恢复；相关研究读取轻量近期预览。 |
| hotel-dashboard.html | 经营、城市、供给与集团；统一页签与控件，保留最新历史覆盖、错期处理和 15 间及以上供给范围。 |
| dutyfree-dashboard.html | 月度和节假日、量价趋势及原表；检查 HTTP 状态，补失败重试；来源弹窗支持 Esc。 |
| gold-jewelry.html | 金价驱动、需求、公司经营、品牌价格、口径；统一页签与来源日期层级，补失败重试。 |
| consumption-macro.html | 消费全景、社零拆分、指标查询与历史；保留当月、累计与合并月口径，统一公共控件。 |
| macro.html | 31 项已核验核心指标、中美切换、五主题、KPI、比较与真实历史；同一宏观导航下保留 FedWatch 与 Polymarket。 |
| earnings.html | 默认展示最近实际披露，计划记录按需展开，使用 Choice MCP 快照与独立回执，保留实际披露/预约/公告三类日期、关注、CSV/ICS；共享导航和显示规范。 |
| research.html | 观点摘要、板块观点、全部观点、纪要文库；原文、附件权限、历史按需加载和最新三天摘要规则保持。 |
| search.html | 全站资料索引、分类、分页；输入防抖与读取失败重试。 |
| quotes.html | 107 家覆盖池、行情热力图、列表、自选、历史图；保留模块自适应图高、稳定 DOM、缓存与每秒请求节奏。 |
| dashboard.html | 数据集目录、CSV 搜索分页、结构化 JSON、原表下载与筛选导出；取消任意末行 KPI 和跨实体自动曲线。 |
| database.html | 保留盯盘工具；专注当前工具，旧行业、研究和覆盖锚点转入对应页面。 |
| companies.html | 已撤除页面的兼容跳转，证券和行业参数转到行情。 |

所有页面读取仓库来源快照，不能把页面更新时间当作观测期间，不能把第三方转引升级为官方值。纪要原文与来源权限不因样式调整改变。全站布局测试隔离外网；行情专项使用标明为测试替身的报价和已录制腾讯响应，不能据此声称已核验实时行情或 Choice 数据。

验证入口：

```sh
node scripts/check-site.cjs
node --test scripts/*.test.cjs tests/*.test.cjs tests/*.test.js
node tests/site-unification.browser.cjs
node tests/macro-dashboard.browser.cjs
node tests/consumption-macro.browser.cjs
node tests/earnings-calendar.browser.cjs
node tests/quotes-workbench.browser.cjs
```

浏览器测试需 Playwright 1.62.1。新 CI 工作流执行同样的检查并保存全站截图。全站测试检查 1440、1024、768、390px，专题测试补充 KPI 下钻、比较、下载、口径、筛选恢复、键盘、故障与恢复。

