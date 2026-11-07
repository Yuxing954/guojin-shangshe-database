# 国金商社数据库

消费零售与社会服务研究工作台。

**[打开正式站](https://yuxing954.github.io/guojin-shangshe-database/industry.html)** · [维护文档](docs/README.md) · [数据目录](data/README.md) · [脚本目录](scripts/README.md) · [编辑规范](AGENTS.md)

## 网站入口

| 板块 | 内容 | 页面 |
| :--- | :--- | :--- |
| 行业数据 | 酒店、免税、旅游、三峡游轮、餐饮 | [行业看板](https://yuxing954.github.io/guojin-shangshe-database/industry.html) |
| 宏观数据 | 中美指标、消费专题、重要预测 | [宏观看板](https://yuxing954.github.io/guojin-shangshe-database/macro.html) |
| 重点公司 | 国内与海外酒店上市公司 | [国内酒店](https://yuxing954.github.io/guojin-shangshe-database/company-database.html) · [海外酒店](https://yuxing954.github.io/guojin-shangshe-database/overseas-hotels.html) |
| 观点纪要 | 商社观点、市场观点与纪要原件 | [研究资料库](https://yuxing954.github.io/guojin-shangshe-database/research.html) |
| 实时行情 | 覆盖公司行情、伦敦金现 | [行情工作台](https://yuxing954.github.io/guojin-shangshe-database/quotes.html) |
| 日历 | 财报披露与重要数据日程 | [日历](https://yuxing954.github.io/guojin-shangshe-database/earnings.html) |

## 研究产品

[酒店周度跟踪](https://yuxing954.github.io/guojin-shangshe-database/hotel-weekly-product.html) · [CPI 跟踪](https://yuxing954.github.io/guojin-shangshe-database/cpi-monthly-product.html) · [社零月度产品](https://yuxing954.github.io/guojin-shangshe-database/retail-monthly-product.html)

## 仓库怎么找

```text
.
├── *.html               网页入口与旧链接兼容页面
├── data/                业务数据、来源记录与研究分片
├── scripts/             页面脚本、样式、数据构建与导入工具
├── docs/                模块说明、口径与维护指引
├── tests/               数据和浏览器回归检查
├── update/              观点增量同步工具
├── .github/workflows/   自动检查与构建任务
├── data-manifest.json   通用数据浏览器的数据清单
├── site.webmanifest     手机添加到主屏幕配置
└── AGENTS.md            网站编辑约定
```

网页入口保留在根目录，避免改变已发布的网址。进入各目录后，先看该目录的 README。

## 常用维护

| 工作 | 指引 |
| :--- | :--- |
| 酒店周度数据 | [酒店数据更新](docs/hotel-data-update.md) |
| 国内 / 海外酒店季度数据 | [国内酒店](docs/domestic-hotels.md) · [海外酒店](docs/overseas-hotels.md) |
| 离岛免税月度数据 | [月度更新](docs/dutyfree-monthly-refresh.md) |
| 宏观数据 | [统一更新入口](docs/macro-update-guide.md) · [快速刷新](docs/macro-refresh-fast-path.md) |
| 观点与纪要 | [纪要维护](docs/research-library.md) · [增量读取](docs/research-incremental-read.md) |
| 页面和图表 | [网站说明](docs/site-presentation.md) · [图表交互](docs/chart-interactions.md) |

## 数据与发布

指标的统计期间、发布日期、来源和可比口径以对应记录为准。更新按各来源披露节奏进行，页面摘要生成时间不等于上游数据更新时间。

修改后运行受影响模块的现有检查，再核对 GitHub Pages 部署结果。检查通过、合并完成和正式站发布分别确认。

本仓库公开；登录凭据、Cookie、令牌和私有同步回执保存在仓库外。
