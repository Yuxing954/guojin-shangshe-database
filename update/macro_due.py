"""Plan only macro series whose official or expected release window is due."""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta
from pathlib import Path

_HERE = Path(__file__).resolve().parent
ROOT = _HERE.parent if _HERE.name == "update" else _HERE
DEFAULT_REGISTRY = ROOT / "data/macro/choice-registry.json"
LEDGER = ROOT / ".cache/macro-due-ledger.json"
POLICY = {
    "timezone": "Asia/Shanghai",
    "marketHolidays": [
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
        "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
        "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19", "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25",
    ],
    "windows": {
        "nbs_cpi": {"days": [10, 16], "exactDays2026": [10, 12, 10, 11, 12, 11, 10, 10, 10, 15, 10, 10]},
        "nbs_pmi": {"days": [1, 3], "exactDays2026": [1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1]},
        "nbs_monthly": {"days": [16, 21], "exactDays2026": [20, None, 17, 17, 19, 17, 16, 18, 16, 20, 17, 16]},
        "nbs_quarterly": {"days": [16, 21], "months": [1, 4, 7, 10], "exactDays2026": [20, None, 17, 17, 19, 17, 16, 18, 16, 20, 17, 16]},
        "pbc_credit": {"days": [10, 17]},
        "lpr": {"days": [20, 23]},
        "customs_trade": {"days": [7, 15]},
        "us_bls": {"days": [11, 19]},
        "bls_cpi": {"exactDates": ["2026-10-15", "2026-11-11", "2026-12-11", "2027-01-14", "2027-02-12", "2027-03-11", "2027-04-14", "2027-05-13", "2027-06-11", "2027-07-15", "2027-08-12", "2027-09-15", "2027-10-15", "2027-11-11", "2027-12-11"]},
        "bls_employment": {"exactDates": ["2026-10-03", "2026-11-07", "2026-12-05", "2027-01-09", "2027-02-06", "2027-03-06", "2027-04-03", "2027-05-08", "2027-06-05", "2027-07-03", "2027-08-07", "2027-09-04", "2027-10-09", "2027-11-06", "2027-12-04"]},
        "census_housing": {"months": list(range(1, 13)), "days": [1, 31], "exactDays2026": [None, None, None, None, None, None, None, None, None, 21, 19, 18], "exactDays2027": [21, 19, 18, 21, 19, 18, 21, 18, 22, 20, 18, 17]},
        "us_retail": {"exactDates": ["2026-10-16", "2026-11-18", "2026-12-17"]},
        "us_pce": {"exactDates": ["2026-10-30", "2026-11-26", "2026-12-24", "2027-01-29", "2027-02-26", "2027-03-31", "2027-04-30", "2027-05-28", "2027-06-26", "2027-07-30", "2027-08-26", "2027-10-01", "2027-10-29", "2027-11-25", "2027-12-23"]},
        "us_industrial": {"exactDates": ["2026-01-17", "2026-02-19", "2026-03-17", "2026-04-17", "2026-05-16", "2026-06-16", "2026-07-18", "2026-08-19", "2026-09-19", "2026-10-17", "2026-11-18", "2026-12-17", "2027-01-16", "2027-02-18", "2027-03-16", "2027-04-16", "2027-05-18", "2027-06-17", "2027-07-17", "2027-08-18", "2027-09-17", "2027-10-19", "2027-11-18", "2027-12-17"]},
        "us_monthly_early": {"days": [1, 7]},
        "us_trade": {"exactDates": ["2026-11-05", "2026-12-09", "2027-01-08", "2027-02-05", "2027-03-10", "2027-04-07", "2027-05-06", "2027-06-10", "2027-07-08", "2027-08-06", "2027-09-09", "2027-10-07", "2027-11-05", "2027-12-08"]},
        "us_gdp": {"exactDates": ["2026-10-30", "2026-11-26", "2026-12-24", "2027-01-29", "2027-02-26", "2027-03-31", "2027-04-30", "2027-05-28", "2027-06-26", "2027-07-30", "2027-08-26", "2027-10-01", "2027-10-29", "2027-11-25", "2027-12-23"]},
        "daily_market": {"marketCalendar": True},
        "daily_prediction": {"everyDay": True},
        "weekly_gold": {"weekdays": [5, 6]},
        "monthly_gold": {"days": [1, 7]},
        "annual_low_frequency": {"months": [10], "days": [1, 7]},
        "fomc": {"exactDates": ["2026-10-29", "2026-12-10", "2027-01-28", "2027-03-18", "2027-04-29", "2027-06-10", "2027-07-29", "2027-09-16", "2027-10-28", "2027-12-09"]},
        "sep": {"exactDates": ["2026-12-10", "2027-03-18", "2027-06-10", "2027-09-16", "2027-12-09"]},
    },
    "scopeWindows": {
        "fedwatch": "daily_market", "federal-funds-futures": "daily_market",
        "polymarket": "daily_prediction", "gold-etf-flows": "weekly_gold",
        "cftc-positioning": "weekly_gold", "central-bank-gold": "monthly_gold",
        "annual-low-frequency": "annual_low_frequency", "fed-policy": "fomc",
        "sep-projections": "sep",
    },
    "calendarSources": {
        "china": "https://www.stats.gov.cn/",
        "bls": "https://www.bls.gov/schedule/",
        "census": "https://www.census.gov/economic-indicators/calendar-listview.html",
        "bea": "https://www.bea.gov/news/schedule",
        "fomc": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
        "industrialProduction": "https://www.federalreserve.gov/releases/G17/default.htm",
        "marketHolidays": "https://www.nyse.com/markets/hours-calendars",
        "censusHousing": "https://www.census.gov/construction/soc/schedule.html",
        "blsCpi": "https://www.bls.gov/schedule/news_release/cpi.htm",
        "blsEmployment": "https://www.bls.gov/schedule/news_release/empsit.htm",
    },
}


def in_window(day: date, spec: dict, release_key: str) -> bool:
    if spec.get("marketCalendar"):
        session = day - timedelta(days=1)
        return session.weekday() < 5 and session.isoformat() not in POLICY["marketHolidays"]
    if "exactDates" in spec:
        return day.isoformat() in spec["exactDates"] or (day.fromordinal(day.toordinal() - 1)).isoformat() in spec["exactDates"]
    year_key = f"exactDays{day.year}"
    if year_key in spec:
        if spec.get("months") and day.month not in spec["months"]:
            return False
        exact = spec[year_key][day.month - 1]
        if exact is None:
            return False
        return day.day in (exact, min(exact + 1, 31))
    if "exactDays2026" in spec and day.year == 2026:
        # Exact release dates are converted to next-day Beijing checks; permit one
        # additional day for a transient source failure, keyed to that release month.
        if day.month != int(release_key[-2:]):
            return False
        exact = spec["exactDays2026"][day.month - 1]
        if exact is None:
            return False
        return day.day in (exact, min(exact + 1, 31))
    if spec.get("everyDay"):
        return True
    if "weekdays" in spec:
        return day.weekday() in spec["weekdays"]
    if spec.get("months") and day.month not in spec["months"]:
        return False
    return not spec.get("days") or spec["days"][0] <= day.day <= spec["days"][1]


def group_for(series: dict) -> str | None:
    sid, publisher = series["id"], series.get("publisher", "")
    if sid == "cn-pmi": return "nbs_pmi"
    if sid in {"cn-cpi", "cn-ppi", "consumer-cpi", "consumer-core-cpi"}: return "nbs_cpi"
    if publisher == "国家统计局":
        return "nbs_quarterly" if series.get("frequency") == "quarterly" else "nbs_monthly"
    if publisher == "中国人民银行": return "lpr" if sid == "cn-lpr" else "pbc_credit"
    if publisher == "中国外汇交易中心": return "nbs_monthly"
    if publisher == "海关总署": return "customs_trade"
    if sid == "us-pce" or sid == "us-personal-income": return "us_pce"
    if sid == "us-retail": return "us_retail"
    if sid == "us-industrial-production": return "us_industrial"
    if sid == "us-trade-balance": return "us_trade"
    if series.get("frequency") == "daily": return "daily_market"
    if sid == "us-fed-rate": return "us_monthly_early"
    return "us_bls"


def window_key(day: date, group: str) -> str:
    spec = POLICY["windows"][group]
    today, yesterday = day.isoformat(), day.fromordinal(day.toordinal() - 1).isoformat()
    if "exactDates" in spec:
        if today in spec["exactDates"]: return today
        if yesterday in spec["exactDates"]: return yesterday
    if group in ("daily_market", "daily_prediction"):
        return day.isoformat()
    if group in ("weekly_gold",):
        return f"{day.isocalendar().year}-W{day.isocalendar().week:02d}"
    if group in ("annual_low_frequency",):
        return str(day.year)
    if group in ("nbs_quarterly",):
        return f"{day.year}-Q{(day.month - 1)//3 + 1}"
    return f"{day.year}-{day.month:02d}"


def build_plan(day: date, registry: dict, ledger: dict | None = None) -> dict:
    ledger = ledger or {"choice": {}, "scopes": {}}
    due_choice, due_scopes = [], []
    for spec in registry.get("series", []):
        group = group_for(spec)
        if not group: continue
        policy = POLICY["windows"][group]
        key = window_key(day, group)
        if in_window(day, policy, key) and ledger.get("choice", {}).get(spec["id"]) != key:
            due_choice.append(spec["id"])
    official = []
    rules = {"bea-real-gdp": "us_gdp", "census-housing": "census_housing"}
    for source, group in rules.items():
        key = window_key(day, group)
        if in_window(day, POLICY["windows"][group], key) and ledger.get("official", {}).get(source) != key:
            official.append(source)
    for source, group in (("bls-cpi", "bls_cpi"), ("bls-employment", "bls_employment")):
        spec = POLICY["windows"][group]
        event = day.isoformat() if day.isoformat() in spec["exactDates"] else (day.fromordinal(day.toordinal() - 1)).isoformat()
        if event in spec["exactDates"] and ledger.get("official", {}).get(source) != event:
            official.append(source)
    for scope, group in POLICY["scopeWindows"].items():
        key = window_key(day, group)
        if in_window(day, POLICY["windows"][group], key) and ledger.get("scopes", {}).get(scope) != key:
            due_scopes.append(scope)
    return {"date": day.isoformat(), "dueChoice": due_choice, "dueOfficial": official,
            "dueScopes": due_scopes, "choiceCount": len(due_choice),
            "scopeCount": len(due_scopes), "policyVersion": 1}


def official_key(day: date, source: str) -> str:
    if source in ("bls-cpi", "bls-employment"):
        spec = POLICY["windows"]["bls_cpi" if source == "bls-cpi" else "bls_employment"]
        today = day.isoformat()
        yesterday = day.fromordinal(day.toordinal() - 1).isoformat()
        return today if today in spec["exactDates"] else yesterday
    group = {"bea-real-gdp": "us_gdp", "census-housing": "census_housing"}[source]
    return window_key(day, group)


def expected_period(spec: dict, day: date) -> str:
    """Latest data period expected to have been published by this Beijing date."""
    frequency = spec.get("frequency")
    if frequency == "monthly":
        index = day.year * 12 + day.month - 2
        year, month0 = divmod(index, 12)
        return f"{year}-{month0 + 1:02d}"
    if frequency == "quarterly":
        index = day.year * 4 + (day.month - 1) // 3 - 1
        year, quarter0 = divmod(index, 4)
        return f"{year}-Q{quarter0 + 1}"
    if frequency == "daily":
        return (day - timedelta(days=1)).isoformat()
    raise ValueError("Unsupported frequency")


def has_expected_period(spec: dict, observations: list[dict], day: date) -> bool:
    target = expected_period(spec, day)
    return any(str(row.get("period", "")) >= target for row in observations)


def semantic_payload(value):
    """Remove acquisition-only metadata before detecting meaningful changes."""
    volatile = {"checkedAt", "fetchedAt", "retrievedAt", "receiptSha256"}
    if isinstance(value, dict):
        return {key: semantic_payload(item) for key, item in value.items() if key not in volatile}
    if isinstance(value, list):
        return [semantic_payload(item) for item in value]
    return value


def incremental_start(spec: dict, observations: list[dict], full_history: bool = False) -> str:
    """Keep stored history, query a revision window, and audit full history annually."""
    if full_history or not observations:
        return spec["start"]
    latest = max(row["period"] for row in observations)
    frequency = spec["frequency"]
    if frequency == "monthly":
        year, month = map(int, latest.split("-"))
        index = year * 12 + month - 1 - 24
        year, month0 = divmod(index, 12)
        candidate = date(year, month0 + 1, 1)
    elif frequency == "quarterly":
        year, quarter = latest.split("-Q")
        index = int(year) * 4 + int(quarter) - 1 - 8
        year, quarter0 = divmod(index, 4)
        candidate = date(year, quarter0 * 3 + 1, 1)
    else:
        candidate = date.fromisoformat(latest) - timedelta(days=180)
    return max(spec["start"], candidate.isoformat())


def load_ledger(path: Path = LEDGER) -> dict:
    try: return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError): return {"choice": {}, "scopes": {}, "official": {}}


def save_ledger(ledger: dict, path: Path = LEDGER) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ledger, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", help="Beijing date YYYY-MM-DD; defaults to today in Asia/Shanghai")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--complete", nargs="*", default=[])
    args = ap.parse_args()
    if args.as_of:
        day = date.fromisoformat(args.as_of)
    else:
        from zoneinfo import ZoneInfo
        day = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    registry = json.loads(DEFAULT_REGISTRY.read_text(encoding="utf-8"))
    ledger = load_ledger()
    plan = build_plan(day, registry, ledger)
    if args.complete:
        for sid in args.complete:
            if sid in plan["dueChoice"]: ledger.setdefault("choice", {})[sid] = window_key(day, group_for(next(s for s in registry["series"] if s["id"] == sid)))
            elif sid in plan["dueScopes"]: ledger.setdefault("scopes", {})[sid] = window_key(day, POLICY["scopeWindows"][sid])
        save_ledger(ledger)
    if not args.complete:
        print(json.dumps({k: v for k, v in plan.items() if k not in ("dueChoice",)}, ensure_ascii=False, separators=(",", ":")) if args.json else f"dueChoice={plan['choiceCount']} dueOfficial={len(plan['dueOfficial'])} dueScopes={plan['scopeCount']}")
    return 0


if __name__ == "__main__": raise SystemExit(main())

