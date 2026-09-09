# 知识星球数据更新工具

把知识星球「水木调研纪要-2.0」的商社相关观点，增量同步到资料库「商社·市场观点」表，并推送本仓库的 `data/商社-市场观点.csv`。

## 文件说明

| 文件 | 作用 |
|---|---|
| `config.json` | 星球 ID / 资料库表 ID / 仓库信息 / 关键词池（三层过滤：关键词池 + 泛词表 + 标题噪音词） |
| `zsxq_update.py` | 一站式更新脚本：抓取增量 → 过滤 → 入库 → 导出 CSV → 推 GitHub |

## 更新流程

```
知识星球增量(30条/页分页抓取)
   → 关键词池命中(标题+正文, 忽略大小写)
   → 标题噪音词排除(仅泛词命中时丢弃)
   → 去重(时间+标题)
   → 写入资料库「商社·市场观点」表(50条/批)
   → 整表导出 CSV(UTF-8 BOM)
   → GitHub Contents API 推送(PAT 鉴权, 用完即弃不落盘)
```

## 前置条件

1. **zsxq-cli 已登录**：`zsxq-cli auth login`（OAuth 设备码授权，约 30 天有效）
2. **资料库 op_ token**：WorkBuddy 会话内获取，约 30 分钟过期；过期表现为 503/TEMPORARY_ERROR，重取即可
3. **GitHub PAT**：需 `Contents: Read and write` 权限（注意：WorkBuddy GitHub 连接器的集成 token 对本仓库只读，Contents 写入会 403，须用 PAT）

## 用法

```bash
# 全流程（抓取 + 入库 + 导出 + 推送）
python update/zsxq_update.py --lib-token op_xxx --github-token ghp_xxx

# 只更新资料库，不推 GitHub
python update/zsxq_update.py --lib-token op_xxx --skip-push

# 只把本地 data/商社-市场观点.csv 推上 GitHub
python update/zsxq_update.py --github-token ghp_xxx --skip-fetch

# 只跑抓取+入库+导出（GitHub 稍后手动推）
python update/zsxq_update.py --lib-token op_xxx --skip-push --skip-fetch
```

## 关键词池维护

- 池子初始 84 词来自历史数据「命中关键词」列反推，另补充约 70 个商社核心标的
- 新增关键词：直接编辑 `config.json` 的 `pool` 数组即可
- 食饮等噪音板块（无商社标的命中）会被自然过滤；若泛词误入，加进 `generic` 或 `noise_title_words`
