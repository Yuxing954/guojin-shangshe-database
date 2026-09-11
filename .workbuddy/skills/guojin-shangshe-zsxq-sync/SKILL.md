---
name: guojin-shangshe-zsxq-sync
description: 同步「国金商社·线上可视化数据库」中来自知识星球「水木调研纪要-2.0」的两类观点数据：商社观点/商社·市场观点精选线，以及市场观点/全部-市场观点段子线。当用户说「更新知识星球数据」「更新商社观点和市场观点」「更新商社数据库」「跑一下观点同步」「按规则更新并排序」「同步全部市场观点」等，或需要维护 data/商社-市场观点.csv、data/全部-市场观点.csv 时使用。
agent_created: true
---

# 国金商社数据库 · 知识星球双线同步

## 目标

同时维护两条来自知识星球「水木调研纪要-2.0」的数据线：

| 数据线 | 定义 | 产物 | 核心约束 |
|---|---|---|---|
| **商社观点 / 精选线** | 与商社覆盖板块、标的、产业关键词相关的观点 | 资料库「商社·市场观点」表 + `data/商社-市场观点.csv` | 按 `config.json` 三层关键词规则过滤，清洗、去重、按发布时间降序 |
| **市场观点 / 段子线** | 更泛市场里真正有信息量的调研纪要、行业观点、数据点评短文 | `data/全部-市场观点.csv`，如有对应资料库表则同步该表 | 必须先剔除已进入商社观点的内容，再做“真段子”筛选，不能混入研报发布、附件贴、广告、通知 |

本 skill 是仓库脚本在 **macOS + WorkBuddy 客户端模式** 下的执行准则。仓库脚本原始运行环境可能偏 Windows：DPAPI 凭据、`LIB_SPACE_API` 环境变量、`zsxq-cli.cmd` 等；在本机执行时按本文的 WorkBuddy / PAT / zsxq-cli 适配方式处理。

## 关键标识

| 项 | 值 |
|---|---|
| 星球 group_id | `88888142214212` |
| 资料库 database_id | `xs7DJShaYbb07IWDaQgzyn` |
| 所属空间 | 团队空间「国金商社数据库」`8ZMtYx7TaF9yvciryKCYvu`（**team**，写入前必须确认范围） |
| 仓库 / 分支 | `Yuxing954/guojin-shangshe-database` / `main` |
| 商社观点 CSV | `data/商社-市场观点.csv` |
| 市场观点 CSV | `data/全部-市场观点.csv` |
| 规则配置 | `update/config.json`（`pool` / `generic` / `noise_title_words`） |
| 清洗模块 | `update/clean_text.py` |
| 段子筛选模块 | `update/segment_filter.py` |

资料库脚本根目录：
`/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library/`

## 第 0 步：先重读远端 HEAD（必做）

仓库迭代很快。动手前和推送前都要重新读一次：

1. `update/` 目录
2. `update/README.md`
3. `update/config.json`
4. `update/clean_text.py`
5. `update/segment_filter.py`
6. 两个 CSV 的当前远端版本

不要拿会话开头读到的脚本当现状；若仓库脚本已更新，以远端 HEAD 为准再打补丁或执行。

## 总体同步顺序

必须按以下顺序同步，避免两张表互相污染：

```text
抓取知识星球原始主题
  → 清洗正文与标题
  → 先跑商社观点精选线
  → 得到商社观点集合 commercial_keys
  → 再跑市场观点段子线
  → 市场观点先排除 commercial_keys
  → 市场观点再做“真段子”筛选
  → 两线分别去重、降序、导出
  → 资料库回读验收
  → GitHub 推送并用 commit SHA 验证
```

## 商社观点精选线规则

**三层过滤**（对 `title + "\n" + content` 大小写不敏感匹配）：

1. 命中 `pool` 任一关键词才保留；`hits` 记录全部命中词，入库时用 `|` 连接。
2. `title` 含 `noise_title_words` 任一噪音词，且 `hits` 全落在 `generic` 泛词表内，则丢弃。
3. 去重键必须同时覆盖：
   - 线上已有 `(时间, 标题)`
   - 本批已收录 `(时间, 标题)`
   - 如有 `原文链接/topic_id`，优先用 `topic_id` 做更强去重

历史教训：分页抓取存在边界重叠。只比对线上旧数据、不把本批已收录加入 `seen`，会把同一主题重复入库。

## 市场观点段子线规则

### 1. 必须先与商社观点互斥

市场观点不是商社观点的 superset 展示页。它需要补充“泛市场段子”，因此先剔除已经进入商社观点的记录：

| 优先级 | 去重键 | 说明 |
|---|---|---|
| 1 | `topic_id` 或 `原文链接` 中的 topic id | 最可靠。`https://wx.zsxq.com/group/<gid>/topic/<topic_id>` |
| 2 | `(时间, 标题)` | 与商社观点当前表保持一致 |
| 3 | `normalize_content(内容)` 后的 hash | 防止标题改写但正文相同 |
| 4 | 标题归一化后相似 + 发布时间接近 | 兜底人工复核，不自动删除大批量 |

执行市场观点线时，先构造 `commercial_keys`：

```text
commercial_topic_ids = 商社观点原文链接提取 topic_id
commercial_time_title = {(时间, 标题)}
commercial_content_hash = {hash(normalize_content(内容))}
```

若市场候选命中任一集合，则标记为 `dup_with_commercial` 并排除，除非用户明确要求保留。

### 2. “真正的段子”定义

这里的“段子”不是笑话，而是**有实质信息量、可被客户阅读的市场短内容**。保留对象包括：

- 调研纪要摘要、渠道反馈、专家交流纪要中的实质段落
- 行业观点、数据点评、政策/事件点评、盘面/资金/价格链反馈
- 有结论、有事实、有指标、有边际变化判断的短文
- 即使标题像“纪要/会议/交流会”，只要正文有完整内容，也可保留

必须剔除：

| 类型 | 判定线索 | 处理 |
|---|---|---|
| 研报发布 / 附件贴 | `报告发布`、`深度报告`、`研报合集`、`请查收附件`、`PDF`、`下载链接`、`见附件`、`原文链接` 为主且正文无摘要 | 丢弃 |
| 会议预告 / 直播通知 | `今晚`、`报名`、`直播`、`电话会`、`路演`、`参会方式`、`会议链接`、`回放`，且无实质纪要 | 丢弃 |
| 图片贴 / 文件贴 | 正文仅 `「图片」`、`「文件」`，或单行 ≤45 字且图片/附件承载主要内容 | 丢弃 |
| 纯标签 / 纯标题 | 仅 `#海外投行报告#`、标题党、无正文 | 丢弃 |
| 广告运营 | `扫码`、`加群`、`优惠`、`会员`、`课程`、`招募`、`抽奖`、`问卷`、`签到` | 丢弃 |
| 转发堆砌 | 大量链接/标题列表，缺少摘要观点 | 丢弃或人工复核 |
| 非市场内容 | 与金融市场、行业、公司、宏观、商品、政策无关 | 丢弃 |

### 3. “真段子”自动保留信号

满足以下任一组强信号时，倾向保留：

- 正文 ≥150 字，且包含分析特征词：`同比`、`环比`、`预期`、`边际`、`景气`、`供需`、`库存`、`订单`、`价格`、`利润`、`估值`、`业绩`、`政策`、`催化`、`风险`、`观点`、`结论`、`数据`、`调研`、`反馈`、`渠道`。
- 正文包含明确数字或指标，例如 `%`、`pct`、`亿元`、`万吨`、`万台`、`bps`、`PE`、`PB`、`CPI`、`PMI`、`社零`。
- 结构呈现“结论/原因/影响/建议/风险/摘要/核心观点”。
- 具有公司、行业、宏观或资产价格相关实体，并有解释性内容，而不是单纯文件名。

### 4. “研报发布”专项排除

用户明确要求：市场观点也要筛选，**确保是真正的段子，而不是发研报之类的东西**。因此对以下情况从严剔除：

```text
若标题或正文命中：研报、报告、深度、专题、跟踪、点评、合集、PDF、附件、下载、发布、外发、请查收
且正文缺少 ≥120 字的独立摘要/核心观点/数据点评
则判定为 report_drop，不进入市场观点。
```

例外：如果正文虽然提到“报告/点评”，但已经摘出了完整结论、关键数据和逻辑，可保留；记录 `keep_reason=has_substantive_summary`。

## 清洗规则（两线共用）

调用 `clean_text.py`，不可省略：

- `normalize_content()`：`<e .../>` 标签转可读文本、去知识星球水印、折叠连续重复行、规整空行。
- `make_title(cleaned_content)`：标题取清洗后内容首行，去 markdown `#`，30 字截断。
- 入库和导出必须使用清洗后的 `标题`、`内容`。

验收条件：

- 0 条内容包含 `<e ` 标签
- 0 条内容包含知识星球水印
- 0 条标题包含换行
- 100% 标题与 `make_title(内容)` 一致

## 排序规则

两条线都按发布时间**降序**：最新在前。

- 商社观点：资料库表和 `data/商社-市场观点.csv` 均降序。
- 市场观点：`data/全部-市场观点.csv` 降序；若有资料库表，也按降序重建。
- 排序函数要幂等：若输入已降序，输出应逐字节不变（除非清洗/去重改变内容）。

## 执行步骤

### A. 准备

1. 加载资料库能力并换取 `op_` token。`op_` token TTL 约 30 分钟，长任务中途要重新换票。
2. 检查 zsxq-cli 登录态：
   ```bash
   node node_modules/zsxq-cli/npm/scripts/zsxq-cli.js auth status
   ```
3. 若本机未安装 zsxq-cli，安装到托管 Node workspace，禁止全局安装：
   ```bash
   cd /Users/daiyuxing/.workbuddy/binaries/node/workspace
   /Users/daiyuxing/.workbuddy/binaries/node/versions/22.22.2-2/bin/npm install zsxq-cli --no-audit --no-fund
   ```
4. 读取 GitHub PAT。优先使用全局记忆中已验证的 PAT；若需要从资料库取，位置是团队空间「国金商社数据库」根目录的「GitHub Token 备忘」doc，nodeId `Dg5Qv9NTb60m73HvbCzVIF`。

### B. 同步商社观点

1. `get-database-content` 拉取当前「商社·市场观点」表。
2. 解析 CSV，记录 `cutoff = max(时间)`、全表 `record_id` 备份、重复组。
3. 用 zsxq-cli 从新到旧分页抓主题，直到页末时间 ≤ `cutoff`。
4. 按商社关键词规则过滤，使用清洗后内容构造标题。
5. 合并旧表 + 新增，去重，按发布时间降序。
6. 对团队空间写入前先向用户确认：新增数量、删除重复数量、是否整表重排。
7. 整表重排时：`batch_delete_database_records.py` 删除旧记录，再 `batch_add_database_records.py` 按降序重建。
8. 回读验收，导出 `data/商社-市场观点.csv`。

### C. 同步市场观点

1. 读取当前 `data/全部-市场观点.csv`，如有资料库表则同时读取资料库表。
2. 构造商社观点互斥集合 `commercial_keys`。
3. 从同一批知识星球主题或指定时间窗口抓取候选主题。
4. 清洗正文和标题。
5. 先排除与商社观点重复的候选：topic_id / `(时间, 标题)` / 内容 hash。
6. 再运行段子筛选：
   - 保留有实质信息量的调研纪要、观点、数据点评。
   - 剔除研报发布、附件贴、文件贴、图片贴、纯标签、广告运营、会议预告、直播通知。
7. 与已有市场观点去重：优先 topic_id，其次内容 hash，再 `(时间, 标题)`。
8. 合并、去重、按时间降序导出 `data/全部-市场观点.csv`。
9. 生成筛选审计摘要：
   - 候选数
   - 与商社观点重复剔除数
   - 非段子剔除数及原因分布
   - 新增市场观点数
   - 人工复核样例（如有）

### D. GitHub 推送

推送以下文件，视本轮实际变更决定是否包含脚本补丁：

| 路径 | 说明 |
|---|---|
| `data/商社-市场观点.csv` | 商社观点精选线 |
| `data/全部-市场观点.csv` | 市场观点段子线 |
| `update/zsxq_update.py` | 商社观点同步脚本，如改规则则推 |
| `update/zsxq_dump_all.py` | 市场观点同步脚本，如改规则则推 |
| `update/segment_filter.py` | 段子筛选规则，如改规则则推 |
| `update/README.md` | 流程/规则说明，如改规则则推 |

WorkBuddy GitHub 连接器可能只读。推送优先用 GitHub PAT 直连 `api.github.com` Contents API：

- Header：`Authorization: Bearer <PAT>`
- 大 CSV 推送要带重试，处理 `IncompleteRead`。
- 每个文件 PUT 前先 GET 当前 `sha`。
- 推送后用 commit SHA 的 raw URL 验证，避免 GitHub raw 缓存延迟。

## 验收清单

### 商社观点

- 行数 = 旧行数 - 重复删除 + 新增命中。
- `时间` 全表降序。
- `(时间, 标题)` 0 重复。
- 标题无换行，内容无 `<e ` 标签和知识星球水印。
- `标题 == make_title(内容)`。
- GitHub CSV 与资料库导出逐字节一致（允许 BOM 处理差异）。

### 市场观点

- `时间` 全表降序。
- 与商社观点 0 重复：topic_id、`(时间, 标题)`、内容 hash 三层都应通过。
- 研报发布/附件贴/直播通知/广告运营/图片文件贴不进入结果。
- 保留样本具备实质信息量：有观点、有数据、有摘要或有边际变化判断。
- 输出审计表：`kept_count`、`dup_with_commercial_count`、`report_drop_count`、`non_segment_drop_count`、`manual_review_count`。
- GitHub raw 文件可按 commit SHA 拉取并通过本地校验。

## 对用户汇报模板

完成后用短表格汇报：

| 模块 | 结果 |
|---|---|
| 商社观点 | 新增 N 条，去重 M 条，最终 X 条，已降序 |
| 市场观点 | 候选 A 条，剔除商社重复 B 条，剔除非段子 C 条，新增 D 条，最终 Y 条，已降序 |
| GitHub | 推送文件列表 + commit 链接 |
| 验收 | 降序 / 去重 / 清洗 / 互斥 / 段子筛选均通过 |

若市场观点中存在边界样本，不要擅自混入；列出 3–10 条标题请用户确认。

## 注意事项

- 团队空间写入属于协作数据变更，写入前必须先展示影响范围并获得确认。
- 不要把 GitHub PAT 写入脚本、日志、skill、memory 或输出文件。可以使用会话内环境变量或命令参数临时传入，用完即弃。
- 不要删除 `.workbuddy` 文件夹。
- 沙箱内 `git clone` 直连 GitHub 可能失败；优先 GitHub API / MCP / raw URL 重试。
- `raw.githubusercontent.com` 刚推送可能缓存旧内容；验证用 commit SHA URL。
- 大文件读写优先 Python `os.path.getsize` / API 流程，避免 shell 对大 CSV 偶发 SIGTERM。
- 若用户只说“更新市场观点”，也要先读取商社观点，用于互斥去重。