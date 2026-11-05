// Execute this file inside functions.exec, where the connected tools are available.
(async () => {
  const root = "C:/Users/daiyu/Documents/Codex/2026-10-08/referenced-chatgpt-conversation-this-is-an-2/work/market-sync-rewrite";
  const state = root + '/state';
  const pack = text => {
    const binary=encodeURIComponent(text).replace(/%([A-F0-9]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
    let dictionary=new Map(),next=256,phrase='',bytes=[];
    const emit=code=>{bytes.push(code>>>8,code&255);};
    const codeOf=value=>value.length===1?value.charCodeAt(0):dictionary.get(value);
    for(const char of binary){const combined=phrase+char;if(!phrase||dictionary.has(combined)){phrase=combined;continue;}emit(codeOf(phrase));if(next<65535)dictionary.set(combined,next++);else{emit(65535);dictionary=new Map();next=256;}phrase=char;}
    if(phrase)emit(codeOf(phrase));
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let encoded='';
    for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2];encoded+=alphabet[a>>>2]+alphabet[((a&3)<<4)|((b||0)>>>4)]+(i+1<bytes.length?alphabet[((b&15)<<2)|((c||0)>>>6)]:'=')+(i+2<bytes.length?alphabet[c&63]:'=');}
    return encoded;
  };
  const unpackMailbox = function(buffer){
    let dictionary=[],next=256,previous='',parts=[];
    for(let i=0;i<buffer.length;i+=2){const code=buffer.readUInt16BE(i);if(code===65535){dictionary=[];next=256;previous='';continue;}const entry=code<256?String.fromCharCode(code):dictionary[code]||(code===next&&previous?previous+previous[0]:null);if(entry===null)throw new Error('Invalid compressed mailbox response');parts.push(entry);if(previous)dictionary[next++]=previous+entry[0];previous=entry;}
    return Buffer.from(parts.join(''),'latin1').toString('utf8');
  };
  const quote = s => "'" + s.replaceAll("'", "''") + "'";
  const allowed = new Set(['mcp__codex_apps__github_fetch','mcp__codex_apps__github_fetch_file','mcp__codex_apps__github_create_blob','mcp__codex_apps__github_create_tree','mcp__codex_apps__github_create_commit','mcp__codex_apps__github_update_ref']);
  const shell = args => tools.exec_command(args);
  // Probe the same writer used for connector replies before starting a worker.
  // A denied writer must never leave a worker waiting on an unreachable mailbox.
  const probe=state+'/bridge-write-probe-'+Date.now();
  // Use the same native Node writer as the worker. No REPL kernel assets are required.
  const base64 = value => {
    const binary=encodeURIComponent(value).replace(/%([A-F0-9]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let out='';
    for(let i=0;i<binary.length;i+=3){const a=binary.charCodeAt(i),b=binary.charCodeAt(i+1)||0,c=binary.charCodeAt(i+2)||0;
      out+=alphabet[a>>>2]+alphabet[((a&3)<<4)|(b>>>4)]+(i+1<binary.length?alphabet[((b&15)<<2)|(c>>>6)]:'=')+(i+2<binary.length?alphabet[c&63]:'=');}
    return out;
  };
  const send = async code => {
    const encoded=base64('(async()=>{var mailboxFs=await import("node:fs/promises");'+code+'})().catch(e=>{console.error(e.message);process.exitCode=1})');
    if(encoded.length>24000)throw new Error('Native bridge payload exceeds Windows command limit');
    const written=await shell({cmd:'node -e "eval(Buffer.from(process.argv[1],\'base64\').toString(\'utf8\'))" '+encoded,workdir:root,max_output_tokens:1000});
    if(written.exit_code!==0)throw new Error('Native bridge write failed: '+written.output);
  };
  try {
    for(const name of allowed)if(typeof tools[name]!=='function')throw new Error('Required GitHub connector tool missing: '+name);
    await send("var bridgeProbeFs=await import('node:fs/promises');await bridgeProbeFs.mkdir("+JSON.stringify(state)+",{recursive:true});await bridgeProbeFs.writeFile("+JSON.stringify(probe+'.tmp')+",'ok');await bridgeProbeFs.rename("+JSON.stringify(probe+'.tmp')+","+JSON.stringify(probe)+");await bridgeProbeFs.unlink("+JSON.stringify(probe)+");");
  } catch(error) {
    text({type:'result',status:'failed',stage:'bridge-preflight',error:String(error)});return;
  }
  // Explicit maintenance mode publishes only the bridge, its regression tests and runbook.
  // Normal scheduled runs do not set this key and always use the checkpoint worker below.
  const repair=typeof load==='function'?load('market_sync_repair_files'):null;
  if(repair){
    const repo='Yuxing954/guojin-shangshe-database';
    const paths=new Set(['scripts/market_sync_bridge.js','scripts/test_market_sync_bridge.mjs','docs/market-sync-v2.md']);
    const decode=v=>{if(v.isError)throw new Error(JSON.stringify(v).slice(0,500));const s=v.structuredContent;if(s)return typeof s.content==='string'?s.content:s;const t=v.content?.find(x=>x.type==='text')?.text;if(!t||t==='Action completed.')throw new Error('Connector payload missing');return t;};
    const call=async(name,args)=>{if(!allowed.has(name))throw new Error('Unexpected connector tool');return decode(await tools[name](args));};
    const obj=v=>typeof v==='string'?JSON.parse(v):v;
    const get=async suffix=>obj(await call('mcp__codex_apps__github_fetch',{url:'https://api.github.com/repos/'+repo+suffix}));
    const saveRepair=async value=>send('await mailboxFs.writeFile('+JSON.stringify(state+'/bridge-repair.json.tmp')+','+JSON.stringify(JSON.stringify(value,null,2))+',"utf8");await mailboxFs.rename('+JSON.stringify(state+'/bridge-repair.json.tmp')+','+JSON.stringify(state+'/bridge-repair.json')+');');
    try{
      if(!Array.isArray(repair)||!repair.length||repair.some(f=>!paths.has(f.path)||typeof f.content!=='string'))throw new Error('Invalid bridge repair file set');
      const head=await get('/branches/main');
      const changed=[];
      for(const f of repair){
        const entries=await get('/contents/'+f.path.split('/').slice(0,-1).join('/')+'?ref='+head.commit.sha);
        if(!Array.isArray(entries))throw new Error('Directory metadata missing');
        if(entries.some(e=>e.path===f.path)){
          const remote=await call('mcp__codex_apps__github_fetch_file',{repository_full_name:repo,path:f.path,ref:head.commit.sha});
          if(remote===f.content)continue;
          if(f.expectedContent!==undefined&&remote!==f.expectedContent){store('market_sync_repair_conflict',{path:f.path,remote});throw new Error('Remote repair file changed: '+f.path);}
        }
        changed.push(f);
      }
      if(!changed.length){await saveRepair({status:'verified',head:head.commit.sha,files:repair.map(f=>f.path)});text({type:'result',status:'repair-verified',head:head.commit.sha});return;}
      const entries=[];
      for(const f of changed){const b=obj(await call('mcp__codex_apps__github_create_blob',{repository_full_name:repo,content:f.content,encoding:'utf-8'}));if(!/^[a-f0-9]{40}$/.test(b.sha))throw new Error('Blob SHA missing');entries.push({path:f.path,sha:b.sha,mode:'100644',type:'blob'});await saveRepair({status:'objects',baseHead:head.commit.sha,entries});}
      const tree=obj(await call('mcp__codex_apps__github_create_tree',{repository_full_name:repo,base_tree_sha:head.commit.commit.tree.sha,tree_elements:entries}));
      const commit=obj(await call('mcp__codex_apps__github_create_commit',{repository_full_name:repo,parent_sha:head.commit.sha,tree_sha:tree.sha,message:'fix: use native Node mailbox writer with atomic preflight and bridge regression tests'}));
      await saveRepair({status:'pending-ref',baseHead:head.commit.sha,commit:commit.sha,entries});
      await call('mcp__codex_apps__github_update_ref',{repository_full_name:repo,branch_name:'main',expected_sha:head.commit.sha,sha:commit.sha,force:false});
      const after=await get('/branches/main');
      for(const f of repair){const value=await call('mcp__codex_apps__github_fetch_file',{repository_full_name:repo,path:f.path,ref:after.commit.sha});if(value!==f.content)throw new Error('Repair readback mismatch: '+f.path);}
      await saveRepair({status:'verified',commit:commit.sha,head:after.commit.sha,entries});text({type:'result',status:'repair-verified',commit:commit.sha,head:after.commit.sha});
    }catch(error){text({type:'result',status:'failed',stage:'bridge-repair',error:String(error)});}
    return;
  }
  let result = await shell({cmd: 'node scripts/sync_market_views.mjs --bridge --state ' + quote(state), workdir:root, yield_time_ms:1000, max_output_tokens:2000});
  let session = result.session_id;
  if(session)store('market_sync_worker_session', session);
  let output = result.output || '';
  for (;;) {
    if (!output.trim()) {
      if (!session) throw new Error('Market sync worker exited without a result');
      result = await tools.write_stdin({session_id:session,chars:'',yield_time_ms:5000,max_output_tokens:2000});
      output += result.output || ''; continue;
    }
    const plain=output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'');
    const messages=plain.split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('{')&&line.endsWith('}')).map(line=>JSON.parse(line));
    if(!messages.length){
      result=await tools.write_stdin({session_id:session,chars:'',yield_time_ms:5000,max_output_tokens:2000});output+=result.output||'';continue;
    }
    output = '';
    const message = messages.at(-1);
    if (message.type === 'result') {store('market_sync_last_result',message);text(message);break;}
    if (message.type !== 'rpc') throw new Error('Unexpected market sync message');
    if (!message.requestFile.replaceAll('\\','/').startsWith(state + '/outbox/')) throw new Error('Request path outside sync state');
    let requestText='',total=1;
    while(requestText.length<total){
      const read=await shell({cmd:'node scripts/market_sync_io.mjs chunk '+quote(message.requestFile)+' '+requestText.length+' 8000',workdir:root,max_output_tokens:24000});
      if(read.exit_code!==0)throw new Error('Could not read connector request');
      const part=JSON.parse(read.output);total=part.total;if(!part.data&&requestText.length<total)throw new Error('Truncated connector request');requestText+=part.data;
    }
    const requests = JSON.parse(requestText).requests;
    const responses = await Promise.allSettled(requests.map(request=>{
      if(!allowed.has(request.tool))throw new Error('Unexpected connector tool');
      return tools[request.tool](request.args);
    }));
    const response={results:responses.map(r=>{
      if(r.status!=='fulfilled')return {isError:true,content:[{type:'text',text:String(r.reason)}]};
      const v=r.value,s=v.structuredContent;
      return s?{isError:!!v.isError,structuredContent:typeof s.content==='string'?{content:s.content}:s}:{isError:!!v.isError,content:v.content};
    })};
    if(!message.responseFile.replaceAll('\\','/').startsWith(state+'/outbox/'))throw new Error('Response path outside sync state');
    const responseText=JSON.stringify(response),tmp=message.responseFile+'.tmp';
    const compressed=pack(responseText);
    if(compressed.length<responseText.length){
      const packed=tmp+'.lzw';
      for(let start=0;start<compressed.length;start+=14000){const op=start===0?'writeFile':'appendFile';await send("var mailboxFs=await import('node:fs/promises');await mailboxFs."+op+'('+JSON.stringify(packed)+',Buffer.from('+JSON.stringify(compressed.slice(start,start+14000))+',"base64"));');}
      await send('var mailboxRaw=('+unpackMailbox.toString()+')(await mailboxFs.readFile('+JSON.stringify(packed)+'));JSON.parse(mailboxRaw);await mailboxFs.writeFile('+JSON.stringify(tmp)+',mailboxRaw,"utf8");await mailboxFs.rename('+JSON.stringify(tmp)+','+JSON.stringify(message.responseFile)+');await mailboxFs.unlink('+JSON.stringify(packed)+');');
      result=await tools.write_stdin({session_id:session,chars:'',yield_time_ms:1000,max_output_tokens:2000});output+=result.output||'';continue;
    }
    const codeBytes=code=>encodeURIComponent(code).replace(/%[A-Fa-f0-9]{2}/g,'x').length;
    for(let start=0;start<responseText.length;){
      let end=Math.min(start+6000,responseText.length),code;
      for(;;){
        if(end<responseText.length&&responseText.charCodeAt(end-1)>=0xd800&&responseText.charCodeAt(end-1)<=0xdbff)end--;
        const op=start===0?'writeFile':'appendFile';
        code="var mailboxFs=await import('node:fs/promises');await mailboxFs."+op+'('+JSON.stringify(tmp)+','+JSON.stringify(responseText.slice(start,end))+',"utf8");';
        const bytes=codeBytes(code);if(bytes<=16000)break;
        end=start+Math.max(1,Math.floor((end-start)*14000/bytes));
      }
      await send(code);start=end;
    }
    await send('await mailboxFs.rename('+JSON.stringify(tmp)+','+JSON.stringify(message.responseFile)+');');
    result = await tools.write_stdin({session_id:session,chars:'',yield_time_ms:1000,max_output_tokens:2000}); output += result.output || '';
  }
})()
