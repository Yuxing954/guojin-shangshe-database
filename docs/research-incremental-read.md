# 市场观点增量读取

更新程序及断点恢复流程见 [market-sync-v2.md](market-sync-v2.md)。入口为 `scripts/sync_market_views.mjs`；不要再逐次临时拼接更新脚本。

每次通过 GitHub 连接器读取 main，并按该提交固定读取本文、`scripts/build_research_shards.py`、`data/research/updates/manifest.json`、`data/research/archive/manifest.json` 和 `data/research/market-briefs.json`。知识星球使用已登录 CLI、每页30条连续读取到旧覆盖点；先落盘再翻页，不反复重取第一页。

去重键遵循 `scripts/build_research_shards.py` 的 `keys(row)`：`topic:<topic_id>`；`stamp:<SHA256(发布时间前19位且T改空格 + | + 标题)>`；`body:<SHA256(正文CRLF/CR转LF且首尾strip)>`；`compactBody:<SHA256(正文删除Python定义的全部空白)>`。编码为UTF-8、小写十六进制；桶为 `SHA256(完整键)[:2]`。任一键命中即重复，保留原始秒级来源时间。

只读取候选键对应桶；桶先按manifest的SHA256校验，校验通过的内容按SHA256缓存在本地，未变内容不重复请求。比较archive与updates覆盖点；索引落后时按indexedUpdateFiles补读未索引的更新CSV；旧版索引缺少该字段时保守补读更新CSV，不读基础观点CSV或大recent.json。历史核对只读取相应时间的小分片。

纯快递、快运、寄递行业投资观点归all_views；仅原文明示即时配送与即时零售、餐饮或商超消费渠道相关时才归views。历史分类迁移保留完整原文。摘要仅收商社相关观点，先去重source.topicId，再比较主题与核心论点；同主题追加证据更新旧条目。北京时间当天及前两天之外的摘要每次清理；未读附件不得纳入摘要。

CSV引用清单、条数、来源ID、分类、摘要与覆盖点在同一次提交中更新；先创建blob/tree/commit，最后以expected_sha非强制更新main。每一步进度落盘，并发时重新按最新main去重。无新增且摘要无变化不提交，仅摘要过期也提交。

Actions由完整归档生成market-views-all.json。archive/manifest.json的marketViewsExport记录导出的字节数、SHA256、Git blob SHA、coverageTo、totalRows；indexedUpdateFiles记录已覆盖批次。连接器回读小回执与全量文件元数据进行一致性验证，完整内容校验由构建测试执行，避免反复读取约88MB导出正文。不生成、读取或维护market-views-recent-300.json。

提交后分别核验归档覆盖点/条数、新topic桶、对应分片、摘要、资源索引、全量导出回执、构建、Pages部署及正式站manifest。等待部署保存verify阶段，下次继续核验；不要重新采集和重复提交。失败最多重试一次，明确报告失败阶段，不能把创建blob或commit当作已发布。
