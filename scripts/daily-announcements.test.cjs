// Synthetic fixtures exercise the actual daily renderer and export handlers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const a={company:'锦江酒店',code:'600754.SH',title:'测试事项 <script>bad()</script>',category:'经营数据',summary:'测试事实',impact:'测试影响',source:'测试原始披露',sourceType:'exchange',url:'https://example.com/disclosure/1',publishedAt:'2026-10-16',timePrecision:'date',verified:true};
const d={schemaVersion:2,date:'2026-10-16',dailySummaryPoints:['测试一','测试二','测试三'],dailySummary:'① 测试一\n② 测试二\n③ 测试三',focus:[],originals:{},companyAnnouncements:[a,{...a,title:'未核验测试',verified:false}],industryUpdates:[{title:'测试行业数据',summary:'测试数据',source:'测试来源',publishedAt:'2026-10-16',url:'https://example.com/data'}]};
const old={...d,date:'2026-10-15',companyAnnouncements:undefined};
const resources={windowStart:'2026-10-15T16:00:00+08:00',cutoff:'2026-10-16T16:00:00+08:00',sourceThrough:'2026-10-16T16:00:00+08:00',attachmentCatalog:{coverageStatus:'pending',sourceThrough:'2026-10-16T09:16:00+08:00',scan:{windowEnd:'2026-10-16T09:28:00+08:00'}},groups:{segments:[],minutes:[],audio:[],reports:[]}};
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,innerHTML:'',textContent:'',value:''});return nodes.get(id);};
let copied,download;
class TestURL extends URL{static createObjectURL(blob){download=blob;return 'blob:test';}static revokeObjectURL(){}}
const context=vm.createContext({console,URL:TestURL,URLSearchParams,Blob,setTimeout:()=>0,location:{href:'https://example.com/daily.html?date=2026-10-16'},navigator:{clipboard:{writeText:async value=>{copied=value;}}},document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>({click(){}})},SiteUI:{date:v=>v,save(){},request:async p=>p.endsWith('index.json')?{dates:['2026-10-16','2026-10-15']}:p.includes('/resources/')?resources:p.includes('2026-10-16')?d:old}});
for(const file of ['daily-announcements.js','daily.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
const flush=async()=>{for(let i=0;i<3;i++)await new Promise(setImmediate);};
(async()=>{await flush();assert.equal(node('daily-announcements').hidden,false);const html=node('announcements-list').innerHTML;
 assert(node('resource-window').textContent.includes('09:28:00'));
 assert(!node('resource-window').textContent.includes('覆盖至 2026-10-16T16:00'));
 assert(node('resource-list').innerHTML.includes('附件索引待补'));
 assert.equal((html.match(/<article /g)||[]).length,1);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
 assert(html.includes('测试影响')&&html.includes('发布 2026-10-16')&&html.includes('href="'+a.url+'"'));
 await node('copy').onclick();assert(copied.indexOf('【行业重要数据】')<copied.indexOf('【公司重要公告】'));
 assert(copied.includes('附件索引待补')&&copied.includes('09:28:00'));
 assert(copied.indexOf('【公司重要公告】')<copied.indexOf('【重点段子】'));
 assert(copied.includes('测试事实\n测试影响')&&copied.includes(a.url));assert(!copied.includes('未核验测试'));
 node('download').onclick();assert.equal(await download.text(),copied);
 await node('dates').onchange({target:{value:'2026-10-15'}});await flush();assert.equal(node('daily-announcements').hidden,true);
 await node('copy').onclick();assert(!copied.includes('【公司重要公告】'));
 console.log('PASS: announcement render, source link, escaping, copy/download and historical snapshot');
})().catch(e=>{console.error(e);process.exitCode=1;});
