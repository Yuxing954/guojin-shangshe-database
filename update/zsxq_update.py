# -*- coding: utf-8 -*-
"""
知识星球「水木调研纪要-2.0」→ 商社·市场观点 一站式增量更新
流程：抓取增量 → 关键词过滤 → 写入资料库表 → 导出 CSV → 推送 GitHub

前置条件：
  1. zsxq-cli 已登录：zsxq-cli auth login
  2. 资料库 op_ token：--lib-token 传入（WorkBuddy 会话内获取，30 分钟有效；
     只推 GitHub 不更新资料库时可用 --skip-lib 跳过）
  3. GitHub PAT（需 Contents 写权限）：--github-token 传入（用完即弃，不落盘）

用法示例：
  python zsxq_update.py --lib-token <op_token> --github-token <PAT>            # 全流程
  python zsxq_update.py --lib-token <op_token> --skip-push                     # 只更新资料库
  python zsxq_update.py --github-token <PAT> --skip-lib                        # 只把本地 CSV 推 GitHub
"""
import argparse, base64, csv, datetime, io, json, os, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "config.json"), encoding="utf-8"))
ZSXQ = os.environ.get("ZSXQ_CLI", "zsxq-cli")
LIB_API = os.environ.get("LIB_SPACE_API", "")

def parse_time(s):
    return datetime.datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%f%z")

# ---------- 1. 抓取 ----------
def ensure_zsxq_auth():
    """预检 zsxq-cli 登录态；失效时自动从 zsxq_auth_backup.json 恢复（同机同用户）。"""
    r = subprocess.run([ZSXQ, "auth", "status"], capture_output=True, text=True,
                       encoding="utf-8", timeout=30, shell=(os.name == "nt"))
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0 and "Logged in as" in out:
        print(f"  zsxq-cli 登录态正常（{out.strip().splitlines()[0].lstrip('✓ ')}）")
        return
    bk = os.path.join(HERE, "zsxq_auth_backup.json")
    if not os.path.exists(bk):
        sys.exit("✗ zsxq-cli 未登录且无备份可恢复，请先扫码授权：zsxq-cli auth login")
    print("  ⚠ zsxq-cli 登录态失效，尝试从备份恢复…")
    rr = subprocess.run([sys.executable, os.path.join(HERE, "restore_zsxq_auth.py"), "-f", bk],
                        capture_output=True, text=True, encoding="utf-8", timeout=60)
    print("  " + ((rr.stdout or "") + (rr.stderr or "")).strip().replace("\n", "\n  "))
    if rr.returncode != 0:
        sys.exit("✗ 自动恢复失败（备份可能过旧或跨机器），请重新扫码授权：zsxq-cli auth login")


def fetch_since(cutoff):
    topics, end_time, page = [], None, 0
    while True:
        page += 1
        cmd = [ZSXQ, "group", "+topics", "--group-id", CFG["group_id"], "--limit", "30", "--json"]
        if end_time:
            cmd += ["--end-time", end_time]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=60)
        d = json.loads(r.stdout)
        ts = d.get("topics_brief") or []
        print(f"  page{page}: {len(ts)} 条")
        if not ts:
            break
        topics.extend(ts)
        if parse_time(ts[-1]["create_time"]) <= cutoff or not d.get("has_more"):
            break
        end_time = d.get("next_end_time")
        time.sleep(1)
    return [t for t in topics if parse_time(t["create_time"]) > cutoff]

# ---------- 2. 资料库 ----------
def lib_call(method, args, token, stdin_data=None):
    cmd = [LIB_API, method, "--token-stdin"] + args
    r = subprocess.run(cmd, input=token, capture_output=True, text=True,
                       encoding="utf-8", timeout=120)
    return json.loads(r.stdout)

def lib_batch_add(token, records):
    ok = 0
    for i in range(0, len(records), 50):
        chunk = records[i:i + 50]
        payload = json.dumps({"database_id": CFG["database_id"], "records": chunk}, ensure_ascii=False)
        script = os.path.join(os.path.dirname(LIB_API), "database", "batch_add_database_records.py")
        r = subprocess.run([sys.executable, script, "--token-stdin", "--stdin"],
                           input=token + "\n" + payload, capture_output=True, text=True,
                           encoding="utf-8", timeout=180)
        try:
            resp = json.loads(r.stdout)
            n = len(resp.get("results") or [])
        except Exception:
            n = 0
            print(f"  batch{i//50+1} 异常: {r.stdout[:200]} {r.stderr[:200]}")
        ok += n
        print(f"  batch{i//50+1}: {n}/{len(chunk)}")
    return ok

def lib_export_csv(token):
    d = lib_call("space.database.get-database-content",
                 ["--database-id", CFG["database_id"]], token)
    return d["data"]["content"]

# ---------- 3. GitHub ----------
def gh(method, url, pat, payload=None, retries=3):
    req = urllib.request.Request(url, method=method,
        data=json.dumps(payload).encode() if payload else None,
        headers={"Authorization": "Bearer " + pat, "Accept": "application/vnd.github+json",
                 "User-Agent": "zsxq-update"})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.status, json.loads(r.read().decode() or "{}")
        except Exception as e:
            if i == retries - 1:
                raise
            print(f"  retry {i}: {e}")
            time.sleep(2)

def gh_push_csv(pat, csv_text, message):
    base = f"https://api.github.com/repos/{CFG['repo_owner']}/{CFG['repo_name']}"
    p = urllib.request.quote(CFG["csv_path"])
    c, body = gh("GET", f"{base}/contents/{p}?ref={CFG['branch']}", pat)
    sha = body.get("sha") if c == 200 else None
    payload = {"message": message, "branch": CFG["branch"],
               "content": base64.b64encode(csv_text.encode("utf-8-sig")).decode()}
    if sha:
        payload["sha"] = sha
    c, body = gh("PUT", f"{base}/contents/{p}", pat, payload)
    url = body.get("commit", {}).get("html_url")
    print(f"  GitHub 推送: {c} {url or body}")
    return c in (200, 201)

# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lib-token", help="资料库 op_ token（--skip-lib 时可省）")
    ap.add_argument("--github-token", help="GitHub PAT（--skip-push 时可省）")
    ap.add_argument("--skip-lib", action="store_true", help="跳过资料库写入")
    ap.add_argument("--skip-push", action="store_true", help="跳过 GitHub 推送")
    ap.add_argument("--skip-fetch", action="store_true", help="跳过抓取，直接用本地 CSV 推 GitHub")
    args = ap.parse_args()

    # op_ token 自动铸造：不传 --lib-token 时现场铸一个（30 分钟 TTL，即用即铸永不过期）
    if not args.skip_lib and not args.lib_token:
        try:
            sys.path.insert(0, HERE)
            from get_lib_token import mint_token
            args.lib_token = mint_token()
            print("① 自动铸造资料库 op_ token ✓（30 分钟内有效）")
        except Exception as e:
            sys.exit(f"未提供 --lib-token 且自动铸造失败：{e}\n（请确认在 WorkBuddy 会话内运行，或手动传 --lib-token）")

    local_csv = os.path.normpath(os.path.join(HERE, CFG["local_csv"]))

    if args.skip_fetch:
        csv_text = open(local_csv, encoding="utf-8-sig").read()
    else:
        # 0) zsxq-cli 登录态预检（失效自动恢复）
        ensure_zsxq_auth()
        # 1) 线上表现状
        if not args.skip_lib:
            d = lib_call("space.database.get-database-content",
                         ["--database-id", CFG["database_id"]], args.lib_token)
            rows = list(csv.DictReader(io.StringIO(d["data"]["content"])))
            cutoff = max(r["时间"] for r in rows)
            existing = {(r["时间"], r["标题"]) for r in rows}
            print(f"① 线上表 {len(rows)} 条，最新 {cutoff}")
        else:
            cutoff = "2026-01-01T00:00:00.000+0800"
            existing = set()

        # 2) 抓取增量
        print("② 抓取知识星球增量…")
        topics = fetch_since(parse_time(cutoff))
        print(f"   增量 {len(topics)} 条")

        # 3) 过滤
        pool, generic = CFG["pool"], set(CFG["generic"])
        new_recs = []
        for t in topics:
            ct = parse_time(t["create_time"])
            title, body = t.get("title") or "", t.get("content") or ""
            hits = [k for k in pool if k.lower() in (title + "\n" + body).lower()]
            if not hits or (t["create_time"], title) in existing:
                continue
            if any(w in title for w in CFG["noise_title_words"]) and all(h in generic for h in hits):
                continue
            c = t.get("counts") or {}
            link = f"https://wx.zsxq.com/group/{CFG['group_id']}/topic/{t['topic_id']}"
            new_recs.append({
                "时间": {"text": t["create_time"]}, "月份": {"select": f"{ct.month}月"},
                "标题": {"text": title}, "内容": {"text": body},
                "作者": {"text": (t.get("owner") or {}).get("name", "")},
                "命中关键词": {"text": "|".join(hits)},
                "点赞": {"number": c.get("likes", 0)}, "评论": {"number": c.get("comments", 0)},
                "阅读": {"number": c.get("readers", 0)},
                "原文链接": {"url": {"text": "原文链接", "link": link}}})
        print(f"③ 过滤后新增 {len(new_recs)} 条")

        # 4) 入库
        if new_recs and not args.skip_lib:
            print("④ 写入资料库…")
            n = lib_batch_add(args.lib_token, new_recs)
            print(f"   写入 {n}/{len(new_recs)}")

        # 5) 导出 CSV 落盘
        if not args.skip_lib:
            print("⑤ 导出 CSV…")
            csv_text = lib_export_csv(args.lib_token)
            os.makedirs(os.path.dirname(local_csv), exist_ok=True)
            with open(local_csv, "w", encoding="utf-8-sig", newline="") as f:
                f.write(csv_text)
        else:
            csv_text = open(local_csv, encoding="utf-8-sig").read()

    # 6) 推 GitHub
    if not args.skip_push:
        print("⑥ 推送 GitHub…")
        gh_push_csv(args.github_token, csv_text,
                    f"update: 商社-市场观点 知识星球增量 ({datetime.date.today().isoformat()})")
    print("完成 ✓")

if __name__ == "__main__":
    main()
