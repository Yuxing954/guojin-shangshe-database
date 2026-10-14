# 市场观点增量读取

先用 GitHub 连接器读取 main、data/research/updates/manifest.json 与 data/research/archive/manifest.json。历史 CSV 和 recent.json 不用于每小时去重。

索引键算法见 scripts/build_research_shards.py 的 keys(row)：topic:<topic_id>；stamp:<SHA256(发布时间前19位且T改空格 + | + 标题)>；body:<SHA256(正文CRLF/CR转LF且首尾trim)>；compactBody:<SHA256(正文删除全部空白)>。编码为UTF-8，哈希为小写十六进制。桶号为 SHA256(完整键) 的前两位；只读取候选键对应的 dedup 桶。任一键命中即重复，不修改原始来源时间。

archive/manifest.json 的 coverageTo 是索引覆盖点；若落后于 updates/manifest.json 的 coverageTo，还必须读取未索引的批次并补充去重键，不能把索引滞后当作没有重复。通过批次正文时间确定是否已被索引覆盖。若缺失覆盖点，保守读取全部更新批次。并发或无法读取时停止写入。

每个历史分片保留完整原始行；manifest列出路径、行数、时间范围、字节数及SHA256。只在需要核对原文时读取对应时间的分片。提交增量CSV、摘要、覆盖点和更新记录后，仓库构建自动重新生成索引与分片。回读索引覆盖点、SHA256、新增topic_id对应桶及最新分片，并验证构建部署。保留现有首屏缓存、最近2000条及网页历史查询方式。

商社精选分类补充：纯快递、快运、寄递公司及行业的股票推荐、业绩点评和行业策略归入 `all_views`，不进入 `views` 或“观点摘要”；明确讨论即时零售、餐饮或商超配送渠道价值的同城履约观点可以保留。历史更正只调整分类，原始正文和发布时间保留在全部观点分片中。


小程序读取文件由 `scripts/build_research_shards.py` 在同一构建流程中从完整归档生成：`data/research/market-views-recent-300.json` 是两类观点合并后按发布时间倒序的前300条；`data/research/market-views-all.json` 是两类市场观点的完整集合，包含前300条。每条包含 `kind`、`topicId`、`publishedAt` 与原始 `record`。新增观点或分类变化后，Actions 会重建两个文件并提交；回读时核对两文件 `coverageTo`、总数、最近文件不超过300条且与全量文件前缀一致。

## 附件索引完整性

刷新 `data/research/library.json` 时，按北京时间自然日窗口完整分页到窗口起点之前（例如最近3个自然日须读到前两日之前的分页边界），不能只取首屏或固定少量页面。分页边界未覆盖、接口失败或附件元数据字段缺失时，将扫描标记为不完整并停止声称已完整更新；下一轮从未覆盖的边界续读。

附件按“来源实例”记录：唯一键使用 `file_id + topic_id + attachment.create_time + filename`。同一文件的哈希/扩展名可用于合并内容记录，但不得因此丢弃另一帖子中的附件实例；每个实例都保留来源主题ID与可打开链接、帖子发布时间、附件原始发布时间、文件名、扩展名、字节数、时长秒数、下载数、平台提供的哈希及“未重新计算”状态、来源类型、分类和 `contentRead:false`。没有文件扩展名或无法分类时仍保留，扩展名记为 `unknown`、分类记为 `other`。未读取附件正文时，不能填写正文摘要或推断内容。

页面和搜索索引按附件实例展示并去重，不按 topic_id 单独去重；列表显示附件上传时间、大小、时长和下载数。相同文件在多个帖子出现时可共享一个内容记录，但仍显示每条来源实例。回读核对“源分页附件实例数 = 索引 occurrence 数”、每个 file_id 都可从主记录或别名定位、所有 occurrence 都能打开其来源链接；同时检查历史同文件重复实例、无扩展名和“其他”分类仍在索引中。只有这些计数和映射全部通过，才将本次附件窗口标记为完整。

