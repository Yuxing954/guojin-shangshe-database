# 知识星球数据更新工具

把知识星球「水木调研纪要-2.0」的商社相关观点，增量同步到资料库「商社·市场观点」表，并推送本仓库的 `data/商社-市场观点.csv`。

## 文件说明

| 文件 | 作用 |
|---|---|
| `config.json` | 星球 ID / 资料库表 ID / 仓库信息 / 关键词池（三层过滤：关键词池 + 泛词表 + 标题噪音词） |
| `zsxq_update.py` | 一站式更新脚本：抓取增量 → 过滤 → 清洗 → 入库 → 导出 CSV → 推 GitHub（含登录态预检自动恢复） |
| `clean_text.py` | 文本清洗（共用）：知识星球标签 `<e .../>` 转可读文本、折叠连续重复行、标题取首行 |
| `fix_market_view.py` | 存量数据修复：对整个「商社·市场观点」表做清洗与标题规范化回写（支持 `--dry-run` 预览） |
| `get_lib_token.py` | 自动铸造资料库 op_ token（无需手动传） |
| `backup_zsxq_auth.py` | 备份 zsxq-cli 登录凭据（DPAPI 密文）到 `zsxq_auth_backup.json` |
| `restore_zsxq_auth.py` | 从备份恢复登录凭据，免重新扫码 |
| `zsxq_auth_backup.json` | 登录凭据备份文件（见下方「登录凭据备份」说明） |

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

1. **zsxq-cli 已登录**：正常情况下无需手动登录——`zsxq_update.py` 启动时预检登录态，失效会自动从 `zsxq_auth_backup.json` 恢复；仅当恢复失败（备份过旧 / 跨机器 / DPAPI 绑定不匹配）才需扫码授权 `zsxq-cli auth login`
2. **资料库 op_ token**：**无需手动传**——脚本会自动调用 `get_lib_token.py` 现场铸造（30 分钟 TTL，即用即铸，永不过期）；仅在 WorkBuddy 会话内可用（依赖 `CODEBUDDY_MCP_CONFIG` 环境变量），WorkBuddy 重启后需在新会话里重跑
3. **GitHub PAT**：需 `Contents: Read and write` 权限（注意：WorkBuddy GitHub 连接器的集成 token 对本仓库只读，Contents 写入会 403，须用 PAT）

## 登录凭据备份（zsxq_auth_backup.json）

zsxq-cli 把 access token 以 **DPAPI 加密**后存在注册表 `HKCU\Software\ZsxqCli\keychain\zsxq-cli` 下。本目录的备份机制：

- **备份**：`python update/backup_zsxq_auth.py`（登录成功后跑一次；换号或重新授权后需重新备份）
- **恢复**：`python update/restore_zsxq_auth.py`（或交给 `zsxq_update.py` 自动处理）
- **安全边界**：备份文件里是 DPAPI 密文，**只能在备份时的同一 Windows 用户 + 同一台机器上解密**，泄露到别处也无法还原 token；仓库为私有，风险可控。若仓库转公开或多人协作，请把该文件移出仓库并加入 `.gitignore`

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

## 关键词池维护

- 池子初始 84 词来自历史数据「命中关键词」列反推，另补充约 70 个商社核心标的
- 新增关键词：直接编辑 `config.json` 的 `pool` 数组即可
- 食饮等噪音板块（无商社标的命中）会被自然过滤；若泛词误入，加进 `generic` 或 `noise_title_words`
