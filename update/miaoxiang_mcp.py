"""Read-only Streamable HTTP MCP client; credentials and raw replies stay local."""
import argparse
import json
import os
from pathlib import Path
import tomllib
from urllib.request import Request, build_opener
from gold_jewelry import NoRedirect, archive, atomic_json

URL = 'https://mxapi.eastmoney.com/mxds/mcp'
READ_ONLY_TOOLS = ('mx_ashare_finance_data','mx_hk_finance_data','mx_macro_data','mx_comprehensive_finance_data','mx_finance_search_notice','mx_finance_search_news')

def response_summary(result):
    """Protocol success alone does not prove business success or indicator relevance."""
    failed=bool(result.get('isError')); tables=[]
    for item in result.get('content',[]):
        if item.get('type')!='text': continue
        try: body=json.loads(item['text'])
        except (ValueError,KeyError): continue
        if not isinstance(body,dict): continue
        for k in ('code','status'):
            if k in body and str(body[k]) not in ('0','200','success'): failed=True
        if isinstance(body.get('data'),list): tables.extend(body['data'])
    has_data=any(isinstance(t,dict) and t.get('columns') and t.get('items') for t in tables)
    return {'businessError':failed,'structuredDataReturned':has_data,'indicatorRelevanceVerified':False}

def decode_reply(raw, request_id):
    text = raw.decode('utf-8-sig')
    if text.lstrip().startswith('{'):
        messages = [json.loads(text)]
    else:
        messages = []
        for event in text.replace('\r\n', '\n').split('\n\n'):
            payload = '\n'.join(line[5:].lstrip() for line in event.splitlines() if line.startswith('data:'))
            if payload: messages.append(json.loads(payload))
    matches = [m for m in messages if m.get('id') == request_id]
    if len(matches) != 1: raise ValueError('Missing or ambiguous MCP response')
    if 'error' in matches[0]: raise ValueError('MCP protocol error')
    return matches[0]['result']

class Client:
    def __init__(self, key):
        if not key.strip(): raise ValueError('Missing EM_API_KEY')
        self.key, self.session, self.version, self.counter = key.strip(), None, None, 0

    def rpc(self, method, params=None, notification=False):
        self.counter += 1
        payload = {'jsonrpc':'2.0', 'method':method}
        if params is not None: payload['params'] = params
        if not notification: payload['id'] = self.counter
        headers = {'em_api_key':self.key,'Content-Type':'application/json','Accept':'application/json, text/event-stream'}
        if self.session: headers['Mcp-Session-Id'] = self.session
        if self.version: headers['MCP-Protocol-Version'] = self.version
        req = Request(URL, data=json.dumps(payload).encode(), headers=headers)
        with build_opener(NoRedirect()).open(req, timeout=120) as response:
            self.session = response.headers.get('Mcp-Session-Id', self.session)
            raw = response.read(8_000_001)
        if len(raw)>8_000_000: raise ValueError('MCP response too large')
        return None if notification else decode_reply(raw,self.counter)

    def initialize(self):
        result = self.rpc('initialize',{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'guojin-readonly-verifier','version':'1.0'}})
        self.version = result['protocolVersion']
        self.rpc('notifications/initialized', notification=True)
        return result

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--codex-config',type=Path)
    ap.add_argument('--raw-dir',type=Path,required=True)
    ap.add_argument('--tool')
    ap.add_argument('--arguments-file',type=Path)
    ap.add_argument('--query-id')
    ap.add_argument('--as-of')
    ap.add_argument('--start')
    ap.add_argument('--company',default='')
    args=ap.parse_args()
    try:
        key=os.getenv('EM_API_KEY','')
        if not key and args.codex_config:
            cfg=tomllib.loads(args.codex_config.read_text(encoding='utf-8'))
            server=cfg['mcp_servers']['mx-ds-mcp']
            if server['url']!=URL: raise ValueError('Configured server URL differs from official endpoint')
            key=server['http_headers']['em_api_key']
        client=Client(key)
        if args.query_id:
            from gold_jewelry import PLAN,read_json,is_date
            if args.tool or args.arguments_file: raise ValueError('Use query-id or explicit tool, not both')
            if not is_date(args.as_of) or not is_date(args.start) or args.start>args.as_of: raise ValueError('Invalid query dates')
            spec=next(x for x in read_json(PLAN)['queries'] if x['id']==args.query_id)
            if '{company}' in spec['query'] and not args.company.strip(): raise ValueError('Company required')
            args.tool=spec['tool']
            arguments={'query':spec['query'].format(as_of=args.as_of,start=args.start,company=args.company)}
        init=client.initialize()
        listing=client.rpc('tools/list'); tools=listing.get('tools',[])
        if listing.get('nextCursor'): raise ValueError('Paginated tool list needs review')
        archive(json.dumps(listing,ensure_ascii=False).encode(),{'provider':'Miaoxiang MCP','method':'tools/list'},args.raw_dir)
        print(json.dumps({'initialized':True,'protocol':init['protocolVersion'],'server':init.get('serverInfo'),'tools':[{'name':t['name'],'inputSchema':t.get('inputSchema')} for t in tools] if not args.tool else [t['name'] for t in tools]},ensure_ascii=False))
        if args.tool:
            # Only the explicitly reviewed query/search tools may be called.
            if args.tool not in READ_ONLY_TOOLS: raise ValueError('Tool not on read-only allowlist')
            if args.tool not in [t['name'] for t in tools]: raise ValueError('Requested tool was not advertised')
            if not args.query_id: arguments=json.loads(args.arguments_file.read_text(encoding='utf-8'))
            result=client.rpc('tools/call',{'name':args.tool,'arguments':arguments})
            path=archive(json.dumps(result,ensure_ascii=False).encode(),{'provider':'Miaoxiang MCP','tool':args.tool,'arguments':arguments,'isError':bool(result.get('isError'))},args.raw_dir)
            summary=response_summary(result)
            print(json.dumps({'tool':args.tool,**summary,'raw_file':str(path),'canonical_imported':False},ensure_ascii=False))
            return 2 if summary['businessError'] or not summary['structuredDataReturned'] else 0
        return 0
    except Exception as exc:
        # Never log exception bodies, headers, config, credentials, or provider prose.
        print(json.dumps({'ok':False,'errorType':type(exc).__name__})); return 2

if __name__=='__main__': raise SystemExit(main())
