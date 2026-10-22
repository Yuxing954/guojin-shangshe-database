# FedWatch整表快速更新

使用CME官方父页 `https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html`。不直接导航到QuikStrike内页：本次已实测内页缺少父页来源时被拒绝；本机直接HTTP请求也收到403，不修改认证头或绕过访问限制。

本次已验证的浏览器路径：激活IAB后，通过官方页面的QuikStrike iframe读取。隐藏标签页读取曾长时间无返回；一次工具调用内连续操作也可能超过默认30秒。每个浏览器操作单独调用，工具层timeout_ms设60000，目标元素timeoutMs设15000；不等待networkidle，不反复新建或刷新父页。菜单滚出视窗时鼠标操作曾报iframe路径错误，改用链接的标准键盘Enter操作后成功。

1. 初始化浏览器并按实际标签清单绑定官方页，按浏览器工具文档激活显示；获取iframe定位器 `tab.playwright.frameLocator('iframe[src*="quikstrike.net"]')`。
2. 以 `getByRole('link',{name:'Probabilities',exact:true}).press('Enter',{timeoutMs:15000})` 进入整表。操作与读取分两次工具调用。若已在整表，不再切换或刷新。
3. 一次读取两个表，不读取整个父页或所有广告iframe：

```javascript
const tables = await frame.locator('table').evaluateAll(nodes => nodes
  .filter(t => ['FED FUND FUTURES', 'CME FEDWATCH TOOL - CONDITIONAL MEETING PROBABILITIES'].includes(t.rows[0]?.innerText.trim()))
  .map(t => ({title:t.rows[0].innerText.trim(),rows:[...t.rows].map(r=>[...r.cells].map(c=>c.innerText.trim()))})));
```

4. 把这次实际DOM单元格保存为JSON回执，字段为provider=`CME FedWatch`、url=官方父页、retrievedAt=实际获取时间、observedAt=null、tables=上述原始返回。不得用旧回执改日期。Current页时间不是整表时点，不赋给整表。不要固定会议、区间或期货数量。
5. 运行 `node update/fedwatch_import.cjs --receipt <本次回执>`。入口验证完整维度、全部概率行、真实零值/空白、日期、合约月份、有效期和SHA-256，再增量追加共用JSON、会议历史和原始回执。坏表不写入，24小时以前的回执拒绝；数据及成功状态均无变化时不重写。只提交返回的changedFiles。
6. 通过专项测试及相关GitHub检查后发布，回读线上完整表及全部CSV。成功或确认无变化后，才用 `python update/macro_due.py --complete fedwatch federal-funds-futures` 登记当日事件；失败不登记。结束后关闭本次临时标签，恢复浏览器显示状态。

验证命令：`node --test tests/fedwatch-import.test.cjs tests/gold-macro.test.js tests/forecast-macro.test.cjs`，并运行既有宏观浏览器回归。不改政策利率、指标定义或来源；不补造源时点，不把部分表当成功。
