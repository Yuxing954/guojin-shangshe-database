# 市场观点更新程序 v2

入口为 `scripts/sync_market_views.mjs`，核心为 `scripts/market_sync_core.mjs`。使用 Node.js 内置模块，不安装依赖；原始数据来自已登录的 `zsxq-cli`，GitHub 读写只通过当前会话的 GitHub 连接器。不能用个人令牌、git push 或未连接的 HTTP API 替代连接器。

## 每小时执行

本机工作副本位于：
`C:/Users/daiyu/Documents/Codex/2026-10-08/referenced-chatgpt-conversation-this-is-an-2/work/market-sync-rewrite`

在 `functions.exec` 中读取并执行 `scripts/market_sync_bridge.js`；该桥接器只允许六种 GitHub 工具。桥接器启动：

```
node scripts/sync_market_views.mjs --bridge --state <本机工作副本>/state
```

脚本通过标准输入输出传递连接器请求；不要直接在终端无人接管地启动。响应的大正文保存在本地，不直接打印到聊天。`state/current.json` 是原子保存的进度，`state/rpc` 保存固定版本读取结果与已创建对象，`state/bucket-cache` 按 SHA256 缓存索引桶。状态文件含原文，不应提交到 GitHub。

## 阶段与恢复

`snapshot → collect → dedup → review → publish → verify → done`

- snapshot：读取最新 main，再按该提交固定读取说明、算法、更新 manifest、归档 manifest 和摘要。
- collect：每页30条；保存成功页后再翻页，直至旧覆盖点，按 topic_id 消除分页边界重叠。CLI 每次40秒、最多重试一次；游标不前进即失败，不推进覆盖点。
- dedup：先过滤无正文的标签/图片占位，再计算 UTF-8 SHA256 的 topic、stamp、body、compactBody 键；仅取候选桶，校验 SHA256，缓存不变的桶。索引落后时补读未索引的更新 CSV；不读大 recent.json 或基础观点 CSV。
- review：程序输出 `needs_review`，语义判断仍由助手完成。读取本地 `review-input.json` 中实际新增正文和现有摘要，写 `review.json` 后重启同一入口。程序本身不能猜测行业相关性或附件内容。
- publish：程序生成 CSV、更新引用清单/计数、推进覆盖点、同批写摘要；先生成对象，最后以 expected_sha 非强制更新 main。每个成功对象立即保存；未知提交结果先查 main。并发时留存旧批次并从新 main 重新去重，不覆盖别人的提交。
- verify：核对归档覆盖点、条数、来源 topic 桶、相应时间分片、摘要、资源索引、全量导出校验回执、构建状态、Pages 和正式站 manifest。等待中的任务只保存 verify 进度；下次先完成核验，不重扫、不重交。

单次执行约8分钟切片；桥接等待90秒超时；构建/部署20分钟仍未验证就明确报告。相同失败只通知一次，权限、源数据或索引不完整时保留原覆盖点。进程锁避免两个更新同时写入。

## 语义复核格式

`review.json`：

```json
{
  "runId": "与 review-input.json 一致",
  "decisions": [{"topicId":"实际来源ID","kind":"views|all_views|exclude|duplicate","reason":"依据正文的理由","duplicateOf":"仅重复项填写已接受的同批来源ID"}],
  "briefEvaluatedTopicIds": ["所有新选入商社观点的来源ID"],
  "briefUpserts": []
}
```

每个候选必须有且仅有一个决定。纯快递/快运/寄递行业投资观点只入 all_views；只有原文明确联系即时零售、餐饮、商超消费渠道的即时配送才可入 views。食品饮料逐条看包装、供应链和消费渠道，不整类纳入。仅标签、图片、附件链接不能推断出观点；同文重复发帖、仅表情/格式不同的同一观点也标重复。

briefUpserts 是完整摘要对象，沿用现有字段 id、sector、date、status、title、conclusion、evidence、boundary（可省略）、watch、sources。sources 保存 topicId、kind、date、publishedAt、title、url；发布时间必须与实际读取的来源秒级时间一致。先查来源ID，再查核心论点；同主题复用旧 id、保留已有来源并追加新证据，不另建摘要。预测保留可能性、条件及时间范围。边界和观察指标只有依据才写。不用“原帖称、作者认为、未独立核验”等模板，不出现“纪要文库”。摘要只保留北京时间当天及前两天，过期清理由程序执行。

## 验证与成本

运行 `node --test scripts/test_market_sync.mjs`；构建兼容测试为 `python scripts/test_research_market_views.py` 和 `python scripts/test_market_sync_receipt.py`。

构建器在 archive/manifest.json 写 marketViewsExport（路径、字节数、SHA256、Git blob SHA、coverageTo、totalRows）以及 indexedUpdateFiles。每次本地构建仍完整验证导出；连接器只比对这份小回执与全量文件元数据，不把约88MB全量正文反复送入模型。不会生成或维护 market-views-recent-300.json。

只在真实新增、摘要更新/过期清理、失败或需人工处理时通知；无变化保持安静。已提交、已构建和已上线必须分别报告。
