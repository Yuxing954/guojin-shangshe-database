import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

export const REPO='Yuxing954/guojin-shangshe-database';
export const GROUP='88888142214212';
const ROOT='data/research/';
const UPDATES=ROOT+'updates/manifest.json', ARCHIVE=ROOT+'archive/manifest.json', BRIEFS=ROOT+'market-briefs.json';
const HEADER=['时间','原始发布时间','月份','标题','内容','作者','原文链接','命中关键词','更新批次'];
const PY_SPACE='\\u0009-\\u000d\\u001c-\\u0020\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const space=new RegExp('['+PY_SPACE+']+','g'), trim=new RegExp('^['+PY_SPACE+']+|['+PY_SPACE+']+$','g');
export const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
export const gitHash=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
export const json=s=>JSON.stringify(s,null,2)+'\n';
export function unpack(r){
  if(!r||r.isError)throw new Error('Connector error: '+JSON.stringify(r).slice(0,300));
  const s=r.structuredContent;
  if(typeof s?.content==='string')return s.content;
  if(s)return s;
  const t=r.content?.find(x=>x.type==='text')?.text;
  if(!t||t==='Action completed.')throw new Error('Connector payload missing');
  return t;
}
const object=r=>{const p=unpack(r);return typeof p==='string'?JSON.parse(p):p;};
export function keys(row){
  const topic=String(row['原文链接']||'').match(/\/topic\/(\d+)/);
  const stamp=String(row['原始发布时间']||row['时间']||row['日期']||'').replaceAll('T',' ').slice(0,19);
  const body=String(row['内容']||row['摘要']||'').replace(/\r\n?/g,'\n').replace(trim,'');
  return ['stamp:'+hash(stamp+'|'+String(row['标题']||'')),...(topic?['topic:'+topic[1]]:[]),...(body?['body:'+hash(body),'compactBody:'+hash(body.replace(space,''))]:[])];
}
export function csvRead(text){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q;}
    else if(!q&&c===','){row.push(cell);cell='';}
    else if(!q&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(q)throw new Error('CSV quote not closed');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const h=rows.shift()||[];return rows.map(r=>{if(r.length!==h.length)throw new Error('CSV column count');return Object.fromEntries(h.map((k,i)=>[k,r[i]]));});
}
export const csvWrite=rows=>[HEADER,...rows.map(r=>HEADER.map(k=>r[k]??''))].map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
export function time(s){const t=Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(s)?s:s+'+08:00');if(!Number.isFinite(t))throw new Error('Invalid source time: '+s);return t;}
export const beijingDate=now=>new Date(now.getTime()+8*3600000).toISOString().slice(0,10);
export const cutoff=now=>new Date(Date.parse(beijingDate(now)+'T00:00:00Z')-2*86400000).toISOString().slice(0,10);
export async function atomic(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,json(value));await fs.rename(tmp,file);}
const exists=async p=>fs.access(p).then(()=>true,()=>false);
export function sourcePage(raw){
  if(raw.success===false)throw new Error('ZSXQ source failed');
  const d=raw.body?.resp_data||raw.resp_data||raw;
  const items=d.topics_brief||d.topics;
  if(!Array.isArray(items))throw new Error('ZSXQ topics array missing');
  const topics=items.map(t=>({topic_id:String(t.topic_id),create_time:t.create_time,title:t.title||'',content:t.content??t.talk?.text??t.question?.text??'',owner:t.owner?.name||t.talk?.owner?.name||'水木调研纪要'}));
  topics.forEach(t=>{if(!/^\d+$/.test(t.topic_id))throw new Error('Invalid topic id');time(t.create_time);});
  return {topics,has_more:d.has_more??topics.length>=30,next_end_time:d.next_end_time||topics.at(-1)?.create_time};
}
export function sourceCli(cursor){return new Promise((resolve,reject)=>{
  const args=['group','+topics','--group-id',GROUP,'--limit','30','--json',...(cursor?['--end-time',cursor]:[])];
  const p=spawn('zsxq-cli',args,{windowsHide:true,shell:false});let out='',err='';
  const timer=setTimeout(()=>{p.kill();reject(new Error('ZSXQ timeout after 40 seconds'));},40000);
  p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
  p.on('error',e=>{clearTimeout(timer);reject(e);});
  p.on('close',code=>{clearTimeout(timer);try{if(code)throw new Error('ZSXQ CLI '+code+': '+err.slice(0,250));resolve(JSON.parse(out));}catch(e){reject(e);}});
});}
function rowFor(t,runId){return Object.fromEntries(HEADER.map((k,i)=>[k,[t.create_time.slice(0,16).replace('T',' '),t.create_time,t.create_time.slice(0,7),t.title||t.content.split('\n').find(x=>x.trim())?.slice(0,120)||'',t.content,t.owner,`https://wx.zsxq.com/group/${GROUP}/topic/${t.topic_id}`,'',runId][i]]));}
export function visibleText(s){return s.replace(/<e\b[^>]*\btitle="([^"]*)"[^>]*\/>/g,(_,t)=>{try{return decodeURIComponent(t);}catch{return t;}}).replace(/<[^>]+>/g,'').trim();}
function placeholder(t){const text=visibleText(t.content);return !text||/^(?:「图片」|\[图片\]|(?:#[^#]+#\s*)+)$/.test(text)?'无可读观点正文':null;}

export class MarketSync{
  constructor({stateDir,transport,source=sourceCli,siteProbe=async()=>{const r=await fetch('https://yuxing954.github.io/guojin-shangshe-database/data/research/archive/manifest.json?t='+Date.now(),{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!r.ok)throw new Error('Live site HTTP '+r.status);return r.json();},now=()=>new Date(),budgetMs=8*60000}){this.root=path.resolve(stateDir);this.transport=transport;this.source=source;this.siteProbe=siteProbe;this.now=now;this.started=Date.now();this.budgetMs=budgetMs;}
  async save(){this.s.updatedAt=this.now().toISOString();await atomic(path.join(this.root,'current.json'),this.s);}
  async rpcMany(jobs,{fresh=false}={}){
    if(Date.now()-this.started>this.budgetMs){const e=new Error('Execution slice finished; resume checkpoint');e.pending=true;throw e;}
    const results=new Map(),pending=[];
    for(const j of jobs){j.id=hash(JSON.stringify([j.tool,j.args]));const file=path.join(this.root,'rpc',j.id+'.json');if(!fresh&&await exists(file))results.set(j.id,JSON.parse(await fs.readFile(file,'utf8')));else pending.push(j);}
    for(let offset=0;offset<pending.length;offset+=6){let batch=pending.slice(offset,offset+6);
      for(let attempt=0;attempt<2&&batch.length;attempt++){
        const answers=await this.transport(batch);const retry=[];
        for(let i=0;i<batch.length;i++){const j=batch[i],r=answers[i];try{unpack(r);if(!fresh)await atomic(path.join(this.root,'rpc',j.id+'.json'),r);results.set(j.id,r);}catch(e){if(attempt===0)retry.push(j);else throw e;}}
        batch=retry;
      }
    }
    return jobs.map(j=>results.get(j.id));
  }
  async rpc(tool,args,fresh=false){return (await this.rpcMany([{tool,args}],{fresh}))[0];}
  async get(url){return object(await this.rpc('mcp__codex_apps__github_fetch',{url},true));}
  async file(p,ref=this.s.baseHead){const r=await this.rpc('mcp__codex_apps__github_fetch_file',{repository_full_name:REPO,path:p,ref});const v=unpack(r);if(typeof v!=='string')throw new Error('File payload is not text: '+p);return v;}
  async snapshot(){
    const b=await this.get(`https://api.github.com/repos/${REPO}/branches/main`);
    this.s.baseHead=b.commit.sha;this.s.baseTree=b.commit.commit.tree.sha;await this.save();
    const names=['docs/research-incremental-read.md','scripts/build_research_shards.py',UPDATES,ARCHIVE,BRIEFS];
    const raw=await this.rpcMany(names.map(p=>({tool:'mcp__codex_apps__github_fetch_file',args:{repository_full_name:REPO,path:p,ref:this.s.baseHead}})));
    const values=raw.map(unpack);this.s.updates=JSON.parse(values[2]);this.s.archive=JSON.parse(values[3]);this.s.briefs=JSON.parse(values[4]);
    if(this.s.archive.keyAlgorithm!=='sha256-utf8-v1')throw new Error('Unknown dedup key algorithm');
    if(!this.s.updates.coverageTo||!this.s.archive.coverageTo)throw new Error('Coverage missing');
    this.s.algorithmSourceSha256=hash(values[1]);this.s.remoteCoverage=this.s.updates.coverageTo;
    const memo=path.join(this.root,'scan-cache.json');const prior=await exists(memo)?JSON.parse(await fs.readFile(memo,'utf8')):null;
    this.s.scanFrom=prior?.remoteCoverage===this.s.remoteCoverage&&time(prior.scannedTo)>time(this.s.remoteCoverage)?prior.scannedTo:this.s.remoteCoverage;
    this.s.pages=[];this.s.stage='collect';await this.save();
  }
  async collect(){
    while(!this.s.pages.length||!this.s.pages.at(-1).complete){
      if(Date.now()-this.started>this.budgetMs){const e=new Error('Source slice finished; saved pages will resume');e.pending=true;throw e;}
      if(this.s.pages.length>=100)throw new Error('Source pagination exceeds 100 pages; checkpoint retained');
      const cursor=this.s.pages.at(-1)?.next_end_time;let raw,lastError;
      for(let retry=0;retry<2;retry++){try{raw=await this.source(cursor);lastError=null;break;}catch(e){lastError=e;}}
      if(lastError)throw lastError;
      const p=sourcePage(raw);const oldest=p.topics.reduce((v,t)=>!v||time(t.create_time)<time(v)?t.create_time:v,null);
      p.complete=!p.has_more||!p.topics.length||(oldest&&time(oldest)<=time(this.s.scanFrom));
      if(!p.complete&&(!p.next_end_time||(cursor&&time(p.next_end_time)>=time(cursor))))throw new Error('Source pagination cursor did not advance');
      this.s.pages.push(p);await this.save();
    }
    const topics=[...new Map(this.s.pages.flatMap(p=>p.topics).map(t=>[t.topic_id,t])).values()].sort((a,b)=>time(b.create_time)-time(a.create_time));
    this.s.topics=topics.filter(t=>time(t.create_time)>time(this.s.scanFrom));this.s.scannedTo=this.s.topics[0]?.create_time||this.s.scanFrom;
    this.s.excluded=this.s.topics.filter(placeholder).map(t=>({topicId:t.topic_id,reason:placeholder(t)}));this.s.excludedBase=structuredClone(this.s.excluded);
    this.s.candidates=this.s.topics.filter(t=>!placeholder(t)).map(t=>({topic:t,row:rowFor(t,this.s.runId)}));
    this.s.stage='dedup';await this.save();
  }
  async dedup(){
    const archive=this.s.archive;const candidates=this.s.candidates;const allKeys=new Set();
    const cacheRoot=path.join(this.root,'bucket-cache');
    const needed=[...new Set(candidates.flatMap(x=>keys(x.row).map(k=>hash(k).slice(0,2))))];
    for(let i=0;i<needed.length;i+=6){
      const group=needed.slice(i,i+6),missing=[],cached=new Map();
      for(const b of group){const m=archive.dedupBuckets?.[b];if(!m)throw new Error('Dedup bucket missing: '+b);const file=path.join(cacheRoot,m.sha256+'.json');if(await exists(file)){const raw=await fs.readFile(file,'utf8');if(hash(raw)===m.sha256)cached.set(b,raw);else await fs.unlink(file);}if(!cached.has(b))missing.push(b);}
      const responses=await this.rpcMany(missing.map(b=>({tool:'mcp__codex_apps__github_fetch_file',args:{repository_full_name:REPO,path:archive.dedupBuckets[b].path,ref:this.s.baseHead}})));
      for(let j=0;j<missing.length;j++){const b=missing[j],raw=unpack(responses[j]);if(typeof raw!=='string'||hash(raw)!==archive.dedupBuckets[b].sha256)throw new Error('Dedup bucket checksum mismatch: '+b);await fs.mkdir(cacheRoot,{recursive:true});await fs.writeFile(path.join(cacheRoot,archive.dedupBuckets[b].sha256+'.json'),raw);cached.set(b,raw);}
      for(const raw of cached.values()){const bucket=JSON.parse(raw);if(!Array.isArray(bucket.keys))throw new Error('Dedup bucket malformed');for(const k of bucket.keys)allKeys.add(k);}
    }
    if(time(archive.coverageTo)<time(this.s.remoteCoverage)){
      // Old manifests without indexedUpdateFiles require a conservative small-update fallback.
      const indexed=new Set(archive.indexedUpdateFiles||[]);
      const missing=Object.values(this.s.updates.files).flat().filter(p=>/-(?:views|all_views)(?:-\d+)?\.csv$/.test(p)&&!indexed.has(p));
      for(let i=0;i<missing.length;i+=6){const batch=missing.slice(i,i+6);const rs=await this.rpcMany(batch.map(p=>({tool:'mcp__codex_apps__github_fetch_file',args:{repository_full_name:REPO,path:p,ref:this.s.baseHead}})));for(const r of rs)for(const row of csvRead(unpack(r)))for(const k of keys(row))allKeys.add(k);}
    }
    const fresh=[],duplicates=[];
    for(const c of candidates){const kk=keys(c.row),hits=kk.filter(k=>allKeys.has(k));if(hits.length)duplicates.push({topicId:c.topic.topic_id,hits});else{fresh.push(c);for(const k of kk)allKeys.add(k);}}
    this.s.duplicates=duplicates;this.s.duplicateBase=structuredClone(duplicates);this.s.fresh=fresh;this.s.bucketCount=needed.length;this.s.candidateKeyCount=candidates.reduce((n,c)=>n+keys(c.row).length,0);
    this.s.stage='review';await this.save();
    await atomic(path.join(this.root,'review-input.json'),{runId:this.s.runId,beijingDate:beijingDate(this.now()),coverageTo:this.s.scannedTo,candidates:fresh.map(x=>({...x.topic,displayText:visibleText(x.topic.content)})),existingBriefs:this.s.briefs.briefs,requiredReview:{decisions:'One {topicId,kind:views|all_views|exclude|duplicate,reason,duplicateOf?} per candidate',briefUpserts:'Full entries; reuse existing id for same thesis, merge sources; only actual read commercial view evidence',briefEvaluatedTopicIds:'Every newly selected commercial topic id, including ones intentionally not summarized'}});
  }
  async prepare(){
    const file=path.join(this.root,'review.json');if(!await exists(file))return false;
    const review=JSON.parse(await fs.readFile(file,'utf8'));if(review.runId!==this.s.runId)throw new Error('Review belongs to another run');
    const decisions=new Map((review.decisions||[]).map(x=>[x.topicId,x]));
    if(decisions.size!==this.s.fresh.length||review.decisions.length!==decisions.size)throw new Error('Every candidate needs exactly one decision');
    const rows={views:[],all_views:[]},sources=[],excluded=structuredClone(this.s.excludedBase),duplicates=structuredClone(this.s.duplicateBase);const ids=new Set(this.s.fresh.map(c=>c.topic.topic_id));
    for(const c of this.s.fresh){const d=decisions.get(c.topic.topic_id);if(!d||!['views','all_views','exclude','duplicate'].includes(d.kind))throw new Error('Invalid classification');
      if(d.kind==='exclude'){if(!d.reason)throw new Error('Exclusion needs reason');excluded.push({topicId:c.topic.topic_id,reason:d.reason});}
      else if(d.kind==='duplicate'){if(!d.duplicateOf||!ids.has(d.duplicateOf)||d.duplicateOf===c.topic.topic_id||!['views','all_views'].includes(decisions.get(d.duplicateOf)?.kind))throw new Error('Duplicate target must be an accepted source');duplicates.push({topicId:c.topic.topic_id,duplicateOf:d.duplicateOf,reason:d.reason});}
      else{rows[d.kind].push(c.row);sources.push({...c.topic,kind:d.kind});}
    }
    const selected= sources.filter(s=>s.kind==='views').map(s=>s.topic_id);
    if(selected.some(id=>!(review.briefEvaluatedTopicIds||[]).includes(id)))throw new Error('Commercial summary evaluation missing');
    const before=this.s.briefs;const briefMap=new Map(before.briefs.map(b=>[b.id,b]));let briefAdded=0,briefUpdated=0;
    for(const b of review.briefUpserts||[]){
      if(!b.id||!b.title||!b.conclusion||!Array.isArray(b.sources)||!b.sources.length)throw new Error('Invalid brief');
      const newSources=b.sources.filter(s=>selected.includes(s.topicId));if(!newSources.length)throw new Error('Brief lacks newly read commercial source');
      for(const s of newSources){const src=sources.find(x=>x.topic_id===s.topicId);if(s.publishedAt!==src.create_time||s.date!==src.create_time.slice(0,10)||s.url!==`https://wx.zsxq.com/group/${GROUP}/topic/${src.topic_id}`)throw new Error('Brief source metadata mismatch');}
      if(b.date!==b.sources.map(s=>s.date).sort().at(-1))throw new Error('Brief date must match newest evidence');
      if(briefMap.has(b.id)){const prior=briefMap.get(b.id);if((prior.sources||[]).some(s=>!b.sources.some(x=>x.topicId===s.topicId)))throw new Error('Updating brief lost prior sources');briefUpdated++;}else{if([...briefMap.values()].some(x=>x.title===b.title))throw new Error('Duplicate brief title');briefAdded++;}
      briefMap.set(b.id,b);
    }
    const expired=[...briefMap.values()].filter(b=>b.date<cutoff(this.now())).map(b=>b.id);
    for(const id of expired)briefMap.delete(id);
    const seenSource=new Set();for(const b of briefMap.values())for(const s of b.sources||[]){if(seenSource.has(s.topicId))throw new Error('Same source repeated in multiple briefs; merge same topic');seenSource.add(s.topicId);}
    const changes={added:briefAdded,updated:briefUpdated,expiredRemoved:expired.length};
    this.s.excluded=excluded;this.s.duplicates=duplicates;this.s.briefCutoff=cutoff(this.now());this.s.added={views:rows.views.length,all_views:rows.all_views.length};this.s.briefChanges=changes;this.s.sourceTopicIds=sources.map(s=>s.topic_id);
    if(!sources.length&&!briefAdded&&!briefUpdated&&!expired.length){this.s.stage='done';this.s.noChange=true;await atomic(path.join(this.root,'scan-cache.json'),{remoteCoverage:this.s.remoteCoverage,scannedTo:this.s.scannedTo});await this.save();return true;}
    const u=structuredClone(this.s.updates),files={};
    for(const kind of ['views','all_views'])if(rows[kind].length){const p=ROOT+'updates/'+this.s.runId+'-'+kind+'.csv';files[p]=csvWrite(rows[kind]);u.files[kind]=[p,...u.files[kind]];u.counts[kind]=(u.counts[kind]||0)+rows[kind].length;u.latest[kind]=rows[kind][0]['时间'];}
    const stamp=this.now().toISOString();const record={runId:this.s.runId,sourceGroup:GROUP,sourceName:'水木调研纪要-2.0',previousCoverageTo:this.s.remoteCoverage,coverageTo:this.s.scannedTo,added:sources.length,updated:0,expiredRemoved:expired.length,sourceTopicIds:this.s.sourceTopicIds,duplicateTopicIds:this.s.duplicates.map(x=>x.topicId),briefChanges:changes};
    u.syncedAt=stamp;u.coverageFrom=this.s.remoteCoverage;u.coverageTo=this.s.scannedTo;u.fetchedTopics=new Set(this.s.pages.flatMap(p=>p.topics.map(t=>t.topic_id))).size;u.oldestFetched=this.s.pages.flatMap(p=>p.topics).at(-1)?.create_time||this.s.scanFrom;
    u.lastRun={...record,added:this.s.added,duplicates:this.s.duplicates.length,excludedTopics:this.s.excluded,pagination:{pages:this.s.pages.length,pageRowsFetched:this.s.pages.reduce((n,p)=>n+p.topics.length,0),limit:30,stoppedWhenPageReachedCoverage:true},dedupCheck:{candidateKeys:this.s.candidateKeyCount,candidateBuckets:this.s.bucketCount,algorithm:'sha256-utf8-v1'},expiredBriefIds:expired};u.lastUpdateRecord=record;
    u.assignedTopics||={};for(const kind of ['views','all_views'])u.assignedTopics[kind]=[...(u.assignedTopics[kind]||[]),...sources.filter(s=>s.kind===kind).map(s=>s.topic_id)];
    files[UPDATES]=json(u);
    if(briefAdded||briefUpdated||expired.length){files[BRIEFS]=json({...before,briefs:[...briefMap.values()],briefCount:briefMap.size,updatedAt:beijingDate(this.now()),syncedAt:stamp,lastUpdateRecord:{...record,added:briefAdded,updated:briefUpdated}});}
    this.s.prepared=files;this.s.sources=sources;this.s.stage='publish';this.s.reviewHash=hash(json(review));await this.save();return true;
  }
  async publish(){
    const head=await this.get(`https://api.github.com/repos/${REPO}/branches/main`);
    if(this.s.commitSha&&head.commit.sha!==this.s.baseHead){
      const remote=JSON.parse(await this.file(UPDATES,head.commit.sha));
      if(remote.lastRun?.runId===this.s.runId){this.s.stage='verify';this.s.publishedAt||=this.now().toISOString();await this.save();return;}
    }
    if(head.commit.sha!==this.s.baseHead){
      await atomic(path.join(this.root,'history',this.s.runId+'-conflict.json'),this.s);
      this.s={version:2,runId:beijingDate(this.now())+'-'+this.now().toISOString().slice(11,19).replaceAll(':','')+'-r'+head.commit.sha.slice(0,5),stage:'snapshot',startedAt:this.now().toISOString()};
      await fs.unlink(path.join(this.root,'review.json')).catch(()=>{});await this.save();const e=new Error('Main changed; checkpoint saved; next slice re-deduplicates against new main');e.pending=true;throw e;
    }
    const entries=Object.entries(this.s.prepared);
    const blobs=await this.rpcMany(entries.map(([p,content])=>({tool:'mcp__codex_apps__github_create_blob',args:{repository_full_name:REPO,content,encoding:'utf-8'}})));
    this.s.blobs=blobs.map((r,i)=>{const o=object(r);if(o.sha!==gitHash(entries[i][1]))throw new Error('Uploaded blob checksum mismatch');return {path:entries[i][0],sha:o.sha,mode:'100644',type:'blob'};});await this.save();
    const tree=object(await this.rpc('mcp__codex_apps__github_create_tree',{repository_full_name:REPO,base_tree_sha:this.s.baseTree,tree_elements:this.s.blobs}));
    if(!tree.sha)throw new Error('Tree SHA missing');this.s.treeSha=tree.sha;await this.save();
    const commit=object(await this.rpc('mcp__codex_apps__github_create_commit',{repository_full_name:REPO,parent_sha:this.s.baseHead,tree_sha:tree.sha,message:`research: market views ${this.s.runId}`}));
    if(!commit.sha)throw new Error('Commit SHA missing');this.s.commitSha=commit.sha;await this.save();
    await this.rpc('mcp__codex_apps__github_update_ref',{repository_full_name:REPO,branch_name:'main',expected_sha:this.s.baseHead,sha:commit.sha,force:false},true);
    this.s.stage='verify';this.s.publishedAt=this.now().toISOString();await this.save();
  }
  async verify(){
    const head=await this.get(`https://api.github.com/repos/${REPO}/branches/main`),ref=head.commit.sha;
    // Fresh reads: build commits can land after the data commit.
    const freshFile=async p=>unpack(await this.rpc('mcp__codex_apps__github_fetch_file',{repository_full_name:REPO,path:p,ref}));
    const a=JSON.parse(await freshFile(ARCHIVE));
    if(time(a.coverageTo)<time(this.s.scannedTo))return {status:'pending',stage:'build',commit:this.s.commitSha};
    if(this.s.dataVerifiedForHead!==ref){
    const u=JSON.parse(await freshFile(UPDATES));if(time(u.coverageTo)<time(this.s.scannedTo))throw new Error('Published coverage regressed');
    const exact=time(a.coverageTo)===time(this.s.scannedTo);
    for(const kind of ['views','all_views']){const expected=this.s.archive.databases[kind].rows+this.s.added[kind];if(exact?a.databases[kind].rows!==expected:a.databases[kind].rows<expected)throw new Error('Archive row count mismatch: '+kind);}
    const needed=new Set(this.s.sourceTopicIds.map(id=>hash('topic:'+id).slice(0,2)));
    for(const b of needed){const meta=a.dedupBuckets[b],raw=await freshFile(meta.path);if(hash(raw)!==meta.sha256)throw new Error('Post-build bucket hash mismatch');const set=new Set(JSON.parse(raw).keys);for(const id of this.s.sourceTopicIds.filter(id=>hash('topic:'+id).slice(0,2)===b))if(!set.has('topic:'+id))throw new Error('New source absent from dedup bucket');}
    for(const kind of ['views','all_views']){
      const expected=this.s.sources.filter(s=>s.kind===kind);if(!expected.length)continue;
      const shardPaths=a.databases[kind].shards.filter(m=>expected.some(s=>time(s.create_time)<=time(m.newest)&&time(s.create_time)>=time(m.oldest)));
      const found=new Set();for(const m of shardPaths){const raw=await freshFile(m.path);if(hash(raw)!==m.sha256)throw new Error('Shard checksum mismatch');for(const row of JSON.parse(raw).rows){const id=row['原文链接']?.match(/\/topic\/(\d+)/)?.[1];if(id)found.add(id);}}
      if(expected.some(s=>!found.has(s.topic_id)))throw new Error('New source absent from archive shard');
    }
    const b=JSON.parse(await freshFile(BRIEFS));if(b.briefs.some(x=>x.date<this.s.briefCutoff))throw new Error('Expired brief remains');
    const resource=await freshFile(ROOT+'resource-index.json');JSON.parse(resource);
    const ex=a.marketViewsExport;if(!ex)throw new Error('Full export validation receipt missing; deploy rewritten builder first');
    const meta=await this.get(`https://api.github.com/repos/${REPO}/contents/${ex.path}?ref=${ref}`);
    if(meta.sha!==ex.gitBlobSha1||meta.size!==ex.bytes||ex.totalRows!==a.databases.views.rows+a.databases.all_views.rows||ex.coverageTo!==a.coverageTo)throw new Error('Full export checksum/count/coverage mismatch');
    this.s.dataVerifiedForHead=ref;this.s.verification={head:ref,coverageTo:a.coverageTo,rows:ex.totalRows,exportSha:meta.sha};await this.save();
    }
    const runs=await this.get(`https://api.github.com/repos/${REPO}/actions/workflows/build-research-recent.yml/runs?head_sha=${this.s.commitSha}&per_page=10`);
    const relevant=runs.workflow_runs.filter(r=>r.head_sha===this.s.commitSha&&r.path?.endsWith('/build-research-recent.yml'));
    if(relevant.some(r=>r.status==='completed'&&r.conclusion!=='success'))throw new Error('Research build failed');
    if(!relevant.some(r=>r.conclusion==='success'))return {status:'pending',stage:'build-status',commit:this.s.commitSha};
    const deployments=await this.get(`https://api.github.com/repos/${REPO}/actions/runs?head_sha=${ref}&per_page=30`);
    const pages=deployments.workflow_runs.filter(r=>r.head_sha===ref&&r.path==='dynamic/pages/pages-build-deployment');
    if(pages.some(r=>r.status==='completed'&&r.conclusion==='failure'))throw new Error('Pages deployment failed');
    const deployed=pages.some(r=>r.status==='completed'&&r.conclusion==='success');
    if(!deployed)return {status:'pending',stage:'deployment',commit:this.s.commitSha};
    const live=await this.siteProbe();if(live.coverageTo!==a.coverageTo||live.marketViewsExport?.gitBlobSha1!==a.marketViewsExport.gitBlobSha1)return {status:'pending',stage:'live-site',commit:this.s.commitSha};
    this.s.stage='done';this.s.verifiedAt=this.now().toISOString();await this.save();
    return {status:'done',added:this.s.added,briefChanges:this.s.briefChanges,verification:this.s.verification};
  }
  async run(){
    await fs.mkdir(this.root,{recursive:true});const lockFile=path.join(this.root,'process.lock');
    let lock;try{lock=await fs.open(lockFile,'wx');await lock.writeFile(json({pid:process.pid,startedAt:this.now().toISOString()}));}catch(e){if(e.code!=='EEXIST')throw e;const old=JSON.parse(await fs.readFile(lockFile,'utf8'));try{process.kill(old.pid,0);return {status:'pending',stage:'another-process'};}catch(err){if(err.code!=='ESRCH')throw err;await fs.unlink(lockFile);return this.run();}}
    try{
      const file=path.join(this.root,'current.json');this.s=await exists(file)?JSON.parse(await fs.readFile(file,'utf8')):null;
      if(!this.s||this.s.stage==='done'){
        if(this.s)await atomic(path.join(this.root,'history',this.s.runId+'.json'),this.s);
        await fs.unlink(path.join(this.root,'review.json')).catch(()=>{});
        await fs.unlink(path.join(this.root,'review-input.json')).catch(()=>{});
        const now=this.now();this.s={version:2,runId:beijingDate(now)+'-'+new Date(now.getTime()+8*3600000).toISOString().slice(11,19).replaceAll(':',''),stage:'snapshot',startedAt:now.toISOString()};await this.save();
      }
      if(this.s.stage==='snapshot')await this.snapshot();
      if(this.s.stage==='collect')await this.collect();
      if(this.s.stage==='dedup')await this.dedup();
      if(this.s.stage==='review'){
        if(!this.s.fresh.length&&!await exists(path.join(this.root,'review.json')))await atomic(path.join(this.root,'review.json'),{runId:this.s.runId,decisions:[],briefUpserts:[],briefEvaluatedTopicIds:[]});
        if(!await this.prepare())return {status:'needs_review',runId:this.s.runId,candidates:this.s.fresh.length,input:path.join(this.root,'review-input.json')};
      }
      if(this.s.stage==='publish')await this.publish();
      if(this.s.stage==='verify'){
        const result=await this.verify();
        if(result.status==='pending'&&this.now().getTime()-time(this.s.publishedAt)>20*60000)throw new Error('Build/deployment not verified after 20 minutes; checkpoint retained');
        return result;
      }
      return {status:'done',noChange:true};
    }catch(e){if(this.s){this.s.lastError={message:e.message,at:this.now().toISOString(),stage:this.s.stage};await this.save();}return {status:e.pending?'pending':'failed',stage:this.s?.stage,error:e.message};}
    finally{await lock.close();await fs.unlink(lockFile).catch(()=>{});}
  }
}
