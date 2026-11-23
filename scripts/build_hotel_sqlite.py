"""Build an atomic SQLite snapshot from the four canonical hotel data tables."""
import argparse
import csv
import hashlib
import os
from pathlib import Path
import sqlite3
import tempfile

TABLES = {
    "hotel_industry_weekly": ("period_id", "region", "segment"),
    "hotel_group_weekly": ("period_id", "group"),
    "hotel_supply_weekly": ("period_id", "region", "room_band"),
    "hotel_market_share_annual": ("year", "group"),
}
TEXT = {"period_id", "region", "segment", "group", "room_band", "source",
        "start_date", "end_date"}
REAL = {"occupancy_rate", "adr", "revpar", "stay_adr", "price_index",
        "heat_index", "stay_price_index", "stay_heat_index", "market_share_pct"}
INTEGER = {"year", "week", "hotel_count", "room_count", "hotel_count_15plus",
           "room_count_15plus", "chain_hotel_count", "chain_room_count"}


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def import_table(db, source_dir, table, keys):
    path = source_dir / (table + ".csv")
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream, strict=True)
        header = next(reader)
        types = []
        for name in header:
            if name not in TEXT | REAL | INTEGER:
                raise ValueError(f"{path}: unknown column {name}")
            types.append("TEXT" if name in TEXT else "REAL" if name in REAL else "INTEGER")
        definitions = [f"{quote(name)} {kind}" for name, kind in zip(header, types)]
        definitions.append("PRIMARY KEY (" + ", ".join(map(quote, keys)) + ")")
        db.execute(f"CREATE TABLE {table} ({', '.join(definitions)}) STRICT, WITHOUT ROWID")
        placeholders = ", ".join("?" for name in header)
        db.executemany(f"INSERT INTO {table} VALUES ({placeholders})",
                       ([None if value == "" else value for value in row] for row in reader))
    count = db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
    if not count:
        raise ValueError(f"{path}: empty input")
    db.execute("INSERT INTO dataset_sources VALUES (?, ?, ?, ?)",
               (table, path.name, count, hashlib.sha256(path.read_bytes()).hexdigest()))
    return count


def build(source_dir, output):
    if output.suffix.lower() not in {".db", ".sqlite", ".sqlite3"}:
        raise ValueError("Use a .db, .sqlite or .sqlite3 destination")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as scratch:
        pending = Path(scratch) / "snapshot.db"
        db = sqlite3.connect(pending)
        try:
            with db:
                db.execute("CREATE TABLE dataset_sources (table_name TEXT PRIMARY KEY, "
                           "source_file TEXT, row_count INTEGER, sha256 TEXT)")
                for table, keys in TABLES.items():
                    print(table, import_table(db, source_dir, table, keys))
                db.execute("CREATE INDEX industry_region_segment ON "
                           "hotel_industry_weekly(region, segment, period_id)")
                if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                    raise ValueError("SQLite integrity check failed")
        finally:
            db.close()
        os.replace(pending, output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.source_dir, args.output)
