(async function(){
  'use strict';
  const D=SiteData,M=ResearchModel,L=ResearchLibrary,$=id=>document.getElementById(id),size=12;
  const archive=new Set(),batches=new Map(),params=new URLSearchParams(location.search);
  let entries=[],filtered=[],kind=['digest','views','minutes','all_views'].includes(params.get('kind'))?params.get('kind'):params.get('topic')||params.get('record')?'views':'digest',page=1,manifest,sync={},range='',articleRequest=0,library={},briefData={briefs:[]};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function entry(r,k){const published=r['时间']||r['日期']||'';return {kind:k,title:r['标题']||'',published,date:published.slice(0,10),content:r['内容']||r['摘要']||'',author:r['作者']||'',sector:r['覆盖板块']||'',company:r['相关标的']||'',url:D.link(r['原文链接']||r['下载链接']),file:r['文件名']||'',batch:r['更新批次']||'',truncated:!!r['正文已截断'],state:r['内容状态']||''};}
  function unique(records){const seen=new Set();return records.filter(r=>{const key=(r.url||r.published+'|'+r.title)+'|'+r.file;if(seen.has(key))return false;seen.add(key);return true;});}
  async function batchRows(path){if(!batches.has(path))batches.set(path,D.table(path).catch(e=>{batches.delete(path);throw e;}));return batches.get(path);}
  function filters(){return {kind,q:$('search').value,sector:$('sector').value,format:kind==='minutes'?$('format').value:'',state:kind==='minutes'?$('processing-state').value:'',from:$('from').value,to:$('to').value};}
  function saveUrl(record){const f=filters(),p=new URLSearchParams();if(kind!=='digest')p.set('kind',kind);for(const key of ['q','sector','format','state','from','to'])if(f[key])p.set(key,f[key]);if(range)p.set('range',range);if($('sort').value==='asc')p.set('sort','asc');if(record){const id=M.topic(record);if(id)p.set('topic',id);else p.set('record',record.title);if(record.file)p.set('file',record.file);if(record.id)p.set('asset',record.id);}history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}
  function renderBriefs(f,invalid){
    const briefs=invalid?[]:briefData.briefs.filter(r=>L.briefMatches(r,f)).sort((a,b)=>$('sort').value==='asc'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
    $('count').textContent=briefs.length+' 条已整理观点 · 每条可追溯原文';
    $('digest-note').textContent=briefData.note||'摘要暂未整理；可切换到观点原文。';
    $('briefs').innerHTML=briefs.map(r=>'<article class="research-brief"><div class="portal-research-meta"><span class="portal-tag">'+D.esc(M.sectors.find(s=>s[0]===r.sector)?.[1]||r.sector)+'</span><time>'+D.esc(r.date)+'</time><span>原文已核对</span></div><h2>'+D.esc(r.title)+'</h2><p>'+D.esc(r.conclusion)+'</p><ul class="brief-evidence">'+r.evidence.map(e=>'<li>'+D.esc(e.text)+'</li>').join('')+'</ul><p class="brief-boundary"><strong>分歧 / 边界</strong> '+D.esc(r.boundary)+'</p><div class="brief-watch" aria-label="后续验证指标">'+r.watch.map(w=>'<span>'+D.esc(w)+'</span>').join('')+'</div><div class="brief-sources">'+r.sources.map(s=>'<a href="'+D.esc(L.topicHref(s))+'">阅读依据：'+D.esc(s.title)+' →</a>').join('')+'</div></article>').join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':'这个范围暂无已整理摘要')+'</p><p class="portal-note">可查看观点原文或消费资料，已收录资料不会被自动当成市场共识。</p><button class="portal-button" data-go-kind="views">查看观点原文</button> <button class="portal-button" data-go-kind="minutes">查看消费资料</button></div>';
    $('freshness').textContent='最近整理 '+(briefData.updatedAt||'暂无');
  }
  function render(){
    const f=filters(),invalid=f.from&&f.to&&f.from>f.to;
    document.querySelector('main').classList.toggle('research-summary-mode',kind==='digest');
    $('briefs').hidden=$('digest-note').hidden=kind!=='digest';$('results').hidden=kind==='digest';
    $('library-stats').hidden=kind!=='minutes';
    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
    $('clear').disabled=!f.q&&!f.sector&&!f.format&&!f.state&&!f.from&&!f.to&&$('sort').value==='desc';
    if(kind==='digest'){renderBriefs(f,invalid);saveUrl();return;}
    filtered=invalid?[]:entries.filter(r=>r.library?r.kind===f.kind&&L.matches(r.library,f):M.matches(r,f)&&!f.state).sort((a,b)=>$('sort').value==='asc'?a.published.localeCompare(b.published):b.published.localeCompare(a.published));
    const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    $('results').innerHTML=filtered.slice((page-1)*size,page*size).map((r,i)=>{
      const type=M.format(r),sectors=M.sectorIds(r).map(id=>M.sectors.find(s=>s[0]===id)[1]);
      const tag=kind==='minutes'?M.labels[type]:sectors.slice(0,2).join(' / ');
      const summary=r.library?[type==='audio'?'会议录音':'研究文档',L.duration(r.library.durationSeconds),L.bytes(r.library.bytes),r.library.processing?.summary||(L.hasStoredOriginal(r.library)?'原件已存 OneDrive；文字内容按处理状态核对。':'原文件尚未获取；可查看来源和处理进度。')].filter(Boolean).join(' · '):kind==='minutes'?(type==='audio'?'会议录音 · 尚未转写，打开来源收听':type==='document'?'研究文档 · 打开来源查看附件':M.preview(r)||'纪要摘要，可在站内阅读'):M.preview(r);
      const state=r.library?'<span class="library-state '+(r.library.processing.textAvailable?'library-ready':'')+'">'+D.esc(L.states[r.library.processing.status]||'处理状态待核对')+'</span>':'';
      return '<article class="portal-research-item"><div class="research-item-main"><div class="portal-research-meta"><time datetime="'+D.esc(r.published)+'">'+D.esc(r.date||'日期待补充')+'</time>'+(r.author?'<span>'+D.esc(r.author)+'</span>':'')+(tag?'<span class="portal-tag">'+D.esc(tag)+'</span>':'')+state+'</div><button class="portal-research-title" data-entry="'+((page-1)*size+i)+'">'+D.esc(r.title||'未命名内容')+'</button><p class="portal-research-summary">'+D.esc(summary)+'</p></div><button class="research-read" data-entry="'+((page-1)*size+i)+'" aria-label="'+D.esc((type==='view'||type==='text'?'阅读':'查看资料')+'：'+r.title)+'">'+(r.library?.processing.textAvailable?'阅读整理':type==='view'||type==='text'?'阅读':'查看资料')+' →</button></article>';
    }).join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':kind==='minutes'&&f.state?'当前范围暂无这种处理状态的资料':'没有找到匹配内容')+'</p><p class="portal-note">'+(kind==='minutes'?'试试更换行业、资料类型或处理状态。未读取的附件不作为已整理纪要。':'试试更换关键词、放宽时间，或加载更早观点。')+'</p><button class="portal-button" data-reset>重置筛选</button></div>';
    $('count').textContent=filtered.length+' 条'+(kind==='minutes'?'资料':'观点')+(f.q?' · “'+f.q.trim()+'”':'');
    $('page-label').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;
    $('archive').hidden=archive.has(kind)||kind==='minutes';
    $('source-note').textContent=kind==='minutes'?'资料范围 '+(library.coverage?.from||'待补充')+' — '+(library.coverage?.to||'').slice(0,10)+'，不代表星球全部历史。待获取附件仅搜索文件名；已提取文字可搜索正文。':archive.has(kind)?'已加载全部历史观点；搜索覆盖已收录正文。':'当前搜索近期标题、公司与内容预览；加载历史后可搜索更多正文。';
    if(kind==='minutes')$('library-stats').innerHTML=['document','audio'].map(t=>'<span>'+D.esc(t==='audio'?'会议录音':'PDF与文档')+' '+filtered.filter(r=>M.format(r)===t).length+'</span>').join('')+'<span>可读文字 '+filtered.filter(r=>r.library?.processing.textAvailable||M.format(r)==='text').length+'</span><span>录音转写与PDF正文按处理状态核对</span>';
    const latest=entries.filter(r=>r.kind===kind).map(r=>r.date).sort().at(-1);
    $('freshness').textContent=latest?'最新内容 '+latest:'暂无已收录内容';
    $('freshness').title='最近同步 '+(sync.syncedAt||'尚无同步记录').slice(0,19).replace('T',' ');
    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
    $('clear').disabled=!f.q&&!f.sector&&!f.format&&!f.state&&!f.from&&!f.to&&$('sort').value==='desc';
    saveUrl();
  }
  function showBody(r,full){
    const type=M.format(r),attachment=type==='audio'||type==='document';
    if(r.library){
      $('article-body').textContent='';$('article-files').hidden=false;
      $('article-note').textContent=r.library.processing.textAvailable?'已获取文字；提取或转写内容保留原始页码、时间段，观点总结须另行核对。':L.hasStoredOriginal(r.library)?'原件已存 OneDrive，文字尚未整理；客户访问范围由 OneDrive 权限决定。':'当前是附件索引，未读取原文件，尚无可用正文或转写。';
      $('article-files').innerHTML='<div class="library-detail-summary"><span>'+D.esc(r.library.extension.toUpperCase())+'</span><span>'+D.esc(L.bytes(r.library.bytes))+'</span><span>'+D.esc(L.duration(r.library.durationSeconds))+'</span><span>'+D.esc(L.states[r.library.processing.status]||'待核对')+'</span></div><p class="library-file-note">'+D.esc(r.file)+'</p><p class="library-prep">'+(type==='audio'?'处理路径：获取录音 → 转写并保留时间段 → 核对数字与说话人 → 整理观点。':'处理路径：获取PDF → 提取正文并保留页码 → 核对表格与数据 → 整理观点。')+'</p><div id="processed-content"></div><div class="library-action-links">'+M.sectorIds(r).map(id=>'<a href="research.html?sector='+encodeURIComponent(id)+'">查看'+D.esc(M.sectors.find(s=>s[0]===id)?.[1]||id)+'市场观点 →</a>').join('')+'</div>';
      const originalUrl=L.storageLink(r.library);
      if(originalUrl)$('article-files').insertAdjacentHTML('afterbegin','<p><a class="portal-button" href="'+D.esc(originalUrl)+'" target="_blank" rel="noopener noreferrer">查看 OneDrive 原件 ↗</a></p>');
      else if(L.hasStoredOriginal(r.library))$('article-files').insertAdjacentHTML('afterbegin','<p class="portal-note">原件已入库，客户原件入口尚未开放。</p>');
      return;
    }
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
    if(r.library?.processing.textAvailable&&L.safeLocalPath(r.library.processing.contentPath)){
      try{const data=await D.json(r.library.processing.contentPath);if(request!==articleRequest)return;
        if(data.assetId!==r.id)throw Error('Processed file mismatch');
        const content=$('processed-content');
        if(data.type==='pdf')content.innerHTML=(data.pages||[]).map(p=>'<details class="library-processed-section"><summary>第 '+D.esc(p.page)+' 页</summary><div class="library-page-text">'+D.esc(p.text)+'</div></details>').join('');
        else content.innerHTML='<p class="library-file-note">'+D.esc(data.reviewed?'已核对转写':'自动转写初稿，数字与说话人待核对')+'</p>'+(data.segments||[]).map(s=>'<div class="library-segment"><span class="portal-tag">'+D.esc(L.duration(s.start))+'</span><p class="library-page-text">'+D.esc((s.speaker?s.speaker+'：':'')+s.text)+'</p></div>').join('');
      }catch(e){if(request===articleRequest)$('article-note').textContent='整理文字暂时无法读取，可重试或查看原始来源。';}
    }
    if(r.batch&&Object.values(sync.files||{}).flat().includes(r.batch)&&M.format(r)==='view'){
      try{const rows=await batchRows(r.batch);const full=rows.map(row=>entry(row,r.kind)).find(row=>row.url===r.url&&row.file===r.file);if(request!==articleRequest)return;if(!full)throw Error('record missing');showBody(full,true);}
      catch(e){if(request===articleRequest)$('article-note').textContent='完整正文暂时无法读取，当前显示内容预览，可查看原始来源。';}
    }
  }
  function reset(){['search','sector','format','processing-state','from','to'].forEach(id=>$(id).value='');$('sort').value='desc';range='';page=1;render();}
  function select(k){kind=k;page=1;$('format').hidden=$('processing-state').hidden=$('library-note').hidden=kind!=='minutes';$('research-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));render();}
  $('sector').innerHTML='<option value="">全部板块</option>'+M.sectors.map(s=>'<option value="'+s[0]+'">'+s[1]+'</option>').join('');
  for(const id of ['search','sector','format','from','to'])$(id).value=params.get(id==='search'?'q':id)||'';
  $('processing-state').value=params.get('state')||'';
  $('sort').value=params.get('sort')==='asc'?'asc':'desc';
  range=['7','30'].includes(params.get('range'))?params.get('range'):params.get('from')||params.get('to')?'custom':'';
  $('research-tabs').onclick=e=>{const b=e.target.closest('[data-kind]');if(b)select(b.dataset.kind);};
  $('search').oninput=()=>{page=1;render();};
  ['sector','format','processing-state','sort'].forEach(id=>$(id).onchange=()=>{page=1;render();});
  $('briefs').onclick=e=>{const b=e.target.closest('[data-go-kind]');if(b)select(b.dataset.goKind);};
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
    const [recent,minutes,updates,libraryResult,briefResult]=await Promise.all([D.json('data/research/recent.json'),D.table(manifest.datasets.find(d=>d.id==='minutes').file),D.json('data/research/updates/manifest.json'),D.json('data/research/library.json').catch(()=>null),D.json('data/research/market-briefs.json').catch(()=>null)]);
    if(libraryResult)library=libraryResult;if(briefResult)briefData=briefResult;
    sync=updates;const minuteUpdates=(await Promise.all((sync.files?.minutes||[]).map(batchRows))).flat();
    entries=recent.dbs.filter(db=>db.id!=='minutes').flatMap(db=>db.rows.map(r=>entry(r,db.id))).concat(unique(minuteUpdates.concat(minutes).map(r=>entry(r,'minutes'))));
    if(library.records){const assets=library.records.map(L.entry);entries=entries.filter(r=>r.kind!=='minutes'||!assets.some(a=>(a.library.sourceTopics||[M.topic(a)]).includes(M.topic(r))&&String(r.file).split('；').some(name=>name===a.file))).concat(assets);}
    if(!libraryResult||!briefResult)$('status').textContent='部分整理数据暂时无法读取，现有观点原文仍可浏览。';
    if(libraryResult&&briefResult)$('status').textContent='';$('content').hidden=false;select(kind);
    if(params.get('topic')||params.get('record')){
      const find=()=>entries.find(r=>r.kind===kind&&(params.get('topic')?(r.library?.sourceTopics||[M.topic(r)]).includes(params.get('topic')):r.title===params.get('record'))&&(!params.get('file')||r.file===params.get('file')||params.get('file').split('；').includes(r.file))&&(!params.get('asset')||(r.library?.aliases||[r.id]).includes(params.get('asset'))));
      let record=find();
      if(!record&&kind!=='minutes'){try{$('status').textContent='正在查找历史观点…';await loadArchive(kind);record=find();render();$('status').textContent='';}catch(e){$('status').textContent='历史观点暂时无法加载，请稍后重试。';}}
      if(record)await openRecord(record);else $('status').textContent='未找到这条内容，可通过公司或关键词查找。';
    }
  }catch(e){$('status').innerHTML='研究文库暂时无法读取。<button class="portal-button" onclick="location.reload()">重试</button>';}
})();
