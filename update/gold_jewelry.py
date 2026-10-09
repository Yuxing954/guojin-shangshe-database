#!/usr/bin/env python3
"""Gold-jewelry ingestion. Stdlib only; never promotes MX prose into verified facts.

Miaoxiang API fallback matches the read-only MCP bridge's mx_data/mx_search.
Raw provider responses are stored outside this public repository.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, HTTPRedirectHandler, build_opener

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data/gold-jewelry/observations.json'
PLAN = ROOT / 'data/gold-jewelry/mx-queries.json'
MX_BASE = 'https://mkapi2.dfcfs.com/finskillshub/api/claw'
KEY_FIELDS = ('brandId','market','city','currency','unit','product','priceBasis','purity','includesLabor','includesTax','quoteDate','quoteTime','sourceId')


def read_json(path: Path) -> Any:
    def bad_constant(value: str) -> None:
        raise ValueError(f'JSON contains non-finite constant: {value}')
    return json.loads(path.read_text(encoding='utf-8-sig'), parse_constant=bad_constant)


def is_date(value: Any) -> bool:
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def positive(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def logical_key(row: dict[str, Any]) -> str:
    fields = KEY_FIELDS if row.get('brandId') else ('instrument','priceType','market','currency','unit','quoteDate','quoteTime','sourceId')
    return json.dumps([row.get(k) for k in fields], ensure_ascii=False, sort_keys=True)


def validate(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if data.get('schemaVersion') != 1:
        errors.append('Unsupported schemaVersion')
    if not is_date(data.get('checkedAt')):
        errors.append('checkedAt must be an ISO calendar date')
    sources = {s['id']: s for s in data.get('sources', [])}
    brands = {b['id'] for b in data.get('brands', [])}
    if len(sources) != len(data.get('sources', [])):
        errors.append('Duplicate source id')
    ids, keys = set(), set()
    if len(brands) != len(data.get('brands', [])):
        errors.append('Duplicate brand id')
    tagged = [('quote', r) for r in data.get('quotes', [])] + [('benchmark', r) for r in data.get('benchmarks', [])]
    for row_type, row in tagged:
        rid = row.get('id')
        if not rid or rid in ids:
            errors.append(f'Duplicate/missing row id: {rid}')
        ids.add(rid)
        qdate = row.get('quoteDate')
        if not is_date(qdate) or (is_date(data.get('checkedAt')) and qdate > data['checkedAt']):
            errors.append(f'Invalid/future observation date: {rid}')
        if not positive(row.get('price')):
            errors.append(f'Price must be a finite positive number: {rid}')
        source = sources.get(row.get('sourceId'))
        if not source:
            errors.append(f'Unknown source: {rid}')
        elif row.get('verification') in ('verified_primary','primary') and source.get('kind') != 'primary':
            errors.append(f'Aggregator cannot be promoted to primary: {rid}')
        if any(not row.get(k) for k in ('market','currency','unit')):
            errors.append(f'Missing market/currency/unit: {rid}')
        purity = row.get('purity')
        if purity is not None and (not positive(purity) or purity > 1):
            errors.append(f'Invalid purity: {rid}')
        if row_type == 'quote':
            for field in ('quoteTime','city','purity','includesLabor','includesTax'):
                if field not in row: errors.append(f'Explicit nullable field missing: {field}: {rid}')
            if row.get('brandId') not in brands:
                errors.append(f'Unknown brand: {rid}')
            if not row.get('priceBasis') or not row.get('product'):
                errors.append(f'Missing product or pricing basis: {rid}')
            if row.get('verification') not in ('pending_primary','verified_primary'):
                errors.append(f'Invalid quote verification: {rid}')
            for field in ('includesLabor','includesTax'):
                if row.get(field) is not None and type(row[field]) is not bool:
                    errors.append(f'{field} must be boolean or null: {rid}')
        elif not row.get('instrument') or not row.get('priceType') or row.get('verification') != 'primary':
            errors.append(f'Missing benchmark instrument/type or primary verification: {rid}')
        key = logical_key(row)
        if key in keys:
            errors.append(f'Duplicate logical observation; resolve revision first: {rid}')
        keys.add(key)
    return errors


def atomic_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    fd, name = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(text)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def merge_batch(old: dict[str, Any], batch: dict[str, Any]) -> dict[str, Any]:
    """Idempotent append. Conflicts fail closed; never overwrite historical values."""
    result = json.loads(json.dumps(old))
    for table in ('sources','brands','quotes','benchmarks'):
        index = {r['id']: r for r in result.get(table, [])}
        for row in batch.get(table, []):
            if row['id'] in index and index[row['id']] != row:
                raise ValueError(f'Conflicting {table} id {row["id"]}; record a reviewed revision, do not overwrite')
            index[row['id']] = row
        result[table] = list(index.values())
    if batch.get('checkedAt'):
        if not is_date(batch['checkedAt']):
            raise ValueError('Invalid batch checkedAt')
        result['checkedAt'] = max(old['checkedAt'], batch['checkedAt'])
    errors = validate(result)
    if errors:
        raise ValueError('; '.join(errors))
    return result


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect refused; credentials must not cross hosts')


def request_bytes(url: str, payload: dict[str, Any] | None = None, api_key: str | None = None) -> bytes:
    headers = {'User-Agent':'GuojinJewelryResearch/1.0','Accept':'application/json,text/html'}
    if api_key:
        headers['apikey'] = api_key
    body = None
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    request = Request(url, data=body, headers=headers)
    with build_opener(NoRedirect()).open(request, timeout=30) as response:
        raw = response.read(8_000_001)
    if len(raw) > 8_000_000:
        raise ValueError('Response too large; split the query into smaller periods')
    return raw


def archive(raw: bytes, meta: dict[str, Any], directory: Path) -> Path:
    directory = directory.expanduser().resolve()
    if directory == ROOT or ROOT in directory.parents:
        raise ValueError('Raw provider responses must be stored outside the public repository')
    directory.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(raw).hexdigest()
    raw_path = directory / (digest + '.raw')
    if not raw_path.exists():
        fd = os.open(raw_path, os.O_CREAT | os.O_WRONLY | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(raw)
    atomic_json(directory / (digest + '.meta.json'), {**meta, 'sha256':digest,'capturedAt':datetime.now(timezone.utc).isoformat()})
    return raw_path


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(); self.rows=[]; self.row=[]; self.cell=[]; self.in_cell=False
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row=[]
        if tag in ('td','th'): self.in_cell=True; self.cell=[]
    def handle_data(self, data):
        if self.in_cell: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.in_cell:
            self.row.append(''.join(self.cell).strip()); self.in_cell=False
        if tag == 'tr' and self.row: self.rows.append(self.row)


def parse_sge(html: str, trade_date: str) -> float:
    parser=TableParser(); parser.feed(html)
    headers=next((r for r in parser.rows if all(x in r for x in ('日期','合约','收盘价'))),None)
    if not headers:
        raise ValueError('SGE table headings changed or table not returned')
    di,ci,pi=(headers.index(x) for x in ('日期','合约','收盘价'))
    matches=[r for r in parser.rows if len(r)>max(di,ci,pi) and r[di]==trade_date and r[ci]=='Au99.99']
    if len(matches)!=1:
        raise ValueError('No unique Au99.99 record for the requested trading date; no forward fill')
    price=float(matches[0][pi].replace(',',''))
    if not positive(price):
        raise ValueError('Missing or non-positive close')
    return price


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--db',type=Path,default=DB)
    sub=ap.add_subparsers(dest='command',required=True)
    sub.add_parser('validate'); sub.add_parser('status')
    imp=sub.add_parser('import-batch'); imp.add_argument('--input',type=Path,required=True)
    mx=sub.add_parser('mx-fetch'); mx.add_argument('--query-id',required=True); mx.add_argument('--as-of',required=True); mx.add_argument('--start',required=True); mx.add_argument('--company',default=''); mx.add_argument('--raw-dir',type=Path,default=Path.home()/'.cache/guojin-gold/raw')
    sge=sub.add_parser('fetch-sge'); sge.add_argument('--date',required=True); sge.add_argument('--as-of',required=True); sge.add_argument('--out',type=Path,required=True); sge.add_argument('--raw-dir',type=Path,default=Path.home()/'.cache/guojin-gold/raw')
    args=ap.parse_args()
    try:
        if args.command=='status':
            print(json.dumps({'mx_api_key_available':bool(os.getenv('MX_APIKEY')),'live_connection_verified':False,'scheduled_job_enabled_by_this_module':False})); return 0
        if args.command=='validate':
            errors=validate(read_json(args.db)); print(json.dumps({'ok':not errors,'errors':errors},ensure_ascii=False)); return 1 if errors else 0
        if args.command=='import-batch':
            result=merge_batch(read_json(args.db),read_json(args.input)); atomic_json(args.db,result); print('Validated batch appended; no historical values overwritten.'); return 0
        if not is_date(args.as_of): raise ValueError('Invalid --as-of')
        if args.command=='mx-fetch':
            key=os.getenv('MX_APIKEY')
            if not key: raise ValueError('MX_APIKEY is not configured in this execution environment; no live query was made')
            if not is_date(args.start) or args.start>args.as_of: raise ValueError('Invalid query period')
            spec=next((x for x in read_json(PLAN)['queries'] if x['id']==args.query_id),None)
            legacy_tool=spec.get('legacyTool',spec['tool']) if spec else None
            if legacy_tool not in ('mx_data','mx_search'): raise ValueError('Unknown or non-read-only query')
            if '{company}' in spec['query'] and not args.company.strip(): raise ValueError('--company is required')
            query=spec['query'].format(as_of=args.as_of,start=args.start,company=args.company)
            endpoint,field=('/query','toolQuery') if legacy_tool=='mx_data' else ('/news-search','query')
            raw=request_bytes(MX_BASE+endpoint,{field:query},key)
            body=json.loads(raw)
            if not isinstance(body,dict): raise ValueError('Provider response must be an object; no canonical data imported')
            codes=[body[k] for k in ('status','code') if k in body]
            if not codes or not all(type(c) in (str,int) and str(c)=='0' for c in codes): raise ValueError('Provider did not report business success; no canonical data imported')
            path=archive(raw,{'provider':'Miaoxiang API fallback','queryId':args.query_id,'query':query,'endpoint':MX_BASE+endpoint,'status':'unmapped_raw_response'},args.raw_dir)
            print(json.dumps({'raw_file':str(path),'canonical_imported':False,'next':'Inspect dataTableDTOList, indicator code, units and original sources before producing a reviewed batch.'},ensure_ascii=False)); return 0
        if not is_date(args.date) or args.date>args.as_of: raise ValueError('Invalid requested trading date')
        url=f'https://www.sge.com.cn/sjzx/quotation_daily_new?end_date={args.date}&start_date={args.date}'
        raw=request_bytes(url); price=parse_sge(raw.decode('utf-8-sig'),args.date)
        archived=archive(raw,{'url':url,'tradeDate':args.date,'captureMethod':'original_http_response'},args.raw_dir)
        sid='sge-http-'+args.date
        batch={'checkedAt':args.as_of,'sources':[{'id':sid,'name':'上海黄金交易所·每日行情','provider':'上海黄金交易所','kind':'primary','url':url,'capturedDate':date.today().isoformat(),'captureMethod':'original_http_table','sha256':archived.stem,'rawArchive':None,'note':'Original HTML archived privately; parsed Au99.99 close. Review conflicts before import.'}], 'benchmarks':[{'id':sid+'-close','instrument':'Au99.99','quoteDate':args.date,'quoteTime':None,'market':'CN','currency':'CNY','unit':'CNY/g','purity':0.9999,'priceType':'close','price':price,'sourceId':sid,'verification':'primary'}]}
        atomic_json(args.out,batch); print('SGE batch written for review; main data unchanged.'); return 0
    except (ValueError, KeyError, OSError, HTTPError, URLError) as exc:
        # Never print HTTP bodies, request headers or environment credentials.
        message=str(exc) if isinstance(exc,ValueError) else type(exc).__name__
        print('ERROR: '+message,file=sys.stderr); return 2

if __name__=='__main__':
    raise SystemExit(main())
