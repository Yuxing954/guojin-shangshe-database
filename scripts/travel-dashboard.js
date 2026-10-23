(function(){
  'use strict';
  const $=id=>document.getElementById(id),M=TravelModel,esc=SiteData.esc;
  const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:d}):'—';
  const delta=v=>Number.isFinite(v)?'同比 '+(v>0?'+':'')+fmt(v,1)+'%':'同比 —';
  const scopes={q3:'第三季度 · 单季',h1:'上半年',annual:'全年'};
  let data,view='domestic',exports=[];
  function source(id,locator){const s=M.source(data,id);return s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener" title="'+esc(s.name+(s.publishedAt?' · 发布 '+s.publishedAt:''))+'">官方来源</a>':'<a href="data-notes.html#travel" title="'+esc((s.file||'')+' · '+(locator||''))+'">原表</a>';}
  function table(id,headers,rows){$(id).innerHTML='<thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody>';}
  function kpis(id,items){$(id).innerHTML=items.map(([title,value,unit,change,period])=>'<article class="travel-kpi"><h2>'+esc(title)+'</h2><strong>'+fmt(value)+'<small>'+esc(unit)+'</small></strong><p class="'+(change>0?'positive':change<0?'negative':'')+'">'+(typeof change==='string'?esc(change):delta(change))+'</p><p>'+esc(period||'')+'</p></article>').join('');}
  function chart(id,rows,name,unit,options={}){SiteCharts.drawPaired($(id),rows,{name,unit,mode:'combo',valueStyle:'bar',changeUnit:'%',precision:2,changePrecision:1,...options});}
  function panelCharts(id,items){if(!$(id).children.length)$(id).innerHTML=items.map(([key,title])=>'<article class="travel-panel"><h2>'+esc(title)+'</h2><div id="'+key+'"></div></article>').join('');}
  function record(name,r,value,unit,change,basis='',sourceId=r.sourceId,locator=r.locator){const s=M.source(data,sourceId);exports.push([view,name,r.period,basis,value,unit,change,r.changeBasis||'',s.name,s.url||'',s.file||'',locator||'',s.publishedAt||'',data.checkedAt]);}
  function renderDomestic(){
    const rows=M.yearRows(data.domestic.holidays,$('domestic-year').value).filter(r=>$('holiday').value==='all'||r.holiday===$('holiday').value),latest=rows.at(-1),daily=$('holiday-basis').value==='daily',tk=daily?'dailyTrips':'trips',sk=daily?'dailySpend':'spend';
    $('asof').textContent=(latest?.period||'当前筛选无假期数据')+' · 用户旅游数据库';
    kpis('domestic-kpis',latest?[[daily?'日均出游人次':'假期出游人次',latest[tk],daily?'亿人次/日':'亿人次',latest[tk+'YoY'],latest.period+' · '+latest.days+'天'],[daily?'日均出游花费':'假期出游花费',latest[sk],daily?'亿元/日':'亿元',latest[sk+'YoY'],latest.period],['人均出游花费',latest.perTrip,'元',latest.perTripYoY,latest.period],daily?['假期天数',latest.days,'天',latest.comparisonDays?'上年同名假期 '+latest.comparisonDays+'天':'同名假期基期缺失',latest.period]:['日均出游人次',latest.dailyTrips,'亿人次/日',latest.dailyTripsYoY,latest.period]]:[]);
    panelCharts('holiday-charts',[['holiday-trips','出游人次'],['holiday-spend','出游花费'],['holiday-pertrip','人均出游花费']]);
    for(const [id,key,name,unit] of [['holiday-trips',tk,'出游人次',daily?'亿人次/日':'亿人次'],['holiday-spend',sk,'出游花费',daily?'亿元/日':'亿元'],['holiday-pertrip','perTrip','人均出游花费','元']]){chart(id,rows.map(r=>({period:$('domestic-year').value==='all'?r.period:r.holiday,value:r[key],change:r[key+'YoY']})),name,unit);for(const r of rows)record(name,r,r[key],unit,r[key+'YoY'],key==='perTrip'?'每人次花费':daily?'日均测算':'假期总量');}
    table('holiday-table',['假期','天数','出游（亿人次）','原表同比（%）','花费（亿元）','原表同比（%）','日均出游（亿）','日均花费（亿元）','人均花费（元）','人均同比（%）','来源'],[...rows].reverse().map(r=>[esc(r.period),fmt(r.days,0),fmt(r.trips),fmt(r.tripsYoY,1),fmt(r.spend),fmt(r.spendYoY,1),fmt(r.dailyTrips),fmt(r.dailySpend),fmt(r.perTrip),fmt(r.perTripYoY,1),source(r.sourceId,r.locator)]));
    const chang=M.yearRows(data.domestic.changbai,$('domestic-year').value),jz=M.yearRows(data.domestic.jiuzhai,$('domestic-year').value);let jr=jz;
    if(jz.length&&$('scenic-window').value!=='all'){const cutoff=new Date(jz.at(-1).period+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-Number($('scenic-window').value)+1);jr=jz.filter(r=>r.period>=cutoff.toISOString().slice(0,10));}
    $('changbai-date').textContent='月度 · 万人次 · '+(chang.at(-1)?.period||'暂无数据');$('jiuzhai-date').textContent='日度 · 人次 · '+(jr.at(-1)?.period||'暂无数据');
    chart('changbai-chart',M.continuous(chang),'长白山客流','万人次');chart('jiuzhai-chart',M.continuous(jr,'day'),'九寨沟客流','人次',{valueStyle:'line',precision:0});
    for(const [rs,n,u] of [[chang,'长白山客流','万人次'],[jr,'九寨沟客流','人次']])for(const r of rs)record(n,r,r.value,u,r.change,'同月/同日同比');
  }
  function renderInbound(){
    const rows=M.borderRows(data,$('border-scope').value),r=rows.at(-1);
    $('asof').textContent=r.period+' · '+scopes[r.scope]+' · 国家移民管理局';
    kpis('inbound-kpis',[["外国人入境 · 单向",r.foreignIn,'万人次',r.foreignInYoY,r.period],['免签入境外国人',r.visaFree,'万人次',r.visaYoY,r.period],['免签占外国人入境',r.visaShare,'%', '官方披露占比',r.period],['外国人出入境 · 双向',r.foreign,'万人次',r.foreignYoY,r.period]]);
    panelCharts('inbound-charts',[['foreign-in-chart','外国人入境与免签入境 · 单向'],['border-structure-chart','出入境查验结构 · 双向'],['foreign-share-chart','外国人占全部出入境查验'],['visa-share-chart','免签占外国人入境']]);
    chart('foreign-in-chart',rows.map(x=>({period:x.period,values:[{name:'外国人入境',value:x.foreignIn??null},{name:'免签入境',value:x.visaFree??null}]})),'外国人单向入境','万人次',{mode:'value',legend:'series'});
    chart('border-structure-chart',rows.map(x=>({period:x.period,values:[{name:'内地居民',value:x.mainland/10000},{name:'港澳台居民',value:x.hmt/10000},{name:'外国人',value:x.foreign/10000}]})),'出入境查验结构','亿人次',{mode:'value',legend:'series'});
    chart('foreign-share-chart',rows.map(x=>({period:x.period,value:x.foreignShare})),'外国人占全部查验','%',{mode:'value'});
    chart('visa-share-chart',rows.map(x=>({period:x.period,value:x.visaShare??null})),'免签入境占比','%',{mode:'value'});
    $('origins-period').textContent=r.topOrigins?r.period+' · 前十合计占比 '+fmt(r.topOriginsShare,1)+'%':'本期来源未列排名';$('origins').innerHTML=(r.topOrigins||[]).map(n=>'<li>'+esc(n)+'</li>').join('');
    table('border-table',['期间','全部查验（万人次）','内地居民','港澳台居民','外国人双向','外国人单向入境','单向入境同比（%）','免签入境','免签占比（%）','外国人双向占比（%）','来源'],[...rows].reverse().map(x=>[esc(x.period),fmt(x.total),fmt(x.mainland),fmt(x.hmt),fmt(x.foreign),fmt(x.foreignIn),fmt(x.foreignInYoY,1),fmt(x.visaFree),fmt(x.visaShare,1),fmt(x.foreignShare,1),source(x.sourceId)]));
    for(const x of rows)for(const [k,n,u,c] of [['foreignIn','外国人单向入境','万人次','foreignInYoY'],['foreign','外国人双向查验','万人次','foreignYoY'],['mainland','内地居民双向查验','万人次'],['hmt','港澳台居民双向查验','万人次'],['total','全部双向查验','万人次'],['visaFree','免签入境外国人','万人次','visaYoY'],['visaShare','免签占入境外国人','%'],['foreignShare','外国人占全部出入境查验','%']])record(n,x,x[k],u,x[c],scopes[x.scope],k==='foreignIn'&&x.foreignInSourceId?x.foreignInSourceId:x.sourceId);
    const tourists=data.inbound.tourists;
    chart('tourist-chart',tourists.map(x=>({period:x.period,value:x.total,change:x.totalYoY})),'入境游客','万人次');chart('foreign-tourist-chart',tourists.map(x=>({period:x.period,value:x.foreign,change:x.foreignYoY})),'外国游客','万人次');
    table('tourist-table',['年度','入境游客（万人次）','同比（%）','其中外国游客','同比（%）','港澳台居民','来源'],[...tourists].reverse().map(x=>[x.period,fmt(x.total),fmt(x.totalYoY,1),fmt(x.foreign),fmt(x.foreignYoY,1),fmt(x.hmt),source(x.sourceId)]));
    for(const x of tourists){record('入境游客',x,x.total,'万人次',x.totalYoY,'文旅部全年');record('外国游客',x,x.foreign,'万人次',x.foreignYoY,'文旅部全年');}
  }
  function renderOutbound(){
    const dest=data.outbound.destinations.find(d=>d.name===$('destination').value),rows=M.outboundRows(dest,$('outbound-year').value,$('outbound-scope').value),r=rows.filter(x=>Number.isFinite(x.value)).at(-1),latest=r?.period,actual=dest.records.find(x=>x.period===latest),ytd=M.cumulative(dest.records,latest),cumulative=$('outbound-scope').value==='ytd';
    $('asof').textContent=dest.name+' · '+(latest||dest.status||'当前筛选暂无数据')+' · 用户海外旅游数据库';
    kpis('outbound-kpis',[['当月接待中国游客',actual?.value,'万人次',actual?.change,latest||'—'],['年初累计接待',ytd.value,'万人次',ytd.change,latest?latest.slice(0,4)+'年1—'+Number(latest.slice(5))+'月':'—'],['内地居民出境 · 单向',data.inbound.border.at(-1).mainlandOut,'万人次',data.inbound.border.at(-1).mainlandOutYoY,'2026Q3 · 单季'],['内地居民出境 · 单向',data.inbound.border.find(x=>x.period==='2026H1').mainlandOut,'万人次',10.5,'2026H1']]);
    $('destination-title').textContent=dest.name+'接待中国游客';$('destination-period').textContent=(cumulative?'年初累计':'当月')+' · 万人次';
    chart('outbound-chart',rows,'中国游客接待人数','万人次');
    table('destination-table',['目的地','最新期间','当月（万人次）','同比（%）','数据状态'],data.outbound.destinations.map(d=>{const x=d.records.at(-1);return [esc(d.name),x?.period||'—',fmt(x?.value),fmt(x?.change,1),esc(d.status||'原表转录')];}));
    table('outbound-table',['月份',cumulative?'累计（万人次）':'当月（万人次）','同比（%）','同比依据','来源'],[...rows].reverse().map(x=>[x.period,fmt(x.value),fmt(x.change,1),esc(cumulative?'同月数值累计计算':x.changeBasis||'缺期'),source('outbound-book',x.locator)]));
    for(const x of rows)record(dest.name+'接待中国游客',x,x.value,'万人次',x.change,cumulative?'年初累计':'当月','outbound-book');
    const border=data.inbound.border.filter(x=>Number.isFinite(x.mainlandOut));table('mainland-out-table',['期间','统计口径','内地居民出境（万人次）','同比（%）','来源'],[...border].reverse().map(x=>[x.period,scopes[x.scope],fmt(x.mainlandOut),fmt(x.mainlandOutYoY,1),source(x.sourceId)]));
    for(const x of border)record('内地居民单向出境',x,x.mainlandOut,'万人次',x.mainlandOutYoY,scopes[x.scope]);
  }
  function render(){if(!data)return;exports=[];for(const v of ['domestic','inbound','outbound']){$('view-'+v).hidden=v!==view;document.querySelector('[data-view="'+v+'"]').setAttribute('aria-pressed',String(v===view));}({domestic:renderDomestic,inbound:renderInbound,outbound:renderOutbound}[view])();}
  function select(){const key=new URLSearchParams(location.hash.slice(1)).get('view')||location.hash.slice(1);view=['domestic','inbound','outbound'].includes(key)?key:'domestic';render();}
  function download(){const csv=M.csv(exports,['板块','指标','数据期间','统计口径','数值','单位','同比（%）','同比依据','来源','来源URL','来源文件','原表定位','发布日期','核对日期']);const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='旅游_'+view+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function load(){
    $('load-error').hidden=true;
    try{data=await SiteData.json('data/tourism/dashboard.json?v=20261023');if(!data.domestic?.holidays?.length||!data.inbound?.border?.length)throw Error('empty');
      const years=[...new Set(data.domestic.holidays.map(r=>r.year))].sort((a,b)=>b-a);$('domestic-year').innerHTML='<option value="all">全部年份</option>'+years.map(y=>'<option>'+y+'</option>').join('');$('domestic-year').value='2026';
      $('outbound-year').innerHTML='<option value="all">全部年份</option>'+Array.from({length:10},(_,i)=>2026-i).map(y=>'<option>'+y+'</option>').join('');$('outbound-year').value='2026';$('destination').innerHTML=data.outbound.destinations.map(d=>'<option>'+esc(d.name)+'</option>').join('');
      $('dashboard').hidden=false;select();$('export').disabled=false;
    }catch(e){data=null;$('dashboard').hidden=true;$('export').disabled=true;$('asof').textContent='旅游数据读取失败';$('load-error').hidden=false;$('load-error').textContent='数据暂时无法读取，请重试。';const b=document.createElement('button');b.textContent='重试';b.onclick=load;$('load-error').append(b);}
  }
  document.querySelector('.travel-tabs').onclick=e=>{const button=e.target.closest('[data-view]');if(button)location.hash='view='+button.dataset.view;};
  for(const id of ['domestic-year','holiday','holiday-basis','scenic-window','border-scope','destination','outbound-year','outbound-scope'])$(id).onchange=render;
  $('export').onclick=download;addEventListener('hashchange',select);load();
})();

