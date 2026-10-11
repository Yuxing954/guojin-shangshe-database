# 二级导航样式

行业、宏观、公司、研究、行情、日历和站内搜索的类目导航，以及板块内部的内容视图，统一使用 `site-subnav`。原有 class、ID、链接和状态属性保留，脚本仍按原字段控制切换。

样式集中在 `scripts/site-polish.css`：14px 字号、22px 行高、44px 最小高度、8px 圆角与间距、10px/16px 内边距；白底描边，蓝色选中、白色文字。选中状态支持 aria-pressed、aria-selected、aria-current=page 及旧 active/on/current。鼠标悬停、键盘焦点和窄屏换行共用同一规则，关闭隐藏视图时仍遵循 hidden 属性。

日期、数值/同比、指标选择等数据筛选控件保留各自语义，不添加二级导航 class。新类目导航应复用此组件，避免另建独立颜色或尺寸。

`tests/site-subnav.browser.cjs` 检查实际页面的电脑/手机样式、选中状态、键盘焦点和类目切换，涵盖行业页内嵌的酒店、免税及餐饮。
