# -*- coding: utf-8 -*-
"""
知识星球「水木调研纪要-2.0」→ 全部-市场观点.csv

与 zsxq_update.py 的区别：
  zsxq_update.py  : 按关键词池「只挑商社相关」入库（增量、精选）
  zsxq_dump_all.py: 抓取时间窗口内「全部」主题，用段子筛选器剔除通知/广告/抽奖/空贴，
                    再对完全重复内容去重

用法：
  python zsxq_dump_all.py --days 30                      # 抓取 + 筛选 + 去重 + 导出 CSV
  python zsxq_dump_all.py --days 30 --github-token <PAT> # 并推送 GitHub
  python zsxq_dump_all.py --skip-fetch                   # 不抓取，用本地 _dump_raw.json 重跑筛选
  python zsxq_dump_all.py --days 30 --keep-dup           # 不去重
"""
import argparse, base64, csv, datetime, io, json, os, re, subprocess, sys, time, urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "config.json"), encoding="utf-8"))
ZSXQ = os.environ.get("ZSXQ_CLI", "zsxq-cli")

sys.path.insert(0, HERE)
from clean_text import normalize_content, make_title   # noqa: E402
from segment_filter import classify                    # noqa: E402

RAW_JSON = os.path.join(HERE, "_dump_raw.json")

CSV_COLS = ["时间", "月份", "标题", "内容", "作者", "话题", "点赞", "评论", "阅读", "原文链接"]


def parse_time(s):
    return datetime.datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%f%z")


def ensure_zsxq_auth():
    r = subprocess.run([ZSXQ, "auth", "status"], capture_output=True, text=True,
                       encoding="utf-8", timeout=30, shell=(os.name == "nt"))
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0 and "Logged in as" in out:
        print("  zsxq-cli 登录态正常")
        return
    bk = os.path.join(HERE, "zsxq_auth_backup.json")
    if not os.path.exists(bk):
        sys.exit("✗ zsxq-cli 未登录且无备份，请先 zsxq-cli auth login")
    print("  ⚠ 登录态失效，尝试从备份恢复…")
    rr = subprocess.run([sys.executable, os.path.join(HERE, "restore_zsxq_auth.py"), "-f", bk],
                        capture_output=True, text=True, encoding="utf-8", timeout=60)
    print("  " + ((rr.stdout or "") + (rr.stderr or "")).strip())
    if rr.returncode != 0:
        sys.exit("✗ 恢复失败，请重新扫码：zsxq-cli auth login")


def fetch_since(cutoff, verbose=True):
    """抓取 create_time > cutoff 的全部主题（分页直到早于 cutoff 或无更多）"""
    topics, end_time, page = [], None, 0
    while True:
        page += 1
        cmd = [ZSXQ, "group", "+topics", "--group-id", CFG["group_id"],
               "--limit", "30", "--json"]
        if end_time:
            cmd += ["--end-time", end_time]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           timeout=90, shell=(os.name == "nt"))
        try:
            d = json.loads(r.stdout)
        except Exception:
            print(f"  page{page} 解析失败: {r.stdout[:200]} {r.stderr[:200]}")
            break
        ts = d.get("topics_brief") or []
        if verbose and page % 20 == 0:
            print(f"  page{page}（累计 {len(topics) + len(ts)} 条）")
        if not ts:
            break
        topics.extend(ts)
        if parse_time(ts[-1]["create_time"]) <= cutoff or not d.get("has_more"):
            break
        end_time = d.get("next_end_time")
        time.sleep(0.5)
    return [t for t in topics if parse_time(t["create_time"]) > cutoff]


def build_records(topics):
    """主题 → 记录；返回 (段子记录, 剔除记录)"""
    keep, drop = [], []
    for t in topics:
        ct = parse_time(t["create_time"])
        raw_body = t.get("content") or ""
        body = normalize_content(raw_body)
        title = make_title(body or (t.get("title") or ""))
        ok, reason = classify(title, body, t)
        rec = {
            "时间": t["create_time"],
            "月份": f"{ct.year}-{ct.month:02d}",
            "标题": title,
            "内容": body,
            "作者": (t.get("owner") or {}).get("name", ""),
            "话题": (t.get("group") or {}).get("name", ""),
            "点赞": (t.get("counts") or {}).get("likes", 0),
            "评论": (t.get("counts") or {}).get("comments", 0),
            "阅读": (t.get("counts") or {}).get("readers", 0),
            "原文链接": f"https://wx.zsxq.com/group/{CFG['group_id']}/topic/{t.get('topic_id','')}",
        }
        if ok:
            keep.append(rec)
        else:
            rec["剔除原因"] = reason
            drop.append(rec)
    return keep, drop


def dedup(records):
    """内容完全相同的记录只保留最新一条（按月分组统计删除数）"""
    seen, out, removed = {}, [], []
    for r in sorted(records, key=lambda x: x["时间"], reverse=True):
        key = re.sub(r'\s+', '', r["内容"])
        if key in seen:
            removed.append(r)
            continue
        seen[key] = r
        out.append(r)
    return out, removed


def write_csv(records, path, cols=CSV_COLS):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in records:
            w.writerow({k: r.get(k, "") for k in cols})
    return path


def gh_push(pat, text, message, csv_path):
    # 直连 api.github.com（Windows 下 urllib 默认会读注册表走系统代理，大文件上传易超时/掉认证头）
    if os.environ.get("GH_USE_PROXY") != "1":
        urllib.request.install_opener(
            urllib.request.build_opener(urllib.request.ProxyHandler({})))
    base = f"https://api.github.com/repos/{CFG['repo_owner']}/{CFG['repo_name']}"
    p = urllib.request.quote(csv_path)
    hdr = {"Authorization": "Bearer " + pat, "Accept": "application/vnd.github+json",
           "User-Agent": "zsxq-dump"}

    def api(method, url, payload=None, timeout=600):
        req = urllib.request.Request(url, method=method,
            data=json.dumps(payload).encode() if payload else None, headers=hdr)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")

    sha = None
    try:
        c, body = api("GET", f"{base}/contents/{p}?ref={CFG['branch']}", timeout=120)
        sha = body.get("sha") if c == 200 else None
    except Exception as e:
        print(f"  查询已有文件失败（按新建处理）: {e}")
    payload = {"message": message, "branch": CFG["branch"],
               "content": base64.b64encode(text.encode("utf-8-sig")).decode()}
    if sha:
        payload["sha"] = sha
    last = None
    for attempt in range(1, 4):
        try:
            c, body = api("PUT", f"{base}/contents/{p}", payload)
            print(f"  GitHub 推送: {c} {body.get('commit', {}).get('html_url', body)}")
            return c in (200, 201)
        except Exception as e:
            last = e
            print(f"  推送第 {attempt} 次失败: {e}")
            time.sleep(3)
    raise last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30, help="回溯天数，默认 30")
    ap.add_argument("--github-token", help="GitHub PAT（可选）")
    ap.add_argument("--skip-fetch", action="store_true", help="用本地 _dump_raw.json 重跑筛选")
    ap.add_argument("--keep-dup", action="store_true", help="不去重")
    ap.add_argument("--out", default=os.path.normpath(os.path.join(HERE, "..", "data", "全部-市场观点.csv")))
    args = ap.parse_args()

    if args.skip_fetch:
        topics = json.load(open(RAW_JSON, encoding="utf-8"))
        print(f"① 读取本地原始数据 {len(topics)} 条")
    else:
        ensure_zsxq_auth()
        cutoff = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))) - \
            datetime.timedelta(days=args.days)
        print(f"① 抓取最近 {args.days} 天（{cutoff:%Y-%m-%d %H:%M} 起）…")
        topics = fetch_since(cutoff)
        print(f"   抓取 {len(topics)} 条（{cutoff:%Y-%m-%d} ~ 现在）")
        json.dump(topics, open(RAW_JSON, "w", encoding="utf-8"), ensure_ascii=False)

    # ② 段子筛选
    keep, drop = build_records(topics)

    def cat(reason):
        for p in ("内容过短", "标题噪音词", "广告/运营词"):
            if reason.startswith(p):
                return p
        return reason
    print(f"② 段子筛选：保留 {len(keep)} / 剔除 {len(drop)}（原始 {len(topics)}）")
    for r, n in Counter(cat(x["剔除原因"]) for x in drop).most_common():
        print(f"     - {r}: {n}")

    # ③ 完全重复去重
    if not args.keep_dup:
        keep, removed = dedup(keep)
        print(f"③ 重复内容去重：移除 {len(removed)} 条（内容完全相同，保留最新）→ {len(keep)} 条")
        if removed:
            write_csv(removed, os.path.join(HERE, "_dump_duplicated.csv"),
                      CSV_COLS + ["剔除原因"])

    # ④ 落盘
    keep.sort(key=lambda r: r["时间"], reverse=True)
    write_csv(keep, args.out)
    print(f"④ 已导出 {os.path.abspath(args.out)}（{len(keep)} 条）")
    if drop:
        write_csv(drop, os.path.join(HERE, "_dump_dropped.csv"), CSV_COLS + ["剔除原因"])
        print(f"   剔除明细：{os.path.join(HERE, '_dump_dropped.csv')}")

    # ⑤ 统计摘要
    if keep:
        months = Counter(r["月份"] for r in keep)
        print("⑤ 月度分布：" + " | ".join(f"{m}: {n}" for m, n in sorted(months.items())))
        lens = sorted(len(r["内容"]) for r in keep)
        print(f"   正文字数：中位 {lens[len(lens)//2]} / 最长 {lens[-1]} / 总计 {sum(lens):,} 字")

    # ⑥ 推 GitHub
    if args.github_token:
        rel = "data/" + os.path.basename(args.out)
        txt = open(args.out, encoding="utf-8-sig").read()
        gh_push(args.github_token, txt,
                f"add: 全部-市场观点（近 {args.days} 天全量段子，{len(keep)} 条）", rel)
    print("完成 ✓")


if __name__ == "__main__":
    main()
