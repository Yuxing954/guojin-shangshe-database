# 宏观数据定期更新运行手册

用户于2026-10-11授权创建全模块更新任务并立即执行一次。常规数据批次完成校验后可通过GitHub连接器提交、合并并核验GitHub Pages；新增指标定义、单位、来源映射或异常修订另开PR供审阅。当前设置为本地Codex线程心跳，需要电脑开机及应用运行，不能宣称是24小时云端服务。仓库Actions仍不持有本机Choice凭证。

## 调度与范围

所有时间为Asia/Shanghai。宏观数据每天只运行一次；在单一批次内覆盖全部已审定模块，只查询有新披露或到复核周期的指标，避免重复全量查询。

| 任务 | 时间 | 更新范围 |
|---|---|---|
| 宏观数据统一刷新 `automation-3` | 每日08:20 | 美国与中国核心、消费、日度市场、FedWatch整表/期货、Polymarket、政策/SEP/日历，以及到期或有新披露的黄金低频数据 |
| 旧傍晚/夜间任务 `automation-4`、`automation-5` | 已暂停 | 统一由每日08:20批次覆盖 |
| 旧发布后补查任务 | 已暂停 | CPI及BLS/Census发布事件只在每日统一批次核验，不单独安排30/90分钟重复采集 |

每日 08:20 只触发一个宏观批次。先运行 `python update/macro_due.py --json` 看今日到期的官方源和独立范围，再运行 `python update/macro_auto.py --due-only`；更新器内部按同一策略过滤 Choice 和官方 API。若今日没有到期数据，它不读取凭证、不发网络请求、不改快照或 `checkedAt`，只返回紧凑的 `noDataFetch` 状态。心跳只处理 `dueScopes` 中的 FedWatch、期货、Polymarket、黄金、政策与 SEP，不要再单独处理 `dueOfficial`，避免重复请求。

刷新窗口定义在 `update/macro_due.py`，用官方本地时区换算为北京时间的次日早批。2026年国家统计局发布表中，CPI/PPI在每月9日至14日发布，PMI通常月末发布，月度经济运行数据集中在当月15日至19日发布；批次只在公告日之后检查。BLS CPI、就业报告按其官方发布日期次日检查；Census零售与新屋开工按官方日历的次日检查；BEA个人收入/PCE、贸易和GDP采用官方公布日次日检查；美联储G.17工业生产按其已公布发布日期次日检查。FedWatch与联邦基金期货在美国上一交易日收市后的北京时间批次核验；若前一美国日历日是周末或NYSE休市日则跳过。Polymarket每日核验；黄金ETF/CFTC周末核验、央行购金每月首周核验、低频年度数据每年10月首周核验。FOMC政策和SEP只在声明/预测实际公布后的北京时间次日检查。

发布窗口容许次日批次作为一次失败重试。成功或确认无变化的指标/来源会写入被Git忽略的 `.cache/macro-due-ledger.json`，同一发布事件不再重复查询；失败不记成功，可在窗口内次日重试。Choice增量请求只回看月度24个月、季度8季、日度180天并合并本地历史；每年10月该指标到期时做一次全历史核验。政策账本不保存宏观值或凭证。官方日历调整时先核验来源，再更新窗口和测试；未来日程未公布的指标保持未到期，不猜日期，也不做定时补查。发布时刻晚于 08:20 的数据只在下个早批检查，不建立当晚的第二次任务。停止单独的发布后30/90分钟补查任务。

官方日历来源：国家统计局 [2026年主要统计信息发布日程](https://www.stats.gov.cn/xw/tjxw/tzgg/202512/t20251224_1962137.html)、[BLS CPI日程](https://www.bls.gov/schedule/news_release/cpi.htm) 与 [Employment Situation日程](https://www.bls.gov/schedule/news_release/empsit.htm)、美国人口普查局 [零售销售](https://www.census.gov/retail/release_schedule.html) 与 [新屋开工](https://www.census.gov/construction/soc/schedule.html)、BEA [发布日历](https://www.bea.gov/news/schedule)、美联储 [FOMC日历](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) 和 [G.17工业生产日历](https://www.federalreserve.gov/releases/G17/default.htm)、[NYSE休市日历](https://www.nyse.com/markets/hours-calendars)。

## 执行与数据文件

每日08:20先运行到期计划；无到期指标时立即结束，不读历史快照或凭证、不联网。按单项预计发布期查询并保留窗口内次日重试；来源尚未返回应发布期时不记成功。回看范围按频率限制为月度24个月、季度8季、日度180天，并合并完整历史。只有数值、期间、来源、修订或状态实际变化才写文件；抓取时间和回执哈希单独变化不触发提交。

1. 仅通过GitHub连接器读取最新main、AGENTS.md及本指引。确认无同批正在执行/待合并PR/部署；存在时继续该批或跳过，不能重叠提交。使用独立本地批次目录，记录基准提交与批次标识，绝不覆盖其他任务的未提交修改。发布前再读main；发生变化时核对涉及文件并重新验证。
2. 依照注册表串行查询本批准确指标；使用本机已授权Choice/东方财富MCP。不得输出或上传配置、凭证、认证头。维护`.cache/`原始回执及SHA-256，失败仅输出安全错误原因。保留所有历史和真实0，未知值保留空，缺期不插值；无独立源时点时留空并另记实际获取时间。
3. 文件与入口：

| 数据范围 | 文件 / 执行入口 |
|---|---|
| 中美核心、消费共用历史和覆盖 | `update/macro_auto.py`；`automatic-series.json`、`coverage.json`；用`--only`/`--consumer-only`按批筛选，官方补充范围按指引执行 |
| 原有快照、年度与低频 | `update/macro_data.py`；`data/macro/snapshot.json`；无适配器项保持pending，接口失败保留历史 |
| 原始消费证据 | `scripts/import_consumption_macro.py --refresh --incremental --checked-at YYYY-MM-DD`；周日完整`--refresh`复核；新增官方原文先核对`sources.json`，现有脚本不会发现新URL |
| Polymarket | `update/polymarket_data.py`；`predictions.json`；核对完整事件选项、原始规则与中文译名，不归一化独立合约概率 |
| FedWatch全部会议/利率区间/期货 | 官方CME工具浏览器采集，`data/gold-jewelry/macro.json`共用；独立收据及SHA；不能只取Current页便宣称整表完成 |
| 黄金共用日频 | 同文件`series`；`update/gold_macro.py`严格标准化本次实际Choice回执后复核合并，不使用相近名称或其他机构替代 |
| 政策/SEP/发布日历、ETF/央行/CFTC | 同文件`policy`、`projections`、`events`、`flows`及对应`sources`；原登记官方链接复核，尚无统一抓取器，由本地任务逐项核验 |

## 失败、无变化与发布

按批输出“新增期间、修订、值未变化、失败、待接入/未执行”。含历史不等于本次成功；`status=error`不能计入ready。Choice返回名称/机构/频率/单位不符时保留旧值，不能修改注册表迁就接口。FedWatch概率和期货分别记录结果；无法读取全表时保留上次有效整表，更新失败状态及原因。局部成功可发布，但不能宣称全模块全部更新成功。

只比较抓取/检查时间会造成无意义提交。无实质数值、期间、来源、修订或状态变化时保留原字节，检查结果放本地批次报告。有效新概率可追加历史，旧快照与收据不覆盖。不能将当前Current页的时点强行赋给概率整表。

测试按`macro-update-guide.md`执行，另运行`tests/forecast-macro.test.cjs`、`tests/gold*.test.js`、`tests/test_gold_macro.py`及受影响浏览器回归。发布前比较diff确认没有凭证、缓存、无关研究数据和仅时间变更。通过GitHub连接器基于最新main创建分支、提交和PR；所有相关GitHub检查通过后合并，附加PR到任务。待Pages部署成功后回读线上JSON、页面、筛选与CSV，再报告发布结果。

当前边界：FedWatch尚未接入授权CME REST；官方嵌入工具不可读时需要保留快照并记录失败。部分年度指标无已审定自动适配器；定时任务覆盖检查，不代表已补齐数据。以上缺口不得通过模拟值、旧收据或仅修改更新时间掩盖。
