"""Fill absent monthly dutyfree growth from the selected same-scope observations."""
import math
import re

VALUE_IDS = ("dutyfree_sales", "dutyfree_shoppers", "dutyfree_items", "dutyfree_spend")
RATE_IDS = {"dutyfree_sales": "dutyfree_sales_yoy", "dutyfree_shoppers": "dutyfree_shoppers_yoy"}

def previous(period):
    return f"{int(period[:4]) - 1}{period[4:]}" if re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period) else None

def fill_yoy(selected):
    for (metric, period), point in list(selected.items()):
        if metric not in VALUE_IDS or math.isfinite(point.get("change", float("nan"))):
            continue
        base_period = previous(period)
        base = selected.get((metric, base_period))
        if not base or base.get("basis") != point.get("basis") or point.get("basis") != "monthly":
            point["changeMissingReason"] = "上年同月同口径基期缺失"
            continue
        if base["value"] <= 0:
            point["changeMissingReason"] = "上年同月基期为0或异常，无法计算同比"
            continue
        value = (point["value"] / base["value"] - 1) * 100
        note = "基期为政策启用首月，非完整经营月" if base_period == "2011-04" else ""
        point.update(change=value, changeLabel="同比（计算）", changeMethod="calculated",
                     changeCalculation={"formula": "(current / prior - 1) * 100",
                        "currentPeriod": period, "currentValue": point["value"],
                        "currentSourceId": point["sourceId"], "priorPeriod": base_period,
                        "priorValue": base["value"], "priorSourceId": base["sourceId"],
                        "metricId": metric, "note": note})
        point.pop("changeMissingReason", None)
        rate = RATE_IDS.get(metric)
        if rate and (rate, period) not in selected:
            selected[rate, period] = {**point, "metricId": rate, "value": value,
                                     "quality": "derived", "calculation": point["changeCalculation"]}
            for key in ("change", "changeLabel", "changeMethod", "changeCalculation"):
                selected[rate, period].pop(key, None)
