# 国内酒店数据库

国内酒店页面按海外酒店的 HTML 组件、overseas-hotels.css、hotel-workspace.css、site-polish.css 重建，替换旧的 company-database.html 交互。海外页面与数据不变。

- 主入口：company-database.html；公司对比：domestic-hotel-comparison.html。
- 索引：data/companies/domestic-hotels.json；四家公司记录按公司分文件，共7427条指标，2018Q1—2026Q2。
- 来源数据：国内四集团经营数据明细_2018Q1起（2026-10-19整理）。每个指标保留独立来源、PDF物理页码、同比来源、基期和原披露备注；公开文件不含本地文件路径。
- 原始历史资料保留在研究项目；旧国内模块不再载入，未删除其他模块共用的历史来源文件。
- 无独立非同店推算，不对累计RevPAR/ADR/OCC作差得到季度值，不将缺失补零，不跨币种连线。
- 锦江同店自动选择累计，标签3M/6M/9M/FY。公司对比须使用相同期间；单季度下不填入锦江H1/9M/FY数据。
- 首旅早期如家业务、原存量分列；华住国际EUR/USD分列，停业范围分列；亚朵不倒填不同样本的同店基期。
- 详细统计口径见 data-notes.html#domestic-hotels；来源弹窗与CSV保留逐指标证据。

验证：node --test tests/domestic-hotels.test.cjs tests/overseas-hotels.test.cjs；浏览器验证公司切换、样本、日期、累计/单季、各层筛选、来源、导出、悬浮及键盘查看、移动屏宽和加载失败重试。
