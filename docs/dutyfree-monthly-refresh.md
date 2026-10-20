# 离岛免税月度快速更新

## 固定流程

1. 用GitHub连接器读取最新main、AGENTS及本指引，确认没有同月份正在运行的批次、PR或部署。复用本线程本地工作区；按文件SHA核对缓存，仅拉取变化文件，不覆盖其他任务。
2. 在最新工作副本运行一次：`python scripts/update_dutyfree_monthly.py --period YYYY-MM --fetch`。凭据仅复用本机Choice配置，绝不提交。已收录月份立即返回`noDataFetch`，不请求、不重写。无需重复搜索新闻或查询历史月份；身份变化、原值修订或缺期另行复核。
3. 也可使用当前已连接的`mx_macro_data`按脚本`query_for(period)`准确问句查询一次，把完整真实工具回执存本地忽略目录，执行`--period YYYY-MM --receipt .cache/receipt.json`。回执可附`query`、`retrievedAt`和`result`；不要重放旧回执冒充本次获取。
4. 命令自动同步月度CSV、来源、每人次金额、计算同比、KPI和行业快照，输出紧凑摘要及`changedFiles`。原始回执只在`.cache/dutyfree-receipts/`；来源和SHA-256进入公开数据，发布日期未知保持空，历史值不变。已有基期缺失或为0不计算同比，真实0保留。
5. 仅跑`python -m unittest discover -s tests -p 'test_dutyfree_refresh.py'`、`python scripts/update_dutyfree_monthly.py --check`与`node tests/dutyfree-refresh.browser.cjs`。浏览器需要Playwright和Chrome，Windows可通过`BROWSER_PATH`指定已有Edge。验证最新值、来源、完整CSV及桌面/手机尺寸；无需重复测试全站。改动共享UI或其他板块时恢复其相应检查。
6. GitHub连接器只提交`changedFiles`并创建本批PR；以`Check dutyfree refresh`及实际受影响的检查为验收。合并前再读main，冲突时仅重放本批改动。合并后等待最新有效Pages部署，回读CSV、网页和行业最新点；网站构建时间与来源数组顺序变化不算数据变化。无新值不提交。

## 构建与重复请求

摘要工作流对严格白名单内、已预生成的免税数据更新，只验证免税快照，不重建研究/酒店/餐饮，也不再制造第二个摘要提交和部署。包含任何其他文件、来源文件缺失、Git历史不完整或校验失败时，快速分流不生效，保留正常构建流程。

脚本不会创建定时任务，也不改变现有宏观任务。没有已结束的新月份时不运行采集；正常更新只取目标月3项指标，不扩展采集历史、假期或累计数据。来源不可访问时保留现有数据并报告失败。

`.cache/dutyfree-refresh.lock`防止同工作区并发采集，正常退出自动清理。异常中断遗留锁时，先核对记录的PID确实已结束，再清理锁；不能直接启动第二批。

