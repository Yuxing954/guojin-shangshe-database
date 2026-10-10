(async function(){
  'use strict';
  const D=SiteData,M=ResearchModel,L=ResearchLibrary,$=id=>document.getElementById(id),size=12;
  const archive=new Set(),batches=new Map(),loadedRecent=new Set(),params=new URLSearchParams(location.search);
  let entries=[],filtered=[],kind=['digest','views','minutes','all_views'].includes(params.get('kind'))?params.get('kind'):params.get('asset')?'minutes':params.get('topic')||params.get('record')?'views':'digest',page=1,manifest,sync={},range='',articleRequest=0,library={},briefData={briefs:[]},recentMeta={dbs:[]},recentFull=null;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let libraryScope=params.get('scope')==='all'||params.get('state')==='awaiting_file'?'all':'archived';
  function entry(r,k,sourceKind=k){const published=r['原始发布时间']||r['时间']||r['日期']||'';return {kind:k,sourceKind,title:r['标题']||'',published,date:published.slice(0,10),content:r['内容']||r['摘要']||'',author:r['作者']||'',sector:r['覆盖板块']||'',company:r['相关标的']||'',url:D.link(r['原文链接']||r['下载链接']),file:r['文件名']||'',batch:r['更新批次']||'',truncated:!!r['正文已截断'],state:r['内容状态']||''};}
  function recentEntries(snapshot,requested){return (snapshot.dbs||[]).filter(db=>db.id!=='minutes'||requested==='minutes').flatMap(db=>db.rows.flatMap(r=>db.id==='views'?[entry(r,'views'),entry(r,'all_views','views')]:[entry(r,db.id)])).filter(r=>r.kind===requested);}
  function unique(records){
    const seen=new Set(),seenStampTitle=new Set(),seenBody=new Set();
    return records.filter(r=>{
      const market=r.kind==='views'||r.kind==='all_views';
      const topic=String(r.url||'').match(/\/topic\/(\d+)/)?.[1]||'';
      const key=topic?'topic:'+topic:(r.url||((r.published||'')+'|'+(r.title||'')))+'|'+(r.file||'');
      if(seen.has(key))return false;
      if(market){
        const stampTitle=(r.published||'')+'|'+(r.title||'');
        const body=String(r.content||'').replace(/\r\n?/g,'\n').trim();
        if(seenStampTitle.has(stampTitle)||(body&&seenBody.has(body)))return false;
        seenStampTitle.add(stampTitle);
        if(body)seenBody.add(body);
      }
      seen.add(key);
      return true;
    });
  }

  function briefPublished(r){return (r.sources||[]).map(s=>s.publishedAt).filter(Boolean).sort((a,b)=>M.publicationTime(a).localeCompare(M.publicationTime(b))).at(-1)||r.date||'';}
  async function batchRows(path){if(!batches.has(path))batches.set(path,D.table(path).catch(e=>{batches.delete(path);throw e;}));return batches.get(path);}
  function filters(){return {kind,q:$('search').value,sector:$('sector').value,format:kind==='minutes'?$('format').value:'',state:kind==='minutes'?$('processing-state').value:'',scope:kind==='minutes'?libraryScope:'',from:$('from').value,to:$('to').value};}
  function saveUrl(record){const f=filters(),p=new URLSearchParams();if(kind!=='digest')p.set('kind',kind);for(const key of ['q','sector','format','state','scope','from','to'])if(f[key])p.set(key,f[key]);if(range)p.set('range',range);if($('sort').value==='asc')p.set('sort','asc');if(record){const id=M.topic(record);if(id)p.set('topic',id);else p.set('record',record.title);if(record.file)p.set('file',record.file);if(record.id)p.set('asset',record.id);}history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}
  function renderBriefs(f,invalid){
    const briefs=invalid?[]:briefData.briefs.filter(r=>L.briefMatches(r,f)).sort((a,b)=>$('sort').value==='asc'?M.publicationTime(briefPublished(a)).localeCompare(M.publicationTime(briefPublished(b))):M.publicationTime(briefPublished(b)).localeCompare(M.publicationTime(briefPublished(a))));
    $('count').textContent=briefs.length+' 条观点';
    $('briefs').innerHTML=briefs.map(r=>'<article class="research-brief"><div class="portal-research-meta"><span class="portal-tag">'+D.esc(M.sectors.find(s=>s[0]===r.sector)?.[1]||r.sector)+'</span><time datetime="'+D.esc(briefPublished(r))+'">'+D.esc('原文发布：'+M.publicationTime(briefPublished(r)))+'</time></div><h2>'+D.esc(r.title)+'</h2><p>'+D.esc(r.conclusion)+'</p><ul class="brief-evidence">'+r.evidence.map(e=>'<li>'+D.esc(e.text)+'</li>').join('')+'</ul><p class="brief-boundary"><strong>分歧 / 边界</strong> '+D.esc(r.boundary)+'</p><div class="brief-watch" aria-label="后续验证指标">'+r.watch.map(w=>'<span>'+D.esc(w)+'</span>').join('')+'</div><div class="brief-sources">'+r.sources.map(s=>'<a href="'+D.esc(L.topicHref(s))+'">阅读原文：'+D.esc(s.title)+' · '+D.esc('发布 '+M.publicationTime(s.publishedAt||s.date))+' →</a>').join('')+'</div></article>').join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':'这个范围暂无已整理摘要')+'</p><button class="portal-button" data-go-kind="views">查看观点原文</button></div>';
    $('freshness').textContent='最近整理 '+(briefData.updatedAt||'暂无');
  }
  function render(){
    const f=filters(),invalid=f.from&&f.to&&f.from>f.to;
    $('library-scope').hidden=kind!=='minutes';
    $('library-scope').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===libraryScope)));
    const batch=library.ingestedBatch;
    document.querySelector('main').classList.toggle('research-summary-mode',kind==='digest');
    document.querySelector('main').classList.toggle('research-minutes-mode',kind==='minutes');
    $('briefs').hidden=kind!=='digest';$('results').hidden=kind==='digest';
    $('library-stats').hidden=true;
    $('recent-more').hidden=kind==='digest'||loadedRecent.has(kind)||!((recentMeta.dbs||[]).some(db=>(kind==='all_views'?db.id==='all_views':db.id===kind)&&(db.availableRows||db.keptRows||db.rows?.length||0)>(db.rows||[]).length));
    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
    $('clear').disabled=!f.q&&!f.sector&&!f.format&&!f.state&&!f.from&&!f.to&&$('sort').value==='desc';
    if(kind==='digest'){renderBriefs(f,invalid);saveUrl();return;}
    filtered=invalid?[]:entries.filter(r=>r.library?r.kind===f.kind&&L.matches(r.library,f):M.matches(r,f)&&(!f.state||f.state==='awaiting_file'&&r.state)&&!(kind==='minutes'&&libraryScope==='archived')).sort((a,b)=>$('sort').value==='asc'?(a.sortDate||a.published).localeCompare(b.sortDate||b.published):(b.sortDate||b.published).localeCompare(a.sortDate||a.published));
    const pageSize=kind==='minutes'?20:size;
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);
    const resultRows=filtered.slice((page-1)*pageSize,page*pageSize).map((r,i)=>{
      if(kind==='minutes')return minuteRow(r,(page-1)*pageSize+i);
      const type=M.format(r),sectors=M.sectorIds(r).map(id=>M.sectors.find(s=>s[0]===id)?.[1]||id);
      const tag=kind==='minutes'?sectors.slice(0,2).join(' / ')||M.labels[type]:sectors.slice(0,2).join(' / ');
      const summary=r.library?.processing.summaryOnly?r.library.processing.summary:r.library?[type==='audio'?'会议录音':'研究文档',L.duration(r.library.durationSeconds),L.bytes(r.library.bytes),r.library.processing?.summary||'原文件尚未整理；可查看来源和处理进度。'].filter(Boolean).join(' · '):kind==='minutes'?(type==='audio'?'会议录音 · 原件待获取，尚未转写':type==='document'?'研究文档 · 原件待获取':M.preview(r)||'纪要摘要，可在站内阅读'):M.preview(r);
      const state=r.library?'<span class="library-state '+(r.library.processing.status==='needs_review'?'library-warning':r.library.processing.status==='reviewed'?'library-ready':'')+'">'+D.esc(r.library.processing.summaryOnly?(r.library.processing.status==='needs_review'?'有口径待核对':r.library.processing.status==='reviewed'?'已审阅摘要':'摘要初稿'):L.states[r.library.processing.status]||'处理状态待核对')+'</span>':kind==='minutes'&&r.state?'<span class="library-state">待获取原件</span>':'';
      const title=r.title;
      const download=r.library&&L.storageLink(r.library);
      const actions='<button class="research-read" data-entry="'+((page-1)*size+i)+'" aria-label="'+D.esc((r.library?.processing.textAvailable?'阅读摘要':type==='view'||type==='text'?'阅读':'查看资料')+'：'+r.title)+'">'+(r.library?.processing.textAvailable?'阅读摘要':type==='view'||type==='text'?'阅读':'查看资料')+' →</button>'+(download?'<a class="minute-download" href="'+D.esc(download)+'" target="_blank" rel="noopener noreferrer" aria-label="'+D.esc('下载原件：'+r.title)+'">下载原件 ↗</a>':'');
      return '<article class="portal-research-item"><div class="research-item-main"><div class="portal-research-meta"><time datetime="'+D.esc(r.published)+'">'+D.esc(r.library?.dateStatus==='needs_review'?'会议日期待核对':kind==='minutes'?r.date||'日期待补充':'发布 '+M.publicationTime(r.published))+'</time>'+(kind!=='minutes'&&r.author?'<span>'+D.esc(r.author)+'</span>':'')+(tag?'<span class="portal-tag">'+D.esc(tag)+'</span>':'')+state+(r.library?.documentType?'<span>'+D.esc(r.library.documentType)+'</span>':'')+'</div><button class="portal-research-title" data-entry="'+((page-1)*size+i)+'">'+D.esc(title||'未命名内容')+'</button><p class="portal-research-summary">'+D.esc(summary)+'</p></div><div class="minute-actions">'+actions+'</div></article>';
    }).join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':kind==='minutes'&&f.state?'当前范围暂无这种处理状态的资料':'没有找到匹配内容')+'</p><p class="portal-note">'+(kind==='minutes'?'更换筛选条件':'更换筛选条件')+'</p><button class="portal-button" data-reset>重置筛选</button></div>';
    $('results').innerHTML=kind==='minutes'&&filtered.length?'<table class="minute-table"><caption class="sr-only">纪要列表</caption><thead><tr><th scope="col">纪要名称</th><th scope="col">日期</th><th scope="col">板块</th><th scope="col">操作</th></tr></thead><tbody>'+resultRows+'</tbody></table>':resultRows;
    $('count').textContent=filtered.length+' '+(kind==='minutes'?'份资料':'条观点')+(f.q?' · “'+f.q.trim()+'”':'');
    $('page-label').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;
    $('archive').hidden=archive.has(kind)||kind==='minutes';
    $('source-note').textContent=kind==='minutes'?'':archive.has(kind)?'已加载全部历史':'近期观点';$('source-note').hidden=!$('source-note').textContent;
    if(kind==='minutes')$('library-stats').innerHTML='<span>原件已归档 '+filtered.filter(r=>r.library&&L.hasStoredOriginal(r.library)).length+'</span><span>可读摘要 / 文字 '+filtered.filter(r=>r.library?.processing.textAvailable||M.format(r)==='text').length+'</span><span>待获取原件 '+filtered.filter(r=>r.library?.processing.status==='awaiting_file'||!r.library&&r.state).length+'</span><span>录音 '+filtered.filter(r=>M.format(r)==='audio').length+'</span>';
    const latest=entries.filter(r=>r.kind===kind).map(r=>kind==='minutes'?r.date:M.publicationTime(r.published)).sort().at(-1);
    $('freshness').textContent=kind==='minutes'&&(library.indexUpdatedAt||batch)?'纪要更新 '+(library.indexUpdatedAt||batch.date):latest?(kind==='minutes'?'最新内容 ':'最新发布 ')+latest+(kind==='minutes'?'':'（北京时间）'):'暂无已收录内容';
    $('freshness').title='最近同步 '+(sync.syncedAt||'尚无同步记录').slice(0,19).replace('T',' ');
    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
    $('clear').disabled=!f.q&&!f.sector&&!f.format&&!f.state&&!f.from&&!f.to&&$('sort').value==='desc';
    saveUrl();
  }
  function minuteRow(r,index){
    const original=r.library&&L.storageLink(r.library),readable=!!(r.library?.processing.preview||r.library?.processing.textAvailable)||M.format(r)==='text';
    const title=r.title;
    const date=r.library?.dateStatus==='needs_review'?'日期待核对':r.date||'暂无日期';
    const sectors=M.sectorIds(r).map(id=>M.sectors.find(s=>s[0]===id)?.[1]||id).slice(0,2).join(' / ')||'未分类';
    const name=readable?'<button class="minute-title" data-entry="'+index+'" aria-label="'+D.esc('查看纪要：'+r.title)+'">'+D.esc(title)+'</button>':'<span class="minute-title">'+D.esc(title)+'</span>';
    const warning=r.library?.processing.status==='needs_review'?'<span class="minute-warning">有待核对项</span>':'';
    const actions=(original?'<a class="minute-download" href="'+D.esc(original)+'" target="_blank" rel="noopener noreferrer" aria-label="'+D.esc('下载原件：'+r.title)+'">下载 ↗</a>':'<span class="portal-subtle">下载未开放</span>')+(readable?'<button class="research-read" data-entry="'+index+'" aria-label="'+D.esc('预览纪要：'+r.title)+'">预览</button>':!original?'<button class="research-read" data-entry="'+index+'">来源</button>':'');
    return '<tr><td><div class="minute-name">'+name+'<span class="minute-extension">'+D.esc((r.library?.extension||M.format(r)).toUpperCase())+'</span>'+warning+'</div></td><td class="minute-date">'+D.esc(date)+(r.library?.dateStatus==='filename'?'<small>文件日期</small>':'')+'</td><td class="minute-sector">'+D.esc(sectors)+'</td><td><div class="minute-row-actions">'+actions+'</div></td></tr>';
  }
  function showBody(r,full){
    const type=M.format(r),attachment=type==='audio'||type==='document';
    $('article-body').textContent=attachment?'':r.content||'此条记录尚无正文，请查看原始来源。';
    $('article-files').hidden=!attachment;
    $('article-files').innerHTML=attachment?'<p class="portal-note">原始文件</p><ul>'+String(r.file||r.title).split('；').map(name=>'<li>'+D.esc(name)+'</li>').join('')+'</ul>':'';
    $('article-note').textContent=attachment?(type==='audio'?'会议音频 · 未转写':'附件 · 未提取正文'):type==='text'?'纪要摘要':full?'完整正文 · '+(sync.sourceName||'研究文库'):r.truncated?'内容预览':'原文';
  }
  async function openMinute(r,request){
    $('article-kind').hidden=true;
    $('article-title').textContent=r.title;
    $('article-meta').textContent=r.library?.dateStatus==='needs_review'?'日期待确认':r.date||'';
    $('article-files').hidden=true;$('article-files').innerHTML='';
    $('article-body').textContent='正在读取原文预览…';$('article-note').hidden=true;
    const download=r.library&&L.storageLink(r.library);
    $('article-source').hidden=!(download||r.url);$('article-source').href=download||r.url||'#';
    $('article-source').textContent=download?'下载完整纪要 ↗':'查看原始来源 ↗';
    $('article-dialog').showModal();$('article-dialog').scrollTop=0;saveUrl(r);
    try{
      let data={preview:r.library?.processing.preview||'',previewTruncated:!!r.library?.processing.previewTruncated};
      if(!data.preview&&r.library?.processing.textAvailable&&L.safeLocalPath(r.library.processing.contentPath)){
        data=await D.json(r.library.processing.contentPath);
        if(data.assetId!==r.id)throw Error('Preview file mismatch');
      }
      if(request!==articleRequest)return;
      const preview=L.preview(data);
      $('article-note').hidden=!preview.text;
      $('article-note').textContent=preview.truncated?'原文前500字':'原文预览';
      $('article-body').textContent=preview.text+(preview.truncated?'…':'')||'暂无文字预览，可打开原件查看完整纪要。';
    }catch(e){if(request===articleRequest)$('article-body').textContent='预览暂时无法读取，可下载完整纪要。';}
  }
  async function openRecord(r){
    if(!r)return;const request=++articleRequest;
    $('article-dialog').classList.toggle('minute-preview-dialog',r.kind==='minutes');
    if(r.kind==='minutes')return openMinute(r,request);
    $('article-kind').hidden=false;$('article-note').hidden=false;
    $('article-title').textContent=r.title;$('article-kind').textContent=kind==='all_views'?(r.sourceKind==='views'?'板块观点':'市场观点'):M.labels[M.format(r)];
    $('article-meta').textContent=[r.library?.dateStatus==='needs_review'?'会议日期待核对':'发布 '+M.publicationTime(r.published)+'（北京时间）',r.author,r.company].filter(Boolean).join(' · ');
    showBody(r,false);$('article-source').hidden=!r.url;$('article-source').href=r.url||'#';
    $('article-source').textContent=r.kind==='minutes'?(M.format(r)==='text'?'下载完整纪要 ↗':'进入来源查看附件 ↗'):'查看原始来源 ↗';
    $('article-dialog').showModal();$('article-dialog').scrollTop=0;saveUrl(r);
    if(r.batch&&Object.values(sync.files||{}).flat().includes(r.batch)&&M.format(r)==='view'){
      try{const rows=await batchRows(r.batch);const full=rows.map(row=>entry(row,r.sourceKind||r.kind,r.sourceKind||r.kind)).find(row=>row.url===r.url&&row.file===r.file);if(request!==articleRequest)return;if(!full)throw Error('record missing');showBody(full,true);}
      catch(e){if(request===articleRequest)$('article-note').textContent='完整正文暂时无法读取，当前显示内容预览，可查看原始来源。';}
    }
  }
  function reset(){['search','sector','format','processing-state','from','to'].forEach(id=>$(id).value='');$('sort').value='desc';range='';libraryScope='archived';page=1;render();}
  function select(k){kind=k;page=1;$('format').hidden=kind!=='minutes';$('processing-state').hidden=true;$('research-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));render();}
  $('sector').innerHTML='<option value="">全部板块</option>'+M.sectors.map(s=>'<option value="'+s[0]+'">'+s[1]+'</option>').join('');
  for(const id of ['search','sector','format','from','to'])$(id).value=params.get(id==='search'?'q':id)||'';
  $('processing-state').value=params.get('state')||'';
  $('sort').value=params.get('sort')==='asc'?'asc':'desc';
  range=['7','30'].includes(params.get('range'))?params.get('range'):params.get('from')||params.get('to')?'custom':'';
  $('more-filters').open=!!(params.get('format')||params.get('state')||params.get('from')||params.get('to')||params.get('range'));
  $('research-tabs').onclick=e=>{const b=e.target.closest('[data-kind]');if(b)select(b.dataset.kind);};
  $('search').oninput=()=>{page=1;render();};
  ['sector','format','processing-state','sort'].forEach(id=>$(id).onchange=()=>{if(id==='processing-state'&&$('processing-state').value==='awaiting_file')libraryScope='all';page=1;render();});
  $('library-scope').onclick=e=>{const b=e.target.closest('[data-scope]');if(b){libraryScope=b.dataset.scope;page=1;render();}};
  $('briefs').onclick=e=>{const b=e.target.closest('[data-go-kind]');if(b)select(b.dataset.goKind);};
  ['from','to'].forEach(id=>$(id).onchange=()=>{range=$('from').value||$('to').value?'custom':'';page=1;render();});
  $('ranges').onclick=e=>{const b=e.target.closest('[data-range]');if(!b)return;range=b.dataset.range;$('from').value=range?M.lowerDate(today,range):'';$('to').value=range?today:'';page=1;render();};
  $('clear').onclick=reset;
  $('results').onclick=e=>{if(e.target.closest('[data-reset]'))return reset();const b=e.target.closest('[data-entry]');if(b)openRecord(filtered[Number(b.dataset.entry)]);};
  $('close-article').onclick=()=>{$('article-dialog').close();};
  $('article-dialog').addEventListener('close',()=>{articleRequest++;saveUrl();});
  function move(delta){page+=delta;render();$('results').scrollIntoView({block:'start',behavior:'smooth'});}
  $('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);
  $('recent-more').onclick=async()=>{const requested=kind,button=$('recent-more');button.disabled=true;button.textContent='正在读取更多近期内容…';$('status').textContent='';try{if(!recentFull)recentFull=await D.json('data/research/recent.json');entries=entries.filter(r=>r.kind!==requested).concat(unique(recentEntries(recentFull,requested)));if(requested==='minutes'){library=await D.json('data/research/library.json').catch(()=>library);if(library.records)entries=L.mergeEntries(entries,library.records.map(L.entry),M.topic);}loadedRecent.add(requested);render();}catch(e){$('status').textContent='更多近期内容暂时无法读取，可重试；当前列表仍可浏览。';}finally{button.disabled=false;button.textContent='读取更多近期内容';}};
  async function loadArchive(requested){
    const sourceIds=requested==='all_views'?['views','all_views']:[requested];
    const loaded=await Promise.all(sourceIds.map(async id=>{
      const source=manifest.datasets.find(d=>d.id===id);
      const [all,...updates]=await Promise.all([D.table(source.file),...(sync.files?.[id]||[]).map(batchRows)]);
      const reassigned=new Set(sync.assignedTopics?.[id==='views'?'all_views':'views']||[]);
      return updates.flat().concat(all.filter(r=>!reassigned.has((D.link(r['原文链接']).match(/\/topic\/(\d+)/)||[])[1]))).map(r=>entry(r,requested,id));
    }));
    entries=entries.filter(r=>r.kind!==requested).concat(unique(loaded.flat()));archive.add(requested);loadedRecent.add(requested);
  }
  $('archive').onclick=async()=>{const requested=kind,button=$('archive');button.disabled=true;button.textContent='正在加载历史观点…';$('status').textContent='';try{await loadArchive(requested);render();}catch(e){$('status').textContent='历史观点暂时无法加载，可重试；近期内容仍可浏览。';}finally{button.disabled=false;button.textContent='加载更早观点';}};
  try{
    manifest=await D.json('data-manifest.json');
    const [recent,updates,briefResult]=await Promise.all([D.json('data/research/recent-preview.json'),D.json('data/research/updates/manifest.json'),D.json('data/research/market-briefs.json').catch(()=>null)]);
    recentMeta=recent;sync=updates;if(briefResult)briefData=briefResult;
    entries=recent.dbs.flatMap(db=>db.rows.flatMap(r=>db.id==='views'?[entry(r,'views'),entry(r,'all_views','views')]:[entry(r,db.id)]));
    entries=entries.filter(r=>r.kind!=='all_views').concat(unique(entries.filter(r=>r.kind==='all_views')));
    if(!briefResult)$('status').textContent='观点摘要暂时无法读取，近期观点原文仍可浏览。';
    if(briefResult)$('status').textContent='';$('content').hidden=false;select(kind);
    if(params.get('topic')||params.get('record')||params.get('asset')){
      const find=()=>entries.find(r=>r.kind===kind&&(params.get('topic')?(r.library?.sourceTopics||[M.topic(r)]).includes(params.get('topic')):!params.get('record')||[r.title,...(r.legacyTitles||[])].includes(params.get('record')))&&(!params.get('file')||r.file===params.get('file')||params.get('file').split('；').includes(r.file))&&(!params.get('asset')||(r.library?.aliases||[r.id]).includes(params.get('asset'))));
      let record=find();
      if(!record){try{$('status').textContent='正在查找历史观点…';await loadArchive(kind);if(kind==='minutes'){library=await D.json('data/research/library.json').catch(()=>library);if(library.records)entries=L.mergeEntries(entries,library.records.map(L.entry),M.topic);}record=find();render();$('status').textContent='';}catch(e){$('status').textContent='历史观点暂时无法加载，请稍后重试。';}}
      if(record)await openRecord(record);else $('status').textContent='未找到这条内容，可通过公司或关键词查找。';
    }
  }catch(e){$('status').innerHTML='研究文库暂时无法读取。<button class="portal-button" onclick="location.reload()">重试</button>';}
})();
