# 验证目录

[返回项目首页](../README.md) · [维护文档](../docs/README.md)

| 文件形式 | 检查内容 |
| :--- | :--- |
| `*.test.cjs` | 数据结构、统计口径及模型 |
| `*.browser.cjs` | 页面加载、筛选、图表、下载及布局 |
| `test_*.py` | Python 数据构建与更新逻辑 |
| `fixtures/` | 测试输入；不用于正式数据发布 |

部分模型检查也位于 `scripts/*.test.cjs`。各模块准确的命令与依赖见[维护文档](../docs/README.md)及 [.github/workflows](../.github/workflows/)。

修改后先运行受影响模块的检查。专项通过不代表全站通过；既有失败、修改引起的失败和部署结果应分别记录。
