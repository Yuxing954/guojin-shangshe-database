# 知识星球数据更新工具

两条独立的数据线，均来自知识星球「水木调研纪要-2.0」：

| 数据线 | 脚本 | 产物 | 特征 |
|---|---|---|---|
| **精选线**（商社相关） | `zsxq_update.py` | 资料库「商社·市场观点」表 + `data/商社-市场观点.csv` | 关键词池过滤，只留商社板块，增量入库 |
| **全量线**（全部段子） | `zsxq_dump_all.py` | `data/全部-市场观点.csv` | 抓时间窗口内全部主题，段子筛选器剔除非纪要内容 |

## 文件说明

| 文件 | 作用 |
|---|---|
| `config.json` | 星球 ID / 资料库表 ID / 仓库信息 / 关键词池（三层过滤：关键词池 + 泛词表 + 标题噪音词） |
| `zsxq_update.py` | 精选线：抓取增量 → 过滤 → 清洗 → 入库 → 导出 CSV（按发布时间降序）→ 推 GitHub（含登录态预检自动恢复） |
| `zsxq_dump_all.py` | 全量线：抓取近 N 天全部主题 → 段子筛选 → 完全重复去重 → 导出 CSV → 推 GitHub |
| `segment_filter.py` | 段子判定器（全量线核心）：区分「有信息量的纪要/观点短文」与非纪要内容 |
| `clean_text.py` | 文本清洗（共用）：知识星球标签 `<e .../>` 转可读文本、去平台水印、折叠连续重复行、标题取首行 |
| `fix_market_view.py` | 存量数据修复：对整个「商社·市场观点」表做清洗与标题规范化回写（支持 `--dry-run` 预览） |
| `get_lib_token.py` | 自动铸造资料库 op_ token（无需手动传） |
| `backup_zsxq_auth.py` | 备份 zsxq-cli 登录凭据（DPAPI 密文）到 `zsxq_auth_backup.json` |
| `restore_zsxq_auth.py` | 从备份恢复登录凭据，免重新扫码 |
| `zsxq_auth_backup.json` | 登录凭据备份文件（见下方「登录凭据备份」说明） |

## WorkBuddy Skill

仓库已内置项目 skill：[`../.workbuddy/skills/guojin-shangshe-zsxq-sync/SKILL.md`](../.workbuddy/skills/guojin-shangshe-zsxq-sync/SKILL.md)。

该 skill 是本目录脚本的操作规程，重点补充两点人工规则：

1. **双线同步顺序**：先更新商社观点精选线，形成 `commercial_keys`；再更新市场观点段子线，市场观点必须先排除与商社观点重复的 topic / 标题 / 正文。
2. **市场观点筛选口径**：只保留真正有信息量的调研纪要、行业观点、数据点评短文；剔除研报发布、附件/PDF 贴、会议预告、直播通知、广告运营、纯图片/文件/标签贴。

后续在 WorkBuddy 中执行「更新商社观点和市场观点」时，应优先按该 skill 的验收清单输出：商社新增、市场观点候选、商社重复剔除、非段子剔除原因、最终条数、GitHub commit。

## 段子筛选规则（segment_filter.py）

「段子」= 有实质信息量的调研纪要 / 行业观点 / 数据点评短文。判定按「宁可放过可疑，不可错杀干货」原则，依次执行：

| 序号 | 规则 | 剔除原因 |
|---|---|---|
| 0 | 正文为空 / 仅占位符（`「文件」`「图片」）/ 纯链接 / 纯标签（`#海外投行报告#`）/ 纯符号 | 对应原因 |
| 1 | 有图片、正文为单行且 ≤45 字（内容实际在图里） | 图片贴（仅标题文字） |
| 1b | 单行且以「交流会/业绩会/纪要/调研纪要」等收尾、无正文（内容在附件） | 仅会议标题（无正文） |
| 2 | 标题命中噪音词（抽奖/签到/问卷调查/招募…）且内容不具实质分析性 | 标题噪音词：XX |
| 3 | 命中广告/运营词（扫码/加群/限时优惠…）且全文无分析特征 | 广告/运营词：XX |
| 4 | 以「今晚/直播/重要通知」等开头、无分析特征且偏短 | 纯通知贴 |
| 5 | 正文 <40 字且无分析特征词、无数字指标 | 内容过短且无信息量 |

**豁免机制**：正文 ≥150 字且含分析特征 → 不受标题噪音词限制（避免「关于美301两项调查结果更新」被误杀）。
**新词维护**：`NOISE_TITLE`（标题噪音）、`AD_WORDS`（广告词）、`ANALYSIS_KW`（分析特征词）都在文件顶部，直接改列表即可。


## 精选线更新流程（zsxq_update.py）

```
知识星球增量(30条/页分页抓取)
   → 关键词池命中(标题+正文, 忽略大小写)
   → 标题噪音词排除(仅泛词命中时丢弃)
   → 去重(时间+标题，线上已有 ∪ 本批已收录)
   → 清洗(标签/水印/重复行)
   → 写入资料库「商社·市场观点」表(50条/批)
   → 整表导出 CSV(UTF-8 BOM, 按发布时间降序)
   → GitHub Contents API 推送(PAT 鉴权, 用完即弃不落盘)
```

> 排序说明：看板前端本就按「时间」降序渲染，导出时同步降序可避免增量追加后行序与视图错位，
> 排序对已有序的输入是幂等的。
>
> 去重说明：去重集合同时覆盖「线上已有」与「本批已收录」。分页抓取存在边界重叠，同一主题可能在
> 增量里出现两次；只比对线上旧数据会让重复条目一并入库（历史数据中已出现过同 `时间`+同 `标题` 的重复行）。

## 全量线更新流程（zsxq_dump_all.py）

```
知识星球近 N 天全部主题(30条/页分页抓取至截止时间)
   → 清洗(标签/水印/重复行)
   → 段子筛选(segment_filter.py，剔除图片贴/文件贴/标签贴/通知/广告)
   → 完全重复内容去重(保留最新一条)
   → 导出 data/全部-市场观点.csv(UTF-8 BOM, 按时间倒序)
   → 可选：GitHub Contents API 推送
```

## 前置条件

1. **zsxq-cli 已登录**：正常情况下无需手动登录——`zsxq_update.py` 启动时预检登录态，失效会自动从 `zsxq_auth_backup.json` 恢复；仅当恢复失败（备份过旧 / 跨机器 / DPAPI 绑定不匹配）才需扫码授权 `zsxq-cli auth login`
2. **资料库 op_ token**：**无需手动传**——脚本会自动调用 `get_lib_token.py` 现场铸造（30 分钟 TTL，即用即铸，永不过期）；仅在 WorkBuddy 会话内可用（依赖 `CODEBUDDY_MCP_CONFIG` 环境变量），WorkBuddy 重启后需在新会话里重跑
3. **GitHub PAT**：需 `Contents: Read and write` 权限（注意：WorkBuddy GitHub 连接器的集成 token 对本仓库只读，Contents 写入会 403，须用 PAT）

## 登录凭据备份（zsxq_auth_backup.json）

zsxq-cli 把 access token 以 **DPAPI 加密**后存在注册表 `HKCU\Software\ZsxqCli\keychain\zsxq-cli` 下。本目录的备份机制：

- **备份**：`python update/backup_zsxq_auth.py`（登录成功后跑一次；换号或重新授权后需重新备份）
- **恢复**：`python update/restore_zsxq_auth.py`（或交给 `zsxq_update.py` 自动处理）
- **安全边界**：备份文件里是 DPAPI 密文，**只能在备份时的同一 Windows 用户 + 同一台机器上解密**，泄露到别处也无法还原 token。⚠️ 注意本仓库当前为 **Public**（为启用 GitHub Pages），该备份文件对所有人可见——虽然密文跨机器不可解密，但若在意请把它移出仓库并加入 `.gitignore`。

## 用法

```bash
# Windows 会话需先显式指定两个可执行入口（bash 下示例）：
export ZSXQ_CLI="C:/Users/daiyu/.workbuddy/binaries/node/versions/22.22.2-2/zsxq-cli.cmd"
export LIB_SPACE_API="C:/Users/daiyu/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library/space_api.py"

# 全流程（抓取 + 入库 + 导出 + 推送）
python update/zsxq_update.py --lib-token op_xxx --github-token ghp_xxx

# 只更新资料库，不推 GitHub
python update/zsxq_update.py --lib-token op_xxx --skip-push

# 只把本地 data/商社-市场观点.csv 推上 GitHub
python update/zsxq_update.py --github-token ghp_xxx --skip-fetch

# 只跑抓取+入库+导出（GitHub 稍后手动推）
python update/zsxq_update.py --lib-token op_xxx --skip-push --skip-fetch
```

### 全量线（全部-市场观点）

```bash
# 抓取最近 30 天全部段子 → 筛选 → 去重 → 导出 data/全部-市场观点.csv
python update/zsxq_dump_all.py --days 30

# 抓取 + 直接推 GitHub
python update/zsxq_dump_all.py --days 30 --github-token ghp_xxx

# 不重新抓取，用本地 _dump_raw.json 调筛选规则后重跑（调参时常用）
python update/zsxq_dump_all.py --skip-fetch

# 保留重复内容（默认会对完全相同的正文去重，只留最新一条）
python update/zsxq_dump_all.py --days 30 --keep-dup
```

产出两个辅助文件（均在 `update/` 下，用于人工复核，不推仓库）：
`_dump_dropped.csv`（被剔除记录 + 原因）、`_dump_duplicated.csv`（去重移除记录）、`_dump_raw.json`（原始抓取数据）。

> 网络提示：大文件（>5MB）经 Windows 系统代理推送时易超时/掉认证头，脚本默认直连 `api.github.com`；确需走代理时设 `GH_USE_PROXY=1`。

## 关键词池维护

- 池子初始 84 词来自历史数据「命中关键词」列反推，另补充约 70 个商社核心标的
- 新增关键词：直接编辑 `config.json` 的 `pool` 数组即可
- 食饮等噪音板块（无商社标的命中）会被自然过滤；若泛词误入，加进 `generic` 或 `noise_title_words`
