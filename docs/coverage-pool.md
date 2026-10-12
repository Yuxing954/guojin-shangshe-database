# 商社行情与财报公司目录

`data/coverage-companies.json`是行情、财报日历、关联公司和公司搜索共用的单一目录。当前范围为用户提供的三张研报估值表截图中的73家公司，另增SHEIN（0625.HK），合计74家。不得自行扩回全行业或旧107家名单。

公司分类以截图为基础，按用户要求将SHEIN归消费出海：新消费10家、消费出海10家、黄金珠宝8家、化妆品&医美13家、免税&出行19家、餐饮&茶饮9家、超市&其他专业连锁5家。显示名称按截图，原证券简称保留为搜索别名；分类为研究分组，非交易所行业。截图的估值、预测和评级没有作为当前行情写入。

74家证券均由真实腾讯响应核对，身份、来源时点、请求链接和响应SHA256保存在`data/coverage-focused-verification.json`。SHEIN另由Choice核对为希音-W（00625.HK）。北交所锦波生物920982.BJ映射bj920982；瑞幸采用截图LKNCY.OO，以usLKNCY请求，腾讯原始市场代码为LKNCY.PS。真实走势缺失时显示错误，不生成替代数据。

财报日历按同一目录展示，包括未取得日期的公司。已取得73家最近披露日，瑞幸所需日期字段返回空，显示待公布；新日期回执见`data/earnings-choice-focused-receipts.json`与`data/earnings-choice-focused-extra-receipts.json`，空查询保留在`data/earnings-choice-focused-missing.json`。旧公司日期记录保留在快照作为历史，不扩展当前展示池。

## 后续维护
1. 只按用户确认增删目录或修改分类，核对证券身份与可用报价，不维护重复名单。
2. 更新公司搜索：`python scripts/build_resource_index.py`。研究与行业数据沿用各自更新规则。
3. 财报日期按`docs/earnings-workbench.md`查询真实Choice指标。北交所使用A股指标，瑞幸OTC代码保留市场归属，不把报告期或上市日期作为披露日。
4. 检查`node scripts/coverage-model.test.cjs`、`node --test scripts/quotes*.test.cjs`、财报逻辑及行情/财报浏览器检查，验证分类、筛选、完整导出、分页、来源时间与手机布局。请求频率维持原值，失败保留已有数据。

## 统一公司库与双热力图
行情和财报日历只读取`data/coverage-companies.json`，不得单独维护公司名单。SHEIN归消费出海，当前消费出海10家、共7个分类、74家公司。行情默认公司热力图；电脑端单页全部公司，手机保留分页。板块热力图基于当前筛选公司计算有效报价涨跌幅的算术平均，剔除缺失值与读取失败值，真实零值参与计算；不是交易所指数，也不是市值加权。每块显示有效/总公司数与涨跌家数，点击展开该板块公司。
