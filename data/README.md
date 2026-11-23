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

## SQLite 全库

从 [Full SQLite database](https://github.com/Yuxing954/guojin-shangshe-database/actions/workflows/full-sqlite.yml) 最近一次成功的 main 构建下载 `guojin-shangshe-sqlite` 并解压。也可运行 `python3 scripts/build_full_sqlite.py guojin-shangshe.sqlite`。

`datasets` 登记源文件、对应 SQL 表、行数和 SHA256。`json_collections` 登记 JSON 数组的源路径、视图名和行数。视图将记录字段展开为列，保留完整元素 `_record`。完整 JSON 原文在 `json_documents`。市场观点更新、历史归档和网站导出存在重复覆盖，统计前请选择单一口径。各模块仍通过原有 CSV、JSON 流程更新。

```sql
SELECT period_id, shopping_sales_cny_100m
FROM dutyfree_monthly ORDER BY period_id DESC LIMIT 12;

SELECT path, key_path, view_name, row_count
FROM json_collections WHERE path LIKE 'data/macro/%';

SELECT period, metric, value
FROM "companies_domestic_hotels_hworld__rows"
WHERE metric = 'RevPAR' ORDER BY period DESC LIMIT 10;
```

### 观点和纪要统一入口

查询 `research_records`，按 `kind` 选「观点」「纪要」或「附件」。`published` 为来源时间，`title` 为标题，`body` 为已有正文，`summary` 为已有摘要。商社观点可筛选 `kind='观点' AND in_sector_views=1`。未确认属于纪要的资料单列为附件。

原批次表统一收录于 `research_sources`。通过 `record_id = research_records.id` 回查源文件 `path` 和第几条记录 `position`（从 1 起），CSV 全部原字段在 `csv_fields`。同一观点按来源话题 ID 合并，无 ID 时仅合并来源、时间、标题和正文一致的记录；附件按资产 ID 区分。研究归档、更新索引与加工原文保存在 `json_documents`，可按原路径查询。其余业务入口沿用原表名。
