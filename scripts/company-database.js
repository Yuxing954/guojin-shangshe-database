(async function(){
 'use strict';
 const D=SiteData,M=CompanyDatabaseModel,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),cache=new Map();
 let catalog,sources=[],issues=[],company,rows=[],view=[],request=0,page=1;const size=24;
 const metric=id=>catalog.metrics.find(m=>m.id===id);
 const problem=o=>issues.filter(i=>i.selectedId===o.id||(i.observationIds||[]).includes(o.id)||i.observationId===o.id);
 async function loadCompany(c){if(cache.has(c.id))return cache.get(c.id);if(!c.file)return {observations:[]};const index=await D.json(c.file);const data=index.parts?{observations:(await Promise.all(index.parts.map(p=>D.json(p)))).flatMap(p=>p.observations)}:index;if(data.observations.length!==c.count)throw Error('历史数据数量不一致');cache.set(c.id,data);return data;}
 function options(id,values,wanted){$(id).innerHTML=values.map(v=>'<option value="'+D.esc(v.value)+'">'+D.esc(v.label)+'</option>').join('');if(values.some(v=>v.value===wanted))$(id).value=wanted;}
 function updateURL(){const u=new URL(location.href);u.searchParams.set('db',company.id);for(const k of ['metric','frequency','series','from','to']){const v=$('db-'+k).value;if(v)u.searchParams.set('db-'+k,v);else u.searchParams.delete('db-'+k);}for(const k of ['forecast','pending']){if($('db-'+k).checked)u.searchParams.set('db-'+k,'1');else u.searchParams.delete('db-'+k);}history.replaceState(null,'',u);}
 function setSeries(wanted){const filtered=M.filter(rows,{metric:$('db-metric').value,frequency:$('db-frequency').value,forecast:$('db-forecast').checked,pending:$('db-pending').checked});options('db-series',M.series(filtered).map(s=>({value:s.key,label:s.label})),wanted);}
 function paint(){
  const opts={metric:$('db-metric').value,frequency:$('db-frequency').value,series:$('db-series').value,from:$('db-from').value,to:$('db-to').value,forecast:$('db-forecast').checked,pending:$('db-pending').checked};
  view=opts.series?M.filter(rows,opts):[];updateURL();const m=metric(opts.metric),last=view.at(-1),actual=view.filter(o=>o.status!=='forecast'&&o.status!=='pending').at(-1);page=Math.min(page,Math.max(1,Math.ceil(view.length/size)));
  $('db-summary').innerHTML=[['指标',m?m.name:'暂无数据'],['单位',last?[last.unit,last.currency].filter(Boolean).join(' / '):'暂无数据'],['最新实际期间',actual?actual.period:'暂无数据'],['记录',view.length+' 条']].map(([k,v])=>'<div class="portal-stat"><span>'+D.esc(k)+'</span><strong>'+D.esc(v)+'</strong></div>').join('');
  // Draw one compatible series. Predictions and pending values remain in the table only.
  const chartRows=view.filter(o=>o.status!=='forecast'&&o.status!=='pending');$('db-chart').innerHTML=chartRows.length?D.trend(chartRows.map(o=>({date:o.period,value:o.value})),company.name+' '+m.name):'<p class="portal-empty">暂无数据</p>';
  $('db-rows').innerHTML=[...view].reverse().slice((page-1)*size,page*size).map(o=>'<tr><td>'+D.esc(o.period)+'</td><td>'+D.fmt(o.value,2)+'</td><td>'+D.esc(o.periodBasis)+'</td><td>'+D.esc(M.labels[o.status])+(problem(o).length?' <span class="db-flag">口径待核验</span>':'')+'</td><td><button class="portal-company-name" data-observation="'+D.esc(o.id)+'">'+D.esc(o.report||sources.find(s=>s.id===o.sourceId)?.file||o.sourceId)+'<small>'+D.esc(o.locator)+'</small></button></td></tr>').join('')||'<tr><td colspan="5">暂无数据</td></tr>';
  $('db-page-label').textContent=page+' / '+Math.max(1,Math.ceil(view.length/size))+' · '+view.length+' 条';$('db-prev').disabled=page<=1;$('db-next').disabled=page*size>=view.length;$('db-export').disabled=!view.length;
 }
 async function select(id,restore=false){
  const current=++request;company=catalog.companies.find(c=>c.id===id)||catalog.companies[0];const selected=company;
  $('db-status').textContent='正在读取 '+selected.name+'…';$('db-controls').hidden=true;$('db-data').hidden=true;
  document.querySelectorAll('[data-db-company]').forEach(b=>{b.classList.toggle('active',b.dataset.dbCompany===selected.id);b.setAttribute('aria-pressed',String(b.dataset.dbCompany===selected.id));});
  try{
   const data=await loadCompany(selected);if(current!==request)return;rows=data.observations||[];
   const has=new Set(rows.map(o=>o.metric));options('db-metric',catalog.metrics.filter(m=>has.has(m.id)).map(m=>({value:m.id,label:m.category+' · '+m.name})),(restore?params.get('db-metric'):null)||'revpar');
   options('db-frequency',[...new Set(rows.map(o=>o.frequency))].sort((a,b)=>['季度','半年','年度'].indexOf(a)-['季度','半年','年度'].indexOf(b)).map(f=>({value:f,label:f})),restore?params.get('db-frequency'):'季度');
   const years=[...new Set(rows.map(o=>o.period.slice(0,4)))].sort();for(const k of ['from','to'])options('db-'+k,[{value:'',label:k==='from'?'起始年':'结束年'},...years.map(y=>({value:y,label:y}))],restore?params.get('db-'+k):'');
   $('db-forecast').checked=restore&&params.get('db-forecast')==='1';$('db-pending').checked=restore&&params.get('db-pending')==='1';setSeries(restore?params.get('db-series'):null);page=1;
   $('db-status').textContent=selected.name+' · '+selected.code+' · '+(rows.length?'底稿历史 '+selected.firstPeriod+' — '+selected.lastPeriod:selected.status);
   $('db-controls').hidden=!rows.length;$('db-data').hidden=!rows.length;$('db-gap').hidden=!!rows.length;$('db-gap').textContent=rows.length?'':selected.name+'：暂无专项经营底稿';paint();
  }catch(e){if(current!==request)return;$('db-status').textContent='公司经营数据读取失败';$('db-status').append(Object.assign(document.createElement('button'),{textContent:'重试',className:'portal-button',onclick:()=>select(selected.id,restore)}));}
 }
 function source(id){const o=rows.find(r=>r.id===id);if(!o)return;const s=sources.find(s=>s.id===o.sourceId);$('db-source-title').textContent=company.name+' · '+o.period+' · '+metric(o.metric).name;
  const fields=[['数值',D.fmt(o.value,3)+' '+o.unit+' '+(o.currency||'')],['范围',M.seriesLabel(o)],['数据状态',M.labels[o.status]],['来源文件',s?.relativePath],['位置',o.locator],['来源报告',o.report],['PDF页码',o.pages],['原始单元格值',o.rawValue],['原始公式 / 推算说明',o.formula],['来源口径',o.note],['核验状态',s?.verification],['导入时间',s?.importedAt],['文件SHA-256',s?.sha256]];
  $('db-source-body').innerHTML='<dl class="db-source-fields">'+fields.filter(([k,v])=>v!=null&&v!=='').map(([k,v])=>'<dt>'+D.esc(k)+'</dt><dd>'+D.esc(v)+'</dd>').join('')+'</dl>'+problem(o).map(i=>'<div class="db-issue">'+D.esc(i.message)+(i.alternative?'<br>另一底稿：'+D.esc(i.alternative.value)+' · '+D.esc(sources.find(s=>s.id===i.alternative.sourceId)?.file)+' · '+D.esc(i.alternative.locator):'')+'</div>').join('');$('db-source-dialog').showModal();
 }
 $('db-source-close').onclick=()=>$('db-source-dialog').close();$('db-rows').onclick=e=>{const b=e.target.closest('[data-observation]');if(b)source(b.dataset.observation);};$('db-company-buttons').onclick=e=>{const b=e.target.closest('[data-db-company]');if(b)select(b.dataset.dbCompany);};
 for(const k of ['metric','frequency','forecast','pending'])$('db-'+k).onchange=()=>{setSeries();page=1;paint();};for(const k of ['series','from','to'])$('db-'+k).onchange=()=>{page=1;paint();};$('db-prev').onclick=()=>{page--;paint();};$('db-next').onclick=()=>{page++;paint();};
 $('db-export').onclick=()=>{const url=URL.createObjectURL(new Blob([M.csv(view,catalog.metrics)],{type:'text/csv;charset=utf-8'}));const a=Object.assign(document.createElement('a'),{href:url,download:company.name+'_'+$('db-metric').value+'.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('db-export-all').onclick=async()=>{const b=$('db-export-all');b.disabled=true;b.textContent='正在准备完整数据…';try{const all=(await Promise.all(catalog.companies.map(loadCompany))).flatMap(d=>d.observations);const url=URL.createObjectURL(new Blob([M.csv(all,catalog.metrics)],{type:'text/csv;charset=utf-8'}));Object.assign(document.createElement('a'),{href:url,download:'酒店上市公司完整历史.csv'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);b.textContent='导出完整数据';}catch(e){b.textContent='导出失败，点击重试';}finally{b.disabled=false;}};
 try{
  [catalog,{sources},{issues}]=await Promise.all([D.json('data/companies/catalog.json'),D.json('data/companies/sources.json'),D.json('data/companies/issues.json')]);
  $('db-company-buttons').innerHTML=catalog.companies.map(c=>'<button class="db-company" data-db-company="'+D.esc(c.id)+'">'+D.esc(c.name)+'<small>'+D.esc(c.code)+' · '+(c.count?c.count+' 条':'暂无数据')+'</small></button>').join('');
  const byCode=catalog.companies.find(c=>c.code===params.get('company'));await select(params.get('db')||byCode?.id||'jinjiang',true);
 }catch(e){$('db-status').innerHTML='重点公司目录读取失败。<button class="portal-button" onclick="location.reload()">重试</button>';}
})();
