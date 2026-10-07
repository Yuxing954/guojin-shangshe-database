# 观点与纪要更新

研究页使用 `recent.json` 作为轻量索引。原始历史 CSV 保留；`updates/manifest.json` 记录知识星球同步范围、分类、数量、最新发布时间和增量文件。

2026-10-07 本次核对水木调研纪要-2.0 自 2026-09-03 起的主题，整理商社观点及商社研究附件。其余有实质正文的观点归入全部市场观点，通知、纯标题等不作为正文收录。附件按原主题分组，保留商社相关文件名与主题链接；音频未转写，文档未提取正文，均明确标记。

商社分类优先识别标题中的行业词、具体公司及商社主题；泛行业词偶然出现在正文时不直接归入商社。英文 OTA 使用词边界，排除 Nyota 等字符串误命中；“看好未来”和“中国黄金周”不按公司名称识别。历史 CSV 不改写，近期重新识别的主题通过 manifest 调整展示分类。

后续更新使用已授权的知识星球连接器，按时间倒序读取主题，持续分页至上次同步日期。原始页面只保存在本地，不提交头像、用户资料或临时访问参数。将返回的主题数组保存为 `page-*.json`，运行：

```sh
python scripts/import_research_topics.py --topics-dir /path/to/local-pages --since 2026-09-03 --batch-date 2026-10-07
python scripts/build_research_recent.py
python scripts/build_home_snapshot.py
python scripts/research_sources_test.py
python scripts/test_research_updates.py
```

更新必须包含完整分页范围；新批次与已有范围重叠，避免日期断档。同批次重跑会替换该批次文件，其他批次和历史 CSV 保留。合并按主题、时间与标题、正文摘要指纹去重，最新增量优先。

`recent.json` 每类最多 400 条。新观点打开时按需读取所在增量文件的完整正文；旧索引中的截断内容标明摘要并保留原文入口。历史库按需加载时同时合并增量文件。首页从同一索引取最新商社内容。

本地预览缺少大型历史 CSV 时可显式使用 `--use-existing-index`；此时完整历史条数为未知。正式构建必须读取完整历史 CSV，GitHub Actions 在主分支重新生成索引和首页摘要。定时构建仅整理仓库现有内容，不会自动获取知识星球新主题。
