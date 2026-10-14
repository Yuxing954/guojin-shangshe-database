# 重要数据日历

财报页新增“重要数据”页签，保留独立的财报查询。只维护五类：中国CPI、中国社零、美国CPI、美国非农、美联储议息。默认未来60天，也可按月或地区查看、导出当前列表ICS。无需账号，不储存用户关注。

## 数据与维护

`data/important-calendar.json` 是日程的唯一公开数据文件；当前核验范围为2026年四季度（14项）。官方计划可能调整；时间已过仅表示日程时间已过，不代表数据已经成功发布或本网站已经更新。日历不重复存储宏观指标数值，查看数据链接指向现有数据模块。

- 中国CPI/社零：[国家统计局2026年发布日程](https://www.stats.gov.cn/xw/tjxw/tzgg/202512/t20251224_1962137.html)。CPI 09:30，社零10:00；四季度日期分别为10月14日/11月9日/12月9日，以及10月19日/11月16日/12月15日。两类数据均为上月期间；不得为2月编造1月单月社零日程。
- 美国CPI/非农：[BLS官方2026年日程](https://www.bls.gov/schedule/2026/home.htm)，美东08:30。四季度CPI为10月14日/11月10日/12月10日，非农为10月2日/11月6日/12月4日，均对应上月数据。
- 美联储：[会议日历](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)、[10月日程](https://www.federalreserve.gov/newsevents/2026-october.htm)、[12月日程](https://www.federalreserve.gov/newsevents/2026-december.htm)。会议为美东10月27—28日、12月8—9日，决议在最后一天14:00。页面以北京时间10月29日02:00、12月10日03:00列示，会议原日期另行标注。12月会议附经济预测，但不拆成额外日历事件。

官方时区与带UTC偏移的`scheduledAt`同时保存；模型检查二者一致，并用Asia/Shanghai展示和筛选。ICS保存UTC时间，兼容跨日和夏令时。未知日期或时间不推算，待核实后补充。未来范围未录入时明确显示“后续日程待更新”，不沿用上年日期。

后续维护先核对官方最新日历，增量追加/修改事件，保留历史和来源；覆盖字段按实际核验范围更新，不能只改检查日期。与现有宏观定期更新批次一并核对即可，不新增高频请求或重复定时任务。每年官方新日历公布后补充下一年度；官方临时调整优先于年度计划。

`update/macro_due.py` 的日期是抓取检查窗口（含发布后的次日重试），不能直接作为客户看到的发布时间。当前开发没有改变抓取调度。

## 验证

- `node --test tests/important-calendar.test.cjs`
- `node scripts/earnings-calendar.test.cjs`
- `node tests/important-calendar.browser.cjs <base-url>`（浏览器测试需Playwright；可用EDGE_PATH指定Edge）

验证北京时间跨日、冬夏令时、期限耗尽、地区和月份筛选、ICS、五类数量、财报失败不影响重要日程，以及桌面/手机布局。发布后再检查正式站。
