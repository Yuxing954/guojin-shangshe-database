(function(){
 'use strict';
 const D=SiteData,M=DomesticHotelModel,$=id=>document.getElementById(id),esc=D.esc,params=new URLSearchParams(location.search),comparison=document.body.dataset.view==='comparison';
 const saved=params.get('sampleView')==='3';
 const colors=['#346b9f','#b08a4c','#38877d','#93669c'],cache=new Map(),evidence=new Map(),charts=new Map(),labelStates=new Map();
 const state={
  company:params.get('company')||params.get('db')||'jinjiang',
  tab:saved?(params.get('tab')||'operating'):'operating',
  kind:saved?(params.get('kind')||'全部'):'全部',
  frequency:saved?(params.get('frequency')||'单季度'):'单季度',
  from:saved?params.get('from'):'',to:saved?params.get('to'):'',
  range:saved?(params.get('range')||'custom'):'12',
  region:saved?(params.get('region')||''):'',category:saved?(params.get('category')||''):'',
  mode:saved?(params.get('operation')||'合计'):'合计',currency:saved?(params.get('currency')||'CNY'):'CNY',
  display:saved?(params.get('display')||'change'):'change',query:saved?(params.get('q')||''):'',
  detailCategory:'*',detailMode:'*',page:1,advanced:false
 };
 let manifest,data,renderToken=0;
 const uniq=values=>[...new Set(values)],unit=(i,c='CNY')=>i===2?'%':({CNY:'元',EUR:'欧元',USD:'美元'}[c]||c);
 const periodName=p=>M.label(p,state.frequency),empty='<div class="oh-empty">当前筛选暂无披露数据</div>';
 function table(headers,rows,cls=''){return '<div class="oh-scroll"><table class="oh-table '+cls+'"><thead><tr>'+headers.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';}
 function select(id,label,values,value){return '<label>'+label+'<select id="'+id+'">'+values.map(v=>{const [key,text]=Array.isArray(v)?v:[v,v];return '<option value="'+esc(key)+'"'+(value===key?' selected':'')+'>'+esc(text)+'</option>';}).join('')+'</select></label>';}
 function source(r){if(!r)return '';evidence.set(r.id,r);return '<button class="oh-source" data-source="'+esc(r.id)+'" aria-label="'+esc(r.company+' '+r.period+' '+r.metric+'数据来源')+'">来源 ↗</button>';}
 const value=(r,i)=>M.fmt(r?.value,i===2?1:2)+(i===2&&M.finite(r?.value)?'%':'');
 function cell(r,i){return '<td>'+value(r,i)+'<small class="'+(r?.change<0?'oh-negative':'')+'">'+M.growth(r?.change,i===2)+'</small>'+source(r)+'</td>';}
 function resetDimensions(){state.region='';state.category='';state.mode='合计';state.currency='CNY';state.detailCategory='*';state.detailMode='*';state.page=1;}
 function normalize(){
  if(!['同店','全部'].includes(state.kind))state.kind='全部';
  if(!['单季度','累计'].includes(state.frequency))state.frequency='单季度';
  if(!['change','value'].includes(state.display))state.display='change';
  if(!['operating','details'].includes(state.tab))state.tab='operating';
  if(!['8','12','20','all','custom'].includes(state.range))state.range='12';
  if(!manifest.quarters.includes(state.to))state.to=manifest.quarters.at(-1);
  if(state.range!=='custom'){const qs=manifest.quarters.filter(q=>q<=state.to);state.from=state.range==='all'?qs[0]:qs.slice(-Number(state.range))[0];}
  const qs=M.range(manifest.quarters,state.from,state.to);state.from=qs[0];state.to=qs.at(-1);
 }
 function normalizeFilters(){
  let rows=M.select(M.windowRows(data.rows,state.frequency),{kind:state.kind});
  const fit=(key,wanted)=>{const a=uniq(rows.map(r=>r[key]));if(!a.includes(state[key]))state[key]=a.includes(wanted)?wanted:a[0]||'';rows=M.select(rows,{[key]:state[key]});return a;};
  const regions=fit('region',data.company.region),currencies=fit('currency','CNY');
  const categories=fit('category',M.mainFilters(data.company,state.kind,state.frequency).category),modes=fit('mode','合计');
  return {regions,currencies,categories,modes};
 }
 function periodTools(){
  return '<div class="dh-primary">'+select('oh-kind','样本',[['全部','全部酒店'],['同店','同店酒店']],state.kind)+
   select('oh-frequency','期间',['单季度','累计'],state.frequency)+select('oh-display','图表',[['change','同比'],['value','数值']],state.display)+
   select('oh-range','范围',[['8','近2年'],['12','近3年'],['20','近5年'],['all','全部历史'],['custom','自定义']],state.range)+'</div>';
 }
 function advancedTools(opts,detail=false){
  let fields=select('oh-from','起始季度',manifest.quarters,state.from)+select('oh-period','截至季度',[...manifest.quarters].reverse(),state.to);
  if(opts){
   fields+=select('oh-region','地区',opts.regions,state.region);
   if(detail){
    fields+=select('oh-category','档次/范围',[['*','全部档次'],...opts.categories],state.detailCategory)+select('oh-operation','经营模式',[['*','全部模式'],...opts.modes],state.detailMode);
   }else{
    if(opts.categories.length>1)fields+=select('oh-category','档次/范围',opts.categories,state.category);
    if(opts.modes.length>1)fields+=select('oh-operation','经营模式',opts.modes,state.mode);
   }
   if(opts.currencies.length>1)fields+=select('oh-currency','币种',opts.currencies,state.currency);
  }
  return '<details id="dh-advanced" class="dh-advanced"'+(state.advanced?' open':'')+'><summary>更多筛选</summary><div class="dh-filter-grid">'+fields+'</div></details>';
 }
 function toolbar(opts,detail=false){CompanyWorkspace.begin();
  $('oh-toolbar').innerHTML=periodTools()+'<div class="dh-tools"><button id="dh-reset" type="button">重置</button><button id="oh-export-view" type="button">'+(detail?'导出明细':comparison?'导出对比':'导出当前数据')+'</button></div>'+advancedTools(opts,detail)+
   (detail?'<div class="dh-search"><label>搜索<input id="oh-search" type="search" placeholder="报告期、指标、口径" value="'+esc(state.query)+'"></label><button id="oh-clear" type="button">清空</button></div>':'');
 }
 function bind(id,fn){const e=$(id);if(e)e.onchange=()=>{fn(e.value);state.page=1;render();};}
 function bindPeriods(){
  bind('oh-range',v=>state.range=v);
  bind('oh-from',v=>{state.range='custom';state.from=v;if(state.to<v)state.to=v;});
  bind('oh-period',v=>{state.to=v;if(state.from>v)state.from=v;});
  bind('oh-frequency',v=>{state.frequency=v;state.category='';state.mode='合计';state.detailCategory='*';state.detailMode='*';});
  bind('oh-kind',v=>{state.kind=v;resetDimensions();});
  bind('oh-display',v=>state.display=v);
  $('dh-advanced').querySelector('summary').onclick=()=>{state.advanced=!$('dh-advanced').open;};
  $('dh-reset').onclick=()=>{Object.assign(state,{kind:'全部',frequency:'单季度',display:'change',range:'12',to:manifest.quarters.at(-1),query:'',advanced:false});resetDimensions();render();};
 }
 function updateURL(){
  CompanyWorkspace.mountActions();
  const u=new URL(location.href);u.search='';
  for(const k of ['company','kind','frequency','from','to','display','range'])u.searchParams.set(k,state[k]);
  u.searchParams.set('sampleView','3');
  if(!comparison){u.searchParams.set('tab',state.tab);for(const k of ['region','category','currency'])if(state[k])u.searchParams.set(k,state[k]);u.searchParams.set('operation',state.mode);if(state.query)u.searchParams.set('q',state.query);}
  history.replaceState(null,'',u);window.HotelWorkspace?.remember();
  const link=$('oh-compare-link')||$('oh-back');
  if(link){const next=new URL(comparison?'company-database.html':'domestic-hotel-comparison.html',location.href);for(const k of ['company','kind','frequency','from','to','display','range'])next.searchParams.set(k,state[k]);next.searchParams.set('sampleView','3');link.href=next.href;}
 }
 async function loadCompany(c){
  if(!cache.has(c.id)){const promise=D.json(c.file).then(d=>{if(d.rows.length!==c.count)throw Error(c.name+'数据条数不匹配');d.rows=d.rows.map((r,i)=>({...r,id:c.id+'-'+i,company:c.name,companyId:c.id,evidence:d.sources[r.source]}));return d;}).catch(e=>{cache.delete(c.id);throw e;});cache.set(c.id,promise);}
  return cache.get(c.id);
 }
 function chart(series,qs,idx,title){
  const id='dh-chart-'+charts.size,rows=qs.map((q,x)=>({period:periodName(M.period(q,state.frequency)),x,values:series.map(s=>({name:s.name,value:s.points[x]?.records[idx]?.value??null,change:s.points[x]?.records[idx]?.change??null}))}));
  charts.set(id,{rows,idx,options:{name:title,unit:unit(idx,series[0]?.currency),precision:idx===2?1:0,changeUnit:idx===2?'pct':'%',changePrecision:1,mode:state.display,valueStyle:'line',colors:colors.slice(0,series.length),legend:'series',gap:1.5,trimEmpty:false}});
  return '<div class="oh-plot" id="'+id+'"></div>';
 }
 function bindCharts(){for(const[id,c]of charts){const host=$(id);if(!host)continue;const draw=()=>CompanyWorkspace.plot(host,c.rows,c.options);draw();const input=host.closest('article').querySelector('[data-chart-labels]');input.onchange=()=>{labelStates.set(c.idx,input.checked);draw();};}}
 function historyTable(series,qs,i){return '<details class="oh-history"><summary>历史数据</summary>'+table(['口径',...[...qs].reverse().map(q=>periodName(M.period(q,state.frequency)))],series.map(s=>'<tr><td>'+esc(s.name)+'</td>'+[...s.points].reverse().map(p=>cell(p.records[i],i)).join('')+'</tr>'))+'</details>';}
 function blocks(series,qs){return '<div class="dh-charts">'+M.metrics.map((m,i)=>{const title=m+(state.display==='change'?(i===2?'同比变化':'同比'):'');return '<article class="oh-block"><div class="oh-block-head"><h3>'+title+'</h3><small>'+esc(state.frequency+' · '+(state.display==='change'?(i===2?'pct':'%'):unit(i,series[0]?.currency)))+'</small><label class="site-value-option"><input type="checkbox" data-chart-labels'+(labelStates.get(i)?' checked':'')+'>显示数值</label></div>'+chart(series,qs,i,title)+historyTable(series,qs,i)+'</article>';}).join('')+'</div>';}
 function operating(){
  const opts=normalizeFilters(),qs=M.range(manifest.quarters,state.from,state.to);toolbar(opts);
  const filters={kind:state.kind,region:state.region,category:state.category,mode:state.mode,currency:state.currency};
  const main=M.mainFilters(data.company,state.kind,state.frequency),isMain=Object.entries(main).every(([k,v])=>filters[k]===v);
  const series=[{name:state.kind==='全部'?'全部酒店':'同店酒店',currency:state.currency,points:isMain?M.mainSeries(data,state.kind,qs,state.frequency):M.series(data.rows,filters,qs,state.frequency)}];
  const latest=series[0].points.at(-1);
  let html='<div class="dh-context"><strong>'+esc(periodName(latest.period))+'</strong><span>'+esc([state.region,state.category,state.mode!=='合计'?state.mode:'',state.currency==='CNY'?'人民币':state.currency].filter((v,i)=>v&&!(i===1&&v==='合计')).join(' · '))+'</span></div>';
  if(data.company.id==='jinjiang'&&state.kind==='同店'&&state.frequency==='单季度'&&!latest.records.some(Boolean)){
   html+='<div class="dh-missing">本期同店仅披露累计数据<button id="dh-cumulative" type="button">查看累计</button></div>';
  }else if(!latest.records.some(Boolean))html+='<div class="dh-missing">本期暂无该口径披露</div>';
  html+='<div class="oh-kpis">'+M.metrics.map((m,i)=>{const r=latest.records[i];return '<article class="oh-kpi"><span>'+m+'</span>'+source(r)+'<strong>'+M.fmt(r?.value,i===2?1:0)+'<small>'+unit(i,state.currency)+'</small></strong><div class="oh-growth '+(r?.change<0?'oh-negative':'')+'">同比 '+M.growth(r?.change,i===2)+'</div></article>';}).join('')+'</div>';
  $('oh-content').innerHTML=html+blocks(series,qs);bindPeriods();
  bind('oh-region',v=>{state.region=v;state.currency='';state.category='';state.mode='合计';});
  bind('oh-category',v=>{state.category=v;state.mode='合计';});
  bind('oh-operation',v=>state.mode=v);bind('oh-currency',v=>state.currency=v);
  if($('dh-cumulative'))$('dh-cumulative').onclick=()=>{state.frequency='累计';state.category='';render();};
  $('oh-export-view').onclick=()=>exportRows(series.flatMap(s=>s.points.flatMap(p=>p.records.filter(Boolean))),data.company.name+'_当前筛选.csv');
 }
 async function compare(token){
  toolbar(null);bindPeriods();$('oh-content').innerHTML='';$('oh-status').textContent='正在读取四集团…';
  const datasets=await Promise.all(manifest.companies.map(loadCompany));if(token!==renderToken)return;$('oh-status').textContent='';
  const qs=M.range(manifest.quarters,state.from,state.to),series=datasets.map(d=>({name:d.company.name,currency:'CNY',points:M.mainSeries(d,state.kind,qs,state.frequency)}));
  $('oh-profile').innerHTML='<div><h2>国内四集团</h2><p>境内主口径 · 人民币</p></div><span class="oh-tag">'+(state.kind==='同店'?'同店酒店':'全部酒店')+'</span>';
  $('oh-content').innerHTML='<article class="oh-block"><div class="oh-block-head"><h3>'+esc(periodName(M.period(state.to,state.frequency)))+'</h3><small>'+esc(state.frequency)+' · 元 / %</small></div>'+table(['集团','RevPAR','ADR','OCC'],series.map(s=>'<tr><td>'+esc(s.name)+(s.name==='锦江酒店'&&state.kind==='同店'&&state.frequency==='单季度'&&!/Q1$/.test(state.to)?'<small>仅累计披露</small>':'')+'</td>'+s.points.at(-1).records.map((r,i)=>cell(r,i)).join('')+'</tr>'))+'</article>'+blocks(series,qs);
  $('oh-export-view').onclick=()=>exportRows(series.flatMap(s=>s.points.flatMap(p=>p.records.filter(Boolean))),'国内四集团_'+state.kind+'对比.csv');
 }
 function details(){
  const baseRows=M.select(M.windowRows(data.rows,state.frequency),{kind:state.kind}),regions=uniq(baseRows.map(r=>r.region));
  if(!regions.includes(state.region))state.region=regions.includes(data.company.region)?data.company.region:regions[0]||'';
  const scoped=baseRows.filter(r=>r.region===state.region),currencies=uniq(scoped.map(r=>r.currency));
  if(!currencies.includes(state.currency))state.currency=currencies.includes('CNY')?'CNY':currencies[0]||'';
  const currencyRows=scoped.filter(r=>r.currency===state.currency),categories=uniq(currencyRows.map(r=>r.category)),modes=uniq(currencyRows.filter(r=>state.detailCategory==='*'||r.category===state.detailCategory).map(r=>r.mode));
  if(!categories.includes(state.detailCategory))state.detailCategory='*';if(!modes.includes(state.detailMode))state.detailMode='*';
  toolbar({regions,currencies,categories,modes},true);
  const rows=M.search(currencyRows.filter(r=>M.quarter(r.period)>=state.from&&M.quarter(r.period)<=state.to&&(state.detailCategory==='*'||r.category===state.detailCategory)&&(state.detailMode==='*'||r.mode===state.detailMode)),state.query).sort((a,b)=>M.quarter(b.period).localeCompare(M.quarter(a.period))||a.category.localeCompare(b.category)||a.mode.localeCompare(b.mode)||M.metrics.indexOf(a.metric)-M.metrics.indexOf(b.metric));
  const pages=Math.max(1,Math.ceil(rows.length/30));state.page=Math.max(1,Math.min(state.page,pages));const pageRows=rows.slice((state.page-1)*30,state.page*30);
  $('oh-content').innerHTML='<article class="oh-block"><div class="oh-block-head"><h3>经营数据明细</h3><small>'+rows.length+' 条</small></div>'+(rows.length?table(['报告期','样本','地区','档次/范围','经营模式','指标','数值','币种/单位','同比','来源'],pageRows.map(r=>'<tr><td>'+esc(periodName(r.period))+'</td><td>'+esc(r.kind==='全部'?'全部酒店':r.kind)+'</td><td>'+esc(r.region)+'</td><td>'+esc(r.category)+'</td><td>'+esc(r.mode)+'</td><td>'+esc(r.metric)+'</td><td>'+M.fmt(r.value,r.metric==='OCC'?1:2)+'</td><td>'+esc(r.metric==='OCC'?'%':r.currency)+'</td><td>'+M.growth(r.change,r.metric==='OCC')+'</td><td>'+source(r)+'</td></tr>'),'dh-details'):empty)+'<div class="oh-pagination"><button id="oh-prev"'+(state.page===1?' disabled':'')+'>上一页</button><span>'+state.page+' / '+pages+'</span><label>页码 <input id="oh-page" type="number" min="1" max="'+pages+'" value="'+state.page+'"></label><button id="oh-next"'+(state.page===pages?' disabled':'')+'>下一页</button></div></article>';
  bindPeriods();bind('oh-region',v=>{state.region=v;state.detailCategory='*';state.detailMode='*';state.currency='';});
  bind('oh-category',v=>{state.detailCategory=v;state.detailMode='*';});bind('oh-operation',v=>state.detailMode=v);bind('oh-currency',v=>state.currency=v);
  $('oh-prev').onclick=()=>{state.page--;render();};$('oh-next').onclick=()=>{state.page++;render();};
  $('oh-page').onchange=e=>{state.page=Number(e.target.value)||1;render();};
  $('oh-search').onchange=e=>{state.query=e.target.value;state.page=1;render();};$('oh-clear').onclick=()=>{state.query='';state.page=1;render();};
  $('oh-export-view').onclick=()=>exportRows(rows,data.company.name+'_明细.csv');
 }
 function exportRows(rows,name){
  const seen=new Set(),out=rows.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;}).map(r=>({'公司':r.company,'原报告期':r.period,'样本':r.kind==='全部'?'全部酒店':r.kind,'地区':r.region,'档次/范围':r.category,'经营模式':r.mode,'指标':r.metric,'数值':r.value,'同期值':r.prior,'币种/单位':r.metric==='OCC'?'%':r.currency,'同比':r.change,'同比单位':r.metric==='OCC'?'pct':'%','同比来源':r.evidence.change_type,'比较基准':r.evidence.comparison_basis,'原始网址':r.evidence.url,'PDF物理页码':r.evidence.pdf_page,'原披露备注':r.evidence.note}));
  D.downloadCsv(out,name);window.HotelWorkspace?.notify('已导出 '+out.length+' 条数据');
 }
 function showSource(id){
  const r=evidence.get(id);if(!r)return;const s=r.evidence,fields=[['公司',r.company],['报告期',r.period],['样本',r.kind==='全部'?'全部酒店':r.kind],['口径',[r.region,r.category,r.mode,r.currency].join(' · ')],['指标',r.metric],['数值',value(r,M.metrics.indexOf(r.metric))],['同比',M.growth(r.change,r.metric==='OCC')],['同比来源',s.change_type],['比较基准',s.comparison_basis],['PDF物理页码',s.pdf_page??'未提供'],['原披露备注',s.note||'—']];
  $('oh-evidence-body').innerHTML=table(['字段','内容'],fields.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>'),'oh-profile-table')+(D.link(s.url)?'<p><a href="'+esc(D.link(s.url))+'" target="_blank" rel="noopener">打开原始披露 ↗</a></p>':'');$('oh-evidence').showModal();
 }
 async function render(){
  const token=++renderToken;
  try{
   normalize();evidence.clear();charts.clear();$('oh-status').textContent='';$('oh-retry').hidden=true;
   if(comparison)await compare(token);
   else{
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===state.tab));
    $('oh-profile').innerHTML='<div><h2>'+esc(data.company.name)+'</h2><p>'+esc(data.company.english+' · '+data.company.ticker)+'</p></div>';
    if(state.tab==='details')details();else operating();
   }
   if(token!==renderToken)return;bindCharts();updateURL();CompanyWorkspace.enhance();
  }catch(e){if(token!==renderToken)return;$('oh-status').textContent='数据读取失败：'+e.message;$('oh-retry').hidden=false;$('oh-content').innerHTML='';}
 }
 async function choose(id){
  state.company=manifest.companies.some(c=>c.id===id)?id:manifest.companies[0].id;const token=++renderToken;
  $('oh-workspace').hidden=true;$('oh-retry').hidden=true;$('oh-status').textContent='正在读取数据…';
  document.querySelectorAll('[data-company]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.company===state.company));
  try{const next=await loadCompany(manifest.companies.find(c=>c.id===state.company));if(token!==renderToken)return;data=next;$('oh-workspace').hidden=false;await render();}
  catch(e){if(token!==renderToken)return;$('oh-status').textContent='数据读取失败：'+e.message;$('oh-retry').hidden=false;}
 }
 async function init(){
  try{
   manifest=await D.json('data/companies/domestic-hotels.json');normalize();
   if(comparison){$('oh-workspace').hidden=false;await render();}
   else{
    $('oh-companies').innerHTML=manifest.companies.map(c=>'<button class="oh-company" data-company="'+esc(c.id)+'" aria-pressed="false"><span class="oh-logo">'+(c.logo?'<img src="'+esc(c.logo)+'" alt="'+esc(c.name)+' Logo">':'<span class="dh-monogram">'+esc(c.name.slice(0,2))+'</span>')+'</span><span><strong>'+esc(c.name)+'</strong><small>'+esc(c.ticker)+'</small></span></button>').join('');
    document.querySelectorAll('[data-company]').forEach(b=>b.onclick=()=>{resetDimensions();choose(b.dataset.company);});
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.page=1;render();});
    await choose(state.company);
    $('oh-export-all').onclick=async()=>{const b=$('oh-export-all');b.disabled=true;try{const all=await Promise.all(manifest.companies.map(loadCompany));exportRows(all.flatMap(d=>d.rows),'国内四集团_全部指标_2018Q1起.csv');}catch(e){window.HotelWorkspace?.notify('导出失败：'+e.message);}finally{b.disabled=false;}};
   }
  }catch(e){$('oh-status').textContent='数据读取失败：'+e.message;$('oh-retry').hidden=false;}
 }
 $('oh-retry').onclick=()=>{cache.clear();init();};$('oh-close').onclick=()=>$('oh-evidence').close();document.addEventListener('click',e=>{const b=e.target.closest('[data-source]');if(b)showSource(b.dataset.source);});init();
})();
