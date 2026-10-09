"""Official release importer. No interpolation, rebasing, or growth from rounded amounts.

Online: --refresh downloads ONLY reviewed sources in sources.json.
Offline: rebuild from evidence.json; fail before replacing observations on parse errors.
Standard library only. Add a reviewed source to sources.json for each new release.
"""
import argparse
import calendar
import concurrent.futures
import hashlib
import json
import re
import urllib.request
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'data/consumption-macro'


def clean(text):
    return re.sub(r'\s+', '', text).replace('％', '%')


class ReleaseParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cell = self.row = self.paragraph = None
        self.rows, self.paragraphs = [], []

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = []
        if tag == 'p':
            self.paragraph = []

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)
        if self.paragraph is not None:
            self.paragraph.append(text)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None:
                self.row.append(clean(''.join(self.cell)))
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        if tag == 'p' and self.paragraph is not None:
            text = clean(''.join(self.paragraph))
            if text:
                self.paragraphs.append(text)
            self.paragraph = None


def number(text):
    text = text.replace(',', '').replace('，', '')
    if text in ('', '-', '—', '…'):
        return None
    if not re.fullmatch(r'-?\d+(?:\.\d+)?', text):
        raise ValueError('unexpected number: ' + text)
    return float(text)


def evidence_hash(rows, paragraphs):
    payload = json.dumps({'rows': rows, 'paragraphs': paragraphs}, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


RETAIL = {
    '社会消费品零售总额': ('retail', '社会消费品零售总额', '消费总量'),
    '除汽车以外的消费品零售额': ('retail_ex_auto', '社零 · 除汽车', '消费总量'),
    '限额以上单位消费品零售额': ('above_total', '限额以上单位消费品零售额', '限额以上'),
    '城镇': ('retail_urban', '城镇消费品零售额', '消费总量'),
    '乡村': ('retail_rural', '乡村消费品零售额', '消费总量'),
    '餐饮收入': ('catering', '餐饮收入', '商品与餐饮'),
    '限额以上单位餐饮收入': ('above_catering', '限额以上单位餐饮收入', '限额以上'),
    '商品零售额': ('goods', '商品零售额', '商品与餐饮'),
    '限额以上单位商品零售额': ('above_goods', '限额以上单位商品零售额', '限额以上'),
    '网上商品零售额': ('online_goods', '网上商品零售额', '线上零售'),
    '实物商品网上零售额': ('online_goods', '网上商品零售额', '线上零售'),
}
CATEGORIES = ['粮油、食品类', '饮料类', '烟酒类', '服装、鞋帽、针纺织品类', '化妆品类', '金银珠宝类', '日用品类', '体育、娱乐用品类', '家用电器和音像器材类', '中西药品类', '文化办公用品类', '家具类', '通讯器材类', '石油及制品类', '汽车类', '建筑及装潢材料类']
for i, name in enumerate(CATEGORIES):
    RETAIL[name] = (f'category_{i}', name, '社零分品类')


def compile_data(sources, evidence, checked_at):
    catalog, observations = {}, []

    def indicator(key, name, group, unit='亿元', definition='', value_label='金额'):
        candidate = dict(id=key, name=name, group=group, unit=unit,
                         definition=definition, valueLabel=value_label, status='connected')
        if key in catalog and catalog[key] != candidate:
            raise ValueError('inconsistent indicator: ' + key)
        catalog[key] = candidate
        return key

    def add(key, source, period, frequency, basis, value, yoy=None, **extra):
        if value is None and yoy is None:
            return
        if frequency == 'monthly':
            y, m = map(int, period.split('-'))
            end = f'{y}-{m:02}-{calendar.monthrange(y,m)[1]}'
        elif frequency == 'quarterly':
            y, q = period.split('-Q')
            m = int(q)*3
            end = f'{y}-{m:02}-{calendar.monthrange(int(y),m)[1]}'
        elif frequency == 'annual':
            end = period + '-12-31'
        else:
            end = extra.pop('endDate')
        observations.append(dict(indicatorId=key, sourceId=source['id'], period=period,
                                 endDate=end, frequency=frequency, basis=basis, value=value, yoy=yoy, **extra))

    for s in sources:
        if s['kind'] == 'reviewed':
            for r in s['records']:
                key = indicator(r['id'], r['name'], r['group'], r['unit'], r['definition'], r.get('valueLabel', '数值'))
                add(key, s, r['period'], r['frequency'], r['basis'], r['value'], r.get('yoy'),
                    note=r.get('note', ''), quality=r.get('quality', 'official'), **({'endDate':r['endDate']} if r['frequency']=='holiday' else {}))
            continue
        e = evidence[s['id']]
        if e['url'] != s['url'] or len(e['sha256']) != 64:
            raise ValueError('invalid evidence: ' + s['id'])
        if e['sha256'] != evidence_hash(e['rows'], e['paragraphs']):
            raise ValueError('evidence checksum mismatch: ' + s['id'])
        rows, paragraphs = e['rows'], e['paragraphs']
        period, year = s['period'], s['period'][:4]
        if s['kind'] == 'retail':
            parsed = 0
            seen_names = {}
            for row in rows:
                if len(row) not in (3, 5):
                    continue
                name = re.sub(r'^(?:其中[：:]?)', '', row[0])
                if name not in RETAIL:
                    continue
                if name in seen_names:
                    if seen_names[name] != row[1:]:
                        raise ValueError('conflicting retail duplicate: ' + s['id'])
                    continue
                seen_names[name] = row[1:]
                key, label, group = RETAIL[name]
                definition = '全国；名义金额及官方可比口径同比；未季调'
                if group in ('限额以上', '社零分品类'):
                    definition += '；限额以上单位，企业范围逐年调整'
                if key == 'online_goods':
                    definition = '全国；网上商品（原实物商品网上零售额）；年初累计；官方可比口径同比'
                indicator(key, label, group, definition=definition)
                if len(row) == 5:
                    amount, yoy, cumulative, cyoy = map(number, row[1:])
                else:
                    if not period.endswith('-02'):
                        raise ValueError('unexpected retail columns: ' + s['id'])
                    amount, yoy = map(number, row[1:])
                    cumulative, cyoy = amount, yoy
                    if key == 'online_goods':
                        amount = yoy = None
                basis = 'jan_feb' if period.endswith('-02') else 'month'
                if year >= '2025':
                    add(key, s, period, 'monthly', basis, amount, yoy)
                    add(key, s, period, 'monthly', 'ytd', cumulative, cyoy)
                if period.endswith('-12'):
                    add(key, s, year, 'annual', 'year', cumulative, cyoy)
                parsed += 1
            if parsed < 20:
                raise ValueError('retail table incomplete: ' + s['id'])
            text = ''.join(paragraphs)
            for pattern, key, label, legacy in [
                (r'全国网上商品和服务零售额([\d.]+)亿元，同比增长([\d.]+)%', 'online_total', '网上商品和服务零售额', False),
                (r'全国网上零售额([\d.]+)亿元，同比增长([\d.]+)%', 'online_total_legacy', '网上零售额 · 旧口径', True),
                (r'网上服务零售额([\d.]+)亿元，增长([\d.]+)%', 'online_services', '网上服务零售额', False),
            ]:
                m = re.search(pattern, text)
                if m:
                    definition = '全国；年初累计；' + ('2025及以前旧平台范围，不与新口径拼接' if legacy else '2026扩展服务平台范围；与旧网上零售额不可比')
                    indicator(key, label, '线上零售', definition=definition)
                    if year >= '2025':
                        add(key, s, period, 'monthly', 'ytd', float(m[1]), float(m[2]))
                    if period.endswith('-12'):
                        add(key, s, year, 'annual', 'year', float(m[1]), float(m[2]))
        elif s['kind'] == 'cpi':
            mapping = {'居民消费价格': ('cpi', 'CPI'), '其中：不包括食品和能源': ('core_cpi', '核心CPI'), '不包括食品和能源': ('core_cpi', '核心CPI')}
            seen = {}
            for row in rows:
                if len(row) not in (3, 4) or row[0] not in mapping:
                    continue
                key, label = mapping[row[0]]
                if key in seen:
                    if seen[key] != row[1:]:
                        raise ValueError('conflicting CPI duplicate: ' + s['id'])
                    continue
                indicator(key, label, '消费价格', '%', '全国居民消费价格；官方同比涨跌幅；未季调；2026年基期轮换；核心CPI扣除食品和能源', '同比涨跌幅')
                mom, yoy = map(number, row[1:3])
                ytd = number(row[3]) if len(row) == 4 else None
                add(key, s, period, 'monthly', 'month', yoy, mom=mom)
                add(key, s, period, 'monthly', 'ytd', ytd)
                if period.endswith('-12'):
                    add(key, s, year, 'annual', 'year', ytd)
                seen[key] = row[1:]
            if set(seen) != {'cpi', 'core_cpi'}:
                raise ValueError('CPI/core table incomplete: ' + s['id'])
        elif s['kind'] == 'household':
            section, found = None, set()
            for row in rows:
                if row and row[0].startswith('注'):
                    break  # First national table only; do not confuse urban/rural detail tables.
                if len(row) != 3:
                    continue
                name = row[0]
                if '全国居民人均可支配收入中位数' in name:
                    section = 'median'
                elif '全国居民人均可支配收入' in name:
                    section = 'income'
                elif '全国居民人均消费支出' in name:
                    section = 'spending'
                elif name not in ('城镇居民', '农村居民'):
                    continue
                if not section:
                    continue
                region = 'urban' if name == '城镇居民' else 'rural' if name == '农村居民' else 'national'
                key = section + '_' + region
                if key in found:
                    continue
                label = {'income':'人均可支配收入', 'median':'人均可支配收入中位数', 'spending':'人均消费支出'}[section]
                label = {'national':'全国', 'urban':'城镇', 'rural':'农村'}[region] + '居民' + label
                indicator(key, label, '居民收支', '元', '住户抽样调查；人均名义金额及同比；季度发布为年初累计，年度含自产自用', '人均金额')
                m = re.fullmatch(r'(-?[\d.]+)(?:（(-?[\d.]+)）)?', row[2])
                if not m:
                    raise ValueError('household growth invalid: ' + s['id'])
                frequency = 'annual' if len(period) == 4 else 'quarterly'
                add(key, s, period, frequency, 'year' if frequency == 'annual' else 'ytd', number(row[1]), float(m[1]), realYoy=float(m[2]) if m[2] else None)
                found.add(key)
            if not {'income_national','spending_national'} <= found:
                raise ValueError('household table incomplete: ' + s['id'])
        else:
            raise ValueError('unknown source kind: ' + s['kind'])

    for key, name, group, unit, definition, url, reason in [
        ('confidence', '消费者信心指数', '消费者信心', '点', '国家统计局月度消费者信心指数；原始指数，不计算增长率', 'https://data.stats.gov.cn/', '官方动态查询接口与历史序列尚待核验'),
        ('mofcom_holiday', '商务部重点监测零售餐饮销售', '服务消费', '%', '商务部重点监测样本；非全国社零，不同假期样本不可直接拼接', 'https://www.mofcom.gov.cn/', '待逐期核验官方样本范围与发布日期'),
        ('holiday_2026_national_trips', '2026国庆国内出游人次', '假期旅游', '亿人次', '全国；国庆7天；文旅部假期测算', 'https://www.mct.gov.cn/', '本次未取得可核验的2026国庆官方旅游披露'),
        ('holiday_2026_national_spend', '2026国庆国内出游花费', '假期旅游', '亿元', '全国；国庆7天；文旅部假期测算', 'https://www.mct.gov.cn/', '本次未取得可核验的2026国庆官方旅游披露'),
    ]:
        catalog[key] = dict(id=key, name=name, group=group, unit=unit, definition=definition, valueLabel='数值', status='pending', sourceUrl=url, pendingReason=reason, frequencies=['monthly' if key=='confidence' else 'holiday'])
    keys = set()
    for r in observations:
        key = (r['indicatorId'], r['frequency'], r['basis'], r['period'])
        if key in keys:
            raise ValueError('duplicate observation: ' + str(key))
        keys.add(key)
    observations.sort(key=lambda r:(r['indicatorId'],r['frequency'],r['basis'],r['period']))
    metadata = [{k:v for k,v in s.items() if k != 'records'} for s in sources]
    return dict(schemaVersion=1, checkedAt=checked_at, indicators=list(catalog.values()), sources=metadata, observations=observations)


def download(source):
    host = urlparse(source['url']).hostname
    if host != 'www.stats.gov.cn':
        raise ValueError('automated parser supports reviewed NBS pages only')
    req = urllib.request.Request(source['url'], headers={'User-Agent':'Mozilla/5.0'})
    raw = urllib.request.urlopen(req, timeout=30).read()
    parser = ReleaseParser()
    parser.feed(raw.decode('utf-8'))
    retrieved_url = source['url']
    if not parser.rows and '/sj/zxfb/' in source['url']:
        # NBS publishes the same release ID in its information-disclosure archive.
        retrieved_url = source['url'].replace('/sj/zxfb/', '/xxgk/sjfb/zxfb2020/')
        raw = urllib.request.urlopen(urllib.request.Request(retrieved_url, headers={'User-Agent':'Mozilla/5.0'}), timeout=30).read()
        parser = ReleaseParser()
        parser.feed(raw.decode('utf-8'))
    # Retain source table cells and relevant statistical paragraphs, not site navigation.
    paragraphs = [p for p in parser.paragraphs if any(k in p for k in ('网上', '统计范围', '名义', '扣除价格', '可比', '调查', '指标调整'))]
    return source['id'], dict(url=source['url'], retrievedUrl=retrieved_url, retrievalMethod='official_html',
                            rawHtmlSha256=hashlib.sha256(raw).hexdigest(), sha256=evidence_hash(parser.rows,paragraphs),
                            hashScope='normalized official source cells and paragraphs', rows=parser.rows, paragraphs=paragraphs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--checked-at', default=date.today().isoformat())
    args = parser.parse_args()
    sources = json.loads((FOLDER / 'sources.json').read_text(encoding='utf-8'))
    if args.refresh:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            evidence = dict(pool.map(download, [s for s in sources if s['kind'] != 'reviewed']))
    else:
        evidence = json.loads((FOLDER / 'evidence.json').read_text(encoding='utf-8'))
    data = compile_data(sources, evidence, args.checked_at)
    for filename, payload in [('evidence.json', evidence), ('observations.json', data)]:
        path = FOLDER / filename
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        temp.replace(path)
    print(json.dumps(dict(sources=len(sources), indicators=len(data['indicators']), observations=len(data['observations']))))


if __name__ == '__main__':
    main()
