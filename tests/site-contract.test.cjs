'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),U=require('../scripts/site-ui.js'),{checkCSS}=require('../scripts/site-style-contract.cjs');
test('new component aliases cannot introduce a private theme',()=>{
 for(const css of ['.topic-kpi{color:#123456}',':root{--site-accent:red}', '.site-button{border-radius:7px}', '.new-pager{font-size:19px}'])assert.throws(()=>checkCSS('new.css',css));
 assert.doesNotThrow(()=>checkCSS('new.css','.plot{height:320px;grid-template-columns:1fr 2fr}.site-kpi{color:var(--site-ink)}'));
 assert.doesNotThrow(()=>checkCSS('x.css','.x-kpi{color:#123456}',[{file:'x.css',selector:'.x-kpi',declaration:'color:#123456',reason:'Explicit reviewed exception'}]));
});
test('shared formats retain unknown, zero, sign and unit semantics',()=>{
 for(const v of [null,undefined,'',NaN]){assert.equal(U.number(v),'—');assert.equal(U.convert(v,10000),null);}
 assert.equal(U.number(0,'percent'),'0.0%');assert.equal(U.number(-.3,'percentagePoint'),'-0.3pct');assert.equal(U.number(25,'basisPoint'),'25bp');assert.equal(U.convert(120000,1/10000),12);
 assert.equal(U.number(1.234,'price',{digits:3,unit:'美元'}),'1.234美元');assert.equal(U.date('2026-10-23T00:01:30Z'),'2026-10-23 08:01');
});
test('series identity survives sort, filter and missing observations',()=>{
 const ids=['jinjiang','hworld','btg','atour','marriott','hilton','ihg','hyatt'],before=new Map(ids.map(id=>[id,U.seriesColor(id)]));
 for(const id of ids.slice().reverse().filter(id=>id!=='btg'))assert.equal(U.seriesColor(id),before.get(id));
 for(const c of U.colors)assert.match(U.contrastColor(c),/^#[0-9a-f]{6}$/);
});
