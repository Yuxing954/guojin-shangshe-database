// Execute this file inside functions.exec, where the connected tools are available.
(async () => {
  const root = "C:/Users/daiyu/Documents/Codex/2026-10-08/referenced-chatgpt-conversation-this-is-an-2/work/market-sync-rewrite";
  const state = root + '/state';
  const quote = s => "'" + s.replaceAll("'", "''") + "'";
  const allowed = new Set(['mcp__codex_apps__github_fetch','mcp__codex_apps__github_fetch_file','mcp__codex_apps__github_create_blob','mcp__codex_apps__github_create_tree','mcp__codex_apps__github_create_commit','mcp__codex_apps__github_update_ref']);
  let result = await tools.exec_command({cmd: 'node scripts/sync_market_views.mjs --bridge --state ' + quote(state), workdir:root, yield_time_ms:1000, max_output_tokens:2000});
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
    const read = await tools.exec_command({cmd:'node scripts/market_sync_io.mjs read '+quote(message.requestFile),workdir:root,max_output_tokens:100000});
    if(read.exit_code!==0)throw new Error('Could not read connector request');
    const requests = JSON.parse(read.output).requests;
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
    const send=async code=>{const r=await tools.mcp__node_repl__js({code,title:'保存连接器返回数据'});if(r.isError)throw new Error(JSON.stringify(r));};
    await send("var mailboxFs=await import('node:fs/promises');await mailboxFs.writeFile("+JSON.stringify(tmp)+",'','utf8');");
    const chunkSize=/^[\x00-\x7f]*$/.test(responseText)?40000:12000;
    for(let start=0;start<responseText.length;){let end=Math.min(start+chunkSize,responseText.length);if(end<responseText.length&&responseText.charCodeAt(end-1)>=0xd800&&responseText.charCodeAt(end-1)<=0xdbff)end--;await send('await mailboxFs.appendFile('+JSON.stringify(tmp)+','+JSON.stringify(responseText.slice(start,end))+',"utf8");');start=end;}
    await send('await mailboxFs.rename('+JSON.stringify(tmp)+','+JSON.stringify(message.responseFile)+');');
    result = await tools.write_stdin({session_id:session,chars:'',yield_time_ms:1000,max_output_tokens:2000}); output += result.output || '';
  }
})()
