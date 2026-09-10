# 知识星球数据更新工具

将知识星球「水木调研纪要-2.0」的商社相关观点增量同步至资料库「商社·市场观点」，并推送到本仓库的 `data/商社-市场观点.csv`。

## 文件说明

| 文件 | 作用 |
|---|---|
| `config.json` | 星球 ID、资料库表 ID、仓库信息与关键词池（三层过滤：关键词池、泛词表、标题噪音词） |
| `zsxq_update.py` | 一站式更新脚本：抓取增量 → 过滤 → 入库 → 导出 CSV → 推送 GitHub；含登录态预检与恢复 |
| `get_lib_token.py` | 在配置的资料库运行环境中自动获取短期 `op_` token |
| `backup_zsxq_auth.py` | 将 zsxq-cli 登录凭据以 DPAPI 密文备份至 `zsxq_auth_backup.json` |
| `restore_zsxq_auth.py` | 从备份恢复登录凭据，避免重新扫码 |
| `zsxq_auth_backup.json` | 登录凭据备份文件；不应提交至公开仓库 |

## 更新流程

```text
知识星球增量（30 条/页分页抓取）
  → 关键词池命中（标题+正文，忽略大小写）
  → 标题噪音词排除（仅泛词命中时丢弃）
  → 去重（时间+标题）
  → 写入资料库「商社·市场观点」表（50 条/批）
  → 整表导出 CSV（UTF-8 BOM）
  → GitHub Contents API 推送（PAT 鉴权，用完即弃不落盘）
```

## 前置条件

1. **zsxq-cli 已登录**：脚本会预检登录态；失效时尝试从 `zsxq_auth_backup.json` 恢复。恢复失败（备份过旧、跨机器或 DPAPI 绑定不匹配）时，请运行 `zsxq-cli auth login` 重新授权。
2. **资料库 `op_` token**：可由脚本在已配置的运行环境中自动获取，也可通过 `--lib-token` 显式传入。
3. **GitHub PAT**：需要 `Contents: Read and write` 权限，用于将更新后的 CSV 推送至仓库。

## 凭据安全

仓库为公开仓库。不要提交访问令牌、Cookie、私钥或认证备份。请将 `zsxq_auth_backup.json` 加入 `.gitignore`，仅在受控设备上保存；若它曾被提交，请移除当前文件并清理 Git 历史。

## 用法

```bash
# 全流程：抓取、入库、导出、推送
python update/zsxq_update.py --lib-token op_xxx --github-token ghp_xxx

# 只更新资料库，不推送 GitHub
python update/zsxq_update.py --lib-token op_xxx --skip-push

# 只将本地 CSV 推送至 GitHub
python update/zsxq_update.py --github-token ghp_xxx --skip-fetch

# 只抓取、入库与导出；稍后手动推送 GitHub
python update/zsxq_update.py --lib-token op_xxx --skip-push --skip-fetch
```

## 关键词池维护

- 初始词池来自历史数据的「命中关键词」，并补充商社核心标的。
- 新增关键词：编辑 `config.json` 的 `pool` 数组。
- 若泛词带来误命中，将其加入 `generic` 或 `noise_title_words`。
