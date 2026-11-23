"""Build a portable SQLite database from the repository's published data files."""
import argparse
import csv
import hashlib
import json
import math
import os
import re
import sqlite3
import sys
import tempfile
from pathlib import Path

import build_research_sqlite as research
from build_hotel_sqlite import TABLES as HOTEL_TABLES, import_table

def ident(name):
    return '"' + name.replace('"', '""') + '"'

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def sql_name(path):
    stem = str(Path(path).with_suffix("")).removeprefix("data/")
    return re.sub(r"[^\w]+", "_", stem).strip("_") or "dataset"

def available_name(proposed, used):
    name = proposed
    suffix = 1
    while name.lower() in used or name.lower().startswith("sqlite_"):
        name = f"dataset_{proposed}_{suffix}"
        suffix += 1
    used.add(name.lower())
    return name

def csv_table(db, path, name):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream)
        header = next(reader)
        used = set()
        cols = [available_name(c or f"column_{i}", used) for i,c in enumerate(header,1)]
        # Infer complete columns, keeping identifiers and formatted numbers as text.
        # Leading zeroes on ticker codes and mixed units must survive the import.
        types = ["TEXT" if re.search(r"(^|_)(id|code|ticker|period)(_|$)|代码|编号", c, re.I)
                 else None for c in cols]
        number = re.compile(r"-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\Z", re.ASCII)
        for row in reader:
            if not row:
                continue
            if len(row) != len(cols):
                raise ValueError(f"{path}:{reader.line_num}: wrong field count")
            for i,value in enumerate(row):
                if types[i] == "TEXT" or value == "":
                    continue
                if len(value) > 64 or not number.fullmatch(value):
                    types[i] = "TEXT"
                elif "." in value or "e" in value.lower():
                    types[i] = "REAL" if math.isfinite(float(value)) else "TEXT"
                elif abs(int(value)) > 2**53 - 1:
                    types[i] = "TEXT"
                elif types[i] is None:
                    types[i] = "INTEGER"
        db.execute(f"CREATE TABLE {ident(name)} (" +
                   ", ".join(ident(c) + " " + (t or "TEXT") for c,t in zip(cols,types)) + ") STRICT")
        stream.seek(0)
        reader = csv.reader(stream)
        next(reader)
        slots = ", ".join("?" for c in cols)
        def rows():
            for row in reader:
                if not row:
                    continue
                if len(row) != len(header):
                    raise ValueError(f"{path}:{reader.line_num}: expected {len(header)} fields, got {len(row)}")
                yield tuple(v if v != "" else None for v in row)
        before = db.total_changes
        db.executemany(f"INSERT INTO {ident(name)} VALUES ({slots})", rows())
        return db.total_changes - before

def json_arrays(node, keys=()):
    if isinstance(node, list):
        yield keys, node
    elif isinstance(node, dict):
        for key, child in node.items():
            if isinstance(child, (list, dict)):
                yield from json_arrays(child, keys + (key,))

def make_json_views(db, source, doc_id, doc, used):
    # Json_each on an explicit subtree also works with punctuation in object keys.
    for keys, records in json_arrays(doc):
        name = available_name(sql_name(source) + ("__" + "__".join(keys) if keys else "__rows"), used)
        expr = "d.body"
        # SQLite's arrow operator treats a fully quoted label as a JSON path.
        for key in keys:
            expr = "(" + expr + " -> " + literal("$." + json.dumps(key, ensure_ascii=False)) + ")"
        cols = ["e.key AS _index", "e.value AS _record"]
        seen = {"_index", "_record"}
        fields = dict.fromkeys(k for row in records if isinstance(row, dict) for k in row)
        if len(fields) <= 150:
            for k in fields:
                alias = available_name(k or "field", seen)
                jp = literal("$." + json.dumps(k,ensure_ascii=False))
                cols.append(f"CASE WHEN e.type='object' THEN json_extract(e.value,{jp}) END AS {ident(alias)}")
        db.execute(f"CREATE VIEW {ident(name)} AS SELECT " + ", ".join(cols) +
                   f" FROM json_documents d, json_each({expr}) e WHERE d.id={doc_id}")
        db.execute("INSERT INTO json_collections VALUES (?,?,?,?)",
                   (source, json.dumps(keys, ensure_ascii=False),name,len(records)))

def build(root, output):
    data = root / "data"
    extra = [root / "data-manifest.json", *sorted((root / "docs/reviews").glob("*.json"))]
    paths = sorted(p for p in data.rglob("*") if p.suffix.lower() in {".csv",".json"}) + extra
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as tmp:
        pending = Path(tmp) / "build.sqlite"
        db = sqlite3.connect(pending)
        try:
            db.executescript("""
                CREATE TABLE datasets(path TEXT PRIMARY KEY, format TEXT, sql_name TEXT,
                                      row_count INTEGER, bytes INTEGER, sha256 TEXT);
                CREATE TABLE json_documents(id INTEGER PRIMARY KEY, path TEXT UNIQUE,
                                            body TEXT NOT NULL CHECK(json_valid(body)));
                CREATE TABLE json_collections(path TEXT, key_path TEXT, view_name TEXT UNIQUE,
                                              row_count INTEGER, PRIMARY KEY(path,key_path));
                CREATE TABLE dataset_sources(table_name TEXT PRIMARY KEY, source_file TEXT,
                                             row_count INTEGER, sha256 TEXT);
            """)
            research.schema(db)
            research.collect(db, root, [p.relative_to(root).as_posix() for p in paths])
            used = {r[0].lower() for r in db.execute("SELECT name FROM sqlite_master")} | set(HOTEL_TABLES)
            for path in paths:
                rel = path.relative_to(root).as_posix()
                raw = path.read_bytes()
                ext = path.suffix.lower()[1:]
                try:
                    if path.parent == data and path.stem in HOTEL_TABLES and ext == "csv":
                        name = path.stem
                        count = import_table(db, data, name, HOTEL_TABLES[name])
                    elif ext == "csv" and research.csv_kind(rel):
                        name = "research_sources"
                        count = db.execute("SELECT count(*) FROM research_sources WHERE path=?", (rel,)).fetchone()[0]
                    elif ext == "csv":
                        name = available_name(sql_name(rel), used)
                        count = csv_table(db,path,name)
                    else:
                        body = raw.decode("utf-8-sig")
                        doc = json.loads(body)
                        row = db.execute("INSERT INTO json_documents(path,body) VALUES (?,?)",(rel,body))
                        if not rel.startswith(("data/research/archive/", "data/research/updates/",
                                               "data/research/processed/")):
                            make_json_views(db,rel,row.lastrowid,doc,used)
                        name, count = "json_documents", 1
                    db.execute("INSERT INTO datasets VALUES (?,?,?,?,?,?)",
                               (rel,ext,name,count,len(raw),hashlib.sha256(raw).hexdigest()))
                except Exception as error:
                    raise ValueError(f"{rel}: {error}") from error
            db.execute("CREATE INDEX industry_region_segment ON hotel_industry_weekly(region,segment,period_id)")
            db.commit()
            if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                raise ValueError("Integrity check failed")
            for name, expected in db.execute("SELECT sql_name,row_count FROM datasets WHERE format='csv' AND sql_name <> 'research_sources'"):
                if db.execute(f"SELECT count(*) FROM {ident(name)}").fetchone()[0] != expected:
                    raise ValueError(name)
            for name, expected in db.execute("SELECT view_name,row_count FROM json_collections"):
                if db.execute(f"SELECT count(*) FROM {ident(name)}").fetchone()[0] != expected:
                    raise ValueError(f"JSON view count mismatch: {name}")
            print("Source files and rows/documents by format:", db.execute(
                "SELECT format,count(*),sum(row_count) FROM datasets GROUP BY format").fetchall())
            print("Queryable JSON collections and entries:", db.execute(
                "SELECT count(*),sum(row_count) FROM json_collections").fetchone())
        finally:
            db.close()
        os.replace(pending,output)

if __name__ == "__main__":
    csv.field_size_limit(sys.maxsize)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output",type=Path)
    args = parser.parse_args()
    build(Path(__file__).resolve().parents[1],args.output)
