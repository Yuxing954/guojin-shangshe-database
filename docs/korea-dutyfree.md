# 韩国免税月度看板

入口：行业数据 → 免税 → 韩国免税。独立页 dutyfree-dashboard.html#korea。
原始统计机构为韩国免税店协会；本次通过Wind及Choice转引，不冒称直接取得会员原表。

## 数据与精度
- data/dutyfree/korea.json：2024-02—2026-08，31个月、三类顾客93条记录。
- 分类total/foreign/domestic对应全部顾客/外国人/韩国本国人。外国人不是中国人，购物人次不是去重访韩游客人数。
- 销售额原单位美元，购物人数原单位人次；展示金额除1e8为亿美元，人次除1e4为万人次。没有混用韩元、美元或人民币。
- Wind D5529203为外国人销售额，保留原美元值；供应商更新时间2026-09-23不冒充官方发布日期。
- Choice金额与人次回执含“万、亿”缩略值；保留Raw字符串和provider-rounded状态。表级候选代码不按顺序绑定到单指标。
- source.publishedAt未知留空。dataAsOf是取得的最新期间，updatedAt是本次核对日，未取得9月不表示9月未发布。
- 同比=同组同指标当月/上年同月-1；基期缺失或非正数留空。含缩略值的同比为测算。客单价=同组销售额/同组购物人次，属于测算值。
- 独立统计总计/分组因舍入略有差异，不强行配平。页面数字直接显示，精度说明保留在来源弹窗中；CSV包含原值、原字符串、精度和来源标识。

## 更新
1. 先用GitHub连接器读取最新main与此模块，核对已收录月份。只取韩国免税月度指标；不要运行海南月度/宏观全量刷新，不重抓已收录历史。
2. 分别保留本次Choice月度人次/销售额及Wind外国人销售额真实回执到本地.cache。不得用新闻四舍五入数字冒充精确原值；不要把年度表填进月度序列。
3. scripts/import_korea_dutyfree.py接受--groups、--sales、--wind、--checked-at。导入严格核对机构、原名、月度、单位，拒绝重叠冲突和超过舍入容差的加总差异。
4. 首批使用共同覆盖期间；增量需先合并已审核历史，脚本拒绝用短回执覆盖长历史。保留来源与精度，真实缺期不插值。
5. 运行节点模型测试、韩国专项浏览器检查和既有海南月度检查；检查行业嵌入的loading/ready/error、页签保存及失败重试。通过后按授权合并，核验Pages和正式页面。
6. 不新增定时任务。接口额度不足或官方表需登录时保留可核验数据，说明截止期，不自动创建协会账号或虚构后续月份。

## 实现与验证
- dutyfree-korea-model.js负责同比、客单价、缺期和CSV；页面不另写计算公式。
- dutyfree-korea.js只在打开韩国页签时加载，失败可单独重试；不阻塞海南、假期或其他行业。
- 行业嵌入识别韩国数据状态，允许保存#korea。来源与详细口径集中在data-notes.html#dutyfree。
- node --test tests/dutyfree-korea.test.cjs tests/dutyfree-monthly.test.cjs
- node tests/dutyfree-korea.browser.cjs [正式站根地址]
- node tests/dutyfree-refresh.browser.cjs
