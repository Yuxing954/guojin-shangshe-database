(async function(){
  'use strict';
  const D=SiteData,M=ResearchModel,L=ResearchLibrary,$=id=>document.getElementById(id),size=12;
  const archive=new Set(),batches=new Map(),params=new URLSearchParams(location.search);
  let entries=[],filtered=[],kind=['digest','views','minutes','all_views'].includes(params.get('kind'))?params.get('kind'):params.get('asset')?'minutes':params.get('topic')||params.get('record')?'views':'digest',page=1,manifest,sync={},range='',articleRequest=0,library={},briefData={briefs:[]};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let libraryScope=params.get('scope')==='all'||params.get('state')==='awaiting_file'?'all':'archived';
  function entry(r,k){const published=r['时间']||r['日期']||'';return {kind:k,title:r['标题']||'',published,date:published.slice(0,10),content:r['内容']||r['摘要']||'',author:r['作者']||'',sector:r['覆盖板块']||'',company:r['相关标的']||'',url:D.link(r['原文链接']||r['下载链接']),file:r['文件名']||'',batch:r['更新批次']||'',truncated:!!r['正文已截断'],state:r['内容状态']||''};}
  function unique(records){const seen=new Set();return records.filter(r=>{const key=(r.url||r.published+'|'+r.title)+'|'+r.file;if(seen.has(key))return false;seen.add(key);return true;});}
  async function batchRows(path){if(!batches.has(path))batches.set(path,D.table(path).catch(e=>{batches.delete(path);throw e;}));return batches.get(path);}
  function filters(){return {kind,q:$('search').value,sector:$('sector').value,format:kind==='minutes'?$('format').value:'',state:kind==='minutes'?$('processing-state').value:'',scope:kind==='minutes'?libraryScope:'',from:$('from').value,to:$('to').value};}
  function saveUrl(record){const f=filters(),p=new URLSearchParams();if(kind!=='digest')p.set('kind',kind);for(const key of ['q','sector','format','state','scope','from','to'])if(f[key])p.set(key,f[key]);if(range)p.set('range',range);if($('sort').value==='asc')p.set('sort','asc');if(record){const id=M.topic(record);if(id)p.set('topic',id);else p.set('record',record.title);if(record.file)p.set('file',record.file);if(record.id)p.set('asset',record.id);}history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}
  function renderBriefs(f,invalid){
    const briefs=invalid?[]:briefData.briefs.filter(r=>L.briefMatches(r,f)).sort((a,b)=>$('sort').value==='asc'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
    $('count').textContent=briefs.length+' 条已整理观点 · 每条可追溯原文';
    $('digest-note').textContent=briefData.note||'摘要暂未整理；可切换到观点原文。';
    $('briefs').innerHTML=briefs.map(r=>'<article class="research-brief"><div class="portal-research-meta"><span class="portal-tag">'+D.esc(M.sectors.find(s=>s[0]===r.sector)?.[1]||r.sector)+'</span><time>'+D.esc(r.date)+'</time><span>原文已核对</span></div><h2>'+D.esc(r.title)+'</h2><p>'+D.esc(r.conclusion)+'</p><ul class="brief-evidence">'+r.evidence.map(e=>'<li>'+D.esc(e.text)+'</li>').join('')+'</ul><p class="brief-boundary"><strong>分歧 / 边界</strong> '+D.esc(r.boundary)+'</p><div class="brief-watch" aria-label="后续验证指标">'+r.watch.map(w=>'<span>'+D.esc(w)+'</span>').join('')+'</div><div class="brief-sources">'+r.sources.map(s=>'<a href="'+D.esc(L.topicHref(s))+'">阅读依据：'+D.esc(s.title)+' →</a>').join('')+'</div></article>').join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':'这个范围暂无已整理摘要')+'</p><p class="portal-note">可查看观点原文或消费资料，已收录资料不会被自动当成市场共识。</p><button class="portal-button" data-go-kind="views">查看观点原文</button> <button class="portal-button" data-go-kind="minutes">查看消费资料</button></div>';
    $('freshness').textContent='最近整理 '+(briefData.updatedAt||'暂无');
  }
  function render(){
    const f=filters(),invalid=f.from&&f.to&&f.from>f.to;
    $('library-scope').hidden=kind!=='minutes';
    $('library-scope').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===libraryScope)));
    const batch=library.ingestedBatch;
    $('ingestion-note').hidden=!batch||kind!=='digest';
    if(batch){const downloads=(library.records||[]).filter(r=>L.storageLink(r)).length;$('ingestion-note').innerHTML='<span><strong>'+D.esc(batch.originals)+' 份纪要</strong> · '+D.esc(downloads)+' 份可下载</span>'+(kind==='digest'?'<button class="research-reset" data-open-minutes>进入纪要文库 →</button>':'<span>'+D.esc(batch.date)+' 更新</span>');}
    document.querySelector('main').classList.toggle('research-summary-mode',kind==='digest');
    document.querySelector('main').classList.toggle('research-minutes-mode',kind==='minutes');
    $('briefs').hidden=$('digest-note').hidden=kind!=='digest';$('results').hidden=kind==='digest';
    $('library-stats').hidden=true;
    if(kind==='minutes')$('library-note').textContent=libraryScope==='archived'?'点击下载打开 OneDrive，无需登录；已有摘要可按需阅读。':'未取得原件的资料仅保留线索，下载开放后进入纪要文库。';
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
      const title=r.library?.processing.summaryOnly?r.title.replace(/^\d{8}\s*/, '').replace(/\.docx$/i,''):r.title;
      const download=r.library&&L.storageLink(r.library);
      const actions='<button class="research-read" data-entry="'+((page-1)*size+i)+'" aria-label="'+D.esc((r.library?.processing.textAvailable?'阅读摘要':type==='view'||type==='text'?'阅读':'查看资料')+'：'+r.title)+'">'+(r.library?.processing.textAvailable?'阅读摘要':type==='view'||type==='text'?'阅读':'查看资料')+' →</button>'+(download?'<a class="minute-download" href="'+D.esc(download)+'" target="_blank" rel="noopener noreferrer" aria-label="'+D.esc('下载原件：'+r.title)+'">下载原件 ↗</a>':'');
      return '<article class="portal-research-item"><div class="research-item-main"><div class="portal-research-meta"><time datetime="'+D.esc(r.published)+'">'+D.esc(r.library?.dateStatus==='needs_review'?'会议日期待核对':r.date||'日期待补充')+'</time>'+(kind!=='minutes'&&r.author?'<span>'+D.esc(r.author)+'</span>':'')+(tag?'<span class="portal-tag">'+D.esc(tag)+'</span>':'')+state+(r.library?.documentType?'<span>'+D.esc(r.library.documentType)+'</span>':'')+'</div><button class="portal-research-title" data-entry="'+((page-1)*size+i)+'">'+D.esc(title||'未命名内容')+'</button><p class="portal-research-summary">'+D.esc(summary)+'</p></div><div class="minute-actions">'+actions+'</div></article>';
    }).join('')||'<div class="portal-empty"><p>'+(invalid?'开始日期不能晚于结束日期':kind==='minutes'&&f.state?'当前范围暂无这种处理状态的资料':'没有找到匹配内容')+'</p><p class="portal-note">'+(kind==='minutes'?'试试更换行业、资料类型或处理状态。未读取的附件不作为已整理纪要。':'试试更换关键词、放宽时间，或加载更早观点。')+'</p><button class="portal-button" data-reset>重置筛选</button></div>';
    $('results').innerHTML=kind==='minutes'&&filtered.length?'<table class="minute-table"><caption class="sr-only">纪要列表</caption><thead><tr><th scope="col">纪要名称</th><th scope="col">日期</th><th scope="col">板块</th><th scope="col">操作</th></tr></thead><tbody>'+resultRows+'</tbody></table>':resultRows;
    $('count').textContent=filtered.length+' '+(kind==='minutes'?'份资料':'条观点')+(f.q?' · “'+f.q.trim()+'”':'');
    $('page-label').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;
    $('archive').hidden=archive.has(kind)||kind==='minutes';
    $('source-note').textContent=kind==='minutes'?'文件名日期不代表已核对会议日期；原件登记不自动生成摘要或录音转写。':archive.has(kind)?'已加载全部历史观点；搜索覆盖已收录正文。':'当前搜索近期标题、公司与内容预览；加载历史后可搜索更多正文。';
    if(kind==='minutes')$('library-stats').innerHTML='<span>原件已归档 '+filtered.filter(r=>r.library&&L.hasStoredOriginal(r.library)).length+'</span><span>可读摘要 / 文字 '+filtered.filter(r=>r.library?.processing.textAvailable||M.format(r)==='text').length+'</span><span>待获取原件 '+filtered.filter(r=>r.library?.processing.status==='awaiting_file'||!r.library&&r.state).length+'</span><span>录音 '+filtered.filter(r=>M.format(r)==='audio').length+'</span>';
    const latest=entries.filter(r=>r.kind===kind).map(r=>r.date).sort().at(-1);
    $('freshness').textContent=kind==='minutes'&&(library.indexUpdatedAt||batch)?'纪要更新 '+(library.indexUpdatedAt||batch.date):latest?'最新内容 '+latest:'暂无已收录内容';
    $('freshness').title='最近同步 '+(sync.syncedAt||'尚无同步记录').slice(0,19).replace('T',' ');
    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
    $('clear').disabled=!f.q&&!f.sector&&!f.format&&!f.state&&!f.from&&!f.to&&$('sort').value==='desc';
    saveUrl();
  }
  function minuteRow(r,index){
    const original=r.library&&L.storageLink(r.library),readable=r.library?.processing.textAvailable||M.format(r)==='text';
    const title=r.title.replace(/^\d{8}\s*/, '').replace(/\.(docx?|pdf|mp3|m4a|wav|aac|flac|ogg|wma|mp4)$/i,'');
    const date=r.library?.dateStatus==='needs_review'?'日期待核对':r.date||'暂无日期';
    const sectors=M.sectorIds(r).map(id=>M.sectors.find(s=>s[0]===id)?.[1]||id).slice(0,2).join(' / ')||'未分类';
    const name=readable?'<button class="minute-title" data-entry="'+index+'" aria-label="'+D.esc('查看纪要：'+r.title)+'">'+D.esc(title)+'</button>':'<span class="minute-title">'+D.esc(title)+'</span>';
    const warning=r.library?.processing.status==='needs_review'?'<span class="minute-warning">有待核对项</span>':'';
    const actions=(original?'<a class="minute-download" href="'+D.esc(original)+'" target="_blank" rel="noopener noreferrer" aria-label="'+D.esc('下载原件：'+r.title)+'">下载 ↗</a>':'<span class="portal-subtle">下载未开放</span>')+(readable?'<button class="research-read" data-entry="'+index+'" aria-label="'+D.esc('阅读摘要：'+r.title)+'">摘要</button>':!original?'<button class="research-read" data-entry="'+index+'">来源</button>':'');
    return '<tr><td><div class="minute-name">'+name+'<span class="minute-extension">'+D.esc((r.library?.extension||M.format(r)).toUpperCase())+'</span>'+warning+'</div></td><td class="minute-date">'+D.esc(date)+(r.library?.dateStatus==='filename'?'<small>文件日期</small>':'')+'</td><td class="minute-sector">'+D.esc(sectors)+'</td><td><div class="minute-row-actions">'+actions+'</div></td></tr>';
  }
  function showBody(r,full){
    const type=M.format(r),attachment=type==='audio'||type==='document';
    if(r.library){
      $('article-body').textContent='';$('article-files').hidden=false;
      $('article-note').textContent=r.library.processing.status==='original_only'?'原件已登记，可直接下载；摘要按需整理。':r.library.processing.summaryOnly?(r.library.processing.status==='reviewed'?'根据Word纪要整理的摘要，已审阅。':'根据Word纪要整理的摘要，待审阅。')+'原文与历史预测保留当时语境，未独立核对公告或录音。':r.library.processing.textAvailable?'已获取文字；提取或转写内容保留原始页码、时间段，观点总结须另行核对。':L.hasStoredOriginal(r.library)?'原件已存 OneDrive，文字尚未整理；客户访问范围由 OneDrive 权限决定。':'当前是附件索引，未读取原文件，尚无可用正文或转写。';
      $('article-files').innerHTML='<div class="library-detail-summary"><span>'+D.esc(r.library.extension.toUpperCase())+'</span><span>'+D.esc(L.bytes(r.library.bytes))+'</span><span>'+D.esc(L.duration(r.library.durationSeconds))+'</span><span>'+D.esc(L.states[r.library.processing.status]||'待核对')+'</span></div><p class="library-file-note">'+D.esc(r.file)+'</p>'+(r.library.processing.summaryOnly||r.library.processing.status==='original_only'?'':'<p class="library-prep">'+(type==='audio'?'处理路径：获取录音 → 转写并保留时间段 → 核对数字与说话人 → 整理观点。':'处理路径：获取文档 → 提取正文并保留定位 → 核对表格与数据 → 整理观点。')+'</p>')+'<div id="processed-content"></div><div class="library-action-links">'+M.sectorIds(r).map(id=>'<a href="research.html?sector='+encodeURIComponent(id)+'">查看'+D.esc(M.sectors.find(s=>s[0]===id)?.[1]||id)+'市场观点 →</a>').join('')+'</div>';
      const originalUrl=L.storageLink(r.library);
      if(originalUrl)$('article-files').insertAdjacentHTML('afterbegin','<div class="minute-original"><a class="portal-button" href="'+D.esc(originalUrl)+'" target="_blank" rel="noopener noreferrer">下载原件 ↗</a><span>在 OneDrive 文件页选择“下载”保存'+D.esc(r.library.extension.toUpperCase())+'文件'+(r.library.storage.audience==='public'?' · 无需登录':'')+'</span></div>');
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
    $('article-meta').textContent=[r.library?.dateStatus==='needs_review'?'会议日期待核对':r.published.replace('T',' '),r.author,r.company].filter(Boolean).join(' · ');
    showBody(r,false);$('article-source').hidden=!r.url;$('article-source').href=r.url||'#';
    $('article-source').textContent=r.kind==='minutes'?(M.format(r)==='text'?'下载完整纪要 ↗':'进入来源查看附件 ↗'):'查看原始来源 ↗';
    $('article-dialog').showModal();$('article-dialog').scrollTop=0;saveUrl(r);
    if(r.library?.processing.textAvailable&&L.safeLocalPath(r.library.processing.contentPath)){
      try{const data=await D.json(r.library.processing.contentPath);if(request!==articleRequest)return;
        if(data.assetId!==r.id)throw Error('Processed file mismatch');
        const content=$('processed-content');
        if(data.type==='pdf')content.innerHTML=(data.pages||[]).map(p=>'<details class="library-processed-section"><summary>第 '+D.esc(p.page)+' 页</summary><div class="library-page-text">'+D.esc(p.text)+'</div></details>').join('');
        else if(data.type==='meeting_summary')content.innerHTML='<section class="meeting-summary"><h3>核心摘要</h3><p>'+D.esc(data.summary)+'</p><h3>后续跟踪</h3><p>'+D.esc(data.watch)+'</p>'+(data.qualityIssues?.length?'<h3>待核对问题</h3><ul>'+data.qualityIssues.map(q=>'<li>'+D.esc(q.detail)+'</li>').join('')+'</ul>':'')+'<details class="library-processed-section"><summary>查看摘要依据 · '+D.esc(data.evidenceLocator)+'</summary>'+data.evidence.map(e=>'<div class="library-segment"><span class="portal-tag">抽取行 '+D.esc(e.line)+'</span><p class="library-page-text">'+D.esc(e.excerpt)+'</p></div>').join('')+'</details></section>';
        else content.innerHTML='<p class="library-file-note">'+D.esc(data.reviewed?'已核对转写':'自动转写初稿，数字与说话人待核对')+'</p>'+(data.segments||[]).map(s=>'<div class="library-segment"><span class="portal-tag">'+D.esc(L.duration(s.start))+'</span><p class="library-page-text">'+D.esc((s.speaker?s.speaker+'：':'')+s.text)+'</p></div>').join('');
      }catch(e){if(request===articleRequest)$('article-note').textContent='整理文字暂时无法读取，可重试或查看原始来源。';}
    }
    if(r.batch&&Object.values(sync.files||{}).flat().includes(r.batch)&&M.format(r)==='view'){
      try{const rows=await batchRows(r.batch);const full=rows.map(row=>entry(row,r.kind)).find(row=>row.url===r.url&&row.file===r.file);if(request!==articleRequest)return;if(!full)throw Error('record missing');showBody(full,true);}
      catch(e){if(request===articleRequest)$('article-note').textContent='完整正文暂时无法读取，当前显示内容预览，可查看原始来源。';}
    }
  }
  function reset(){['search','sector','format','processing-state','from','to'].forEach(id=>$(id).value='');$('sort').value='desc';range='';libraryScope='archived';page=1;render();}
  function select(k){kind=k;page=1;$('format').hidden=$('library-note').hidden=kind!=='minutes';$('processing-state').hidden=true;$('research-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));render();}
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
  $('ingestion-note').onclick=e=>{if(e.target.closest('[data-open-minutes]')){reset();select('minutes');}};
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
    if(library.records)entries=L.mergeEntries(entries,library.records.map(L.entry),M.topic);
    if(!libraryResult||!briefResult)$('status').textContent='部分整理数据暂时无法读取，现有观点原文仍可浏览。';
    if(libraryResult&&briefResult)$('status').textContent='';$('content').hidden=false;select(kind);
    if(params.get('topic')||params.get('record')||params.get('asset')){
      const find=()=>entries.find(r=>r.kind===kind&&(params.get('topic')?(r.library?.sourceTopics||[M.topic(r)]).includes(params.get('topic')):!params.get('record')||[r.title,...(r.legacyTitles||[])].includes(params.get('record')))&&(!params.get('file')||r.file===params.get('file')||params.get('file').split('；').includes(r.file))&&(!params.get('asset')||(r.library?.aliases||[r.id]).includes(params.get('asset'))));
      let record=find();
      if(!record&&kind!=='minutes'){try{$('status').textContent='正在查找历史观点…';await loadArchive(kind);record=find();render();$('status').textContent='';}catch(e){$('status').textContent='历史观点暂时无法加载，请稍后重试。';}}
      if(record)await openRecord(record);else $('status').textContent='未找到这条内容，可通过公司或关键词查找。';
    }
  }catch(e){$('status').innerHTML='研究文库暂时无法读取。<button class="portal-button" onclick="location.reload()">重试</button>';}
})();

