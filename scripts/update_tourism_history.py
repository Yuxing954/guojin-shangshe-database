"""Apply reviewed public-source history without changing the user's workbooks.

The checked-in supplement is a dated source snapshot, not a live forecast.
Run after import_tourism_workbooks.py, or run this file to refresh dashboard.json.
"""
import json
from pathlib import Path


def apply_history(data, folder):
    supplement = json.loads((folder / 'history-supplement.json').read_text(encoding='utf-8'))
    source_ids = {s['id'] for s in data['sources']}
    data['sources'] += [s for s in supplement['sources'] if s['id'] not in source_ids]
    for update in supplement['destinations']:
        dest = next(d for d in data['outbound']['destinations'] if d['name'] == update['name'])
        rows = {r['period']: r for r in dest['records']}
        for r in update['records']:
            old = rows.get(r['period'])
            new = dict(r)
            if old and old.get('sourceId') == 'outbound-book':
                new['originalWorkbook'] = {k: old.get(k) for k in ['value', 'sourceYoY', 'sourceId', 'locator']}
            elif old and old.get('originalWorkbook'):
                new['originalWorkbook'] = old['originalWorkbook']
            rows[r['period']] = new
        dest.update({k: v for k, v in update.items() if k not in ['name', 'records']})
        dest['records'] = sorted(rows.values(), key=lambda r: r['period'])
    for baseline in supplement['annualBaselines']:
        dest = next(d for d in data['outbound']['destinations'] if d['name'] == baseline['name'])
        dest['annualBaselines'] = [{k: v for k, v in baseline.items() if k != 'name'}]
    for dest in data['outbound']['destinations']:
        rows = {r['period']: r for r in dest['records']}
        for r in dest['records']:
            prior = rows.get(str(int(r['period'][:4]) - 1) + r['period'][4:])
            if prior and prior['value'] > 0:
                r['change'] = (r['value'] / prior['value'] - 1) * 100
                r['changeBasis'] = '同月客流计算'
                r['comparisonPeriod'] = prior['period']
                r['comparisonSourceId'] = prior['sourceId']
            else:
                r['change'] = r.get('sourceYoY')
                r['changeBasis'] = '原表同比' if r['change'] is not None else '上年同月基期未收录'
        dest['coverage'] = {'start': dest['records'][0]['period'], 'end': dest['records'][-1]['period'], 'count': len(dest['records'])}
    official = json.loads((folder / 'inbound-official.json').read_text(encoding='utf-8'))
    data['outbound']['nationalAnnual'] = official['outboundAnnual']
    for issue in data['issues']:
        if '马来西亚' in issue.get('locator', ''):
            issue.setdefault('originalMessage', issue['message'])
            issue['status'] = '已核对修正'
            issue['resolution'] = '2022—2025年采用马来西亚官方年鉴China / TOURIST月表；2024、2025年逐月匹配原表，原始错位日期保留。'
            issue['message'] = '已核对修正：' + issue['resolution']
    data['notes'] = [n for n in data['notes'] if not n.startswith('马来西亚日期错位')]
    notes = [
        '近三年显示2023—2025三个完整年度，并保留2026年最新已披露期间。年度汇总仅纳入1—12月齐全的目的地记录；年度、当月、年初累计分别比较，不把2026年累计当成全年。年度同比以完整上年或官方年度基期计算。',
        '马来西亚：2022—2025年月度值来自Tourism Malaysia KPI 2025印刷页20（PDF第23页）China / TOURIST，单位人次换算万人次，排除EXCURSIONIST。原表2024、2025月值全部匹配，错误日期已修正；quarantined仍保存36条原数。',
        '新加坡：官方国际访客抵达月表DataSeries=China，按居住地统计，2022年1月—2026年8月采用2026-10-10更新的官方序列；原工作簿被替换值保留在originalWorkbook。其他目的地仍为原Excel转录，不能将不同定义直接加总。',
        '泰国2022年中国籍游客官方年度基期27.3567万人次用于2023年度同比；未核验2022年逐月基期，因此2023年月度同比留空。越南2023年1月缺同月基期及原表同比，保留空值。文旅部2023年出入境旅游同比未取得可比披露，保留空值。',
        '入境查验覆盖2023—2026年第一季度、上半年、第三季度及2023—2025完整年度；同比优先官方披露。2024Q1总查验为“超1.41亿”，图中以1.41亿作披露下限展示；2023H1外国人不含边民，不跨口径反推增速。2026Q1免签同比29.3%沿用官方披露，与2025Q1问答中657万人次不直接勾稽，保留披露差异。',
        '文旅部出境旅游2024年同比41.0%、2025年20.8%沿用公报的可比口径；不使用本库已四舍五入的历史总量覆盖官方增速。所有“—”表示未披露或缺少已核验基期，不按零处理。'
    ]
    for n in notes:
        if n not in data['notes']:
            data['notes'].append(n)
    from update_domestic_tourism import apply_domestic
    return apply_domestic(data, folder)


if __name__ == '__main__':
    folder = Path(__file__).resolve().parents[1] / 'data' / 'tourism'
    target = folder / 'dashboard.json'
    data = json.loads(target.read_text(encoding='utf-8'))
    official = json.loads((folder / 'inbound-official.json').read_text(encoding='utf-8'))
    data['inbound'] = {k: official[k] for k in ['border', 'tourists']}
    known = {s['id'] for s in data['sources']}
    data['sources'] += [s for s in official['sources'] if s['id'] not in known]
    target.write_text(json.dumps(apply_history(data, folder), ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print('Updated tourism history and source-linked comparisons')
