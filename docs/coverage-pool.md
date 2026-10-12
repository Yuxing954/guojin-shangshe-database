# 商社公司与财报目录

`data/coverage-companies.json`是财报日历、关联公司和公司搜索共用的单一目录。当前范围为用户提供的三张研报估值表截图中的73家公司，另增SHEIN（0625.HK），合计74家。不得自行扩回全行业或旧107家名单。

公司分类以截图为基础，按用户要求将SHEIN归消费出海：新消费10家、消费出海10家、黄金珠宝8家、化妆品&医美13家、免税&出行19家、餐饮&茶饮9家、超市&其他专业连锁5家。显示名称按截图，原证券简称保留为搜索别名；分类为研究分组，非交易所行业。截图的估值、预测和评级没有作为当前行情写入。

74家证券身份与分类来自用户指定的研报估值表范围，来源核验记录保留在`data/coverage-focused-verification.json`。该目录继续供财报日历、重点公司搜索和相关公司索引使用，不再发起实时报价或走势请求。

财报日历按同一目录展示，包括未取得日期的公司。已取得73家最近披露日，瑞幸所需日期字段返回空，显示待公布；新日期回执见`data/earnings-choice-focused-receipts.json`与`data/earnings-choice-focused-extra-receipts.json`，空查询保留在`data/earnings-choice-focused-missing.json`。旧公司日期记录保留在快照作为历史，不扩展当前展示池。

## 后续维护
1. 只按用户确认增删目录或修改分类，核对证券身份与可用报价，不维护重复名单。
2. 更新公司搜索：`python scripts/build_resource_index.py`。研究与行业数据沿用各自更新规则。
3. 财报日期按`docs/earnings-workbench.md`查询真实Choice指标。北交所使用A股指标，瑞幸OTC代码保留市场归属，不把报告期或上市日期作为披露日。
4. 检查`node scripts/coverage-model.test.cjs`与财报日历逻辑，验证目录唯一性、来源记录与公司分类。
