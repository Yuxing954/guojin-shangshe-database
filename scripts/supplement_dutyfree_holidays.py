"""Apply reviewed public disclosures; never infer an absent period from a growth rate."""
import copy
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = {"spend": "购物金额（亿元）/购物人次（万人次）×10000",
           "daily_sales": "购物金额/统计天数", "daily_shoppers": "购物人次/统计天数"}


def group(record):
    return record.get("comparison_group", record.get("holiday_group", record["holiday"]))


def apply_updates(data):
    supplements = json.loads((ROOT / "data/dutyfree/public-supplements.json").read_text())
    records = data["records"]
    for update in supplements["records"]:
        record = next((r for r in records if all(r[k] == update[k] for k in ("year", "holiday", "kind"))), None)
        if record is None:
            record = {"id": f'{update["year"]}-{update["holiday"]}-{update["kind"]}-public',
                      "sheet": "", "source_cells": {}, "notes": [], "daily_yoy": None,
                      "shoppers_daily_yoy": None, "spend_yoy": None}
            records.append(record)
        elif not record.get("web_source") and "workbook_baseline" not in record:
            record["workbook_baseline"] = copy.deepcopy(record)
        if update.get("preserve_calendar_detail"):
            baseline = record["workbook_baseline"]
            detail_id = f'{update["year"]}-元旦同日历三天-detail-public-baseline'
            if not any(r["id"] == detail_id for r in records):
                detail = copy.deepcopy(baseline)
                detail.update(id=detail_id, kind="detail", holiday="元旦同日历三天", holiday_group="元旦",
                              daily_yoy=None, shoppers_daily_yoy=None, spend_yoy=None,
                              yoy_basis="原表公式反推的同日历窗口，不能作为法定假期")
                detail["notes"].append("1月2日、3日为工作日；该三天窗口由原表公式反推，非独立公开披露。")
                records.append(detail)
        for key, value in update.items():
            if key not in ("notes", "preserve_calendar_detail", "recompute_yoy"):
                record[key] = copy.deepcopy(value)
        record["notes"] = list(dict.fromkeys(record["notes"] + update["notes"]))
        record.update(status="available", quality="公开披露＋计算值")
        if "web_source" in update:
            record["web_source"]["checkedAt"] = supplements["checkedAt"]
        sales, shoppers, days = record.get("sales"), record.get("shoppers"), record.get("days")
        record["spend"] = sales / shoppers * 10000 if sales is not None and shoppers else None
        record["daily_sales"] = sales / days if sales is not None and days else None
        record["daily_shoppers"] = shoppers / days if shoppers is not None and days else None
        record["calculations"] = dict(DERIVED)
        if update.get("preserve_calendar_detail") or update.get("recompute_yoy"):
            record.update(daily_yoy=None, shoppers_daily_yoy=None, spend_yoy=None)
        if not record.get("yoy_basis"):
            record["yoy_basis"] = "未取得可比同比，保持缺失；披露同比单列保留"

    for record in records:
        if record["kind"] != "holiday" or not record.get("days"):
            continue
        previous = next((r for r in records if r["kind"] == "holiday" and r["year"] == record["year"] - 1
                         and group(r) == group(record)), None)
        if previous is None or not previous.get("days"):
            continue
        for field, key in (("daily_sales", "daily_yoy"), ("daily_shoppers", "shoppers_daily_yoy"), ("spend", "spend_yoy")):
            if record.get(key) is None and record.get(field) is not None and previous.get(field):
                record[key] = (record[field] / previous[field] - 1) * 100
                record.setdefault("calculations", {})[key] = f'{record["year"]}年{field}/{previous["year"]}年{field}−1，乘100'
                record["yoy_basis"] = "缺失同比按连续上一年同组假期的日均/每人次金额计算；原文披露同比单列保留。"
    data["updatedAt"] = supplements["checkedAt"]
    data["coverageNotes"] = supplements["coverageNotes"]
    data["source"] = "历史数据保留原表单元格；经核验的公开披露逐条补录。披露同比与按本表计算的日均同比分别保留。"
    return data


def write_data(data):
    (ROOT / "data/dutyfree/holidays.json").write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    fields = ["year", "holiday", "daily_sales_cny_100m", "yoy_pct", "source", "period", "days", "sales_cny_100m",
              "shoppers_10k", "spend_per_shopper_cny", "daily_shoppers_10k", "status", "quality", "source_sheet", "source_sales_cell"]
    with (ROOT / "data/dutyfree_holiday.csv").open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out, lineterminator="\n")
        writer.writerow(fields)
        for r in data["records"]:
            if r["kind"] == "holiday":
                writer.writerow([r["year"], r["holiday"], r["daily_sales"], r["daily_yoy"],
                                 r.get("web_source", {}).get("url", data["sourceFile"]), r["period"], r["days"], r["sales"],
                                 r["shoppers"], r["spend"], r["daily_shoppers"], r["status"], r["quality"], r["sheet"],
                                 r["source_cells"].get("sales", {}).get("cell", "")])


if __name__ == "__main__":
    data = apply_updates(json.loads((ROOT / "data/dutyfree/holidays.json").read_text()))
    write_data(data)
    print(json.dumps({"holiday": sum(r["kind"] == "holiday" for r in data["records"]),
                      "detail": sum(r["kind"] == "detail" for r in data["records"])}, ensure_ascii=False))
