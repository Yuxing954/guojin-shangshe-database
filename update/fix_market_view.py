# -*- coding: utf-8 -*-
"""修复「商社·市场观点」表：清洗知识星球标签残留 + 规范标题
1) <e type="hashtag" title="%23XXX%23" /> -> #XXX#
2) <e type="web" href="..." title="..." /> -> 标题或解码后的链接
3) 连续重复行折叠、多余空行规整
4) 标题 = 内容首行（<=30 字，去换行）
"""
import sys, json, subprocess, os, re, io, csv, urllib.parse

API = "C:/Users/daiyu/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library/space_api.py"
DB = "xs7DJShaYbb07IWDaQgzyn"
TOKEN = sys.argv[1]

sys.path.insert(0, os.path.dirname(API))
sys.path.insert(0, os.path.join(os.path.dirname(API), "database"))


from clean_text import normalize_content, make_title  # noqa: E402


def lib(method, args, stdin=None):
    r = subprocess.run([sys.executable, API, method, "--token-stdin"] + args,
                       input=TOKEN, capture_output=True, text=True, encoding="utf-8", timeout=180)
    return json.loads(r.stdout)


# ---------- 1. 拉取全部记录 ----------
recs, cursor = [], None
while True:
    args = ["--database-id", DB, "--page-size", "100"]
    if cursor:
        args += ["--start-cursor", cursor]
    d = lib("space.database.query-database", args)
    data = d.get("data", {})
    recs += data.get("results", [])
    cursor = data.get("nextCursor") or data.get("next_cursor")
    if not cursor or len(recs) >= 500:
        break
print(f"拉取记录 {len(recs)} 条")

# ---------- 2. 计算修复 ----------
updates = []
for r in recs:
    old_c = r.get("内容", "") or ""
    old_t = r.get("标题", "") or ""
    new_c = normalize_content(old_c)
    new_t = make_title(new_c)
    if new_c != old_c or new_t != old_t:
        updates.append({"record_id": r["_id"],
                        "properties": {"内容": {"text": new_c}, "标题": {"text": new_t}}})

print(f"需修复 {len(updates)} 条")
for u in updates[:3]:
    print("  样例标题:", u["properties"]["标题"]["text"])

# ---------- 3. 批量回写 ----------
DRY = "--dry-run" in sys.argv
if DRY:
    print("【dry-run】未写入，以下为预览：")
    for u in updates[:8]:
        print("  -", u["properties"]["标题"]["text"])
    sys.exit(0)
if updates:
    script = os.path.join(os.path.dirname(API), "database", "batch_update_database_records.py")
    for i in range(0, len(updates), 50):
        chunk = updates[i:i + 50]
        payload = json.dumps({"database_id": DB, "records": chunk}, ensure_ascii=False)
        r = subprocess.run([sys.executable, script, "--token-stdin", "--stdin"],
                           input=TOKEN + "\n" + payload, capture_output=True, text=True,
                           encoding="utf-8", timeout=180)
        print(f"  批 {i//50+1}: {r.stdout.strip()[:200]}")
print("完成")
