// Run with await eval(fileText) inside functions.exec. All GitHub calls use the connector.
(async()=>{
 const root='C:/Users/daiyu/Documents/Codex/2026-10-08/referenced-chatgpt-conversation-this-is-an-2';
 const dir=root+'/work/library-refresh/upload', repo='Yuxing954/guojin-shangshe-database';
 const shell=async cmd=>{const r=await tools.exec_command({cmd,workdir:root,max_output_tokens:40000});if(r.exit_code!==0)throw Error('Local library upload I/O failed');return r.output;};
 const read=async expr=>JSON.parse(await shell('node -e "const fs=require(\'fs\');const p=JSON.parse(fs.readFileSync(\'work/library-refresh/upload/plan.json\',\'utf8\'));process.stdout.write(JSON.stringify('+expr+'))"'));
 const spec=await read('({manifest:p.manifest,count:p.entries.length})');
 let state=JSON.parse(await shell('node -e "const fs=require(\'fs\');const f=\'work/library-refresh/upload/checkpoint.json\';process.stdout.write(fs.existsSync(f)?fs.readFileSync(f,\'utf8\'):\'{}\')"'));
 const save=async()=>{const r=await tools.apply_patch('*** Begin Patch\n*** Add File: '+dir+'/checkpoint.json\n+'+JSON.stringify(state)+'\n*** End Patch');};
 const call=async(name,args)=>{const r=await tools[name](args);if(r.isError)throw Error(name+': '+JSON.stringify(r.content));const s=r.structuredContent;return typeof s?.content==='string'?JSON.parse(s.content):s;};
 if(state.batchId&&state.batchId!==spec.manifest.batchId)throw Error('Upload checkpoint belongs to a different batch');
 state.batchId=spec.manifest.batchId;state.blobs??={};
 const head=await call('mcp__codex_apps__github_fetch',{url:'https://api.github.com/repos/'+repo+'/branches/main'});
 const activate=async()=>{
  const entry=await read('p.entries.find(e=>e.path.endsWith(\'/manifest.json\'))');
  const result=await call('mcp__codex_apps__github_update_file',{repository_full_name:repo,branch:'main',path:entry.path,sha:state.blobs[entry.path],content:entry.content+'\n',message:'research: activate verified library upload '+state.batchId});
  state.activationCommit=result.commit_sha;state.stage='submitted';await save();
  text({status:'submitted',commit:state.activationCommit,batchId:state.batchId});
 };
 if(state.activationCommit){text({status:state.stage,commit:state.activationCommit,batchId:state.batchId});return;}
 if(state.commit&&head.commit.sha===state.commit){await activate();return;}
 if(state.head&&head.commit.sha!==state.head)throw Error('Main changed; retain upload and reconcile before publishing');
 const listing=await call('mcp__codex_apps__github_fetch',{url:'https://api.github.com/repos/'+repo+'/contents/data/research?ref='+head.commit.sha});
 if(listing.find(f=>f.name==='library.json')?.sha!==spec.manifest.baseBlobSha)throw Error('Library changed since scan; no write');
 state.head=head.commit.sha;state.baseTree=head.commit.commit.tree.sha;await save();
 for(let i=0;i<spec.count;i++){
  const entry=await read('p.entries['+i+']');
  if(state.blobs[entry.path])continue;
  if(entry.content.length>40000)throw Error('Upload entry exceeds bounded connector payload');
  const b=await call('mcp__codex_apps__github_create_blob',{repository_full_name:repo,encoding:'utf-8',content:entry.content});
  if(!b?.sha)throw Error('Missing blob SHA');state.blobs[entry.path]=b.sha;await save();
 }
 if(!state.tree){const t=await call('mcp__codex_apps__github_create_tree',{repository_full_name:repo,base_tree_sha:state.baseTree,tree_elements:Object.entries(state.blobs).map(([path,sha])=>({path,mode:'100644',type:'blob',sha}))});state.tree=t.sha;await save();}
 if(!state.commit){const c=await call('mcp__codex_apps__github_create_commit',{repository_full_name:repo,parent_sha:state.head,tree_sha:state.tree,message:'research: repair large library writes with verified chunk uploads'});state.commit=c.sha;await save();}
 await call('mcp__codex_apps__github_update_ref',{repository_full_name:repo,branch_name:'main',expected_sha:state.head,force:false,sha:state.commit});
 state.stage='uploaded';await save();await activate();
})()

