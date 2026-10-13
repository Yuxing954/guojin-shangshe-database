# 国金商社数据库 · 微信小程序版

「国金商社·线上可视化数据库」的移动端入口。**数据实时来自 GitHub 仓库，仓库更新 → 小程序跟着更新，无需重新发版。**

## 架构

```
GitHub (Yuxing954/guojin-shangshe-database@main)
        ↑ 实时拉取 raw CSV/JSON（5 分钟内存缓存）
云端代理服务 (Node.js, 零依赖, server/)
        ↑ HTTPS JSON API
微信小程序 (app/, 原生框架, 5 Tab)
```

## 小程序结构（app/）

| Tab | 页面 | 数据集 |
|---|---|---|
| 首页 | home | 标的池估值 + 本周涨跌 + 最新纪要 |
| 板块 | sector | 酒店/免税/黄金珠宝/餐饮茶饮/跨境电商 高频数据 |
| 观点 | views | 商社精选 4548 条 + 全部观点（按需搜索） |
| 纪要 | minutes | 纪要文库（标题/标的/下载链接） |
| 我的 | about | 数据链路说明 + 快照日期 |

配色遵循 **涨红跌绿（CN 约定）**、浅色 paper 主题。

## 代理 API（server/）

- `GET /health` — 存活检查
- `GET /manifest` — 仓库 data-manifest 摘要（updatedAt / 数据集数）
- `GET /datasets` — 可用数据集清单
- `GET /data/{key}` — 数据集 JSON，key ∈ hotel / taxfree / gold / dining / cbec / valuation / weekly / financials / views / allviews / minutes

特性：
- 实时拉 GitHub raw，**GitHub push 后小程序下拉刷新即得最新**
- 5 分钟内存缓存防限额；`allviews` 超 2 万条自动截断至 8000 条并标记 `truncated/total`
- 零 npm 依赖，纯 Node 内置模块

## 使用步骤

1. **部署代理服务**：WorkBuddy →「发布为应用」选择 `server/` 目录发布（Node），得到 live URL。
2. **配置小程序**：把 `app/utils/api.js` 的 `API_BASE` 改为代理 live URL。
3. **导入小程序**：微信开发者工具 → 导入项目 → 选 `app/` 目录（appid 用测试号或自己的）。
4. **域名白名单**（正式发版前）：在小程序管理后台「开发管理 → 开发设置 → 服务器域名」把代理域名加入 request 合法域名（需 https + 备案域名）。
5. **发布**：用户在 WorkBuddy 小程序应用面板点「发布」，或经微信开发者工具上传审核。

## 数据链路验证（三层）

- ✅ curl 抽查：11 个数据集全部 HTTP 200，JSON 结构正确
- ✅ 数据核对：minutes 14 条、valuation 32 只、views 4548 条、allviews 32148 条（截断 8000）与仓库 CSV 一致
- ✅ 链路：GitHub raw → 代理转 JSON → 小程序下拉刷新
