#!/usr/bin/env python3
"""Build the small daily home summary from existing, dated repository data."""
import argparse
import calendar
import csv
import datetime as dt
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TZ = dt.timezone(dt.timedelta(hours=8))
RESEARCH_TERMS = ("酒店", "免税", "餐饮", "茶饮", "珠宝", "黄金", "旅游", "旅行", "教育", "零售", "商超", "跨境电商", "人服", "海底捞", "锦江", "华住", "首旅", "亚朵", "君亭", "中免", "携程", "同程", "老铺", "老凤祥", "周大福", "周大生", "潮宏基", "安克", "赛维", "小商品城", "科锐", "北京人力", "泡泡玛特", "蜜雪", "古茗", "百胜", "九毛九", "新东方", "永辉")


def numeric(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def rate(current, previous):
    current, previous = numeric(current), numeric(previous)
    return (current / previous - 1) * 100 if current is not None and previous not in (None, 0) else None


def month_end(period):
    year, month = map(int, period[:7].split("-"))
    return f"{year:04d}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"


def rows(root, path):
    with (root / path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def latest(records, key, value_key):
    usable = [r for r in records if r.get(key) and numeric(r.get(value_key)) is not None]
    if not usable:
        raise ValueError(f"No valid dated records for {value_key}")
    return max(usable, key=lambda r: r[key])


def link(value, fallback="research.html"):
    if isinstance(value, str) and value.startswith("{"):
        try:
            value = json.loads(value)
        except ValueError:
            return fallback
    if isinstance(value, dict):
        value = value.get("link", "")
    return value if isinstance(value, str) and value.startswith(("https://", "http://")) else fallback


def research_items(payload):
    items, seen = [], set()
    # Home stays focused on the commercial coverage and minutes libraries.
    for db in payload.get("dbs", []):
        if db.get("id") not in ("views", "minutes"):
            continue
        minutes = db["id"] == "minutes"
        for row in db.get("rows", []):
            when = str(row.get("时间") or row.get("日期") or "")
            title = str(row.get("标题") or "").strip()
            if not title or not when:
                continue
            if not minutes and not row.get("更新批次") and not any(term in title for term in RESEARCH_TERMS):
                continue
            href = link(row.get("下载链接") if minutes else row.get("原文链接"))
            key = (when[:10], title)
            if key in seen:
                continue
            seen.add(key)
            items.append({"title": title, "date": when[:10], "sortTime": when[:19],
                          "kind": "minutes" if minutes else "views",
                          "label": (row.get("类型") or "纪要") if minutes else "商社观点",
                          "author": row.get("相关标的") if minutes else row.get("作者"),
                          "href": href})
    items.sort(key=lambda r: r["sortTime"], reverse=True)
    return [{k: v for k, v in row.items() if k != "sortTime"} for row in items[:5]]


def signed(value):
    return "待补充" if value is None else f"{value:+.1f}%"


def build(root=ROOT, now=None):
    manifest = json.loads((root / "data-manifest.json").read_text(encoding="utf-8-sig"))
    paths = {item["id"]: item["file"] for item in manifest["datasets"]}
    hotel = [r for r in rows(root, paths["hotel_industry_weekly"]) if r["region"] == "全国" and r["segment"] == "全部"]
    h = latest(hotel, "period_id", "revpar")
    previous = next((r for r in hotel if numeric(r["year"]) == numeric(h["year"]) - 1 and r["week"] == h["week"]), {})
    h_change = rate(h["revpar"], previous.get("revpar"))
    dutyfree = latest(rows(root, paths["dutyfree_monthly"]), "period_id", "shopping_sales_cny_100m")
    gold = [r for r in rows(root, paths["gold"]) if r["指标名称"] == "上海Au9999现货收盘价"]
    g = latest(gold, "数据日期", "数值")
    old_gold = [r for r in gold if r["数据日期"] < g["数据日期"] and numeric(r["数值"]) is not None]
    g_previous = latest(old_gold, "数据日期", "数值") if old_gold else {}
    dining = latest(rows(root, paths["dining"]), "月份", "餐饮收入(亿元)")
    industries = [
        {"id": "hotel", "name": "酒店", "metric": "全国 RevPAR", "value": numeric(h["revpar"]), "unit": "元",
         "change": h_change, "period": h["period_id"], "asOf": h["end_date"], "freshnessDays": 14,
         "source": h["source"], "sourceFile": paths["hotel_industry_weekly"], "href": "hotel-dashboard.html"},
        {"id": "dutyfree", "name": "免税", "metric": "离岛免税销售额", "value": numeric(dutyfree["shopping_sales_cny_100m"]), "unit": "亿元", "precision": 2,
         "change": numeric(dutyfree["sales_yoy_pct"]), "period": dutyfree["period_id"], "asOf": month_end(dutyfree["period_id"]), "freshnessDays": 50,
         "source": dutyfree["source"], "sourceFile": paths["dutyfree_monthly"], "href": "dutyfree-dashboard.html"},
        {"id": "gold", "name": "黄金珠宝", "metric": "上海 Au9999 现货收盘价", "value": numeric(g["数值"]), "unit": g["单位"],
         "change": rate(g["数值"], g_previous.get("数值")), "changeLabel": "较前一记录日", "period": "日度", "asOf": g["数据日期"][:10], "freshnessDays": 7,
         "source": g["数据来源"], "sourceFile": paths["gold"], "href": "industry.html#gold"},
        {"id": "dining", "name": "餐饮", "metric": "全国餐饮收入", "value": numeric(dining["餐饮收入(亿元)"]), "unit": "亿元",
         "change": numeric(dining["餐饮收入同比增速(%)"]), "period": dining["月份"], "asOf": month_end(dining["月份"]), "freshnessDays": 50,
         "source": dining["数据来源"], "sourceFile": paths["dining"], "href": "industry.html#dining"},
    ]
    d_change = numeric(dutyfree["sales_yoy_pct"])
    focus = [
        {"sector": "酒店经营", "title": "关注酒店经营的量价变化", "summary": f"全国 RevPAR 为 {numeric(h['revpar']):.1f} 元，同比 {signed(h_change)}。结合入住率与房价查看变化来源。", "asOf": h["end_date"], "href": "hotel-dashboard.html"},
        {"sector": "免税消费", "title": "对照销售额与购物人次", "summary": f"离岛免税销售额 {numeric(dutyfree['shopping_sales_cny_100m']):.2f} 亿元，同比 {signed(d_change)}；购物人次同比 {signed(numeric(dutyfree['shoppers_yoy_pct']))}。", "asOf": month_end(dutyfree["period_id"]), "href": "dutyfree-dashboard.html"},
        {"sector": "餐饮需求", "title": "跟踪餐饮收入增速", "summary": f"全国餐饮收入同比 {signed(numeric(dining['餐饮收入同比增速(%)']))}，限额以上餐饮同比 {signed(numeric(dining['限额以上同比增速(%)']))}。查看两种口径的趋势。", "asOf": month_end(dining["月份"]), "href": "industry.html#dining"},
    ]
    recent = json.loads((root / "data/research/recent.json").read_text(encoding="utf-8"))
    research = research_items(recent)
    moment = now or dt.datetime.now(TZ)
    return {"version": 1, "generatedAt": moment.astimezone(TZ).isoformat(timespec="seconds"),
            "industries": industries, "focus": focus, "research": research,
            "researchAsOf": research[0]["date"] if research else None}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    payload = build(args.root)
    target = args.root / "data/home-snapshot.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Home summary: {len(payload['industries'])} industries, {len(payload['research'])} research items, {target.stat().st_size} bytes")
