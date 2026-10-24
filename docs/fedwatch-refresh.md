# FedWatch 整表更新

从 CME 官方父页 `https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html` 正常加载 QuikStrike。不要直接访问缺少父页上下文的工具内页，不修改认证头、不绕过403，也不把付费REST当作已授权接口。

## 首选：标准浏览器扩展

2026-10-24 实测：IAB 中 Probabilities 的 Enter 操作超时且没有完整表；同一官方父页在已连接 Edge 扩展中正常点击后成功取得两表。本次只能确认路径差异，不能据此断言 CME 服务故障或 Cookie 是唯一根因。

1. 通过浏览器工具清单选择已连接的 Edge/Chrome 扩展，在任务新建标签打开官方父页，不占用用户标签；保留已有登录，不安装扩展或修改安全设置。没有扩展时才用 IAB 备用路径。
2. 读一次当前页面。如果存在 Cookie 遮挡，正常点 `Reject All` 关闭；不存在则跳过。若已显示完整两表，直接读取，不再次切换。
3. 在 `iframe[src*="quikstrike.net"]` 中定位可见 `Probabilities` 链接，用标准 `click({timeoutMs:15000})` 切换。每个浏览器操作单独调用，工具超时设60000；不要在一次调用中串行等待多个长操作，不等 networkidle。
4. 用一次只读 DOM 提取全部两表，不读整个父页或 Current 的其他表：

```javascript
const tables = await frame.locator('table').evaluateAll(nodes => nodes
  .filter(t => ['FED FUND FUTURES', 'CME FEDWATCH TOOL - CONDITIONAL MEETING PROBABILITIES'].includes(t.rows[0]?.innerText.trim()))
  .map(t => ({title:t.rows[0].innerText.trim(),rows:[...t.rows].map(r=>[...r.cells].map(c=>c.innerText.trim()))})), undefined, {timeoutMs:15000});
```

没有表时只检查一次当前状态；不要反复新建页面、点击或重复采集。操作超时不等于数据源故障。若浏览器权限、验证码或用户接管阻塞，按工具要求处理，不换通道绕过限制。

## IAB 备用

仅在标准扩展不可用时，用 IAB 新建官方父页并激活显示；读取 Cookie/遮挡状态后，Probabilities 用标准 Enter 操作。调用和读取分开，工具60000、目标15000。IAB 若再次超时，只读一次两表确认是否已经切换；没有完整两表则保留历史，停止本轮，不循环重试。结束后关闭临时标签并恢复显示状态。

## 回执、校验和发布

把本次实际 DOM 单元格保存为 JSON：provider=`CME FedWatch`、url=官方父页、retrievedAt=实际获取时间、observedAt=null、tables=原始返回。Current 页参考时间不能赋给完整表；不固定会议、区间、合约数量，保留真实零值、空白及原始价格精度。不得改日期重放旧回执冒充新数据。

运行 `node update/fedwatch_import.cjs --receipt <本次回执>`。入口验证全表维度、概率合计、日期、合约月份、有效期和SHA-256，增量追加共用JSON、会议历史和原始回执；坏表不写，数据及成功状态均无变化不重写。只提交命令返回的changedFiles，加上本次必要的流程或测试修复。

运行 `node --test tests/fedwatch-import.test.cjs tests/gold-macro.test.js tests/forecast-macro.test.cjs` 及相关宏观/黄金检查。历史导入测试的固定时点夹具只保留该时点之前的快照，不能把生产新快照视为测试时点的未来数据并误报；不放宽生产校验。检查所有会议、完整区间、零值/空白、CSV及窄屏。

相关GitHub检查通过才合并，等待Pages并回读线上JSON、完整表和CSV。成功或确认无变化后才执行 `python update/macro_due.py --complete fedwatch federal-funds-futures`；失败不登记。清理任务临时标签，不改政策利率、指标定义、数据来源或其他模块。
