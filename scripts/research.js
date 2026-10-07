(async function(){
  'use strict';
  const D=SiteData,M=ResearchModel,$=id=>document.getElementById(id),size=12;
  const archive=new Set(),batches=new Map(),params=new URLSearchParams(location.search);
  let entries=[],filtered=[],kind=['views','minutes','all_views'].includes(params.get('kind'))?params.get('kind'):'views',page=1,manifest,sync={},range='',articleRequest=0;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function entry(r,k){const published=r['时间']||r['日期']||'';return {kind:k,title:r['标题']||'',published,date:published.slice(0,10),content:r['内容']||r['摘要']||'',author:r['作者']||'',sector:r['覆盖板块']||'',company:r['相关标的']||'',url:D.link(r['原文链接']||r['下载链接']),file:r['文件名']||'',batch:r['更新批次']||'',truncated:!!r['正文已截断'],state:r['内容状态']||''};}
  function unique(records){const seen=new Set();return records.filter(r=>{const key=(r.url||r.published+'|'+r.title)+'|'+r.file;if(seen.has(key))return false;seen.add(key);return true;});}
  async function batchRows(path){if(!batches.has(path))batches.set(path,D.table(path).catch(e=>{batches.delete(path);throw e;}));return batches.get(path);}
  function filters(){return {kind,q:$('search').value,sector:$('sector').value,format:kind==='minutes'?$('format').value:'',from:$('from').value,to:$('to').value};}
  function saveUrl(record){const f=filters(),p=new URLSearchParams();if(kind!=='views')p.set('kind',kind);for(const key of ['q','sector','format','from','to'])if(f[key])p.set(key,f[key]);if(range)p.set('range',range);if($('sort').value==='asc')p.set('sort','asc');if(record){const id=M.topic(record);if(id)p.set('topic',id);else p.set('record',record.title);if(record.file)p.set('file',record.file);}history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}
  function render(){
    const f=filters(),invalid=f.from&&f.to&&f.from>f.to;
    filtered=invalid?[]:entries.filter(r=>M.matches(r,f)).sort((a,b)=>$('sort').value==='asc'?a.published.localeCompare(b.published):b.published.localeCompare(a.published));
    const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    $('results').innerHTML=filtered.slice((page-1)*size,page*size).map((r,i)=>{
      const type=M.format(r),sectors=M.sectorIds(r).map(id=>M.sectors.find(s=>s[0]===id)[1]);
      const tag=kind==='minutes'?M.labels[type]:sectors.slice(0,2).join(' / ');
      const summary=kind==='minutes'?(type==='audio'?'会议录音 · 尚未转写，打开来源收听':type==='document'?'研究文档 · 打开来源查看附件':M.preview(r)||'纪要摘要，可在站内阅读'):M.preview(r);
      return '<article class="portal-research-item"><div class="research-item-main"><div class="portal-research-meta"><time datetime="'+D.esc(r.published)+'">'+D.esc(r.date||'日期待补充')+'</time>'+(r.author?'<span>'+D.esc(r.author)+'</span>':'')+(tag?'<span class="portal-tag">'+D.esc(tag)+'</span>':'')+'</div><button class="portal-research-title" data-entry="'+((page-1)*size+i)+'">'+D.esc(r.title||'未命名内容')+'</button><p class="portal-research-summary">'+D.esc(summary)+'</p></div><button class="research-read" data-entry="'+((page-1)*size+i)+'" aria-label="'+D.esc((type==='view'||type==='text'?'阅读':'查看资料')+'：'+r.title)+'">'+(type==='view'||type==='text'?'阅读':'查看资料')+' →</button></article>';
    }).join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':'没有找到匹配内容')+'</p><p class="portal-note">试试更换关键词、放宽时间，或加载更早观点。</p><button class="portal-button" data-reset>重置筛选</button></div>';
    $('count').textContent=filtered.length+' 条'+(kind==='minutes'?'资料':'观点')+(f.q?' · “'+f.q.trim()+'”':'');
    $('page-label').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;
    $('archive').hidden=archive.has(kind)||kind==='minutes';
    $('source-note').textContent=kind==='minutes'?'已展示全部已收录纪要与附件':archive.has(kind)?'已加载全部历史观点；搜索覆盖已收录正文。':'当前搜索近期标题、公司与内容预览；加载历史后可搜索更多正文。';
    const latest=entries.filter(r=>r.kind===kind).map(r=>r.date).sort().at(-1);
    $('freshness').textContent=latest?'最新内容 '+latest:'暂无已收录内容';
    $('freshness').title='最近同步 '+(sync.syncedAt||'尚无同步记录').slice(0,19).replace('T',' ');
    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
    $('clear').disabled=!f.q&&!f.sector&&!f.format&&!f.from&&!f.to&&$('sort').value==='desc';
    saveUrl();
  }
  function showBody(r,full){
    const type=M.format(r),attachment=type==='audio'||type==='document';
    $('article-body').textContent=attachment?'':r.content||'此条记录尚无正文，请查看原始来源。';
    $('article-files').hidden=!attachment;
    $('article-files').innerHTML=attachment?'<p class="portal-note">原始文件</p><ul>'+String(r.file||r.title).split('；').map(name=>'<li>'+D.esc(name)+'</li>').join('')+'</ul>':'';
    $('article-note').textContent=attachment?(type==='audio'?'这是会议音频，尚未转写为文字纪要。请进入来源收听。':'这是研究附件索引，尚未提取文档正文。请进入来源查看。'):type==='text'?'当前为纪要摘要；完整纪要请查看原文件。':full?'完整正文 · '+(sync.sourceName||'研究文库'):r.truncated?'当前为内容预览；完整内容请查看原始来源。':'来源内容按原文展示';
  }
  async function openRecord(r){
    if(!r)return;const request=++articleRequest;
    $('article-title').textContent=r.title;$('article-kind').textContent=kind==='all_views'?'其他市场观点':M.labels[M.format(r)];
    $('article-meta').textContent=[r.published.replace('T',' '),r.author,r.company].filter(Boolean).join(' · ');
    showBody(r,false);$('article-source').hidden=!r.url;$('article-source').href=r.url||'#';
    $('article-source').textContent=r.kind==='minutes'?(M.format(r)==='text'?'下载完整纪要 ↗':'进入来源查看附件 ↗'):'查看原始来源 ↗';
    $('article-dialog').showModal();$('article-dialog').scrollTop=0;saveUrl(r);
    if(r.batch&&Object.values(sync.files||{}).flat().includes(r.batch)&&M.format(r)==='view'){
      try{const rows=await batchRows(r.batch);const full=rows.map(row=>entry(row,r.kind)).find(row=>row.url===r.url&&row.file===r.file);if(request!==articleRequest)return;if(!full)throw Error('record missing');showBody(full,true);}
      catch(e){if(request===articleRequest)$('article-note').textContent='完整正文暂时无法读取，当前显示内容预览，可查看原始来源。';}
    }
  }
  function reset(){['search','sector','format','from','to'].forEach(id=>$(id).value='');$('sort').value='desc';range='';page=1;render();}
  function select(k){kind=k;page=1;$('format').hidden=$('library-note').hidden=kind!=='minutes';$('research-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));render();}
  $('sector').innerHTML='<option value="">全部板块</option>'+M.sectors.map(s=>'<option value="'+s[0]+'">'+s[1]+'</option>').join('');
  for(const id of ['search','sector','format','from','to'])$(id).value=params.get(id==='search'?'q':id)||'';
  $('sort').value=params.get('sort')==='asc'?'asc':'desc';
  range=['7','30'].includes(params.get('range'))?params.get('range'):params.get('from')||params.get('to')?'custom':'';
  $('research-tabs').onclick=e=>{const b=e.target.closest('[data-kind]');if(b)select(b.dataset.kind);};
  $('search').oninput=()=>{page=1;render();};
  ['sector','format','sort'].forEach(id=>$(id).onchange=()=>{page=1;render();});
  ['from','to'].forEach(id=>$(id).onchange=()=>{range=$('from').value||$('to').value?'custom':'';page=1;render();});
  $('ranges').onclick=e=>{const b=e.target.closest('[data-range]');if(!b)return;range=b.dataset.range;$('from').value=range?M.lowerDate(today,range):'';$('to').value=range?today:'';page=1;render();};
  $('clear').onclick=reset;
  $('results').onclick=e=>{if(e.target.closest('[data-reset]'))return reset();const b=e.target.closest('[data-entry]');if(b)openRecord(filtered[Number(b.dataset.entry)]);};
  $('close-article').onclick=()=>{$('article-dialog').close();};
  $('article-dialog').addEventListener('close',()=>{articleRequest++;saveUrl();});
  function move(delta){page+=delta;render();$('results').scrollIntoView({block:'start',behavior:'smooth'});}
  $('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);
  async function loadArchive(requested){
    const source=manifest.datasets.find(d=>d.id===requested);
    const [all,...updates]=await Promise.all([D.table(source.file),...(sync.files?.[requested]||[]).map(batchRows)]);
    const reassigned=new Set(sync.assignedTopics?.[requested==='views'?'all_views':'views']||[]);
    const combined=unique(updates.flat().concat(all.filter(r=>!reassigned.has((D.link(r['原文链接']).match(/\/topic\/(\d+)/)||[])[1]))).map(r=>entry(r,requested)));
    entries=entries.filter(r=>r.kind!==requested).concat(combined);archive.add(requested);
  }
  $('archive').onclick=async()=>{const requested=kind,button=$('archive');button.disabled=true;button.textContent='正在加载历史观点…';$('status').textContent='';try{await loadArchive(requested);render();}catch(e){$('status').textContent='历史观点暂时无法加载，可重试；近期内容仍可浏览。';}finally{button.disabled=false;button.textContent='加载更早观点';}};
  try{
    manifest=await D.json('data-manifest.json');
    const [recent,minutes,updates]=await Promise.all([D.json('data/research/recent.json'),D.table(manifest.datasets.find(d=>d.id==='minutes').file),D.json('data/research/updates/manifest.json')]);
    sync=updates;const minuteUpdates=(await Promise.all((sync.files?.minutes||[]).map(batchRows))).flat();
    entries=recent.dbs.filter(db=>db.id!=='minutes').flatMap(db=>db.rows.map(r=>entry(r,db.id))).concat(unique(minuteUpdates.concat(minutes).map(r=>entry(r,'minutes'))));
    $('status').textContent='';$('content').hidden=false;select(kind);
    if(params.get('topic')||params.get('record')){
      const find=()=>entries.find(r=>r.kind===kind&&(params.get('topic')?M.topic(r)===params.get('topic'):r.title===params.get('record'))&&(!params.get('file')||r.file===params.get('file')));
      let record=find();
      if(!record&&kind!=='minutes'){try{$('status').textContent='正在查找历史观点…';await loadArchive(kind);record=find();render();$('status').textContent='';}catch(e){$('status').textContent='历史观点暂时无法加载，请稍后重试。';}}
      if(record)await openRecord(record);else $('status').textContent='未找到这条内容，可通过公司或关键词查找。';
    }
  }catch(e){$('status').innerHTML='研究文库暂时无法读取。<button class="portal-button" onclick="location.reload()">重试</button>';}
})();
