# 国金商社数据库展示规范

默认母版为 Tabler 1.7.5 浅色 Dashboard。源码固定在 [官方提交](https://github.com/tabler/tabler/tree/4257ebcd1cd5494f71b84c485fd15749fc6d5f92)。使用仓库内的 CSS 和 JS。在线演示在持续更新，正式发布以锁定的资源为准。

| 区域 | 官方参照 | 代码入口与使用方式 |
| --- | --- | --- |
| 顶部双层导航、页头、全站搜索 | [Dashboard](https://preview.tabler.io/) | app.js 的 page、navbar、container-xl 和 common.setHeader |
| 本期指标、日报、历史小图 | Dashboard 的统计卡与活动摘要 | common.metricCard，home.js 加载真实历史。金额与比例分列，缺失用破折号，零值照常显示 |
| 趋势与筛选 | [Charts](https://preview.tabler.io/charts.html) | common.chartCard、chart、filterBar。SVG 保留断点与无障碍读数，鼠标、触摸或键盘选点 |
| 明细表、分页 | [Tables](https://preview.tabler.io/tables.html) | common.tableCard；表格外层 table-responsive，分页只截取显示行，下载使用完整筛选结果 |
| 结果、来源、全文 | [Search results](https://preview.tabler.io/search-results.html) 与模态框 | research.js、common.dialog、sourceDialog；原文与附件以原记录为准 |
| 空态、加载、失败重试 | Tabler empty、spinner、alert | common.empty、loading、failure |

## 页面模板

总览用工作台的日报、指标、趋势与资料列表。查询用数据目录的筛选、结果数、表格和导出。公司详情用当前公司、报告期、样本及可展开的各公司经营口径。行业使用分类、筛选、指标、趋势和明细。研究库以可点击标题进入全文，关闭后回到列表。日报按发布日期切换，在同一日期内浏览栏目。新界面从对应模块起步，先查公共组件再扩展。

## 尺寸与颜色

沿用 Tabler 的 container-xl、row-cards、card-header、card-body、page-title、subheader、h1、small text-secondary。正文用官方字体栈和系统中文回退。数值使用等宽数字，日期与来源为辅助信息。涨跌须同时给出符号和单位；同比百分点与百分比使用各自口径。仅同组指标卡等高。筛选与阅读操作支持键盘、触摸和窄屏。

## 变更与验证

组件展览使用 tools/design-system。进入该目录执行 npm ci 和 npm run storybook。故事中的固定数据只用于测试。真实业务显示和取数继续走 scripts/tabler-app。审查时打开官方参照、此前获准页面和本次运行图，分别检查功能与外观。视觉基准只能在明确批准后更新。主分支数据有变化时重新取最新代码并运行专项检查。

官方参照可用 `python tools/design-system/restore-reference.py` 恢复至独立的 `.cache/tabler-official`，再执行 `python -m http.server --directory .cache/tabler-official` 查看。归档校验覆盖 Dashboard、Charts、Tables、Search results 及其加载的展示资源。若线上演示已改版，恢复脚本将报告发生变化的文件。
