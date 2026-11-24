// Tabler presentation only. The original pure models retain data and classification rules.
const PATHS = {
  catalog:'data/macro/catalog.json', snapshot:'data/macro/snapshot.json',
  automatic:'data/macro/automatic-series.json', consumption:'data/consumption-macro/observations.json',
  expectations:'data/macro/expectations.json', predictions:'data/macro/predictions.json',
  fedwatch:'data/gold-jewelry/macro.json'
};
let modelPromise;
async function models() {
  if (!modelPromise) modelPromise = (async () => {
    await import('../macro-model.js');
    await Promise.all(['macro-dashboard-model','macro-expectations','prediction-model','fedwatch-model','consumption-macro-model'].map(name=>import('../'+name+'.js')));
    return {M:window.MacroModel,D:window.MacroDashboardModel,E:window.MacroExpectations,P:window.PredictionModel,F:window.FedwatchModel,C:window.ConsumptionMacro};
  })();
  return modelPromise;
}
const finite = value => typeof value==='number' && Number.isFinite(value);
const clone = value => structuredClone(value);
function choice(value,allowed,fallback) {return allowed.includes(value)?value:fallback;}
function button(a,label,id,extra='') {return '<button type="button" class="btn btn-sm" '+id+' '+extra+'>'+a.esc(label)+'</button>';}
function select(a,label,id,items,value) {return '<div class="filter-field"><label class="form-label" for="'+id+'">'+a.esc(label)+'</label><select id="'+id+'" class="form-select">'+a.options(items,value)+'</select></div>';}
function field(a,label,id,value,placeholder='') {return '<div class="filter-field"><label class="form-label" for="'+id+'">'+a.esc(label)+'</label><input class="form-control" type="search" id="'+id+'" value="'+a.esc(value)+'" placeholder="'+a.esc(placeholder)+'"></div>';}
function linked(a,url,label='来源') {const safe=a.safeHref(url);return safe?'<a href="'+a.esc(safe)+'" target="_blank" rel="noopener">'+a.esc(label)+' '+a.icon('external')+'</a>':'<span class="text-secondary">未提供</span>';}
function badge(a,status) {return '<span class="badge '+(['已收录','已接入','ready'].includes(status)?'bg-blue-lt':'bg-yellow-lt')+'">'+a.esc(status)+'</span>';}
function sign(a,value,digits=2) {return finite(value)?(value>0?'+':'')+a.num(value,digits):'—';}
function coreBasis(spec,reading) {
  const labels={
    'cn-gdp-quarter':'实际 · 当季同比','cn-retail':'当月同比','cn-pmi':'原始景气指数',
    'cn-cpi':'当月同比 · 未季调','cn-unemployment':'全国当月值','cn-m2':'月末余额同比',
    'us-gdp-quarter':'实际 · 季调环比折年率','us-cpi':'同比 · 未季调','us-payroll':'较上月增减 · 季调',
    'us-unemployment':'季调','us-fed-rate':'月平均值','us-treasury10':'日度名义收益率 · 未季调'
  };
  return labels[spec.id]||reading.label||window.MacroModel.frequency[spec.frequency];
}
function nav(a,active) {
  return a.tabs([
    ['CN','中国','macro.html?country=CN&view=indicators'],
    ['US','美国','macro.html?country=US&view=indicators'],
    ['consumption','消费专题','consumption-macro.html'],
    ['national','全国社零','national-retail.html'],
    ['regional','地方社零','regional-retail.html'],
    ['expectations','指标预测','macro.html?view=expectations'],
    ['fedwatch','FedWatch','macro.html?view=fedwatch'],
    ['predictions','事件预测','macro.html?view=predictions']
  ],active,'宏观分类');
}
function notices(a,errors) {
  return errors.map(message=>'<div class="alert alert-warning" role="status"><div>'+a.esc(message)+'</div></div>').join('');
}
function pager(a,page,count,size,scope) {
  const total=Math.max(1,Math.ceil(count/size));
  return '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2"><span class="text-secondary">共 '+a.num(count,0)+' 条 · '+page+' / '+total+' 页</span><div class="btn-list">'+button(a,'上一页','data-page="'+scope+'" data-step="-1"',page<=1?'disabled':'')+button(a,'下一页','data-page="'+scope+'" data-step="1"',page>=total?'disabled':'')+'</div></div>';
}
function connectPager(root,scope,state,key,render) {root.querySelectorAll('[data-page="'+scope+'"]').forEach(el=>el.onclick=()=>{state[key]+=Number(el.dataset.step);render();});}
function pointsFromSegments(segments,field='chartValue') {
  return segments.flatMap((segment,index)=>[
    ...(index?[{period:segment[0].period,value:null}]:[]),
    ...segment.map(row=>({period:row.period,label:row.period,value:row[field]}))
  ]);
}
function meta(a,pairs) {
  return '<dl class="row mb-0">'+pairs.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([label,value])=>'<dt class="col-sm-3 text-secondary fw-normal">'+a.esc(label)+'</dt><dd class="col-sm-9 text-break">'+a.esc(value)+'</dd>').join('')+'</dl>';
}
async function loadMacro(a,models) {
  const keys=['catalog','snapshot','consumption','automatic','expectations'];
  const settled=await Promise.allSettled(keys.map(key=>a.json(PATHS[key])));
  if(settled[0].status==='rejected')throw settled[0].reason;
  if(settled[1].status==='rejected')throw settled[1].reason;
  let catalog=clone(settled[0].value),snapshot=clone(settled[1].value),expectations=null;
  const errors=[];
  for(let index=2;index<settled.length;index++) {
    const key=keys[index],result=settled[index],label={consumption:'消费原始数据',automatic:'补充历史序列',expectations:'指标预测'}[key];
    if(result.status==='rejected'){errors.push(label+'读取失败：'+result.reason.message);continue;}
    try {
      if(key==='consumption') {const next=clone(snapshot);models.M.mergeConsumption(catalog,next,result.value);snapshot=next;}
      if(key==='automatic') {const nextCatalog=clone(catalog),next=clone(snapshot);models.M.mergeAutomatic(nextCatalog,next,result.value);catalog=nextCatalog;snapshot=next;}
      if(key==='expectations')expectations=models.E.validate(result.value);
    }catch(error){errors.push(label+'未通过核验：'+error.message);}
  }
  return {catalog,snapshot,expectations,errors};
}
function macroSources(spec,data,sources,row) {
  const original=sources[spec.source]||{};
  return [{
    name:spec.name,url:row?.sourceUrl||data.sourceUrl||original.url,
    publisher:data.sourceOrganization||original.name,provider:data.provider,
    '数据期间':row?.period,'单位':spec.unit,'统计频率':window.MacroModel.frequency[spec.frequency],
    '统计口径':data.sourceDefinition||spec.definition,'季调':spec.adjustment,
    releaseDate:row?.releaseDate||'未提供','源数据库更新日':data.datasetUpdatedAt||'未提供',
    '数据获取时间':data.fetchedAt||'未提供','最近核对时间':data.checkedAt||'未提供',
    '修订说明':(row?.footnotes||[]).join('；'),'原始披露链接':row?.originalSourceUrl||'',
    '数据状态':data.status,'覆盖区间':data.coverage?[data.coverage.start,data.coverage.end].join(' — '):'',
    '缺失期间':data.coverage?.missingPeriods?.join('、'),'历史长度不足':data.coverage?.historyShort?'是':'',
    '更新错误':data.error||''
  }];
}
async function renderIndicators(container,a,model,p) {
  const {M,D,E}=model,{catalog,snapshot,expectations,errors}=await loadMacro(a,model);
  const state={
    country:p.get('country')==='US'?'US':'CN',category:p.get('category')||'',group:p.get('group')||'',
    query:p.get('q')||p.get('query')||'',frequency:p.get('frequency')||'',health:p.get('health')==='pending'?'empty':p.get('health')||'',
    available:p.get('available')==='1',indicator:p.get('indicator')||p.get('series')||'',
    mode:choice(p.get('mode'),['display','value','yoy','mom'],'display'),
    years:choice(p.get('years'),['1','3','5','10','0'],'3'),historyPage:1,directoryPage:1
  };
  const allCountry=()=>catalog.series.filter(s=>s.country===state.country);
  if(!allCountry().some(s=>s.id===state.indicator))state.indicator=D.featured[state.country][0];
  a.setHeader({title:state.country==='CN'?'中国宏观数据':'美国宏观数据',pretitle:'MACRO ECONOMICS',actions:'<a class="btn" href="data-notes.html#macro">'+a.icon('book')+'口径与来源</a>'});
  const sync=key=>a.url(key,state[key]===false?'':state[key]===true?'1':state[key]);
  const openSource=id=>{const spec=catalog.series.find(s=>s.id===id),data=snapshot.series[id]||{};a.sourceDialog(spec.name,macroSources(spec,data,catalog.sources,M.rows(data).at(-1)));};
  function render() {
    const specs=allCountry(),spec=specs.find(s=>s.id===state.indicator),data=snapshot.series[spec.id]||{};
    const reading=D.readout(spec,data),def=D.detailDefinition(spec,data);
    const history=state.mode==='display'?D.detailRows(spec,data,Number(state.years)):M.chartRows(spec,data,state.mode,Number(state.years));
    const unit=state.mode==='display'?def.unit:state.mode==='value'?spec.unit:M.changeUnit(spec);
    const measure=state.mode==='display'?(def.label||'原始值'):state.mode==='value'?'原始值':M.changeLabel(spec,state.mode);
    const filtered=M.filter(catalog.series,{country:state.country,category:state.category,available:state.available,q:state.query},snapshot)
      .filter(s=>(!state.group||M.groupOf(s.id)?.id===state.group)&&(!state.frequency||s.frequency===state.frequency)&&(!state.health||(state.health==='empty'?M.rows(snapshot.series[s.id]).length===0:M.status(s,snapshot.series[s.id])!=='已收录'||snapshot.series[s.id]?.coverage?.missingPeriods?.length||snapshot.series[s.id]?.coverage?.historyShort)));
    const directory=filtered.map(s=>({spec:s,data:snapshot.series[s.id]||{},reading:D.readout(s,snapshot.series[s.id]||{})}));
    state.directoryPage=Math.min(state.directoryPage,Math.max(1,Math.ceil(directory.length/15)));
    state.historyPage=Math.min(state.historyPage,Math.max(1,Math.ceil(history.length/15)));
    const latest=reading.latest;
    const forecast=expectations&&E.lookup(expectations,spec.id,latest?.period);
    const featured=D.featured[state.country].map(id=>catalog.series.find(s=>s.id===id)).filter(Boolean);
    container.innerHTML=nav(a,state.country)+notices(a,errors)+
      '<div class="row row-deck row-cards mb-3">'+featured.map(s=>{
        const d=snapshot.series[s.id]||{},r=D.readout(s,d),delta=r.delta;
        return '<div class="col-sm-6 col-lg-4"><div class="card macro-stat macro-core-stat h-100"><div class="card-body"><div class="d-flex align-items-center justify-content-between gap-2 mb-2"><div class="subheader">'+a.esc(s.name)+'</div>'+badge(a,M.status(s,d))+'</div><div class="h1 macro-core-value mb-2">'+a.num(r.value)+' <span class="h4 text-secondary">'+a.esc(r.unit)+'</span></div><div class="metric-period text-secondary small">'+a.esc(r.latest?.period||'暂无观测')+' · '+a.esc(coreBasis(s,r))+'<br>'+a.esc(delta?delta.label+' '+sign(a,delta.value)+' '+delta.unit:'前期可比值未提供')+'</div></div><div class="card-footer py-2 d-flex justify-content-between">'+button(a,'查看趋势','data-indicator="'+a.esc(s.id)+'"')+button(a,'来源','data-source="'+a.esc(s.id)+'"')+'</div></div></div>';
      }).join('')+'</div>'+
      '<div class="card mb-3"><div class="card-header"><h3 class="card-title">指标趋势</h3><div class="card-actions">'+button(a,'导出历史 CSV','id="macro-export"')+'</div></div><div class="card-body"><div class="d-flex flex-wrap gap-3 mb-4">'+
      select(a,'指标','macro-indicator',specs.map(s=>[s.id,s.name]),spec.id)+select(a,'显示口径','macro-mode',[['display','指标默认口径'],['value','原始值'],['yoy','较上年同期'],['mom','较上期']],state.mode)+select(a,'历史区间','macro-years',[['1','近 1 年'],['3','近 3 年'],['5','近 5 年'],['10','近 10 年'],['0','全部历史']],state.years)+
      '</div><div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><h3 class="mb-1">'+a.esc(spec.name)+'</h3><div class="text-secondary small">'+a.esc(M.frequency[spec.frequency]+' · '+measure+' · '+spec.adjustment)+'</div></div><div class="text-end"><div class="h2 mb-0">'+a.num(reading.value)+' '+a.esc(reading.unit)+'</div><div class="text-secondary small">'+a.esc(latest?.period||'暂无观测')+'</div></div></div><div id="macro-chart" class="dashboard-chart"></div>'+
      (data.error?'<div class="alert alert-warning mt-3 mb-0">'+a.esc(data.error)+'</div>':'')+
      '<div class="mt-3 small text-secondary">'+a.esc(spec.definition)+'</div>'+
      (forecast?'<div class="mt-2 small">Choice 预测：'+a.num(forecast.value)+'% · '+a.esc(latest.period)+' · <a href="macro.html?view=expectations&indicator='+a.esc(spec.id)+'">预测明细</a></div>':'')+
      '</div><div class="card-footer d-flex justify-content-between flex-wrap gap-2"><span class="text-secondary small">发布：'+a.esc(latest?.releaseDate||'未提供')+' · 获取：'+a.esc(data.fetchedAt||'未提供')+'</span>'+button(a,'来源与字段口径','data-source="'+a.esc(spec.id)+'"')+'</div></div>'+
      a.tableCard({title:'历史观测 · '+spec.name,columns:[
        {key:'period',label:'数据期间'},{key:'chartValue',label:measure+'（'+unit+'）',numeric:true,render:v=>a.num(v,4)},
        {key:'value',label:'原始值（'+spec.unit+'）',numeric:true,render:v=>a.num(v,4)},
        {key:'releaseDate',label:'发布日期',render:v=>a.esc(v||'未提供')},
        {key:'sourceUrl',label:'来源',render:(v,row)=>linked(a,v||data.sourceUrl||catalog.sources[spec.source]?.url)}
      ],rows:history.slice().reverse().slice((state.historyPage-1)*15,state.historyPage*15),footer:pager(a,state.historyPage,history.length,15,'history')})+
      '<div class="card my-3"><div class="card-header"><h3 class="card-title">全部指标</h3><div class="card-actions">'+button(a,'导出当前目录','id="macro-directory-export"')+'</div></div><div class="card-body"><form id="macro-filter" class="d-flex flex-wrap align-items-end gap-3">'+
      select(a,'分类','macro-category',[['','全部分类'],...catalog.categories],state.category)+
      select(a,'研究分组','macro-group',[['','全部分组'],...M.groups.map(g=>[g.id,g.label])],state.group)+
      select(a,'频率','macro-frequency',[['','全部频率'],...Object.entries(M.frequency)],state.frequency)+
      select(a,'状态','macro-health',[['','全部状态'],['attention','需关注'],['empty','暂无观测']],state.health)+
      select(a,'收录','macro-available',[['','全部指标'],['1','有观测值']],state.available?'1':'')+
      field(a,'搜索','macro-query',state.query,'指标名称、代码或口径')+'<button class="btn btn-primary" type="submit">'+a.icon('search')+'筛选</button></form></div></div>'+
      a.tableCard({title:'指标目录 · '+filtered.length+' 项',columns:[
        {key:'spec',label:'指标',render:s=>'<button class="btn btn-link p-0 text-start" data-indicator="'+a.esc(s.id)+'">'+a.esc(s.name)+'</button><div class="small text-secondary">'+a.esc(s.category+' · '+M.frequency[s.frequency])+'</div>'},
        {key:'reading',label:'最新值',numeric:true,render:r=>a.num(r.value)+' '+a.esc(r.unit)},
        {key:'reading',label:'数据期间',render:r=>a.esc(r.latest?.period||'—')},
        {key:'spec',label:'状态',render:(s,row)=>badge(a,M.status(s,row.data))},
        {key:'spec',label:'来源',render:s=>button(a,'来源','data-source="'+a.esc(s.id)+'"')}
      ],rows:directory.slice((state.directoryPage-1)*15,state.directoryPage*15),footer:pager(a,state.directoryPage,directory.length,15,'directory')});
    a.chart(container.querySelector('#macro-chart'),pointsFromSegments(D.segments(spec,history)),{label:spec.name+' · '+measure,unit});
    container.querySelectorAll('[data-indicator]').forEach(el=>el.onclick=()=>{state.indicator=el.dataset.indicator;state.historyPage=1;sync('indicator');render();container.querySelector('#macro-indicator').focus();});
    container.querySelectorAll('[data-source]').forEach(el=>el.onclick=()=>openSource(el.dataset.source));
    for(const [id,key] of [['macro-indicator','indicator'],['macro-mode','mode'],['macro-years','years']])container.querySelector('#'+id).onchange=e=>{state[key]=e.target.value;state.historyPage=1;sync(key);render();};
    container.querySelector('#macro-filter').onsubmit=e=>{e.preventDefault();for(const key of ['category','group','frequency','health']){state[key]=container.querySelector('#macro-'+key).value;sync(key);}state.available=container.querySelector('#macro-available').value==='1';sync('available');state.query=container.querySelector('#macro-query').value;sync('query');a.url('q','');state.directoryPage=1;render();};
    container.querySelector('#macro-export').onclick=()=>a.download(spec.id+'-history.csv',M.csv(spec,data,catalog.sources[spec.source]||{}));
    container.querySelector('#macro-directory-export').onclick=()=>a.download(state.country+'-macro-directory.csv',D.latestCsv(filtered,snapshot,catalog.sources));
    connectPager(container,'history',state,'historyPage',render);connectPager(container,'directory',state,'directoryPage',render);
  }
  render();
}

async function renderConsumption(container,a,{C},p,national=false) {
  const results=await Promise.allSettled([a.json(PATHS.consumption),a.json(PATHS.automatic)]);
  if(results[0].status==='rejected')throw results[0].reason;
  let data=clone(results[0].value);const errors=C.validate(data);
  if(errors.length)throw new Error(errors.slice(0,3).join('；'));
  if(results[1].status==='fulfilled'){try{data=C.mergeAutomatic(data,results[1].value);}catch(e){errors.push('补充历史序列未通过核验：'+e.message);}}
  else errors.push('补充历史序列读取失败：'+results[1].reason.message);
  const state={indicator:p.get('indicator')||'retail',group:p.get('group')||'',query:p.get('query')||p.get('q')||'',frequency:p.get('frequency')||'',basis:p.get('basis')||'',measure:choice(p.get('measure'),['value','yoy','mom','realYoy'],'yoy'),years:choice(p.get('years'),['1','3','5','10','0'],'3'),historyPage:1,directoryPage:1,breakdown:p.get('breakdown')||'categories',period:p.get('period')||''};
  if(!data.indicators.some(i=>i.id===state.indicator))state.indicator='retail';
  if(!state.frequency&&state.basis==='year')state.frequency='annual';
  if(!state.frequency&&state.basis==='quarter')state.frequency='quarterly';
  function resetScope() {const scope=C.defaultScope(data,state.indicator,state.frequency)||C.defaultScope(data,state.indicator);if(scope){state.frequency=scope.frequency;const bases=[...new Set(C.records(data,state.indicator,{frequency:state.frequency}).map(r=>r.basis==='jan_feb'?'month':r.basis))];if(!bases.includes(state.basis))state.basis=scope.basis;}else{state.frequency='';state.basis='';}}
  resetScope();
  if(!p.has('measure')&&!C.records(data,state.indicator,{frequency:state.frequency,basis:state.basis}).some(r=>finite(r.yoy)))state.measure='value';
  const sourceMap=new Map(data.sources.map(s=>[s.id,s]));
  function rowSources(indicator,row) {
    if(!row)return [{name:indicator.name,url:indicator.sourceUrl,note:indicator.pendingReason||indicator.definition}];
    const fields={value:indicator.valueLabel||'原始值',yoy:'同比',mom:'环比',realYoy:'实际同比'};
    const ids=[...new Set([row.sourceId,row.supplementSourceId,...Object.values(row.fieldSources||{})].filter(Boolean))];
    return ids.map(id=>{const s=sourceMap.get(id)||{};return {name:s.title||indicator.name,url:s.url,publisher:s.publisher,provider:C.licensedSource(s)?'东方财富 Choice':'','字段':Object.entries(fields).filter(([field])=>finite(row[field])&&(row.fieldSources?.[field]||row.sourceId)===id).map(([,label])=>label).join('、'),'数据期间':row.period,'频率':C.frequencies[row.frequency],'统计口径':C.bases[row.basis]+'；'+indicator.definition,releaseDate:s.publishedAt||row.releaseDate||'未提供','最近核对':indicator.checkedAt||data.checkedAt,note:row.note||'','数据性质':row.quality==='estimate'?'预计':C.licensedSource(s)?'经授权来源转引':'官方披露'};});
  }
  a.setHeader({title:national?'全国社会消费品零售总额':'消费专题',pretitle:'CONSUMPTION',actions:'<a class="btn" href="'+(national?'retail-monthly-product.html':'consumption-monthly-product.html')+'">'+a.icon('document')+'月度产品</a>'});
  const sync=key=>a.url(key,state[key]);
  function render() {
    const indicator=data.indicators.find(i=>i.id===state.indicator),scope={frequency:state.frequency,basis:state.basis};
    const all=C.records(data,indicator.id,scope),latest=all.at(-1);
    const from=new Date();from.setUTCFullYear(from.getUTCFullYear()-Number(state.years));
    const history=all.filter(r=>state.years==='0'||r.endDate>=from.toISOString().slice(0,10));
    const frequencies=[...new Set(C.records(data,indicator.id).map(r=>r.frequency))];
    const bases=[...new Set(C.records(data,indicator.id,{frequency:state.frequency}).map(r=>r.basis==='jan_feb'?'month':r.basis))];
    const unit=state.measure==='value'?indicator.unit:'%';
    const label={value:indicator.valueLabel||'原始值',yoy:'同比',mom:'环比',realYoy:'实际同比'}[state.measure];
    const directory=C.directory(data,{group:state.group,query:state.query});
    const covered=C.scopeCoverage(data,indicator.id,scope);
    state.historyPage=Math.min(state.historyPage,Math.max(1,Math.ceil(history.length/15)));
    state.directoryPage=Math.min(state.directoryPage,Math.max(1,Math.ceil(directory.length/15)));
    const breakdown=C.retailBreakdown(data,{basis:['month','ytd','year'].includes(state.basis)?state.basis:'month',period:state.period,group:state.breakdown});
    const breakdownBasis=['month','ytd','year'].includes(state.basis)?state.basis:'month';
    const breakdownPeriods=C.records(data,'retail',{frequency:breakdownBasis==='year'?'annual':'monthly',basis:breakdownBasis});
    container.innerHTML=nav(a,national?'national':'consumption')+notices(a,errors)+
      '<div class="row row-deck row-cards mb-3">'+(national?['retail','goods','catering','online_goods','retail_urban','retail_rural']:C.important.slice(0,6)).map(id=>{
        const item=data.indicators.find(i=>i.id===id),row=C.latest(data,id);if(!item)return '';
        const value=finite(row?.yoy)?row.yoy:row?.value,valueUnit=finite(row?.yoy)?'%':item.unit;
        return '<div class="col-sm-6 col-lg-4"><div class="card macro-stat h-100"><div class="card-body"><div class="subheader mb-2">'+a.esc(item.name)+'</div><div class="h1 mb-2">'+a.num(value)+' <span class="h4 text-secondary">'+a.esc(valueUnit)+'</span></div><div class="metric-period small text-secondary">'+a.esc(row?.period||'暂无观测')+' · '+a.esc(C.bases[row?.basis]||'')+'<br>'+a.esc(finite(row?.yoy)?'同比':item.valueLabel||'原始值')+'</div></div><div class="card-footer py-2">'+button(a,'查看趋势','data-consumption="'+a.esc(id)+'"')+'</div></div></div>';
      }).join('')+'</div>'+
      '<div class="card mb-3"><div class="card-header"><h3 class="card-title">'+a.esc(indicator.name)+'</h3><div class="card-actions">'+button(a,'导出当前口径','id="consumption-export"')+'</div></div><div class="card-body"><div class="d-flex flex-wrap gap-3 mb-4">'+
      select(a,'指标','consumption-indicator',data.indicators.map(i=>[i.id,i.name]),indicator.id)+
      select(a,'频率','consumption-frequency',frequencies.map(f=>[f,C.frequencies[f]]),state.frequency)+
      select(a,'统计口径','consumption-basis',bases.map(b=>[b,C.bases[b]]),state.basis)+
      select(a,'数值','consumption-measure',[['yoy','同比'],['value',indicator.valueLabel||'原始值'],['mom','环比'],['realYoy','实际同比']],state.measure)+
      select(a,'历史区间','consumption-years',[['1','近 1 年'],['3','近 3 年'],['5','近 5 年'],['10','近 10 年'],['0','全部历史']],state.years)+
      '</div><div id="consumption-chart" class="dashboard-chart"></div><div class="text-secondary small mt-3">'+a.esc(indicator.definition)+'</div>'+
      (indicator.status==='pending'?'<div class="alert alert-warning mt-3 mb-0">'+a.esc(indicator.pendingReason||'待接入')+'</div>':'')+
      (indicator.updateStatus==='error'?'<div class="alert alert-warning mt-3 mb-0">'+a.esc(indicator.automaticSeries?.filter(s=>s.status==='error').map(s=>s.error).filter(Boolean).join('；')||'补充序列更新失败')+'</div>':'')+
      '</div><div class="card-footer d-flex flex-wrap justify-content-between gap-2"><span class="text-secondary small">'+(covered?a.esc(covered.start+' — '+covered.end+' · '+covered.count+' 期'+(covered.missingPeriods.length?' · 缺失 '+covered.missingPeriods.length+' 期':'')):'暂无该口径观测')+'</span>'+button(a,'来源与字段口径','id="consumption-source"')+'</div></div>'+
      a.tableCard({title:'历史观测',columns:[
        {key:'period',label:'数据期间'},{key:'basis',label:'口径',render:v=>a.esc(C.bases[v])},
        {key:'value',label:(indicator.valueLabel||'原始值')+'（'+indicator.unit+'）',numeric:true,render:v=>a.num(v,4)},
        {key:'yoy',label:'同比（%）',numeric:true,render:v=>a.num(v,4)},
        {key:'mom',label:'环比（%）',numeric:true,render:v=>a.num(v,4)},
        {key:'sourceId',label:'发布日期',render:(v,row)=>a.esc(sourceMap.get(v)?.publishedAt||row.releaseDate||'未提供')},
        {key:'period',label:'来源',render:(v,row)=>button(a,'字段来源','data-consumption-row="'+a.esc(row.period)+'" data-basis="'+a.esc(row.basis)+'"')}
      ],rows:history.slice().reverse().slice((state.historyPage-1)*15,state.historyPage*15),footer:pager(a,state.historyPage,history.length,15,'consumption-history')})+
      (national?'<div class="card my-3"><div class="card-body"><div class="d-flex flex-wrap gap-3">'+
        select(a,'社零结构','retail-breakdown',[['categories','分品类'],['structure','商品与餐饮'],['channels','城乡与渠道']],state.breakdown)+
        select(a,'统计期','retail-period',[['','最新社零期间'],...breakdownPeriods.slice().reverse().map(r=>[r.period,r.period+' · '+C.bases[r.basis]])],state.period)+
        '</div></div></div>'+a.tableCard({title:'社零结构 · '+(breakdown.reference?breakdown.reference.period+' · '+C.bases[breakdown.reference.basis]:'暂无观测'),columns:[
          {key:'indicator',label:'指标',render:i=>'<button class="btn btn-link p-0 text-start" data-consumption="'+a.esc(i.id)+'">'+a.esc(i.name)+'</button>'},
          {key:'row',label:'原始值',numeric:true,render:(r,item)=>a.num(r?.value)+' '+a.esc(item.indicator.unit)},
          {key:'row',label:'同比（%）',numeric:true,render:r=>a.num(r?.yoy)},
          {key:'row',label:'来源',render:(r,item)=>r?button(a,'来源','data-breakdown-source="'+a.esc(item.indicator.id)+'"'):'<span class="text-secondary">该期未提供</span>'}
        ],rows:breakdown.items}):'')+
      '<div class="card my-3"><div class="card-header"><h3 class="card-title">消费指标目录</h3></div><div class="card-body"><form id="consumption-filter" class="d-flex flex-wrap align-items-end gap-3">'+
      select(a,'分类','consumption-group',[['','全部分类'],...[...new Set(data.indicators.map(i=>i.group))]],state.group)+
      field(a,'搜索','consumption-query',state.query,'指标名称或口径')+'<button class="btn btn-primary" type="submit">'+a.icon('search')+'筛选</button></form></div></div>'+
      a.tableCard({title:'全部消费指标 · '+directory.length+' 项',columns:[
        {key:'name',label:'指标',render:(v,i)=>'<button class="btn btn-link p-0 text-start" data-consumption="'+a.esc(i.id)+'">'+a.esc(v)+'</button>'},
        {key:'group',label:'分类'},{key:'status',label:'状态',render:(v,i)=>badge(a,i.updateStatus==='error'?'更新失败':v==='pending'?'待接入':'已接入')},
        {key:'id',label:'最新期间',render:id=>a.esc(C.latest(data,id)?.period||'—')},
        {key:'id',label:'最新同比（%）',numeric:true,render:id=>a.num(C.latest(data,id)?.yoy)}
      ],rows:directory.slice((state.directoryPage-1)*15,state.directoryPage*15),footer:pager(a,state.directoryPage,directory.length,15,'consumption-directory')});
    a.chart(container.querySelector('#consumption-chart'),pointsFromSegments(C.segments(history,state.measure),state.measure),{label:indicator.name+' · '+label,unit});
    function chooseIndicator(id) {state.indicator=id;state.frequency='';state.basis='';state.historyPage=1;resetScope();const rows=C.records(data,id,{frequency:state.frequency,basis:state.basis});if(!rows.some(r=>finite(r[state.measure]))){state.measure=rows.some(r=>finite(r.yoy))?'yoy':'value';sync('measure');}['indicator','frequency','basis'].forEach(sync);render();}
    container.querySelectorAll('[data-consumption]').forEach(el=>el.onclick=()=>chooseIndicator(el.dataset.consumption));
    container.querySelector('#consumption-indicator').onchange=e=>chooseIndicator(e.target.value);
    for(const key of ['frequency','basis','measure','years'])container.querySelector('#consumption-'+key).onchange=e=>{state[key]=e.target.value;if(key==='frequency'){state.basis='';resetScope();sync('basis');}state.historyPage=1;sync(key);render();};
    container.querySelector('#consumption-source').onclick=()=>a.sourceDialog(indicator.name,rowSources(indicator,latest));
    container.querySelectorAll('[data-consumption-row]').forEach(el=>el.onclick=()=>a.sourceDialog(indicator.name,rowSources(indicator,all.find(r=>r.period===el.dataset.consumptionRow&&r.basis===el.dataset.basis))));
    container.querySelector('#consumption-export').onclick=()=>a.download(indicator.id+'-'+state.frequency+'-'+state.basis+'.csv',C.csv(data,all));
    container.querySelector('#consumption-filter').onsubmit=e=>{e.preventDefault();state.group=container.querySelector('#consumption-group').value;state.query=container.querySelector('#consumption-query').value;state.directoryPage=1;sync('group');sync('query');a.url('q','');render();};
    connectPager(container,'consumption-history',state,'historyPage',render);connectPager(container,'consumption-directory',state,'directoryPage',render);
    if(national){container.querySelector('#retail-breakdown').onchange=e=>{state.breakdown=e.target.value;sync('breakdown');render();};container.querySelector('#retail-period').onchange=e=>{state.period=e.target.value;sync('period');render();};container.querySelectorAll('[data-breakdown-source]').forEach(el=>el.onclick=()=>{const item=breakdown.items.find(i=>i.indicator.id===el.dataset.breakdownSource);a.sourceDialog(item.indicator.name,rowSources(item.indicator,item.row));});}
  }
  render();
}

async function renderExpectations(container,a,model,p) {
  const {M,E}=model,{catalog,snapshot,expectations,errors}=await loadMacro(a,model);
  a.setHeader({title:'指标预测',pretitle:'MACRO EXPECTATIONS',actions:'<a class="btn" href="data-notes.html#macro">'+a.icon('book')+'预测口径</a>'});
  if(!expectations){container.innerHTML=nav(a,'expectations')+notices(a,errors)+a.empty('预测数据暂时无法读取');return;}
  const available=E.ids.filter(id=>expectations.series[id]&&catalog.series.some(s=>s.id===id));
  const state={indicator:available.includes(p.get('indicator'))?p.get('indicator'):available[0],page:1};
  function render() {
    const spec=catalog.series.find(s=>s.id===state.indicator),feed=expectations.series[spec.id],actuals=new Map(M.rows(snapshot.series[spec.id]).map(r=>[r.period,r]));
    const rows=feed.observations.slice().sort((x,y)=>y.period.localeCompare(x.period)).map(row=>({...row,actual:E.actual(spec,actuals.get(row.period)),difference:E.difference(expectations,spec,actuals.get(row.period))}));
    container.innerHTML=nav(a,'expectations')+notices(a,errors)+
      '<div class="card mb-3"><div class="card-header"><h3 class="card-title">Choice 指标预测</h3><div class="card-actions">'+button(a,'导出预测与实际','id="expectation-export"')+'</div></div><div class="card-body"><div class="d-flex flex-wrap gap-3 mb-3">'+select(a,'指标','expectation-indicator',available.map(id=>[id,catalog.series.find(s=>s.id===id).name]),state.indicator)+'</div>'+meta(a,[['统计口径',feed.basis],['预测获取时间',feed.fetchedAt],['预测发布日期','未提供'],['公布前版本',feed.vintageVerified?'已核验':'未核验']])+'</div><div class="card-footer small text-secondary">实际与预测的可比性按原始数据标记保留。未核验公布前版本的预测不作为超预期结论。</div></div>'+
      a.tableCard({title:spec.name+' · 预测历史',columns:[
        {key:'period',label:'数据期间'},{key:'value',label:'Choice 预测（%）',numeric:true,render:v=>a.num(v,4)},
        {key:'actual',label:'实际同比（%）',numeric:true,render:v=>a.num(v,4)},
        {key:'difference',label:'实际－预测（百分点）',numeric:true,render:v=>sign(a,v,4)},
        {key:'comparisonAllowed',label:'可比性',render:v=>a.esc(v===true?'可比':'不直接比较')},
        {key:'forecastDate',label:'预测发布日期',render:v=>a.esc(v||'未提供')},
        {key:'period',label:'来源',render:()=>linked(a,feed.sourceUrl,'Choice')}
      ],rows:rows.slice((state.page-1)*20,state.page*20),footer:pager(a,state.page,rows.length,20,'expectation')});
    container.querySelector('#expectation-indicator').onchange=e=>{state.indicator=e.target.value;state.page=1;a.url('indicator',state.indicator);render();};
    container.querySelector('#expectation-export').onclick=()=>a.download(spec.id+'-expectations.csv',E.csv(expectations,spec,snapshot.series[spec.id]||{}));
    connectPager(container,'expectation',state,'page',render);
  }
  render();
}

async function renderFedwatch(container,a,{F},p) {
  const data=await a.json(PATHS.fedwatch),today=new Date().toISOString().slice(0,10);
  const meetings=(data.meetings||[]).filter(m=>F.snapshots(m).length).slice().sort((x,y)=>x.meetingDate.localeCompare(y.meetingDate));
  const wanted=meetings.find(m=>m.meetingDate===p.get('meeting'))||meetings.find(m=>m.meetingDate>=today)||meetings.at(-1);
  a.setHeader({title:'FedWatch 利率概率',pretitle:'INTEREST RATE EXPECTATIONS',actions:'<a class="btn" href="data-notes.html#macro">'+a.icon('book')+'来源与口径</a>'});
  if(!wanted){container.innerHTML=nav(a,'fedwatch')+a.empty('暂无通过核验的 FedWatch 快照');return;}
  const state={meeting:wanted.meetingDate,snapshot:p.get('snapshot')||'',compare:p.get('compare')||''};
  const sourceMap=new Map((data.sources||[]).map(s=>[s.id,s]));
  const rate=range=>a.num(range.lower)+'% — '+a.num(range.upper)+'%';
  function aggregate(snapshot) {
    const values=F.aggregate(snapshot,data.policy);if(!values)return null;
    for(const r of snapshot.missingRanges||[]) {
      if(!finite(r.lower)||!finite(r.upper)){values.cut=null;values.hold=null;values.hike=null;continue;}
      const [lower,upper]=data.policy.range;
      if(r.upper<=lower)values.cut=null;else if(r.lower>=upper)values.hike=null;else values.hold=null;
    }
    return values;
  }
  function source(snapshot) {
    const src=sourceMap.get(snapshot.sourceId)||{};
    return {name:src.name||'CME FedWatch',url:src.url||'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
      '会议日期':state.meeting,'源观测时间':snapshot.observedAt||snapshot.observedDate||'未提供',
      '获取时间':snapshot.retrievedAt||src.retrievedAt||'未提供','来源时区':snapshot.timezone||'未提供',
      '概率单位':'%','利率单位':'%','原始证据':src.evidence?.path||'','证据校验值':src.evidence?.sha256||src.sha256||''};
  }
  function render() {
    const meeting=meetings.find(m=>m.meetingDate===state.meeting),snapshots=F.snapshots(meeting);
    const selected=snapshots.find(s=>F.key(s)===state.snapshot)||snapshots.at(-1);state.snapshot=F.key(selected);
    const index=snapshots.indexOf(selected),priorChoices=snapshots.slice(0,index);
    const previous=priorChoices.find(s=>F.key(s)===state.compare)||priorChoices.at(-1)||null;state.compare=previous?F.key(previous):'';
    const rows=[...F.comparison(selected,previous),...(selected.missingRanges||[]).filter(r=>finite(r.lower)&&finite(r.upper)).map(r=>({...r,probability:null,previous:previous?.ranges.find(prior=>prior.lower===r.lower&&prior.upper===r.upper)?.probability??null,change:null}))].sort((x,y)=>x.lower-y.lower);
    const values=aggregate(selected),table=F.latestTable(data),warning=F.refreshWarning(data.fedwatchUpdate,selected);
    const labels=[['cut','降息'],['hold','不变'],['hike','加息']];
    container.innerHTML=nav(a,'fedwatch')+(warning?notices(a,[warning+(data.fedwatchUpdate?.error||'')]):'')+
      '<div class="card mb-3"><div class="card-body"><div class="d-flex flex-wrap gap-3">'+
      select(a,'会议日期','fed-meeting',meetings.map(m=>[m.meetingDate,m.meetingDate+(m.meetingDate<today?' · 历史会议':'')]),state.meeting)+
      select(a,'概率快照','fed-snapshot',snapshots.slice().reverse().map(s=>[F.key(s),F.label(s)]),state.snapshot)+
      select(a,'对比快照','fed-compare',priorChoices.length?priorChoices.slice().reverse().map(s=>[F.key(s),F.label(s)]):[['','无可比快照']],state.compare)+
      '</div></div><div class="card-footer small text-secondary">源观测时间：'+a.esc(selected.observedAt||selected.observedDate||'未提供')+' · 获取时间：'+a.esc(selected.retrievedAt||'未提供')+'</div></div>'+
      '<div class="row row-deck row-cards mb-3">'+labels.map(([key,label])=>'<div class="col-md-4"><div class="card macro-stat h-100"><div class="card-body"><div class="subheader mb-2">'+label+'概率</div><div class="h1 mb-2">'+a.num(values?.[key],1)+' <span class="h4 text-secondary">%</span></div><div class="metric-period text-secondary small">相对政策区间 '+a.esc((data.policy?.range||[]).map(v=>a.num(v)).join('% — '))+'%<br>政策日期 '+a.esc(data.policy?.decisionDate||'未提供')+'</div></div></div></div>').join('')+'</div>'+
      a.tableCard({title:state.meeting+' · 目标利率概率',actions:button(a,'来源','id="fed-source"')+button(a,'导出快照','id="fed-export"'),columns:[
        {key:'lower',label:'目标利率区间',render:(v,r)=>rate(r)},
        {key:'probability',label:'所选快照（%）',numeric:true,render:v=>a.num(v,2)},
        {key:'previous',label:'对比快照（%）',numeric:true,render:v=>a.num(v,2)},
        {key:'change',label:'变化（百分点）',numeric:true,render:v=>sign(a,v,2)}
      ],rows,footer:previous?'对比：'+a.esc(F.label(previous)):'暂无更早的可比快照'})+
      '<div class="card my-3"><div class="card-header"><h3 class="card-title">概率历史 · '+a.esc(state.meeting)+'</h3></div><div class="card-body"><div id="fed-chart" class="dashboard-chart"></div><div class="text-secondary small mt-3">归类基准：'+a.esc(data.policy?.decisionDate||'未提供')+' 政策区间；缺失区间未计作零概率。</div></div></div>'+
      (table?a.tableCard({title:'全部会议概率 · 获取 '+table.retrievedAt,actions:button(a,'导出整表','id="fed-table-export"'),columns:[
        {key:'meetingDate',label:'会议日期'},
        ...table.columns.map((col,i)=>({key:'probabilities',label:rate(col),numeric:true,render:values=>a.num(values[i],1)}))
      ],rows:table.rows,footer:'概率单位：% · 源观测时间：'+a.esc(table.observedAt||'未提供')})+
      '<div class="mt-3">'+a.tableCard({title:'联邦基金期货 · 获取 '+table.retrievedAt,columns:[
        {key:'contract',label:'合约'},{key:'contractMonth',label:'合约月份'},
        {key:'rawPrice',label:'期货价格',numeric:true}
      ],rows:table.futures})+'</div>':'');
    a.chart(container.querySelector('#fed-chart'),[],{label:state.meeting+' 利率概率历史',unit:'%',series:labels.map(([key,label])=>({name:label,points:snapshots.map(s=>({period:F.time(s),label:F.label(s),value:aggregate(s)?.[key]??null}))}))});
    for(const key of ['meeting','snapshot','compare'])container.querySelector('#fed-'+key).onchange=e=>{state[key]=e.target.value;if(key==='meeting'){state.snapshot='';state.compare='';a.url('snapshot','');a.url('compare','');}a.url(key,state[key]);render();};
    container.querySelector('#fed-source').onclick=()=>a.sourceDialog('FedWatch 概率来源',[source(selected),{name:'所列政策区间',...sourceMap.get(data.policy?.sourceId),'决策日期':data.policy?.decisionDate}]);
    container.querySelector('#fed-export').onclick=()=>a.download('fedwatch-'+state.meeting+'.csv',a.csv(rows.map(r=>({'会议日期':state.meeting,'源观测时间':selected.observedAt||selected.observedDate||null,'获取时间':selected.retrievedAt,'目标利率下限%':r.lower,'目标利率上限%':r.upper,'概率%':r.probability,'对比快照':previous?F.label(previous):null,'前次概率%':r.previous,'变化百分点':r.change,'来源':sourceMap.get(selected.sourceId)?.url}))));
    if(table)container.querySelector('#fed-table-export').onclick=()=>a.download('fedwatch-full-table.csv',a.csv(table.rows.map(row=>({'会议日期':row.meetingDate,...Object.fromEntries(table.columns.map((col,i)=>[rate(col)+'概率%',row.probabilities[i]])),'获取时间':table.retrievedAt,'源观测时间':table.observedAt,'来源':sourceMap.get(table.sourceId)?.url}))));
  }
  render();
}

async function renderPredictions(container,a,{P},p) {
  const data=await a.json(PATHS.predictions);
  if(!Array.isArray(data.markets))throw new Error('预测市场数据格式错误');
  const state={category:p.get('predictionTopic')||p.get('category')||'',query:p.get('predictionQuery')||p.get('query')||p.get('q')||'',sort:choice(p.get('predictionSort')||p.get('sort'),['volume','deadline'],'volume'),scope:p.get('history')==='1'?'all':'active',page:1};
  a.setHeader({title:'事件预测',pretitle:'PREDICTION MARKETS',actions:'<a class="btn" href="data-notes.html#macro">'+a.icon('book')+'预测市场口径</a>'});
  const probability=value=>finite(value)?a.num(value*100,2)+'%':'—';
  const reportedVolume=markets=>{const values=markets.map(m=>m.volume24h).filter(finite);return values.length?values.reduce((sum,value)=>sum+value,0):null;};
  function eventDialog(group) {
    const rows=group.markets.flatMap(m=>(m.outcomes||[]).map(o=>({market:m,outcome:o})));
    const dialog=a.dialog(group.title,
      '<div class="mb-3">'+meta(a,[['数据分类',group.dataType.label],['概率含义',P.measurement(group)],['收录范围',group.complete?'完整收录该事件的活跃合约':'部分收录'],['数据获取时间',data.fetchedAt],['最近核对',data.checkedAt]])+'</div>'+
      a.tableCard({title:'已收录合约与结果',columns:[
        {key:'market',label:'合约条件',render:m=>'<span class="record-title">'+a.esc(P.optionLabel(group,m))+'</span><div class="small text-secondary text-break">'+a.esc(m.question)+'</div>'},
        {key:'outcome',label:'结果',render:o=>a.esc(o.nameZh||o.name)},
        {key:'outcome',label:'概率',numeric:true,render:o=>probability(o.probability)},
        {key:'outcome',label:'前次概率',numeric:true,render:o=>probability(o.previousProbability)},
        {key:'market',label:'截止日期',render:m=>a.esc(m.endDate||'未提供')},
        {key:'market',label:'来源',render:m=>linked(a,m.url,'Polymarket')}
      ],rows})+
      '<div class="mt-3">'+a.tableCard({title:'合约市场快照',columns:[
        {key:'questionZh',label:'合约',render:(v,m)=>'<span class="record-title">'+a.esc(P.optionLabel(group,m))+'</span>'},
        {key:'volume24h',label:'24h 交易量（美元）',numeric:true,render:v=>a.num(v)},
        {key:'liquidity',label:'流动性（美元）',numeric:true,render:v=>a.num(v)},
        {key:'spread',label:'买卖价差',numeric:true,render:v=>a.num(v,4)},
        {key:'updatedAt',label:'源更新时间',render:v=>a.esc(v||'未提供')}
      ],rows:group.markets})+'</div><div class="text-secondary small mt-3">各合约按自身结算条件保留概率，跨条件未归一化。</div>');
    return dialog;
  }
  function render() {
    const groups=P.groups(data.markets,{query:state.query,category:state.category,sort:state.sort,wholeEvents:true,now:state.scope==='all'?0:Date.now()});
    state.page=Math.min(state.page,Math.max(1,Math.ceil(groups.length/15)));
    const markets=groups.flatMap(g=>g.markets);
    container.innerHTML=nav(a,'predictions')+
      (data.status==='error'?notices(a,[data.error||'最新更新失败，显示已保留快照']):'')+
      '<div class="card mb-3"><div class="card-header"><h3 class="card-title">预测市场快照</h3><div class="card-actions">'+button(a,'导出当前合约','id="prediction-export"')+'</div></div><div class="card-body"><form id="prediction-filter" class="d-flex flex-wrap align-items-end gap-3">'+
      select(a,'分类','prediction-category',[['','全部分类'],...P.dataTypes.map(t=>t.label),...[...new Set(data.markets.map(m=>m.category))].filter(c=>!P.dataTypes.some(t=>t.label===c))],state.category)+
      select(a,'截止状态','prediction-scope',[['active','尚未截止'],['all','全部已收录合约']],state.scope)+
      select(a,'排序','prediction-sort',[['volume','已披露 24h 交易量'],['deadline','截止时间']],state.sort)+
      field(a,'搜索','prediction-query',state.query,'事件、条件或关键字')+'<button class="btn btn-primary" type="submit">'+a.icon('search')+'筛选</button></form></div><div class="card-footer small text-secondary">快照获取：'+a.esc(data.fetchedAt||'未提供')+' · 最近核对：'+a.esc(data.checkedAt||'未提供')+'</div></div>'+
      '<div class="row row-deck row-cards mb-3">'+[
        ['已筛选事件',groups.length,'个'],['已收录合约',markets.length,'个'],['已披露 24h 交易量',reportedVolume(markets),'美元']
      ].map(([label,value,unit])=>'<div class="col-md-4"><div class="card"><div class="card-body"><div class="subheader mb-2">'+label+'</div><div class="h1 mb-0">'+a.num(value,0)+' <span class="h4 text-secondary">'+unit+'</span></div></div></div></div>').join('')+'</div>'+
      a.tableCard({title:'事件目录',columns:[
        {key:'title',label:'事件',render:(v,g)=>'<button class="btn btn-link p-0 record-title" data-prediction="'+a.esc(g.id)+'">'+a.esc(v)+'</button><div class="text-secondary small">'+a.esc(g.dataType.label+' · '+P.measurement(g))+(g.complete?'':' · 部分收录')+'</div>'},
        {key:'markets',label:'概率最高条件',render:(rows,g)=>'<div class="data-cell">'+a.esc(P.optionLabel(g,rows[0]))+'</div>'},
        {key:'markets',label:'该条件概率',numeric:true,render:rows=>probability(P.affirmative(rows[0])?.probability)},
        {key:'volume',label:'已披露 24h 交易量（美元）',numeric:true,render:(v,group)=>a.num(reportedVolume(group.markets),0)},
        {key:'endDate',label:'最早截止日',render:v=>a.esc(v?v.slice(0,10):'未提供')},
        {key:'id',label:'详情',render:id=>button(a,'全部条件','data-prediction="'+a.esc(id)+'"')}
      ],rows:groups.slice((state.page-1)*15,state.page*15),footer:pager(a,state.page,groups.length,15,'prediction')});
    container.querySelector('#prediction-filter').onsubmit=e=>{e.preventDefault();for(const key of ['category','scope','sort','query'])state[key]=container.querySelector('#prediction-'+key).value;state.page=1;a.url('category',state.category);a.url('query',state.query);a.url('sort',state.sort);a.url('history',state.scope==='all'?'1':'');['predictionTopic','predictionQuery','predictionSort'].forEach(key=>a.url(key,''));render();};
    container.querySelectorAll('[data-prediction]').forEach(el=>el.onclick=()=>eventDialog(groups.find(g=>g.id===el.dataset.prediction)));
    container.querySelector('#prediction-export').onclick=()=>a.download('prediction-contracts.csv',a.csv(groups.flatMap(group=>group.markets.flatMap(m=>(m.outcomes||[]).map(o=>({'事件':group.title,'分类':group.dataType.label,'原分类':m.category,'概率含义':P.measurement(group),'合约条件':P.optionLabel(group,m),'原始问题':m.question,'结果':o.nameZh||o.name,'概率':o.probability,'前次概率':o.previousProbability,'24h交易量美元':m.volume24h,'流动性美元':m.liquidity,'截止时间':m.endDate,'源更新时间':m.updatedAt,'获取时间':data.fetchedAt,'来源':m.url,'事件合约完整收录':group.complete?'是':'否'}))))));
    connectPager(container,'prediction',state,'page',render);
  }
  render();
}

async function renderRegional(container,a) {
  const {renderExplorer}=await import('./explorer.js');
  container.innerHTML=nav(a,'regional')+'<div class="card mb-3"><div class="card-body"><div class="btn-list"><a class="btn" href="dashboard.html?file=data%2Fregional-retail%2Fobservations.json">地区观测</a><a class="btn" href="dashboard.html?file=data%2Fregional-retail%2Fhistory.json">历史序列</a><a class="btn" href="dashboard.html?file=data%2Fregional-retail%2Ftier-supplement.json">城市层级补充</a><a class="btn" href="dashboard.html?file=data%2Fregional-retail%2Fcity-tiers.json">城市分类</a></div></div></div><div id="regional-explorer"></div>';
  await renderExplorer(container.querySelector('#regional-explorer'),a,{file:'data/regional-retail/observations.json',title:'地方社会消费品零售总额'});
}

export async function renderMacro(container,api) {
  const model=await models(),p=new URLSearchParams(location.search),page=location.pathname.split('/').pop();
  let view=p.get('view')||'indicators';
  if(page==='consumption-macro.html')view='consumption';
  if(page==='national-retail.html')view='national';
  if(page==='regional-retail.html')view='regional';
  if(page==='consumption-monthly-product.html')view='consumption';
  if(page==='retail-monthly-product.html')view='national';
  if(page==='cpi-monthly-product.html'){view='consumption';if(!p.has('indicator'))p.set('indicator','cpi');if(!p.has('measure'))p.set('measure','value');}
  if(['prediction','polymarket','markets'].includes(view))view='predictions';
  if(['forecast','forecasts'].includes(view))view='expectations';
  if(['fed','rates'].includes(view))view='fedwatch';
  if(view==='consumption')return renderConsumption(container,api,model,p);
  if(view==='national')return renderConsumption(container,api,model,p,true);
  if(view==='regional')return renderRegional(container,api);
  if(view==='expectations')return renderExpectations(container,api,model,p);
  if(view==='fedwatch')return renderFedwatch(container,api,model,p);
  if(view==='predictions')return renderPredictions(container,api,model,p);
  return renderIndicators(container,api,model,p);
}
