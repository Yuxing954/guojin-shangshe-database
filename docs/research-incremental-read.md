# 市场观点增量读取

先用 GitHub 连接器读取 main、data/research/updates/manifest.json 与 data/research/archive/manifest.json。历史 CSV 和 recent.json 不用于每小时去重。

索引键算法见 scripts/build_research_shards.py 的 keys(row)：topic:<topic_id>；stamp:<SHA256(发布时间前19位且T改空格 + | + 标题)>；body:<SHA256(正文CRLF/CR转LF且首尾trim)>；compactBody:<SHA256(正文删除全部空白)>。编码为UTF-8，哈希为小写十六进制。桶号为 SHA256(完整键) 的前两位；只读取候选键对应的 dedup 桶。任一键命中即重复，不修改原始来源时间。

archive/manifest.json 的 coverageTo 是索引覆盖点；若落后于 updates/manifest.json 的 coverageTo，还必须读取未索引的批次并补充去重键，不能把索引滞后当作没有重复。通过批次正文时间确定是否已被索引覆盖。若缺失覆盖点，保守读取全部更新批次。并发或无法读取时停止写入。

每个历史分片保留完整原始行；manifest列出路径、行数、时间范围、字节数及SHA256。只在需要核对原文时读取对应时间的分片。提交增量CSV、摘要、覆盖点和更新记录后，仓库构建自动重新生成索引与分片。回读索引覆盖点、SHA256、新增topic_id对应桶及最新分片，并验证构建部署。保留现有首屏缓存、最近2000条及网页历史查询方式。
