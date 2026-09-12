#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_research_recent.py
把 3 个研究线 CSV 预聚合为 data/research/recent.json：
  - data/商社-市场观点.csv  -> shop
  - data/全部-市场观点.csv   -> allviews
  - data/商社-纪要文库.csv   -> minutes
窗口：最近 MAX_DAYS 天；每个库至多 MAX_PER_DB 条
字段只保留前端展示必需；长文本截断到 SUB_LEN
"""
import sys, os, csv, json, io, argparse, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# ---- 参数（可用 --days / --per-db / --sub-len 覆盖） ----
MAX_DAYS   = 90      # 时间窗口
MAX_PER_DB = 400     # 每库条数上限
SUB_LEN    = 1200    # 单条 sub 截断（可通过 _set_sub_len 覆盖）


def _set_sub_len(n):
    global SUB_LEN
    SUB_LEN = n

SOURCES = [
    # (databaseId, k 标签, 文件名, 默认时间列候选)
    ("views",     "shop",     "商社-市场观点.csv", ["时间", "日期"]),
    ("all_views", "allviews", "全部-市场观点.csv", ["时间", "日期"]),
    ("minutes",   "min",      "商社-纪要文库.csv", ["日期", "时间"]),
]

# views/all_views 列
V_COLS = ["时间", "月份", "标题", "内容", "作者", "命中关键词", "点赞", "评论", "阅读", "原文链接"]
# minutes 列
M_COLS = ["日期", "类型", "标题", "摘要", "相关标的", "下载链接", "文件名", "覆盖板块"]


def parse_time(s):
    """尽量容忍多种时间格式，返回 datetime 或 None"""
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z",
                "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d"):
        try:
            d = dt.datetime.strptime(s, fmt)
            return d.replace(tzinfo=None) if d.tzinfo else d
        except ValueError:
            pass
    return None


def trunc(s, n=None):
    if n is None:
        n = SUB_LEN
    if s is None:
        return ""
    s = str(s)
    return s if len(s) <= n else s[:n].rstrip() + "…"


def read_csv_rows(path):
    """utf-8-sig 兼容 BOM；返回 list[dict]"""
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        rdr = csv.DictReader(f)
        return [r for r in rdr]


def pick(row, keys):
    for k in keys:
        if k in row and row[k]:
            return row[k]
    return ""


def normalize_row(dbid, k, row):
    """把原始 CSV 行扁平化为前端直接可用的 row 字段"""
    if dbid == "minutes":
        return {
            "日期": row.get("日期", "")[:10],
            "类型": row.get("类型", ""),
            "标题": row.get("标题", ""),
            "摘要": trunc(row.get("摘要", "")),
            "相关标的": row.get("相关标的", ""),
            "下载链接": row.get("下载链接", "") or "",
            "文件名": row.get("文件名", ""),
            "覆盖板块": row.get("覆盖板块", ""),
        }
    else:
        return {
            "时间": (row.get("时间", "") or "")[:19],
            "月份": row.get("月份", ""),
            "标题": row.get("标题", ""),
            "内容": trunc(row.get("内容", "")),
            "作者": row.get("作者", ""),
            "命中关键词": row.get("命中关键词", ""),
            "点赞": row.get("点赞", "") or "0",
            "评论": row.get("评论", "") or "0",
            "阅读": row.get("阅读", "") or "0",
            "原文链接": row.get("原文链接", ""),
        }


def sort_key(row):
    t = parse_time(row.get("时间") or row.get("日期"))
    return t or dt.datetime(1970, 1, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days",   type=int, default=MAX_DAYS)
    ap.add_argument("--per-db", type=int, default=MAX_PER_DB)
    ap.add_argument("--sub-len", type=int, default=SUB_LEN)
    ap.add_argument("--full", action="store_true", help="不截断（默认截断长文本）")
    args = ap.parse_args()

    if args.full:
        args.sub_len = 10 ** 9

    _set_sub_len(args.sub_len)

    cutoff = dt.datetime.now() - dt.timedelta(days=args.days)
    out_root = DATA / "research"
    out_root.mkdir(parents=True, exist_ok=True)
    out_json = out_root / "recent.json"

    payload = {"updatedAt": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
               "windowDays": args.days,
               "dbs": []}

    total = 0
    total_bytes = 0
    for dbid, k, fname, time_keys in SOURCES:
        rows = read_csv_rows(DATA / fname)
        fresh = []
        for r in rows:
            t = parse_time(pick(r, time_keys))
            if t is None:
                continue                       # 无时间一律丢弃（不稳）
            if t < cutoff:
                continue                       # 超窗丢弃
            fresh.append((t, r))
        # 时间倒序、截前 N 条
        fresh.sort(key=lambda x: x[0], reverse=True)
        fresh = fresh[:args.per_db]
        norm = [normalize_row(dbid, k, r) for _, r in fresh]
        kept = len(norm)
        total += kept
        total_bytes += os.path.getsize(DATA / fname)
        payload["dbs"].append({
            "id": dbid, "k": k, "source": f"data/{fname}",
            "sourceRows": len(rows), "keptRows": kept,
            "oldestKept": (fresh[-1][0].strftime("%Y-%m-%d") if fresh else ""),
            "newestKept": (fresh[0][0].strftime("%Y-%m-%d") if fresh else ""),
            "rows": norm,
        })

    out_json.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"OK  wrote {out_json.relative_to(ROOT)}  "
          f"total kept={total}  json_size={out_json.stat().st_size}B  "
          f"src_total={total_bytes/1024:.0f}KB")


if __name__ == "__main__":
    try:
        csv.field_size_limit(sys.maxsize)
    except Exception:
        pass
    main()
