# 国家队持仓项目导入

上游：[H-Jett/etf-radar](https://github.com/H-Jett/etf-radar)，固定提交 `caacc37e185df8503f7747aef178395dfe19f5ec`。全部 4,976 个文件原样保存在 `etf-radar/`，含页面、数据、采集程序和原始工作流。上游 README 标注 MIT，原作者与原始说明均保留。

站内入口：[国家队持仓](../etf-radar.html)；指定个股可用 `etf-radar.html?ind=银行&code=601939`，原生页面位于 `etf-radar/docs/`。

本次导入为固定快照，不代表重新采集数据。原采集工作流位于子目录，不自动运行。来源、披露期、估算方法和缺口沿用上游，详见原 README 与 [入库记录](../data/etf-radar-import.json)。导入校验运行 `python scripts/verify_etf_radar.py`，并以 Git 子树哈希验证全部原始字节。
