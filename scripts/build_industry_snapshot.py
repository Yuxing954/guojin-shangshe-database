"""Build five compact industry datasets from original CSVs and reviewed MCP imports."""
import argparse
import calendar
import csv
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def number(value):
    if value is None or str(value).strip() in ('', '-', '--'):
        return None
    try:
        parsed = float(str(value).replace(',', ''))
        return parsed if math.isfinite(parsed) else None
    except ValueError:
        return None


def period_info(period, basis='monthly'):
    if '-Q' in period:
        year, quarter = map(int, period.split('-Q'))
        month = quarter * 3
        return f'{year}-01-01', f'{year}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}', f'{year}年1—{month}月累计'
    if len(period) == 7:
        year, month = map(int, period.split('-'))
        combined = month == 2 and basis == 'combined'
        cumulative = basis == 'cumulative'
        return f'{year}-{1 if combined or cumulative else month:02d}-01', f'{year}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}', f'{year}年1—{month}月累计' if cumulative else f'{year}年1—2月' if combined else f'{year}年{month}月'
    if len(period) == 4:
        return period + '-01-01', period + '-12-31', period + '年累计'
    date.fromisoformat(period)
    return period, period, period


def metric(id, label, unit, frequency, scope, **extra):
    return {'id': id, 'label': label, 'unit': unit, 'frequency': frequency, 'scope': scope, 'precision': 2, **extra}


def definitions():
    hotel = [
        metric('hotel_revpar', '每间可售客房收入', '元', '周度', '全国 / 全部档次', shortLabel='RevPAR', yoyLabel='去年同周', formula='同一周、同一样本：平均房价 × 入住率（小数）', field='revpar'),
        metric('hotel_adr', '平均房价', '元', '周度', '全国 / 全部档次', shortLabel='ADR', yoyLabel='去年同周', field='adr'),
        metric('hotel_occ', '入住率', '%', '周度', '全国 / 全部档次', precision=1, yoyLabel='去年同周', changeUnit='百分点', field='occupancy_rate'),
    ]
    dutyfree = [
        metric('dutyfree_sales', '离岛免税购物金额', '亿元', '月度', '海南离岛免税海关监管口径', changeMetric='dutyfree_sales_yoy'),
        metric('dutyfree_shoppers', '购物人次', '万人次', '月度', '海南离岛免税；按人次统计', changeMetric='dutyfree_shoppers_yoy'),
        metric('dutyfree_spend', '每购物人次金额', '元/人次', '月度', '相同期间的购物金额与购物人次', precision=0, formula='购物金额（亿元）÷ 购物人次（万人次）× 10,000；不等于去重人数客单价'),
        metric('dutyfree_items', '购物件数', '万件', '月度', '海南离岛免税海关监管口径'),
        metric('dutyfree_sales_yoy', '购物金额同比', '%', '月度', '源数据公布的当月同比', isRate=True),
        metric('dutyfree_shoppers_yoy', '购物人次同比', '%', '月度', '源数据公布的当月同比', isRate=True),
    ]
    gold = [
        metric('gold_price', 'Au99.99收盘价', '元/克', '日度', '上海黄金交易所 Au99.99；人民币现货收盘价'),
        metric('gold_retail_yoy', '珠宝零售额同比', '%', '月度', '限额以上单位金银珠宝类；名义增速', precision=1, isRate=True),
        metric('gold_jewelry_volume', '黄金首饰消费量', '吨', '季度累计', '中国黄金协会；年初至期末累计', precision=3, scopeNote='累计消费量；不连接为单季度趋势'),
        metric('gold_retail', '珠宝零售额', '亿元', '月度', '限额以上单位金银珠宝类；名义金额', changeMetric='gold_retail_yoy'),
    ]
    overseas = [
        metric('crossborder_exports', '跨境电商出口', '亿元', '按披露', '中国跨境电商全行业出口', missing='全行业出口口径待补齐'),
        metric('crossborder_fx', '美元兑人民币中间价', '人民币元/美元', '日度', '中国人民银行 / 中国外汇交易中心；中间价', precision=4, environment=True),
        metric('crossborder_scfi', '上海出口集装箱运价', '点', '周度', 'SCFI综合指数；上海航运交易所', environment=True),
        metric('crossborder_b2b_subset', 'B2B简化申报商品出口', '亿美元', '月度', '99章跨境电商B2B简化申报商品；仅为子集', scopeNote='不能代替跨境电商全行业出口', subset=True),
        metric('crossborder_b2b_cumulative_yoy', 'B2B子集累计出口同比', '%', '月度累计', '99章B2B简化申报；年初至期末累计增速', isRate=True, subset=True),
    ]
    dining = [
        metric('dining_revenue', '全国餐饮收入', '亿元', '月度', '全国餐饮收入；1—2月合并发布', precision=0, changeMetric='dining_revenue_yoy'),
        metric('dining_revenue_yoy', '餐饮收入同比', '%', '月度', '国家统计局公布的可比口径名义增速', precision=1, isRate=True),
        metric('dining_above_yoy', '限额以上餐饮同比', '%', '月度', '限额以上单位；与全行业范围不同', precision=1, isRate=True),
        metric('dining_above_revenue', '限额以上餐饮收入', '亿元', '月度', '限额以上单位；1—2月合并发布', precision=0, changeMetric='dining_above_yoy'),
    ]
    configs = [
        ('hotel', '酒店', '看入住率与房价，拆解每间客房的收入变化。', hotel, 'hotel_revpar', 'travel', '酒店', 'hotel-dashboard.html', ''),
        ('dutyfree', '免税', '看购物金额、人次与每人次消费，识别增长来源。', dutyfree, 'dutyfree_sales', 'dutyfree', '免税', 'dutyfree-dashboard.html', '人次口径跟随海关披露；机场与市内免税单独查看。'),
        ('gold', '黄金珠宝', '分开看金价、名义零售与首饰消费量。', gold, 'gold_retail_yoy', 'gold', '黄金珠宝', '', '消费量为年初累计；名义零售额增速不能直接当作销量增长。'),
        ('overseas', '跨境电商', '看行业出口，再看汇率和物流成本。', overseas, 'crossborder_fx', 'commerce', '跨境电商与出海', '', '全行业出口暂缺。汇率与运价用于观察经营环境，B2B简化申报数据仅为子集。'),
        ('dining', '餐饮', '看收入与可比增速，再核对连锁公司的经营表现。', dining, 'dining_revenue_yoy', 'dining', '餐饮,茶饮', '', '1—2月按合并期间记录。金额趋势默认只看单月，合并值单列查看。'),
    ]
    return [{'id': id, 'name': name, 'question': question, 'metrics': metrics, 'core': [m['id'] for m in metrics[:3]], 'defaultMetric': default, 'researchSector': research, 'companySector': company, 'detailHref': detail, 'note': note} for id, name, question, metrics, default, research, company, detail, note in configs]


def build(root=ROOT):
    manifest = json.loads((root / 'data-manifest.json').read_text(encoding='utf-8-sig'))
    files = {item['id']: item['file'] for item in manifest['datasets']}
    sectors = definitions()
    metrics = {m['id']: m for sector in sectors for m in sector['metrics']}
    sources, selected, revisions = {}, {}, []

    def source(id, file, name):
        sources[id] = {'id': id, 'name': name, 'provider': '仓库历史数据', 'file': file, 'url': '', 'publishedAt': None, 'retrievedAt': None, 'quality': 'legacy'}

    def add(record):
        value = number(record['value'])
        if value is None:
            return
        assert record['metricId'] in metrics, record['metricId']
        start, end, label = period_info(record['period'], record.get('basis', 'monthly'))
        item = {'startDate': start, 'endDate': end, 'periodLabel': label, **record, 'value': value}
        key = (item['metricId'], item['period'])
        old = selected.get(key)
        if old and old['sourceId'] != item['sourceId'] and not math.isclose(old['value'], value, rel_tol=1e-10, abs_tol=1e-8):
            revisions.append({'metricId': key[0], 'period': key[1], 'previousValue': old['value'], 'previousSourceId': old['sourceId'], 'selectedValue': value, 'selectedSourceId': item['sourceId'], 'reason': '原始披露优先；平台转引优先于未回查的历史整理值'})
        selected[key] = item

    def rows(id):
        with (root / files[id]).open(encoding='utf-8-sig', newline='') as handle:
            return list(csv.DictReader(handle))

    source('legacy-hotel', files['hotel_industry_weekly'], '酒店之家 / 仓库周度样本')
    hotel = [r for r in rows('hotel_industry_weekly') if r['region'] == '全国' and r['segment'] == '全部']
    latest_hotel_date = max(r['end_date'] for r in hotel) if hotel else '暂无数据'
    sectors[0]['note'] = f'全国周度样本截至{latest_hotel_date}；同周号同比，未作节假日错期调整。完整城市、集团与供给结构见酒店专题。'
    for item in sectors[0]['metrics']:
        item['scopeNote'] = '同比按去年相同周号比较，未作节假日错期调整。'
    hotel_index = {(int(r['year']), int(r['week'])): r for r in hotel}
    for row in hotel:
        for item in sectors[0]['metrics']:
            raw = number(row[item['field']])
            if raw is None:
                continue
            week = int(row['week'])
            prior = hotel_index.get((int(row['year']) - 1, week)) if week <= 52 else None
            old = number(prior.get(item['field'])) if prior else None
            change = (raw - old) * 100 if item['id'] == 'hotel_occ' and old is not None else (raw / old - 1) * 100 if old else None
            add({'metricId': item['id'], 'period': row['end_date'], 'periodLabel': row['period_id'] + ' · ' + row['end_date'], 'startDate': row.get('start_date', row['end_date']), 'value': raw * 100 if item['id'] == 'hotel_occ' else raw, 'change': change, 'changeLabel': '去年同周', 'sourceId': 'legacy-hotel', 'basis': 'point', 'quality': 'legacy'})

    source('legacy-dutyfree', files['dutyfree_monthly'], '海口海关 / 海南统计 / iFinD 历史整理')
    provenance_file = root / 'data/dutyfree/monthly-provenance.json'
    if provenance_file.exists():
        provenance = json.loads(provenance_file.read_text(encoding='utf-8-sig'))
        sources['legacy-dutyfree'].update(name=provenance['sourceFile'], provider='用户提供原Excel', url='https://yuxing954.github.io/guojin-shangshe-database/data/dutyfree/monthly-provenance.json', retrievedAt=provenance['checkedAt'], locator='月度数据工作表 O9:AE193；对应月份行号和指标列见来源文件。按原表逐值核对，未独立回查公告。')
    dutyfree_fields = {'dutyfree_sales': 'shopping_sales_cny_100m', 'dutyfree_shoppers': 'shoppers_10k', 'dutyfree_items': 'items_10k', 'dutyfree_sales_yoy': 'sales_yoy_pct', 'dutyfree_shoppers_yoy': 'shoppers_yoy_pct'}
    for row in rows('dutyfree_monthly'):
        for id, field in dutyfree_fields.items():
            add({'metricId': id, 'period': row['period_id'], 'value': row[field], 'sourceId': 'legacy-dutyfree', 'basis': 'monthly', 'quality': 'legacy'})

    source('legacy-gold', files['gold'], '仓库黄金珠宝历史整理')
    gold_fields = {'上海Au9999现货收盘价': 'gold_price', '社零金银珠宝类当月值': 'gold_retail', '黄金首饰消费量(累计)': 'gold_jewelry_volume'}
    for row in rows('gold'):
        id = gold_fields.get(row['指标名称'])
        if not id:
            continue
        day = row['数据日期'][:10]
        period = day[:7] if id == 'gold_retail' else f'{day[:4]}-Q{(int(day[5:7]) - 1) // 3 + 1}' if id == 'gold_jewelry_volume' else day
        basis = 'cumulative' if id == 'gold_jewelry_volume' else 'combined' if id == 'gold_retail' and day[5:7] == '02' else 'point' if id == 'gold_price' else 'monthly'
        add({'metricId': id, 'period': period, 'value': row['数值'], 'sourceId': 'legacy-gold', 'basis': basis, 'quality': 'legacy'})
        if id == 'gold_retail':
            add({'metricId': 'gold_retail_yoy', 'period': period, 'value': row.get('同比(%)'), 'sourceId': 'legacy-gold', 'basis': basis, 'quality': 'legacy'})

    source('legacy-crossborder', files['crossborder'], '仓库跨境经营环境历史整理')
    cross_fields = {'美元兑人民币:中间价': 'crossborder_fx', '上海出口集装箱运价指数SCFI:综合': 'crossborder_scfi'}
    for row in rows('crossborder'):
        if row['指标名称'] in cross_fields:
            add({'metricId': cross_fields[row['指标名称']], 'period': row['数据日期'][:10], 'value': row['数值'], 'sourceId': 'legacy-crossborder', 'basis': 'point', 'quality': 'legacy'})

    source('legacy-dining', files['dining'], '国家统计局 / Wind 历史整理')
    dining_fields = {'dining_revenue': '餐饮收入(亿元)', 'dining_revenue_yoy': '餐饮收入同比增速(%)', 'dining_above_revenue': '限额以上餐饮(亿元)', 'dining_above_yoy': '限额以上同比增速(%)'}
    for row in rows('dining'):
        for id, field in dining_fields.items():
            add({'metricId': id, 'period': row['月份'], 'value': row[field], 'sourceId': 'legacy-dining', 'basis': 'combined' if row['月份'].endswith('-02') else 'monthly', 'quality': 'legacy'})

    provider_files = sorted((root / 'data/industry').glob('miaoxiang-*.json'))
    verified_files = sorted((root / 'data/industry').glob('verified-*.json'))
    for path in provider_files + verified_files:
        payload = json.loads(path.read_text(encoding='utf-8-sig'))
        for item in payload['sources']:
            sources[item['id']] = item
        for record in payload['records']:
            record = dict(record)
            if record['metricId'] in ('gold_retail_yoy', 'gold_retail') and record['period'].endswith('-02'):
                record['basis'] = 'combined'
            add(record)

    # Derived values require the numerator and denominator to come from the same release.
    for (id, period), sales in list(selected.items()):
        if id != 'dutyfree_sales':
            continue
        shoppers = selected.get(('dutyfree_shoppers', period))
        sales_source = sources[sales['sourceId']]
        shopper_source = sources[shoppers['sourceId']] if shoppers else None
        same_release = shoppers and (sales['sourceId'] == shoppers['sourceId'] or (sales_source.get('query') == shopper_source.get('query') and sales_source.get('retrievedAt') == shopper_source.get('retrievedAt')))
        if same_release and shoppers['value'] > 0:
            add({'metricId': 'dutyfree_spend', 'period': period, 'value': sales['value'] / shoppers['value'] * 10000, 'sourceId': sales['sourceId'], 'inputs': [sales['sourceId'], shoppers['sourceId']], 'basis': 'monthly', 'quality': 'derived'})

    for sector in sectors:
        for item in sector['metrics']:
            item.pop('field', None)
            points = sorted((r for (id, _), r in selected.items() if id == item['id']), key=lambda r: r['endDate'])
            for point in points:
                change = selected.get((item.get('changeMetric', ''), point['period']))
                psource = sources[point['sourceId']]
                csource = sources[change['sourceId']] if change else None
                compatible = change and (point['sourceId'] == change['sourceId'] or (psource['quality'] == csource['quality'] == 'provider' and psource.get('query') == csource.get('query') and psource.get('retrievedAt') == csource.get('retrievedAt')))
                if compatible:
                    point['change'], point['changeLabel'] = change['value'], '同比'
                    point['changeSourceId'] = change['sourceId']
            item['points'] = points
        sector['sourceIds'] = sorted({p['sourceId'] for m in sector['metrics'] for p in m['points']})
    payload = {'version': 1, 'generatedAt': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'), 'checkedAt': max((json.loads(p.read_text(encoding='utf-8-sig')).get('checkedAt', '') for p in verified_files), default=''), 'sectors': sectors, 'sources': list(sources.values()), 'revisions': revisions}
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    payload = build(args.root)
    path = args.root / 'data/industry/overview.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('Industry snapshot:', len(payload['sectors']), 'sectors;', sum(len(m['points']) for s in payload['sectors'] for m in s['metrics']), 'observations;', len(payload['revisions']), 'retained source differences')


if __name__ == '__main__':
    main()
