(function(){
  'use strict';
  const R=HotelResearchModel,J=JinjiangResearchModel,D=SiteData,esc=D.esc;
  const state={region:'domestic',tier:'all',mode:'全部',cohortId:'',segmentPeriod:'',revenueItem:'持续加盟服务',revenueRegion:'境内有限服务型酒店'};
  let cachedRows,cachedModel;
  const menu={compare:'锦江总览',operating:'境内与海外',expansion:'开店与加盟',profit:'收入与利润',logic:'改革兑现',scenario:'预期与测算',raw:'数据明细'};
  function model(rows){if(rows!==cachedRows){cachedRows=rows;cachedModel=J.build(rows);}return cachedModel;}
  const heading=(title,period='')=>'<div class="jj-section-head"><h3>'+esc(title)+'</h3>'+(period?'<span>'+esc(period)+'</span>':'')+'</div>';
  const unit=o=>o?.unit==='百万元'?(o.currency==='EUR'?'百万欧元':o.currency==='CNY'?'亿元':'百万'+o.currency):o?.unit||'';
  const shown=o=>o?.unit==='百万元'&&o.currency==='CNY'?o.value/100:o?.value;
  function metricCard(U,label,o,change,detail=''){
    const value=o?U.numeric(shown(o),o.unit==='家'||o.unit==='间'?0:2):'—';
    return '<article class="jj-kpi"><h4>'+esc(label)+'</h4><strong>'+value+'<span>'+esc(unit(o))+'</span></strong><div class="jj-kpi-change">'+(change||'—')+'</div><div class="jj-kpi-bottom"><small>'+esc(detail||[o?.period,o?.periodBasis,o?.currency].filter(Boolean).join(' · '))+'</small>'+U.source(o)+'</div></article>';
  }
  function derivedCard(U,label,o,detail=''){return '<article class="jj-kpi"><h4>'+esc(label)+'</h4><strong>'+U.numeric(o?.value,2)+'<span>'+esc(o?.unit||'')+'</span></strong><div class="jj-kpi-bottom"><small>'+esc(detail)+'</small>'+U.source(o)+'</div></article>';}
  function grid(cards,cls=''){return '<div class="jj-kpis '+cls+'">'+cards.join('')+'</div>';}
  function reportPeriod(m,requested){if(m.segmentPeriods.includes(requested))return requested;return m.segmentPeriods[0]||'';}
  function periodTools(m,U,env){state.segmentPeriod=state.segmentPeriod&&m.segmentPeriods.includes(state.segmentPeriod)?state.segmentPeriod:reportPeriod(m,env.financePeriod);return '<div class="hr-tools">'+U.field('分部报告期','jj-segment-period',m.segmentPeriods,state.segmentPeriod)+'</div>';}
  function briefTable(U,headers,rows){return U.table(headers.map(esc),rows.map(U.tr).join(''));}
  function growthChart(U,m,periods,title,series,unit='%'){
    return '<article class="hr-card"><h3>'+esc(title)+'</h3>'+U.lineChart(series.map(s=>({name:s.name,points:periods.map(per=>{const g=R.growth(m.data,s.row(per));return {value:g?.unit===unit?g.value:null};})})),periods,title,unit)+'</article>';
  }
  function snapshot(env){
    const {U,quarter,financePeriod}=env,m=model(env.data.rows),segmentPeriod=reportPeriod(m,financePeriod),f=metric=>m.group(metric,financePeriod),per=U.quarters(quarter);
    let html=heading('合并业绩',financePeriod);
    html+=grid([['营业收入','revenue'],['归母净利润','parent_profit'],['扣非归母净利润','deducted_profit'],['经营现金流','operating_cf']].map(([label,metric])=>metricCard(U,label,f(metric),U.grow(m.data,f(metric)))));
    html+=heading('境内经营与盈利兑现',quarter)+'<div class="jj-overview-grid">';
    const dom=m.operating('revpar',quarter),direct=m.cohort(quarter,'domestic','直营'),same=m.cohort(quarter),overseas=m.segment('parent_profit','overseas',segmentPeriod),channel=m.matrixRow('订房渠道','境内有限服务型酒店',segmentPeriod),fees=m.matrixRow('持续加盟服务','境内有限服务型酒店',segmentPeriod);
    const items=[['境内有限服务型',dom,U.grow(m.data,dom),'RevPAR'],['境内直营同店',direct,U.grow(m.data,direct),'RevPAR · '+(direct?.period||'')],['境内持续加盟服务',fees,U.grow(m.data,fees),'收入 · '+segmentPeriod],['境内订房渠道',channel,U.grow(m.data,channel),'收入 · '+segmentPeriod],['海外有限服务型',overseas,U.cell(m.delta(overseas)),'归母净利润 · '+segmentPeriod]];
    html+=items.map(([title,o,change,label])=>'<article class="jj-driver"><h4>'+title+'</h4><span class="hr-caption">'+esc(label)+'</span><strong>'+U.numeric(shown(o),2)+' <small>'+esc(unit(o))+'</small></strong><div>'+change+'</div>'+U.source(o)+'</article>').join('')+'</div>';
    html+='<div class="jj-charts">'+growthChart(U,m,per,'境内有限服务型 · RevPAR同比',[{name:'全部',row:p=>m.operating('revpar',p)},{name:'直营',row:p=>m.operating('revpar',p,'domestic','all','直营')},{name:'加盟',row:p=>m.operating('revpar',p,'domestic','all','加盟')}])+'<article class="hr-card"><h3>单季归母与扣非利润</h3>'+U.lineChart([{name:'归母',points:per.map(p=>{const o=m.group('parent_profit',p);return {value:o?o.value/100:null};})},{name:'扣非',points:per.map(p=>{const o=m.group('deducted_profit',p);return {value:o?o.value/100:null};})}],per,'单季归母与扣非利润','亿元')+'</article></div>';
    html+=heading('关键核对',segmentPeriod)+briefTable(U,['事项','本期数据','对照 / 增减','来源口径'],[
      ['境内全部 / 同店 RevPAR同比',U.grow(m.data,m.operating('revpar',same?.period)),U.grow(m.data,same),'同店 '+esc(same?.period||'—')],
      ['海外亏损',U.cell(overseas),U.cell(m.delta(overseas)),'有限服务型 · 原币EUR'],
      ['财务费用',U.cell(m.group('finance_expense',segmentPeriod)),U.cell(m.delta(m.group('finance_expense',segmentPeriod))),'合并报表 · CNY'],
      ['归母 − 扣非',U.cell(nonrecurring(m,segmentPeriod)),U.cell(nonrecurringChange(m,segmentPeriod)),'归母非经常性损益净额']]);
    return html;
  }
  function operating(env){
    const {U,quarter}=env,m=model(env.data.rows),p=U.quarters(quarter,12),area=state.region==='domestic'?'境内':'海外',r=metric=>m.operating(metric,quarter,state.region,state.tier,state.mode);
    let html='<div class="hr-tools">'+U.field('区域','jj-region',[{value:'domestic',label:'境内'},{value:'overseas',label:'海外'}],state.region)+U.field('档次','jj-tier',[{value:'all',label:'有限服务型合计'},{value:'mid',label:'中端'},{value:'economy',label:'经济型'}],state.tier)+U.field('经营模式','jj-mode',['全部','直营','加盟'],state.mode)+'</div>';
    html+=heading(area+'有限服务型 · 量价',quarter)+grid(['revpar','adr','occ'].map(metric=>metricCard(U,U.metric(metric),r(metric),U.grow(m.data,r(metric)))), 'jj-three');
    html+='<div class="jj-charts">'+growthChart(U,m,p,'量价同比',[{name:'RevPAR',row:per=>m.operating('revpar',per,state.region,state.tier,state.mode)},{name:'ADR',row:per=>m.operating('adr',per,state.region,state.tier,state.mode)}])+growthChart(U,m,p,'入住率同比',[{name:'入住率',row:per=>m.operating('occ',per,state.region,state.tier,state.mode)}],'百分点')+'</div>';
    html+=briefTable(U,['季度','RevPAR','同比','ADR','同比','入住率','同比 / pp'],p.slice().reverse().map(per=>{const rows=['revpar','adr','occ'].map(metric=>m.operating(metric,per,state.region,state.tier,state.mode));return [per,...rows.flatMap(o=>[U.cell(o),U.grow(m.data,o)])];}));
    const cohorts=m.cohorts(state.region,state.mode,state.tier);const selected=cohorts.find(o=>o.id===state.cohortId)||m.cohort(quarter,state.region,state.mode,state.tier);state.cohortId=selected?.id||'';
    html+=heading('固定样本同店');
    if(!cohorts.length)return html+U.empty('该范围暂无同店披露');
    html+='<div class="hr-tools">'+U.field('同店样本 / 报告期','jj-cohort',cohorts.map(o=>({value:o.id,label:o.period+' · '+o.basis})),state.cohortId,true)+'</div>';
    html+=briefTable(U,['指标','全口径','全口径同比','固定同店','同店同比','同店 − 全口径'],['revpar','adr','occ'].map(metric=>{const sel=R.selector(selected);if(metric==='occ')delete sel.currency;const same=R.one(m.data,sel,metric,selected.period),all=m.operating(metric,selected.period,state.region,state.tier,state.mode),a=R.growth(m.data,same),b=R.growth(m.data,all);const difference=a&&b&&a.unit===b.unit?{value:a.value-b.value,unit:'百分点',inputs:[...a.inputs,...b.inputs],method:'同店同比 − 同期全口径同比'}:null;return [U.metric(metric),U.cell(all),U.grow(m.data,all),U.cell(same),U.grow(m.data,same),U.cell(difference)];}));
    return html;
  }
  function expansion(env){
    const {U,quarter}=env,m=model(env.data.rows),s=m.structure(quarter),p=U.quarters(quarter,12);
    let html=heading('酒店网络',quarter)+grid([metricCard(U,'全球已开业',m.scale('hotels',quarter),U.grow(m.data,m.scale('hotels',quarter))),metricCard(U,'有限服务型',s.finite,U.grow(m.data,s.finite)),derivedCard(U,'有限服务型加盟占比',s.franchiseShare,'加盟 / 有限服务型酒店数'),derivedCard(U,'有限服务型中端占比',s.midShare,'中端 / 有限服务型酒店数')]);
    const stock=m.stockBridge(quarter);
    html+=heading('开关店勾稽',quarter);
    html+=briefTable(U,['上季末','新开','退出','转筹建','本季净增','本季末','未解释差额'],[[U.cell(stock?.prior,0),U.cell(stock?.opened,0),U.cell(stock?.closed,0),U.cell(stock?.transfer,0),U.cell(stock?.net,0),U.cell(stock?.current,0),U.cell(stock?.residual,0)]]);
    html+=briefTable(U,['季度','开业酒店','新开','退出','转筹建','净增','签约酒店','签约未开业差额'],p.slice().reverse().map(per=>[per,...['hotels','opened','closed','to_pipeline','net_opened','signed_hotels'].map(metric=>U.cell(m.scale(metric,per),0)),U.cell(m.contractGap(per),0)]));
    html+='<div class="jj-charts"><article class="hr-card"><h3>新开、退出与净增</h3>'+U.lineChart(['opened','closed','net_opened'].map(metric=>({name:U.metric(metric),points:p.map(per=>({value:m.scale(metric,per)?.value}))})),p,'开关店','家')+'</article><article class="hr-card"><h3>有限服务型 · 结构升级</h3>'+U.lineChart([{name:'加盟酒店占比',points:p.map(per=>({value:m.structure(per).franchiseShare?.value}))},{name:'中端酒店占比',points:p.map(per=>({value:m.structure(per).midShare?.value}))},{name:'中端客房占比',points:p.map(per=>({value:m.structure(per).midRoomShare?.value}))}],p,'有限服务型结构','%')+'</article></div>';
    html+=heading('境内外开业与签约',quarter)+briefTable(U,['地区 / 模式','开业酒店','签约酒店','客房'],['中国大陆境内 / 合计','海外 / 合计','海外 / 欧洲','海外 / 其中:法国','海外 / 亚洲','海外 / 美洲','海外 / 非洲'].flatMap(region=>['直营','加盟'].map(mode=>{const sel={region,mode,scope:'全部',basis:'原报告境内外开业签约规模',frequency:'季度'};return [esc(region+' · '+mode),...['hotels','signed_hotels','rooms'].map(metric=>U.cell(m.get(metric,sel,quarter),0))];})));
    return html;
  }
  function nonrecurring(m,period){if(!period)return null;const p=m.group('parent_profit',period),d=m.group('deducted_profit',period);return R.compatible(p,d)?{value:p.value-d.value,unit:p.unit,inputs:[p,d],method:'归母净利润 − 扣非归母净利润'}:null;}
  function nonrecurringChange(m,period){const b=m.qualityBridge(period);return b?.components[1]||null;}
  function bridge(U,b,title){
    if(!b)return '<article class="hr-card"><h3>'+esc(title)+'</h3>'+U.empty('缺少同口径对照')+'</article>';
    const base=b.start.value,steps=[{label:'上年同期',value:base,start:0,end:base,inputs:[b.start]}];let current=base;
    for(const c of b.components){steps.push({...c,start:current,end:current+c.value});current+=c.value;}steps.push({label:'本期',value:b.end.value,start:0,end:b.end.value,inputs:[b.end]});
    const lo=Math.min(0,...steps.flatMap(x=>[x.start,x.end])),hi=Math.max(0,...steps.flatMap(x=>[x.start,x.end])),range=hi-lo||1,y=v=>190-(v-lo)/range*140,w=630/steps.length;
    const chart='<svg class="hr-chart quotes-chart" viewBox="0 0 720 265" role="img" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title><line x1="40" x2="690" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#d5dfe4"/>'+steps.map((s,i)=>{const x=45+w*i;return '<rect x="'+x+'" y="'+Math.min(y(s.start),y(s.end))+'" width="'+(w-12)+'" height="'+Math.max(1,Math.abs(y(s.start)-y(s.end)))+'" fill="'+(i===0||i===steps.length-1?'#215a77':s.value>=0?'#b18c50':'#69948f')+'"><title>'+esc(s.label+' '+U.numeric(s.value/100,2)+'亿元')+'</title></rect><text x="'+(x+w/2-6)+'" y="'+(Math.min(y(s.start),y(s.end))-7)+'" text-anchor="middle">'+U.numeric(s.value/100,2)+'</text><text x="'+(x+w/2-6)+'" y="'+(220+(i%2)*18)+'" text-anchor="middle">'+esc(s.label)+'</text>';}).join('')+'</svg>';
    return '<article class="hr-card"><h3>'+esc(title)+' · 亿元</h3>'+chart+'<details class="hr-disclosure"><summary>数值与计算依据</summary>'+briefTable(U,['项目','金额 / 百万元'],steps.map(s=>[esc(s.label),U.cell({...s,unit:b.end.unit})]))+'</details></article>';
  }
  function profit(env){
    const {U,financePeriod}=env,m=model(env.data.rows),tools=periodTools(m,U,env),per=state.segmentPeriod,groupR=m.group('revenue',financePeriod);
    let html=heading('合并业绩',financePeriod)+grid([['营业收入','revenue'],['归母净利润','parent_profit'],['扣非归母','deducted_profit'],['经营现金流','operating_cf']].map(([label,metric])=>metricCard(U,label,m.group(metric,financePeriod),U.grow(m.data,m.group(metric,financePeriod)))));
    html+='<div class="jj-charts">'+bridge(U,m.qualityBridge(financePeriod),'归母增长质量')+bridge(U,m.grossBridge(financePeriod),'毛利、费用与归母变化')+'</div>';
    html+=heading('费用率与非经常性损益',financePeriod)+briefTable(U,['指标','本期','上年同期','同比变化'],[['销售费用率','sales_expense'],['管理费用率','admin_expense'],['财务费用率','finance_expense'],['归母净利率','parent_profit'],['扣非净利率','deducted_profit']].map(([label,metric])=>{const o=m.group(metric,financePeriod),now=R.ratio(o,groupR),old=R.ratio(R.previous(m.data,o),R.previous(m.data,groupR));return [label,U.cell(now),U.cell(old),U.cell(now&&old?{value:now.value-old.value,unit:'百分点',inputs:[...now.inputs,...old.inputs],method:'本期费用率或净利率 − 上年同期'}:null)];}).concat([['归母 − 扣非',U.cell(nonrecurring(m,financePeriod)),U.cell(nonrecurring(m,R.previous(m.data,m.group('parent_profit',financePeriod))?.period)),U.cell(nonrecurringChange(m,financePeriod))]]));
    html+=heading('境内外分部财务 · 原币')+tools+briefTable(U,['分部','币种','收入','收入同比','归母净利润','同比增减'],[['domestic','境内有限服务型'],['overseas','海外有限服务型']].map(([region,label])=>{const rev=m.segment('revenue',region,per),profit=m.segment('parent_profit',region,per);return [label,esc(rev?.currency||'—'),U.cell(rev),U.grow(m.data,rev),U.cell(profit),U.cell(m.delta(profit))];}));
    html+=heading('境内外收入矩阵',per)+briefTable(U,['项目 / 百万元CNY','境内有限服务型','境外有限服务型','集团披露合计','境内同比'],m.revenueParts(per).map(row=>[esc(row.label),U.cell(row.domestic),U.cell(row.overseas),U.cell(row.total),U.grow(m.data,row.domestic)]));
    html+=heading('业务毛利率',per)+briefTable(U,['业务','收入','毛利','毛利率','毛利率同比'],['酒店客房','餐饮服务','前期加盟服务','持续加盟服务','订房渠道','会员服务','采购平台收入'].map(item=>{const scope='境内外有限服务型酒店 / '+item,rev=m.project('project_revenue',scope,per),gross=m.project('gross_profit',scope,per),margin=m.projectMargin(scope,per),old=R.ratio(R.previous(m.data,gross),R.previous(m.data,rev));return [item,U.cell(rev),U.cell(gross),U.cell(margin),U.cell(margin&&old?{value:margin.value-old.value,unit:'百分点',inputs:[...margin.inputs,...old.inputs],method:'本期毛利率 − 上年同期毛利率'}:null)];}));
    return html;
  }
  function logic(env){
    const {U,quarter}=env,m=model(env.data.rows),per=reportPeriod(m,env.financePeriod),direct=m.cohort(quarter,'domestic','直营'),overseas=m.segment('parent_profit','overseas',per);
    const lines=[
      ['境内直营减亏',direct,U.grow(m.data,direct),'直营同店RevPAR · '+(direct?.period||'—'),'直营独立利润未入库'],
      ['加盟存量升级',m.structure(quarter).mid,U.cell(m.structure(quarter).midShare),'中端门店 / 有限服务型 · '+quarter,'改造店数及改造样本未入库'],
      ['加盟与渠道收入',m.matrixRow('持续加盟服务','境内有限服务型酒店',per),U.grow(m.data,m.matrixRow('持续加盟服务','境内有限服务型酒店',per)),'境内持续加盟服务收入 · '+per,'综合收费率缺少同口径交易额'],
      ['海外减亏',overseas,U.cell(m.delta(overseas)),'有限服务型归母净利润 · '+per+' · EUR','海外独立列报，不折算相加']
    ];
    let html=heading('改革兑现 · 证据跟踪',per)+'<div class="jj-reform-grid">'+lines.map(([title,row,change,label,gap])=>'<article class="hr-card"><div class="jj-reform-title"><h3>'+title+'</h3>'+U.tag('指标跟踪')+'</div><p class="hr-caption">'+esc(label)+'</p><strong class="hr-value">'+U.cell(row)+'</strong><div>'+change+'</div><p class="jj-gap">'+esc(gap)+'</p></article>').join('')+'</div>';
    html+=heading('渠道与会员收入',per)+briefTable(U,['境内有限服务型','本期','上年同期','同比'],['持续加盟服务','订房渠道','会员服务','前期加盟服务'].map(item=>{const o=m.matrixRow(item,'境内有限服务型酒店',per);return [item,U.cell(o),U.cell(R.previous(m.data,o)),U.grow(m.data,o)];}));
    html+=heading('财务因素单列',env.financePeriod)+briefTable(U,['指标','本期','上年同期','同比增减'],['finance_expense','parent_profit','deducted_profit'].map(metric=>{const o=m.group(metric,env.financePeriod);return [U.metric(metric),U.cell(o),U.cell(R.previous(m.data,o)),U.cell(m.delta(o))];}));
    html+='<details class="hr-disclosure"><summary>研究验证记录 / 新增进展</summary>'+env.legacyLogic()+'</details>';
    return html;
  }
  function render(panel,env){const renders={compare:snapshot,operating,expansion,profit,logic};return renders[panel]?renders[panel](env):null;}
  function bind(env){const $=id=>document.getElementById(id);for(const [id,key]of Object.entries({'jj-region':'region','jj-tier':'tier','jj-mode':'mode','jj-cohort':'cohortId','jj-segment-period':'segmentPeriod'})){if($(id))$(id).onchange=()=>{state[key]=$(id).value;if(['jj-region','jj-tier','jj-mode'].includes(id))state.cohortId='';env.refresh();};}}
  window.JinjiangResearch={menu,render,bind,model};
})();
