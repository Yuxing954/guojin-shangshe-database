import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=await fs.readFile(new URL('./market_sync_bridge.js',import.meta.url),'utf8');
const names=['github_fetch','github_fetch_file','github_create_blob','github_create_tree','github_create_commit','github_update_ref'];
async function run({deny=false,missing=false,body='中文😀'.repeat(30000),repair=null,lost=false}={}){
 const root=(await fs.mkdtemp(path.join(os.tmpdir(),'market bridge 空格-'))).replaceAll('\\','/');
 const state=root+'/state',requestFile=state+'/outbox/request.json',responseFile=requestFile+'.response';
 await fs.mkdir(state+'/outbox',{recursive:true});
 const request=JSON.stringify({requests:[{tool:'mcp__codex_apps__github_fetch_file',args:{}}]});
 const logs=[];let workers=0,writes=0,refWrites=0;
 const tools=Object.fromEntries(names.map(n=>['mcp__codex_apps__'+n,async()=>({structuredContent:{content:body}})]));
 if(missing)delete tools.mcp__codex_apps__github_fetch;
 if(repair){
  const files=new Map(),blobs=new Map();let tree=[],head='a'.repeat(40);
  const wrap=value=>({structuredContent:value});
  tools.mcp__codex_apps__github_fetch=async({url})=>wrap(url.includes('/branches/')?{commit:{sha:head,commit:{tree:{sha:'b'.repeat(40)}}}}:[...files.keys()].map(path=>({path})));
  tools.mcp__codex_apps__github_fetch_file=async({path})=>wrap({content:files.get(path)});
  tools.mcp__codex_apps__github_create_blob=async({content})=>{const sha=createHash('sha1').update(content).digest('hex');blobs.set(sha,content);return wrap({sha});};
  tools.mcp__codex_apps__github_create_tree=async({tree_elements})=>{tree=tree_elements;return wrap({sha:'c'.repeat(40)});};
  tools.mcp__codex_apps__github_create_commit=async()=>wrap({sha:'d'.repeat(40)});
  tools.mcp__codex_apps__github_update_ref=async args=>{assert.equal(args.force,false);assert.equal(args.expected_sha,head);refWrites++;head=args.sha;tree.forEach(e=>files.set(e.path,blobs.get(e.sha)));if(lost)throw new Error('reply lost after successful write');return wrap({sha:head});};
 }
 tools.exec_command=async({cmd})=>{
  if(cmd.startsWith('node -e ')){
   writes++;if(deny)return{exit_code:1,output:'path unavailable'};
   const encoded=cmd.split(' ').at(-1);assert.ok(encoded.length<=24000);assert.ok(cmd.length<32767);
   execFileSync(process.execPath,['-e',Buffer.from(encoded,'base64').toString('utf8')],{windowsHide:true});
   return{exit_code:0,output:''};
  }
  if(cmd.includes('market_sync_io.mjs chunk')){const offset=Number(cmd.split(' ').at(-2));return{exit_code:0,output:JSON.stringify({total:request.length,data:request.slice(offset,offset+8000)})};}
  if(cmd.includes('sync_market_views.mjs')){workers++;return{session_id:1,output:JSON.stringify({type:'rpc',requestFile,responseFile})};}
  throw new Error('Unexpected shell command');
 };
 tools.write_stdin=async()=>({output:JSON.stringify({type:'result',status:'done'})});
 try{
  const execute=()=>vm.runInNewContext(source.replace(/const root = .*?;/,'const root = '+JSON.stringify(root)+';'),{tools,text:v=>logs.push(v),store:()=>{},load:()=>repair});
  await execute();if(lost)await execute();
  const response=await fs.readFile(responseFile,'utf8').catch(()=>null);
  return{logs,workers,writes,response,refWrites};
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
test('native bridge round trips Unicode using paths with spaces, without a REPL',async()=>{
 const body=Array.from({length:18000},(_,i)=>i+'中文😀'+(i*7919).toString(36)).join('\n');
 const r=await run({body});assert.equal(r.workers,1);assert.ok(r.writes>2);assert.equal(JSON.parse(r.response).results[0].structuredContent.content,body);assert.equal(r.logs.at(-1).status,'done');
});
test('failed atomic mailbox preflight never starts a waiting worker',async()=>{
 const r=await run({deny:true});assert.equal(r.workers,0);assert.equal(r.logs[0].stage,'bridge-preflight');assert.equal(r.response,null);
});
test('missing connector fails before starting the worker',async()=>{
 const r=await run({missing:true});assert.equal(r.workers,0);assert.equal(r.writes,0);assert.match(r.logs[0].error,/connector tool missing/);
});
test('explicit repair mode commits atomically and recovers an unknown ref result by readback',async()=>{
 const r=await run({repair:[{path:'scripts/market_sync_bridge.js',content:'reviewed repair 中文'}],lost:true});
 assert.equal(r.workers,0);assert.equal(r.refWrites,1);assert.equal(r.logs[0].status,'failed');assert.equal(r.logs.at(-1).status,'repair-verified');
});
test('repair mode rejects files outside the repair allowlist',async()=>{
 const r=await run({repair:[{path:'data/research/library.json',content:'invalid'}]});assert.equal(r.refWrites,0);assert.equal(r.workers,0);assert.match(r.logs[0].error,/Invalid bridge repair/);
});
