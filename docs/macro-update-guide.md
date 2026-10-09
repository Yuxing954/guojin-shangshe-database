# 宏观数据更新指引（供后续AI使用）

更新本项目宏观数据时，先同步 GitHub 最新 `main`，读取 `data/macro/choice-registry.json` 与现有历史快照，使用运行环境已连接的东方财富/Choice 妙想 MCP 查询审定指标，并通过 `update/macro_auto.py` 同步 BEA、BLS、Census 官方历史。核心指标和消费专题共用 `data/macro/automatic-series.json`，不要分别维护两套数据。更新必须核验准确名称、机构、频率、单位、季调及累计口径；增量保留历史，不插值、不拼接相近指标，不把获取时间当发布日期。检查真实缺期、修订及失败状态，运行相关测试，再按本次用户授权提交、合并并核验线上文件。密钥只从本机配置或环境变量读取，禁止上传；没有新数据或状态变化时，不仅为检查时间创建提交。

## 1. 找到数据与更新入口

| 文件 | 用途 |
|---|---|
| `data/macro/choice-registry.json` | Choice指标的审定名称、发布机构、频率、单位、转换和代码信息 |
| `update/macro_auto.py` | Choice限速抓取、官方历史补充、校验及增量合并 |
| `data/macro/automatic-series.json` | 核心指标和消费专题共用的补充历史、来源和更新状态 |
| `data/macro/coverage.json` | 起止、条数、真实缺期、结构性非发布月份及历史覆盖不足 |
| `data/consumption-macro/observations.json` | 原始官方消费披露；重叠期间优先保留精确金额和真实发布日期 |
| `data/macro/snapshot.json` | 原有宏观快照，另由`update/macro_data.py`维护 |
| `data/macro/predictions.json` | Polymarket预测，另由`update/polymarket_data.py`维护 |

先确认当前工作副本来自最新`main`，保留其他任务和用户未提交的修改。后续AI不应依赖某次聊天中的旧本机目录、提交号、条数或最新数值。

## 2. 执行抓取

要求Python 3.11及以上；BEA和Census工作簿解析需要`openpyxl`。若未安装，在当前项目使用的Python环境执行`python -m pip install openpyxl`。

本机已配置`mx-ds-mcp`时，在仓库根目录运行；以下为PowerShell示例，`YYYY-MM-DD`须替换成北京时间当天日期：

```powershell
python update/macro_auto.py --codex-config "$env:USERPROFILE\.codex\config.toml" --cutoff YYYY-MM-DD
```

其他环境可通过已有安全凭证机制注入`EM_API_KEY`，然后执行：

```text
python update/macro_auto.py --cutoff YYYY-MM-DD
```

不要读取或输出完整配置、密钥、认证头，也不要把它们加入GitHub或浏览器。运行环境没有Choice连接或凭证时，应说明阻塞并保留现有快照。用户已于2026-10-09确认本网站的现有Choice数据可公开展示和下载；这不意味着新数据源或其他用途也已获授权。

脚本已串行限速、复用重复查询，并对“操作过于频繁”重试。不要同时运行多个宏观更新进程或以并发轰炸接口。它只更新本地文件，不会自动提交、合并或部署。退出码`0`表示本次没有记录失败；`1`表示存在单项失败且历史已保留；`2`表示启动或整体执行异常。还必须检查各序列`status`、`errors`和覆盖信息，不能只看有多少序列含历史。

仅重试Choice中的指定项时：

```text
python update/macro_auto.py --codex-config <本机配置文件> --cutoff YYYY-MM-DD --only cn-cpi cn-pmi --skip-official
```

`--only`只筛选Choice注册项；不加`--skip-official`仍会运行全部官方补充。美国GDP、BLS指标和新屋开工由官方补充流程维护，不能用相近Choice序列替换。

## 3. MCP补查及回执重放

若命令行未取得准确序列，而当前AI可调用已连接的`mx_macro_data`，按注册表逐项补查：准确指标名称＋发布机构＋原生频率＋注册起点至北京时间当天的完整历史，要求保留原名、精度和来源链接。使用实际工具返回的JSON回执，不手写数值。

将本次新抓取回执保存到一个独立、本地忽略的目录，文件名须为`choice-<id>.json`，再使用`--receipts-dir <本次新回执目录>`重放；可与`--only`及`--skip-official`组合。不要混入旧回执冒充新抓取。历史原始回执默认存于`.cache/macro-receipts/`，其哈希文件名不会被`--receipts-dir`的`choice-*.json`规则自动选中。

精确名称、机构、频率和单位必须一致。已确认单指标代码用`code`核验；多指标表仅提供代码集合时，`codeCandidates`是表级候选集合，不能按代码和数据行的顺序配对。出现定义或代码不符时保留历史并报告，不能修改注册表来迁就返回。修改指标定义、转换或来源应作为单独的开发变更核验。

## 4. 检查和测试

- 确认最新期间未倒退，已有历史未因返回截短而消失；检查`revisedCount`及异常大幅修订。
- 真实缺期如实保留，图表断线；1—2月合并发布不拆出虚构单月，交易日序列不把周末及节假日算缺失。
- 比例、金额、当月、累计、折年率和季调不能混用。上年同期100指数按注册规则转换；舍入金额保留脚注。`releaseDate`未提供时留空，不以`fetchedAt`或`checkedAt`替代。
- 单项失败保留旧历史、标记失败并说明原因；不要把失败状态改成`ready`，也不要清空错误以便通过测试。部分更新可提交，但须明确失败项。

在仓库根目录运行：

```text
node --test tests/macro.test.cjs tests/consumption-macro.test.cjs
python tests/test_macro_auto.py
python tests/test_macro_data.py
python -m unittest discover -s tests -p "test_consumption_macro.py"
node scripts/site-data.test.cjs
node scripts/industry-model.test.cjs
```

核对页面`macro.html`和`consumption-macro.html`的最新值、来源、覆盖和CSV。有历史不等于所有应发布期间完整；缺期或覆盖不足不能宣称已补齐。

## 5. 提交与发布

常规共用历史更新仅提交`automatic-series.json`和`coverage.json`；Polymarket或原始官方消费披露的更新按对应流程另列文件。比较实际数值、期间、来源、修订和状态；只有抓取或检查时间变化时不创建无意义提交。新分支和PR以最新`main`为基础，避免覆盖其他任务。

本次任务授权合并部署时，测试和GitHub检查通过后合并，沿用现有GitHub Pages。回读线上页面、共用数据和覆盖报告，确认实际发布，而不是只报告“已推送”。交付说明新增期间、修订、失败或缺期，以及PR、提交和部署情况。

本项目已在Codex任务中设置北京时间每日17:30更新；这是需要本机和Codex运行的任务，不是仓库自带的云端调度。其他AI不得假定自己环境已有该任务，也不要重复创建调度。`.github/workflows/refresh-macro.yml`仍是人工触发的原有宏观/预测流程，不会自动获得本机Choice凭证。

如任务同时要求更新重要预测，再运行`python update/polymarket_data.py`。核对中文标题、英文原文、结果、来源及截止时间；译名由`data/macro/prediction-translations.json`按完整英文标题匹配，新合约需在核对原始规则后补充中文译名，不沿用已改题合约的旧译名。补充译名后重跑脚本生成快照。它不由`macro_auto.py`更新，也不在当前宏观定时任务的默认提交范围内。
