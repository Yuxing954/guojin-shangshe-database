# 全站显示规范

唯一规范入口为本文。业务内容与数据边界沿用根目录 AGENTS.md；导航细则见 secondary-navigation.md；可运行的开发示例见 components.html。不要另建平行主题。

## 来源与职责

| 文件 | 职责 |
| --- | --- |
| scripts/site.css | 语义变量、字体、尺度、外壳、组件、命名变体、响应式及无障碍 |
| scripts/site-ui.js | navigation、registry、请求、URL、时间、数字与系列色 |
| scripts/site-shell.js | 唯一外壳、跳过链接、搜索、导航；重复执行不重复注入 |
| scripts/site-charts.js / .css | 图表配色、轴、图例、标签、提示框及鼠标/触屏/键盘行为 |
| scripts/chart-period.js | 短期间标签；完整期间保留在提示框、明细、CSV |
| 专题 CSS | 业务结构及必要布局，必须置于 page 层 |
| scripts/site-polish.css | 遗留布局适配；不得新增通用组件视觉规则 |

层次固定为 tokens、base、page、charts、components、accessibility；共享组件优先于专题布局。不得使用 !important 争夺组件样式（hidden 的可访问性规则除外）。宏观重复样式已合入 macro.css；地方社零同步移除旧引用，五份重复宏观样式文件删除。

## 视觉尺度

以当前共享主题为基准：主色 #4d58a4，橙金 #ac863d，底色 #f5f7fb，卡片白色。数值方向红涨绿跌，成功/失败使用独立状态变量，不能把增长直接定义为利好。系列色集中在 SiteUI.colors/companyColors，稳定标识调用 seriesColor，深色标签调用 contrastColor；禁止按当前显示顺序重涂 SVG。

字体见 --site-font，数字采用 tabular-nums。页面标题30/手机26，区块20，面板16，正文14，辅助和表头13，图轴12；阅读正文使用16px/1.95。间距使用4/8/12/16/24/32/48。侧栏220、内容上限1600；断点1100和760。控件40、compact32、触控44；控件圆角8、卡片12。宽表、密集图仅在自身区域滚动，不允许通过隐藏 body 溢出来过关。

## 组件契约

| 组件 | 复用入口与状态 |
| --- | --- |
| 外壳/标题 | site-page、site-main、portal-header；独立入口显示一次外壳，embed=1 由 industry-embed.js 处理 |
| 分类/内容/指标导航 | site-subnav--category / site-subnav / site-segment；详见导航规范 |
| 筛选/搜索/日期 | site-filters（兼容 board-filters）、site-search；input/select 带可访问名称 |
| 主次/紧凑按钮 | site-button、site-button--primary、site-button--compact；disabled 用原生属性 |
| KPI | site-kpis/site-kpi；board-kpis/board-stat 是兼容别名。标签、读数、变动、期间/状态各占槽位；forecast 变体固定六槽，不截断数值 |
| 面板/图表 | site-panel，board-panel（无内边距容器）+ board-panel-head/body/chart；site-chart-toolbar/legend |
| 表格/分页 | site-table-scroll、原生 table；数字列标记，portal-pager；排序状态用 aria-sort |
| 标签/状态/空 | site-tag、site-status、site-empty；加载 role=status，失败 role=alert 并提供重试 |
| 折叠/来源/详情 | 原生 details/summary、portal-dialog；Esc关闭，关闭后焦点返回触发控件 |
| 导出/复制 | 使用共享按钮，保留现有数据处理和原始精度；成功/失败反馈不可静默 |

forecast 变体适用于“读数+历史趋势+可选预测”的卡片，固定高度234px（手机296px），必须保留空槽；其余 KPI 使用标准密度。阅读、日历、产品画布结构可以不同；不得为同类按钮/KPI另加模块色彩、字号或圆角。

数字按 amount、price、count、percent、percentagePoint、basisPoint 调用 SiteUI.number，并按已披露单位配置 digits/unit。SiteUI.convert 先保留 null/空值再换算。业务模型及原始导出不改精度；OCC水平、相对同比和百分点变化不得混用。未知值显示“—”；缺期断线，不插值、不补零。发布时间使用 SiteUI.date（北京时间到分钟），不将抓取时点冒充发布日期。

图表用 SiteCharts.attach 统一悬浮、点击固定、再次取消、Esc、左右/Home/End和触屏。已有业务图可以传 valuesControl:false/scroll:false 复用提示行为而保留自己的标签及布局。地方社零保留合并/分开、显隐、高亮与缺期；酒店、游轮保留默认勾选。默认值通过页面配置声明，避免运行时猜测。

## 新模块与验收

1. 在 SiteUI.registry 登记入口、所属栏目、page/redirect、独立/嵌入、主要视图和参数；页面数量从磁盘与清单比较，不写死30。
2. 复用共享资源、组件、格式器。按既有约定登记 data-notes.html 的数据说明。
3. 新能力先加入共享实现与本文/组件示例。必要例外必须精确到文件、选择器、声明及理由，登记 design-exceptions.json；不接受通配豁免。
4. 运行 check-site.cjs、共享单元测试、site-unification.browser.cjs 和受影响专项。至少1440/1024/768/390；宏观中美另测1920。检查实际计算样式、截图、交互、加载/空/错、URL恢复、长文与数字及内嵌溢出。
5. 生成逐页验收记录：通过、失败、未测或受外部条件影响。代码提交、CI通过、部署完成、正式站回读分别记录，不能互相替代。

本轮清单和迁移状态见 design-migration.json；它是时点记录，不是第二份页面路由配置。正式导航仅以 SiteUI.navigation 为准；已退役页面继续兼容跳转。国家队持仓为外部链接，仅统一入口样式。

添加到主屏幕界面沿用当前主分支的临时关闭状态（site-install.js）；保留manifest和图标，检查禁止为旧测试恢复该界面。
