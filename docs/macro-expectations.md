# 宏观预期数据

宏观核心页展示中国CPI同比、GDP季度同比和社零同比的Choice预测值；总览卡片显示与实际期匹配的预测，总览表显示晚于已收录实际期的最近一期预测，指标详情保留完整预测明细与独立CSV。这个表不代表官方尚未公布：实际库可能滞后，不能据其覆盖终点推断发布日期。

数据文件：`data/macro/expectations.json`。真实MCP回执保存在`data/macro/expectation-receipts/`，每项保留文件路径与SHA-256、准确原名、频率、单位、原始精度和来源链接。2026-10-15导入CPI 22期（2025-01至2026-10）、GDP 8期（2025Q1至2026Q4）、社零20期（2025-02至2026-12，缺失月份不补）。未来期间是预测对象期间，不是发布或获取日期。

接口未提供调查发布日期、均值/中位数定义与公布前版本，因此标为“Choice预测”，不得改标为公布前市场一致预期。`forecastDate`和`aggregation`保留null，`vintageVerified`为false。历史“实际−预测”使用当前返回预测与当前已收录实际值，不解释为公布时超预期。获取时间另记，不能替代调查日期。

社零比较优先使用实际库中官方同比；实际库为金额时只取`officialYoy`，缺失则不计算。1—2月预测的合并定义待核验，禁止拆成单月并计算差值。GDP预测原名只说明季度同比，未说明实际/名义定义，保留预测数值，`comparisonAllowed=false`，暂不与实际GDP相减。美国接口本次未返回匹配的预测序列，不用实际值或IMF年度值代替。

后续更新按准确原名、Choice数据、原生频率和%单位逐项查询，用新回执重新导入；原始回执中无关的实际、年度、极值、IMF序列均拒绝混入。多指标链接只作表级来源，不按代码排列推断名称配对。保留已有历史，定义变化需要另行核验。接口未取得匹配预测时保留现有文件，不能清空历史、改抓取时间冒充更新或填入实际值。

导入命令：`python update/macro_expectations.py --receipt-dir data/macro/expectation-receipts --fetched-at <本次实际获取时间>`。使用独立目录中的本次回执；导入程序按精确原名筛选月/季表，拒绝多个匹配与期间重复。首次基线为2025年起；更新请求不得缩短历史范围，提交前逐项核对旧期间未消失。新增日期回执与旧回执并存时，传入只包含本次三个回执的独立目录。

验证：`node --test tests/macro-expectations.test.cjs tests/macro-dashboard.test.cjs tests/macro.test.cjs`，以及`node tests/macro-expectations.browser.cjs`和现有宏观浏览器回归。预测读取失败保留实际值展示、显示失败信息并支持重试。
