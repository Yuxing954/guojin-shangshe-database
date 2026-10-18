import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {MarketSync,hash,gitHash,keys,csvWrite,csvRead,json,sourcePage,cutoff,unpack} from './market_sync_core.mjs';
import {mailboxTransport} from './market_sync_mailbox.mjs';
const U='data/research/updates/manifest.json',A='data/research/archive/manifest.json',B='data/research/market-briefs.json';
const now=()=>new Date('2026-10-19T02:00:00Z');
const topic={topic_id:'12345',create_time:'2026-10-19T09:01:02.345+0800',title:'渠道经营观点',content:'渠道订单可能改善。\n需观察销售兑现。',owner:'测试'};
const ok=content=>({structuredContent:{content}}), obj=value=>({structuredContent:value});
class FakeRepo{
 constructor(){
  this.head='base';this.calls=[];this.blobs=new Map();this.tree=null;this.lostRef=false;this.failReads=0;
  this.files=new Map([['docs/research-incremental-read.md','dedup'],['scripts/build_research_shards.py','keys(row)'],
   [U,json({coverageTo:'2026-10-18T18:00:00+0800',files:{views:[],all_views:[]},counts:{views:0,all_views:0},latest:{},assignedTopics:{views:[],all_views:[]}})],
   [B,json({schemaVersion:1,briefs:[],briefCount:0})],['data/research/resource-index.json','{"items":[]}\n']]);
  const raw='{"keys":[]}\n';this.archive={keyAlgorithm:'sha256-utf8-v1',coverageTo:'2026-10-18T18:00:00+0800',databases:{views:{rows:0,shards:[]},all_views:{rows:0,shards:[]}},dedupBuckets:{}};
  for(let i=0;i<256;i++){const b=i.toString(16).padStart(2,'0'),p='data/research/archive/dedup/'+b+'.json';this.archive.dedupBuckets[b]={path:p,sha256:hash(raw)};this.files.set(p,raw);}
  this.files.set(A,json(this.archive));
 }
 build(){
  const update=JSON.parse(this.files.get(U));const grouped={views:[],all_views:[]};
  for(const kind of ['views','all_views'])for(const p of update.files[kind])grouped[kind].push(...csvRead(this.files.get(p)));
  const buckets={};for(const row of Object.values(grouped).flat())for(const k of keys(row)){const b=hash(k).slice(0,2);(buckets[b]||=new Set()).add(k);}
  for(const [b,ks] of Object.entries(buckets)){const raw=json({keys:[...ks]}),p=this.archive.dedupBuckets[b].path;this.files.set(p,raw);this.archive.dedupBuckets[b].sha256=hash(raw);}
  for(const kind of ['views','all_views']){const rows=grouped[kind],p='data/research/archive/'+kind+'/0001.json';const raw=json({rows});this.files.set(p,raw);this.archive.databases[kind]={rows:rows.length,shards:rows.length?[{path:p,sha256:hash(raw),newest:rows[0]['原始发布时间'],oldest:rows.at(-1)['原始发布时间']}]:[]};}
  const full=json({items:Object.values(grouped).flat()});this.files.set('data/research/market-views-all.json',full);this.archive.coverageTo=update.coverageTo;this.archive.marketViewsExport={path:'data/research/market-views-all.json',bytes:Buffer.byteLength(full),gitBlobSha1:gitHash(full),totalRows:Object.values(grouped).flat().length,coverageTo:update.coverageTo};this.files.set(A,json(this.archive));
 }
 async transport(jobs){return Promise.all(jobs.map(async j=>{
  this.calls.push(j);const a=j.args;
  if(j.tool.endsWith('github_fetch_file')){if(this.failReads-->0)return {isError:true,content:[{type:'text',text:'temporary'}]};if(!this.files.has(a.path))throw new Error('Fixture missing '+a.path);return ok(this.files.get(a.path));}
  if(j.tool.endsWith('github_create_blob')){const sha=gitHash(a.content);this.blobs.set(sha,a.content);return obj({sha});}
  if(j.tool.endsWith('github_create_tree')){this.tree=a.tree_elements;return obj({sha:'tree'});}
  if(j.tool.endsWith('github_create_commit'))return obj({sha:'new-commit'});
  if(j.tool.endsWith('github_update_ref')){assert.equal(a.expected_sha,this.head);for(const e of this.tree)this.files.set(e.path,this.blobs.get(e.sha));this.head='new-commit';this.build();if(this.lostRef){this.lostRef=false;throw new Error('Simulated disconnect after successful ref update');}return obj({ref:'main'});}
  if(j.tool.endsWith('github_fetch')){
   if(a.url.includes('/branches/'))return ok(JSON.stringify({commit:{sha:this.head,commit:{tree:{sha:'base-tree'}}}}));
   if(a.url.includes('/contents/')){const raw=this.files.get('data/research/market-views-all.json');return ok(JSON.stringify({sha:gitHash(raw),size:Buffer.byteLength(raw)}));}
   if(a.url.includes('/actions/workflows/'))return ok(JSON.stringify({workflow_runs:[{head_sha:'new-commit',path:'.github/workflows/build-research-recent.yml',status:'completed',conclusion:'success'}]}));
   if(a.url.includes('/actions/runs'))return ok(JSON.stringify({workflow_runs:[{head_sha:this.head,path:'dynamic/pages/pages-build-deployment',status:'completed',conclusion:'success'}]}));
  }
  throw new Error('Unexpected connector request '+j.tool+' '+JSON.stringify(a));
 }));}
}
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'market-sync-v2-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const repo=new FakeRepo();const opts={stateDir:dir,transport:j=>repo.transport(j),source:async()=>({success:true,topics_brief:[topic],has_more:false}),siteProbe:async()=>repo.archive,now};return {dir,repo,opts};}
async function review(dir,kind='all_views'){
 const state=JSON.parse(await fs.readFile(path.join(dir,'current.json'),'utf8'));
 await fs.writeFile(path.join(dir,'review.json'),json({runId:state.runId,decisions:[{topicId:topic.topic_id,kind}],briefUpserts:[],briefEvaluatedTopicIds:kind==='views'?[topic.topic_id]:[]}));
}
test('SHA and Python whitespace compatibility',()=>{
 assert.equal(hash('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const row={'内容':'\u0085甲\r\n乙\u001c','原始发布时间':'2026-10-19T09:01:02.345+0800','标题':'a','原文链接':'https://x/topic/12345'};
 assert.equal(keys(row)[2],'body:'+hash('甲\n乙'));assert.equal(keys(row)[3],'compactBody:'+hash('甲乙'));
 assert.equal(cutoff(now()),'2026-10-17');
});
test('CSV preserves Chinese, multiline and quotes',()=>{const r={'时间':'2026-10-19','标题':'a"b','内容':'甲\n乙,"x"'};assert.equal(csvRead(csvWrite([r]))[0]['内容'],r['内容']);assert.equal(csvRead(csvWrite([r]))[0]['标题'],r['标题']);});
test('connector mutation schema is not a file schema',()=>{assert.deepEqual(unpack(obj({sha:'123'})),{sha:'123'});assert.equal(unpack(ok('text')),'text');assert.throws(()=>unpack({isError:true}));});
test('CLI and raw source envelopes',()=>{assert.equal(sourcePage({success:true,topics_brief:[topic],has_more:false}).topics[0].topic_id,'12345');assert.equal(sourcePage({body:{resp_data:{topics:[topic]}}}).topics.length,1);});
test('resumed source pagination reuses saved pages and reaches coverage',async t=>{
 const {dir,repo,opts}=await fixture(t);const calls=[];const old={...topic,topic_id:'111',create_time:'2026-10-18T17:00:00+0800'};
 opts.source=async cursor=>{calls.push(cursor);if(!cursor)return {topics_brief:[topic],has_more:true,next_end_time:topic.create_time};return {topics_brief:[topic,old],has_more:true,next_end_time:old.create_time};};
 const a=await new MarketSync(opts).run();assert.equal(a.status,'needs_review');assert.equal(calls.length,2);
 await new MarketSync(opts).run();assert.equal(calls.length,2);assert.equal(repo.calls.filter(x=>x.tool.endsWith('github_create_blob')).length,0);
});
test('review, atomic commit, archive/export and live deployment verify end to end',async t=>{
 const {dir,repo,opts}=await fixture(t);assert.equal((await new MarketSync(opts).run()).status,'needs_review');await review(dir);
 const done=await new MarketSync(opts).run();assert.equal(done.status,'done');assert.equal(done.added.all_views,1);
 const u=JSON.parse(repo.files.get(U));assert.equal(u.files.all_views.length,1);assert.equal(csvRead(repo.files.get(u.files.all_views[0])).length,1);assert.equal(u.lastUpdateRecord.sourceTopicIds.length,1);
 assert.equal(done.verification.rows,1);assert(!repo.calls.some(x=>JSON.stringify(x).includes('recent-300')));
});
test('lost response after branch update resumes without reuploading or duplicate commit',async t=>{
 const {dir,repo,opts}=await fixture(t);await new MarketSync(opts).run();await review(dir);repo.lostRef=true;
 assert.equal((await new MarketSync(opts).run()).status,'failed');const before=repo.calls.filter(x=>x.tool.endsWith('github_create_blob')).length;
 const resumed=await new MarketSync(opts).run();assert.equal(resumed.status,'done');assert.equal(repo.calls.filter(x=>x.tool.endsWith('github_create_blob')).length,before);assert.equal(repo.calls.filter(x=>x.tool.endsWith('github_create_commit')).length,1);
});
test('brief expiry commits even with no source; clean run does not commit',async t=>{
 const {dir,repo,opts}=await fixture(t);opts.source=async()=>({topics_brief:[],has_more:false});
 assert.equal((await new MarketSync(opts).run()).noChange,true);assert.equal(repo.calls.filter(x=>x.tool.endsWith('github_create_commit')).length,0);
 repo.files.set(B,json({briefs:[{id:'expired',date:'2026-10-16',sources:[]}],briefCount:1}));repo.head='after-expiry-fixture';
 const result=await new MarketSync(opts).run();assert.equal(result.status,'done');assert.equal(result.briefChanges.expiredRemoved,1);assert.equal(JSON.parse(repo.files.get(B)).briefs.length,0);
});
test('concurrent main update creates resumable rebase instead of overwriting',async t=>{
 const {dir,repo,opts}=await fixture(t);await new MarketSync(opts).run();await review(dir);repo.head='someone-else';
 const result=await new MarketSync(opts).run();assert.equal(result.status,'pending');assert.equal(repo.calls.filter(x=>x.tool.endsWith('github_update_ref')).length,0);
 const state=JSON.parse(await fs.readFile(path.join(dir,'current.json'),'utf8'));assert.equal(state.stage,'snapshot');
});
test('missing decisions never advance coverage',async t=>{
 const {dir,repo,opts}=await fixture(t);await new MarketSync(opts).run();const state=JSON.parse(await fs.readFile(path.join(dir,'current.json'),'utf8'));await fs.writeFile(path.join(dir,'review.json'),json({runId:state.runId,decisions:[]}));
 assert.equal((await new MarketSync(opts).run()).status,'failed');assert.equal(repo.head,'base');
});
test('file mailbox transfers multi-megabyte Unicode results without terminal encoding',async t=>{
 const {dir}=await fixture(t),body='多行原文\n🙂"字段"'.repeat(160000);
 const exchange=mailboxTransport(dir,async message=>{await atomicResponse(message.responseFile,{results:[ok(body)]});});
 async function atomicResponse(file,value){await fs.writeFile(file+'.tmp',JSON.stringify(value),'utf8');await fs.rename(file+'.tmp',file);}
 const result=await exchange([{tool:'test',args:{}}]);assert.equal(unpack(result[0]),body);
});
