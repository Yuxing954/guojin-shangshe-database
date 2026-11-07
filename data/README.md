# 数据目录

[返回项目首页](../README.md) · [通用数据清单](../data-manifest.json) · [维护文档](../docs/README.md)

## 按业务查找

| 数据 | 位置 |
| :--- | :--- |
| 酒店周度经营、集团、供给、假期 | 本目录下的 `hotel_*.csv` |
| 饭店协会年度结构 | `hotel-association-annual.json` / `.csv` |
| 酒店投资与 HCI | `hotel-investment-monthly.*` · `hotel-hci/` |
| 国内酒店公司 | `companies/domestic-hotels.json` 和 `companies/domestic-hotels/` |
| 海外酒店公司 | `companies/overseas-hotels.json` 和 `companies/overseas/` |
| 离岛免税 | `dutyfree_monthly.csv` · `dutyfree_holiday.csv` · `dutyfree/` |
| 宏观与消费 | `macro/` · `consumption-macro/` · `regional-retail/` |
| 旅游与三峡游轮 | `tourism/` |
| 行业整理与来源 | `industry/` · `sectors/` · `gold-jewelry/` |
| 观点、纪要与资料索引 | `research/` |
| 日报 | `daily/` |

## 观点纪要文件

- `research/updates/manifest.json` 登记增量 CSV；文件通过清单动态读取。
- `research/archive/manifest.json` 登记历史 JSON 分片。
- `research/library.json` 保存纪要原件入口；`resource-index.json` 用于资料检索。

## 文件维护

CSV 不一定直接写在网页链接里，也可能由清单、构建器或更新程序读取。移动或删除前检查代码、数据清单与来源记录的依赖。

本目录中的历史 CSV、来源回执及核验文件保留原文件名，便于追溯；原件下载与公开权限以[纪要维护指引](../docs/research-library.md)为准。
