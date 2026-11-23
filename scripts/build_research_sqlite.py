"""Consolidate source batches into research records with reversible source mappings."""
import csv
import hashlib
import json
import re

BASE = {"data/全部-市场观点.csv": "all_views", "data/商社-市场观点.csv": "views",
        "data/商社-纪要文库.csv": "minutes"}
ARCHIVE = re.compile(r"data/research/archive/(views|all_views)/[0-9]+\.json$")
LIBRARY = "data/research/library.json"
WORK = "data/research/work-minutes.json"

def csv_kind(path):
    if path in BASE:
        return BASE[path]
    if path.startswith("data/research/updates/"):
        match = re.search(r"-(all_views|views|minutes)(?:-|\.csv$)", path)
        if match:
            return match.group(1)
    return None

def schema(db):
    db.executescript("""
        CREATE TABLE research_records (
          id TEXT PRIMARY KEY, kind TEXT NOT NULL, published TEXT, title TEXT, body TEXT,
          summary TEXT, author TEXT, source_url TEXT, attachment_url TEXT,
          filename TEXT, company TEXT, in_sector_views INTEGER NOT NULL DEFAULT 0
        ) WITHOUT ROWID;
        CREATE TABLE research_sources (
          path TEXT, position INTEGER, record_id TEXT NOT NULL REFERENCES research_records(id),
          source_group TEXT NOT NULL, csv_fields TEXT,
          PRIMARY KEY(path,position)
        ) WITHOUT ROWID;
        CREATE INDEX research_sources_record ON research_sources(record_id);
        CREATE INDEX research_kind_date ON research_records(kind,published);
    """)

def dump(value):
    return json.dumps(value,ensure_ascii=False,separators=(",",":"))

def digest(*fields):
    return hashlib.sha256(dump(fields).encode()).hexdigest()

def topic(url):
    match = re.search(r"/topic/(\d+)(?:[/#?]|$)",url or "")
    return match.group(1) if match else None

def download(value):
    if value and value.startswith("{"):
        try:
            obj=json.loads(value)
            if isinstance(obj,dict):
                return obj.get("link") or obj.get("url")
        except ValueError:
            pass
    return value

def save(db, path, position, group, key, values, raw=None):
    # More authoritative input is read last; missing fields never erase earlier values.
    cols = ("kind","published","title","body","summary","author","source_url",
            "attachment_url","filename","company")
    fields=[values.get(c) or None for c in cols]
    update=", ".join(f"{c}=coalesce(excluded.{c},{c})" for c in cols)
    db.execute(f"INSERT INTO research_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?) "
               f"ON CONFLICT(id) DO UPDATE SET {update}, "
               "in_sector_views=max(in_sector_views,excluded.in_sector_views)",
               (key,*fields,int(group=="views")))
    db.execute("INSERT INTO research_sources VALUES (?,?,?,?,?)",
               (path,position,key,group,dump(raw) if raw is not None else None))

def collect(db, root, paths):
    def document(path):
        return json.loads((root/path).read_text(encoding="utf-8-sig"))
    library=document(LIBRARY)["records"]
    work=document(WORK)["records"]
    minutes={r["id"] for r in work}
    by_topic_name={}
    for r in library:
        name=r.get("name")
        for tid in set((r.get("sourceTopics") or [])+[r.get("topicId")]):
            if tid and name:
                by_topic_name.setdefault((str(tid),name),set()).add(r["id"])

    def article(path,pos,group,r,raw=None):
        url=r.get("原文链接")
        date=r.get("原始发布时间") or r.get("时间") or r.get("日期")
        title=r.get("标题")
        if group=="minutes":
            file=r.get("文件名") or title
            link=download(r.get("下载链接"))
            matches=by_topic_name.get((topic(url or link),file),set())
            key=("asset:"+next(iter(matches)) if len(matches)==1 else
                 "minutes:"+digest(file,link or url or date))
            minutes.add(key.removeprefix("asset:"))
            values=dict(kind="纪要",published=date,title=title,body=r.get("内容"),
                        summary=r.get("摘要"),source_url=url,attachment_url=link,
                        filename=file,company=r.get("相关标的"))
        else:
            tid=topic(url)
            # Distinct topic IDs always stay separate, even with identical titles.
            key=("topic:"+tid if tid else "view:"+digest(url,date,title,r.get("内容")))
            values=dict(kind="观点",published=date,title=title,body=r.get("内容"),
                        author=r.get("作者"),source_url=url)
        save(db,path,pos,group,key,values,raw)

    for path in paths:
        group=csv_kind(path)
        if not group or not path.endswith(".csv"):
            continue
        with (root/path).open(encoding="utf-8-sig",newline="") as stream:
            for pos,r in enumerate(csv.DictReader(stream),1):
                if None in r or None in r.values():
                    raise ValueError(f"Invalid CSV fields in {path} record {pos}")
                article(path,pos,group,r,r)
    for path in paths:
        match=ARCHIVE.fullmatch(path)
        if match:
            for pos,r in enumerate(document(path)["rows"],1):
                article(path,pos,match.group(1),r)
    for path,rows in ((LIBRARY,library),(WORK,work)):
        for pos,r in enumerate(rows,1):
            asset=r["id"]
            storage=r.get("storage") or {}
            processed=r.get("processing") or {}
            values=dict(kind="纪要" if asset in minutes else "附件",
                        title=r.get("name"),filename=r.get("name"),published=r.get("published") or r.get("date"),
                        summary=processed.get("summary"),source_url=r.get("sourceUrl"),
                        attachment_url=storage.get("openUrl") or storage.get("webUrl") or storage.get("url"),company=r.get("company"))
            save(db,path,pos,"library" if path==LIBRARY else "work_minutes","asset:"+asset,values)
    for path in paths:
        if path.startswith("data/research/processed/") and path.endswith(".json"):
            r=document(path)
            if r.get("type") != "work_minutes" or not r.get("assetId"):
                continue
            values=dict(kind="纪要",title=r.get("title"),body=r.get("body"),summary=r.get("summary"),
                        company=r.get("company"))
            save(db,path,1,"processed","asset:"+r["assetId"],values)
    if db.execute("PRAGMA foreign_key_check(research_sources)").fetchone():
        raise ValueError("Unlinked research source")
