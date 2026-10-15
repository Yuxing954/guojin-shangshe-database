(function(){
  'use strict';
  const R=HotelResearchModel,J=JinjiangResearchModel,D=SiteData,esc=D.esc;
  const state={region:'domestic',tier:'all',mode:'全部',cohortId:'',segmentPeriod:'',revenueItem:'持续加盟服务',revenueRegion:'境内有限服务型酒店'};
  let cachedRows,cachedModel;
  const menu={compare:'总览',operating:'经营',expansion:'开店',profit:'财务',raw:'明细'};
  const panels=['compare','operating','expansion','profit','raw'];
  const redirects={logic:'profit',scenario:'profit'};
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
  const palette=['#245c78','#b18b50','#639790','#8c7598','#bd7960','#7c94a6','#a2a767','#a1a6ac'];
  const valid=o=>o&&(o.inputs?o.inputs.every(R.safe):R.safe(o))&&Number.isFinite(o.value);
  function chartCard(title,period,body){return '<article class="hr-card jj-visual">'+heading(title,period)+body+'</article>';}
  function trend(U,m,title,period,series,chartUnit='亿元'){
    const ps=m.samePeriods(period);
    return chartCard(title,period.slice(4)+' · 同期',U.lineChart(series.map(s=>({name:s.name,points:ps.map(p=>{const o=s.row(p);return {value:valid(o)?(chartUnit==='亿元'?o.value/100:o.value):null};})})),ps,title,chartUnit)+'<details class="hr-disclosure"><summary>数值与来源</summary>'+briefTable(U,['期间',...series.map(s=>s.name)],ps.map(p=>[p,...series.map(s=>U.cell(s.row(p)))]))+'</details>');
  }
  function operatingMatrix(U,m,period,region,tiers=['all','mid','economy']){
    const area=region==='domestic'?'境内':'海外',currency=region==='domestic'?'元/间':'欧元/间';
    const cells=tiers.flatMap(tier=>['全部','直营','加盟'].map(mode=>({label:{all:'合计',mid:'中端',economy:'经济型'}[tier]+' · '+mode,rows:['revpar','adr','occ'].map(metric=>m.operating(metric,period,region,tier,mode))}))).filter(x=>x.rows.some(Boolean));
    return chartCard(area+'量价全景 · 有限服务型',period,'<div class="jj-matrix-note">本期值 / 同比 · OCC同比：pp</div><div class="jj-matrix"><div class="jj-matrix-head"><span>范围 / 模式</span><span>RevPAR<br><small>'+currency+'</small></span><span>ADR<br><small>'+currency+'</small></span><span>OCC<br><small>%</small></span></div>'+cells.map(row=>'<div class="jj-matrix-row"><b>'+esc(row.label)+'</b>'+row.rows.map(o=>{const g=R.growth(m.data,o),tone=g?(g.value>=0?'positive':'negative'):'missing';return '<div class="jj-heat '+tone+'"><strong>'+U.numeric(o?.value,2)+'</strong><span>'+ (o&&!R.safe(o)?U.tag('待核验'):g?U.numeric(g.value,2)+(g.unit==='百分点'?' pp':g.unit):'—')+'</span>'+U.source(o)+'</div>';}).join('')+'</div>').join('')+'</div>');
  }
  function composition(U,title,period,parts,base,measure='家'){
    const values=parts.map(p=>p.row),complete=valid(base)&&base.value>0&&values.every(valid)&&values.every(o=>o.value>=0&&R.compatible(o,base,['region','basis','currency','frequency','periodBasis'])&&o.unit===base.unit)&&Math.abs(values.reduce((s,o)=>s+o.value,0)-base.value)<0.01;
    const bar=complete?'<div class="jj-stack" role="img" aria-label="'+esc(title)+'">'+parts.map((p,i)=>'<span style="width:'+p.row.value/base.value*100+'%;background:'+palette[i]+'" title="'+esc(p.name+' '+U.numeric(p.row.value,0)+measure)+'"></span>').join('')+'</div>':'';
    return chartCard(title,period,bar+'<div class="jj-stack-legend">'+parts.map((p,i)=>'<div><i style="background:'+palette[i]+'"></i><span>'+esc(p.name)+'</span><strong>'+U.numeric(p.row?.value,0)+'<small> '+esc(measure)+'</small></strong><b>'+ (complete?U.numeric(p.row.value/base.value*100,1)+'%':'—')+'</b>'+U.source(complete?{value:p.row.value/base.value*100,unit:'%',inputs:[p.row,base],method:'原报告分类分项 / 相同口径总量'}:p.row)+'</div>').join('')+'</div>');
  }
  function compareBars(U,m,title,period,items,chartUnit='亿元'){
    const data=items.map(x=>({...x,old:x.old===undefined?R.previous(m.data,x.row):x.old})),all=data.flatMap(x=>[x.row,x.old]).filter(valid).map(o=>o.value),lo=Math.min(0,...all),hi=Math.max(0,...all),range=hi-lo||1,zero=-lo/range*100;
    const bar=(o,cls)=>{if(!valid(o))return '<div class="jj-bar-line"><span class="jj-missing">—</span></div>';const value=o.value,start=(Math.min(0,value)-lo)/range*100,width=Math.abs(value)/range*100;return '<div class="jj-bar-line"><div class="jj-bar-track" style="--zero:'+zero+'%"><i class="'+cls+'" style="left:'+start+'%;width:'+width+'%"></i></div><strong>'+U.numeric(chartUnit==='亿元'?value/100:value,2)+'</strong>'+U.source(o)+'</div>';};
    return chartCard(title+' · '+chartUnit,period,'<div class="jj-bar-key"><span><i></i>本期</span>'+(data.some(x=>x.old)?'<span><i></i>上年同期</span>':'')+'</div><div class="jj-bars">'+data.map(x=>'<div class="jj-bar-item"><div class="jj-bar-label"><b>'+esc(x.name)+'</b><span>'+(x.row?.inputs?'':U.grow(m.data,x.row))+'</span></div>'+bar(x.row,'current')+(x.old===null?'':bar(x.old,'prior'))+'</div>').join('')+'</div>');
  }
  function networkVisuals(U,m,quarter){const s=m.structure(quarter);return '<div class="jj-charts">'+composition(U,'经营模式 · 有限服务型',quarter,[{name:'加盟和管理',row:s.franchise},{name:'自有和租赁',row:s.leased}],s.finite)+composition(U,'档次结构 · 有限服务型',quarter,[{name:'中端',row:s.mid},{name:'经济型',row:s.economy}],s.finite)+'</div>';}
  function feeTrend(U,m,period){return trend(U,m,'境内加盟、渠道与会员收入',period,['持续加盟服务','订房渠道','会员服务','前期加盟服务'].map(name=>({name,row:p=>m.matrixRow(name,'境内有限服务型酒店',p)})));}
  function businessVisual(U,m,period){
    const rows=m.businessParts(period),numbers=rows.flatMap(x=>[x.revenue,x.gross]).filter(valid).map(o=>o.value),lo=Math.min(0,...numbers),hi=Math.max(0,...numbers),range=hi-lo||1;
    return chartCard('收入与毛利来源 · 有限服务型',period,'<div class="jj-business-key">亿元CNY <span><i></i>收入</span><span><i></i>毛利</span><span>右侧：毛利率</span></div><div class="jj-business">'+rows.map(x=>'<div class="jj-business-row"><b>'+esc(x.label)+'</b><div>'+['revenue','gross'].map(k=>{const o=x[k];return '<div class="jj-business-line"><div style="--zero:'+(-lo/range*100)+'%"><i class="'+k+'" style="left:'+(valid(o)?(Math.min(0,o.value)-lo)/range*100:0)+'%;width:'+(valid(o)?Math.abs(o.value)/range*100:0)+'%"></i></div><strong>'+U.numeric(valid(o)?o.value/100:null,2)+'</strong>'+U.source(o)+'</div>';}).join('')+'</div><div class="jj-margin"><strong>'+U.numeric(x.margin?.value,1)+'<small>%</small></strong>'+U.source(x.margin)+'</div></div>').join('')+'</div>');
  }
  function segmentVisuals(U,m,period){return '<div class="jj-charts">'+compareBars(U,m,'境内分部',period,[{name:'有限服务型收入',row:m.segment('revenue','domestic',period)},{name:'有限服务型归母',row:m.segment('parent_profit','domestic',period)},{name:'全服务型收入',row:m.fullSegment('revenue',period)},{name:'全服务型归母',row:m.fullSegment('parent_profit',period)}])+compareBars(U,m,'海外有限服务型',period,[{name:'收入',row:m.segment('revenue','overseas',period)},{name:'归母净利润',row:m.segment('parent_profit','overseas',period)}],'百万欧元')+'</div>';}
  function regionalVisual(U,m,period){
    const chart=(title,regions)=>{const rows=regions.flatMap(([label,region])=>['直营','加盟'].map(mode=>({label:label+' · '+mode,mode,row:m.regional('hotels',region,mode,period)}))),max=Math.max(1,...rows.filter(x=>valid(x.row)).map(x=>x.row.value));return chartCard(title+' · 开业酒店',period,'<div class="jj-region-bars">'+rows.map(x=>'<div><b>'+esc(x.label)+'</b><span><i style="width:'+(valid(x.row)?x.row.value/max*100:0)+'%;background:'+palette[x.mode==='直营'?1:0]+'"></i></span><strong>'+U.numeric(x.row?.value,0)+'<small> 家</small></strong>'+U.source(x.row)+'</div>').join('')+'</div>');};
    return '<div class="jj-charts">'+chart('境内外 · 原报告地区口径',[['境内','中国大陆境内 / 合计'],['海外','海外 / 合计']])+chart('海外分布 · 法国为欧洲子集',[['欧洲','海外 / 欧洲'],['其中法国','海外 / 其中:法国'],['亚洲','海外 / 亚洲'],['美洲','海外 / 美洲'],['非洲','海外 / 非洲']])+'</div>';
  }
  function operatingComparison(U,m,period,region,mode,tier,selected){
    const same=selected||m.cohort(period,region,mode,tier);if(!same)return '';
    const sameRow=metric=>{const sel=R.selector(same);if(metric==='occ')delete sel.currency;return R.one(m.data,sel,metric,same.period);};
    return '<div class="jj-charts">'+compareBars(U,m,'全口径与固定同店 · RevPAR同比',same.period,[{name:'全口径',row:R.growth(m.data,m.operating('revpar',same.period,region,tier,mode)),old:null},{name:'固定同店',row:R.growth(m.data,same),old:null}],'%')+chartCard('固定同店 · '+mode,same.period,grid(['revpar','adr','occ'].map(metric=>metricCard(U,U.metric(metric),sameRow(metric),U.grow(m.data,sameRow(metric)))),'jj-three'))+'</div>';
  }
  function snapshot(env){
    const {U,quarter,financePeriod}=env,m=model(env.data.rows),segmentPeriod=reportPeriod(m,financePeriod),f=metric=>m.group(metric,financePeriod),per=U.quarters(quarter);
    let html=heading('合并业绩',financePeriod);
    html+=grid([['营业收入','revenue'],['归母净利润','parent_profit'],['扣非归母净利润','deducted_profit'],['经营现金流','operating_cf']].map(([label,metric])=>metricCard(U,label,f(metric),U.grow(m.data,f(metric)))));
    html+='<div class="jj-charts">'+operatingMatrix(U,m,quarter,'domestic',['all'])+operatingMatrix(U,m,quarter,'overseas',['all'])+'</div>';
    html+=heading('境内经营与盈利兑现',quarter)+'<div class="jj-overview-grid">';
    const dom=m.operating('revpar',quarter),direct=m.cohort(quarter,'domestic','直营'),same=m.cohort(quarter),overseas=m.segment('parent_profit','overseas',segmentPeriod),channel=m.matrixRow('订房渠道','境内有限服务型酒店',segmentPeriod),fees=m.matrixRow('持续加盟服务','境内有限服务型酒店',segmentPeriod);
    const items=[['境内有限服务型',dom,U.grow(m.data,dom),'RevPAR'],['境内直营同店',direct,U.grow(m.data,direct),'RevPAR · '+(direct?.period||'')],['境内持续加盟服务',fees,U.grow(m.data,fees),'收入 · '+segmentPeriod],['境内订房渠道',channel,U.grow(m.data,channel),'收入 · '+segmentPeriod],['海外有限服务型',overseas,U.cell(m.delta(overseas)),'归母净利润 · '+segmentPeriod]];
    html+=items.map(([title,o,change,label])=>'<article class="jj-driver"><h4>'+title+'</h4><span class="hr-caption">'+esc(label)+'</span><strong>'+U.numeric(shown(o),2)+' <small>'+esc(unit(o))+'</small></strong><div>'+change+'</div>'+U.source(o)+'</article>').join('')+'</div>';
    html+='<div class="jj-charts">'+growthChart(U,m,per,'境内有限服务型 · RevPAR同比',[{name:'全部',row:p=>m.operating('revpar',p)},{name:'直营',row:p=>m.operating('revpar',p,'domestic','all','直营')},{name:'加盟',row:p=>m.operating('revpar',p,'domestic','all','加盟')}])+'<article class="hr-card"><h3>单季归母与扣非利润</h3>'+U.lineChart([{name:'归母',points:per.map(p=>{const o=m.group('parent_profit',p);return {value:o?o.value/100:null};})},{name:'扣非',points:per.map(p=>{const o=m.group('deducted_profit',p);return {value:o?o.value/100:null};})}],per,'单季归母与扣非利润','亿元')+'</article></div>';
    html+=networkVisuals(U,m,quarter)+'<div class="jj-charts">'+feeTrend(U,m,segmentPeriod)+trend(U,m,'海外有限服务型 · 归母净利润',segmentPeriod,[{name:'海外归母',row:p=>m.segment('parent_profit','overseas',p)}],'百万欧元')+'</div>';
    html+=heading('关键核对',segmentPeriod)+briefTable(U,['事项','本期数据','对照 / 增减','来源口径'],[
      ['境内全部 / 同店 RevPAR同比',U.grow(m.data,m.operating('revpar',same?.period)),U.grow(m.data,same),'同店 '+esc(same?.period||'—')],
      ['海外亏损',U.cell(overseas),U.cell(m.delta(overseas)),'有限服务型 · 原币EUR'],
      ['财务费用',U.cell(m.group('finance_expense',segmentPeriod)),U.cell(m.delta(m.group('finance_expense',segmentPeriod))),'合并报表 · CNY'],
      ['归母 − 扣非',U.cell(nonrecurring(m,segmentPeriod)),U.cell(nonrecurringChange(m,segmentPeriod)),'归母非经常性损益净额']]);
    return html;
  }
  function operating(env){
    const {U,quarter}=env,m=model(env.data.rows),p=U.quarters(quarter,12),area=state.region==='domestic'?'境内':'海外',r=metric=>m.operating(metric,quarter,state.region,state.tier,state.mode);
    let html='<div class="jj-charts">'+operatingMatrix(U,m,quarter,'domestic')+operatingMatrix(U,m,quarter,'overseas')+'</div>';
    html+=heading('量价历史 / 同店对照')+'<div class="hr-tools">'+U.field('区域','jj-region',[{value:'domestic',label:'境内'},{value:'overseas',label:'海外'}],state.region)+U.field('档次','jj-tier',[{value:'all',label:'有限服务型合计'},{value:'mid',label:'中端'},{value:'economy',label:'经济型'}],state.tier)+U.field('经营模式','jj-mode',['全部','直营','加盟'],state.mode)+'</div>';
    html+=heading(area+'有限服务型 · 量价',quarter)+grid(['revpar','adr','occ'].map(metric=>metricCard(U,U.metric(metric),r(metric),U.grow(m.data,r(metric)))), 'jj-three');
    html+='<div class="jj-charts">'+growthChart(U,m,p,'量价同比',[{name:'RevPAR',row:per=>m.operating('revpar',per,state.region,state.tier,state.mode)},{name:'ADR',row:per=>m.operating('adr',per,state.region,state.tier,state.mode)}])+growthChart(U,m,p,'入住率同比',[{name:'入住率',row:per=>m.operating('occ',per,state.region,state.tier,state.mode)}],'百分点')+'</div>';
    html+=heading('境内全服务型',quarter)+grid(['revpar','adr','occ'].map(metric=>{const o=m.fullOperating(metric,quarter);return metricCard(U,U.metric(metric),o,U.grow(m.data,o));}),'jj-three');
    html+='<details class="hr-disclosure"><summary>季度量价明细</summary>'+briefTable(U,['季度','RevPAR','同比','ADR','同比','入住率','同比 / pp'],p.slice().reverse().map(per=>{const rows=['revpar','adr','occ'].map(metric=>m.operating(metric,per,state.region,state.tier,state.mode));return [per,...rows.flatMap(o=>[U.cell(o),U.grow(m.data,o)])];}))+'</details>';
    const cohorts=m.cohorts(state.region,state.mode,state.tier);const selected=cohorts.find(o=>o.id===state.cohortId)||m.cohort(quarter,state.region,state.mode,state.tier);state.cohortId=selected?.id||'';
    html+=heading('固定样本同店');
    if(!cohorts.length)return html+U.empty('该范围暂无同店披露');
    html+='<div class="hr-tools">'+U.field('同店样本 / 报告期','jj-cohort',cohorts.map(o=>({value:o.id,label:o.period+' · '+o.basis})),state.cohortId,true)+'</div>';
    html+=operatingComparison(U,m,selected.period,state.region,state.mode,state.tier,selected);
    html+=briefTable(U,['指标','全口径','全口径同比','固定同店','同店同比','同店 − 全口径'],['revpar','adr','occ'].map(metric=>{const sel=R.selector(selected);if(metric==='occ')delete sel.currency;const same=R.one(m.data,sel,metric,selected.period),all=m.operating(metric,selected.period,state.region,state.tier,state.mode),a=R.growth(m.data,same),b=R.growth(m.data,all);const difference=a&&b&&a.unit===b.unit?{value:a.value-b.value,unit:'百分点',inputs:[...a.inputs,...b.inputs],method:'同店同比 − 同期全口径同比'}:null;return [U.metric(metric),U.cell(all),U.grow(m.data,all),U.cell(same),U.grow(m.data,same),U.cell(difference)];}));
    return html;
  }
  function expansion(env){
    const {U,quarter}=env,m=model(env.data.rows),s=m.structure(quarter),p=U.quarters(quarter,12);
    let html=heading('酒店网络',quarter)+grid([['全球已开业','hotels'],['期末签约酒店','signed_hotels'],['当季新开','opened'],['当季净增','net_opened']].map(([label,metric])=>{const o=m.scale(metric,quarter);return metricCard(U,label,o,U.grow(m.data,o));}));
    const stock=m.stockBridge(quarter);
    html+=networkVisuals(U,m,quarter);
    html+='<div class="jj-charts">'+composition(U,'客房结构 · 有限服务型',quarter,[{name:'中端客房',row:s.midRooms},{name:'经济型客房',row:s.economyRooms}],s.finiteRooms,'间')+chartCard('客房与签约储备',quarter,grid([derivedCard(U,'有限服务型单店客房',s.roomsPerHotel),metricCard(U,'全服务型酒店',s.full,''),derivedCard(U,'签约未开业差额',m.contractGap(quarter))],'jj-three'))+'</div>';
    if(stock){const flow=(label,o,sign)=>({label,value:o.value*sign,unit:o.unit,inputs:[o],method:label});html+=bridge(U,{start:stock.prior,end:stock.current,components:[flow('新开',stock.opened,1),flow('退出',stock.closed,-1),flow('转筹建',stock.transfer,-1),...(Math.abs(stock.residual.value)>0.01?[{label:'未解释差额',...stock.residual}]:[])]},'开业门店变动',true);}
    html+='<details class="hr-disclosure"><summary>门店季度明细</summary>'+briefTable(U,['季度','开业酒店','新开','退出','转筹建','净增','签约酒店','签约未开业差额'],p.slice().reverse().map(per=>[per,...['hotels','opened','closed','to_pipeline','net_opened','signed_hotels'].map(metric=>U.cell(m.scale(metric,per),0)),U.cell(m.contractGap(per),0)]))+'</details>';
    html+='<div class="jj-charts"><article class="hr-card"><h3>新开、退出与净增</h3>'+U.lineChart(['opened','closed','net_opened'].map(metric=>({name:U.metric(metric),points:p.map(per=>({value:m.scale(metric,per)?.value}))})),p,'开关店','家')+'</article><article class="hr-card"><h3>有限服务型 · 结构升级</h3>'+U.lineChart([{name:'加盟酒店占比',points:p.map(per=>({value:m.structure(per).franchiseShare?.value}))},{name:'中端酒店占比',points:p.map(per=>({value:m.structure(per).midShare?.value}))},{name:'中端客房占比',points:p.map(per=>({value:m.structure(per).midRoomShare?.value}))}],p,'有限服务型结构','%')+'</article></div>';
    html+=regionalVisual(U,m,quarter);
    html+=heading('境内外开业与签约',quarter)+briefTable(U,['地区 / 模式','开业酒店','签约酒店','客房'],['中国大陆境内 / 合计','海外 / 合计','海外 / 欧洲','海外 / 其中:法国','海外 / 亚洲','海外 / 美洲','海外 / 非洲'].flatMap(region=>['直营','加盟'].map(mode=>[esc(region+' · '+mode),...['hotels','signed_hotels','rooms'].map(metric=>U.cell(m.regional(metric,region,mode,quarter),0))])));
    return html;
  }
  function nonrecurring(m,period){if(!period)return null;const p=m.group('parent_profit',period),d=m.group('deducted_profit',period);return R.compatible(p,d)?{value:p.value-d.value,unit:p.unit,inputs:[p,d],method:'归母净利润 − 扣非归母净利润'}:null;}
  function nonrecurringChange(m,period){const b=m.qualityBridge(period);return b?.components[1]||null;}
  function bridge(U,b,title,stock=false){
    if(!b)return '<article class="hr-card"><h3>'+esc(title)+'</h3>'+U.empty('缺少同口径对照')+'</article>';
    const divisor=stock?1:100,chartUnit=stock?'家':'亿元';
    const base=b.start.value,steps=[{label:stock?'上季末':'上年同期',value:base,start:0,end:base,inputs:[b.start]}];let current=base;
    for(const c of b.components){steps.push({...c,start:current,end:current+c.value});current+=c.value;}steps.push({label:'本期',value:b.end.value,start:0,end:b.end.value,inputs:[b.end]});
    const stockValues=steps.flatMap(x=>[x.start,x.end]).filter(v=>v!==0),stockPadding=Math.max(50,(Math.max(...stockValues)-Math.min(...stockValues))*.25);
    const lo=stock?Math.max(0,Math.floor((Math.min(...stockValues)-stockPadding)/100)*100):Math.min(0,...steps.flatMap(x=>[x.start,x.end])),hi=stock?Math.max(...stockValues)+stockPadding:Math.max(0,...steps.flatMap(x=>[x.start,x.end])),range=hi-lo||1,y=v=>190-(Math.max(lo,v)-lo)/range*140,w=630/steps.length;
    const chart='<svg class="hr-chart quotes-chart" viewBox="0 0 720 265" role="img" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title><line x1="40" x2="690" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#d5dfe4"/>'+steps.map((s,i)=>{const x=45+w*i;return '<rect x="'+x+'" y="'+Math.min(y(s.start),y(s.end))+'" width="'+(w-12)+'" height="'+Math.max(1,Math.abs(y(s.start)-y(s.end)))+'" fill="'+(i===0||i===steps.length-1?'#215a77':s.value>=0?'#b18c50':'#69948f')+'"><title>'+esc(s.label+' '+U.numeric(s.value/divisor,stock?0:2)+chartUnit)+'</title></rect><text x="'+(x+w/2-6)+'" y="'+(Math.min(y(s.start),y(s.end))-7)+'" text-anchor="middle">'+U.numeric(s.value/divisor,stock?0:2)+'</text><text x="'+(x+w/2-6)+'" y="'+(220+(i%2)*18)+'" text-anchor="middle">'+esc(s.label)+'</text>';}).join('')+'</svg>';
    return '<article class="hr-card"><h3>'+esc(title)+' · '+chartUnit+'</h3>'+(stock?'<div class="hr-caption">纵轴起点 '+U.numeric(lo,0)+' 家</div>':'')+chart+'<details class="hr-disclosure"><summary>数值与计算依据</summary>'+briefTable(U,['项目',stock?'酒店数 / 家':'金额 / 百万元'],steps.map(s=>[esc(s.label),U.cell({...s,unit:b.end.unit})]))+'</details></article>';
  }
  function profit(env){
    const {U,financePeriod}=env,m=model(env.data.rows),tools=periodTools(m,U,env),per=state.segmentPeriod,groupR=m.group('revenue',financePeriod);
    let html=heading('合并业绩',financePeriod)+grid([['营业收入','revenue'],['归母净利润','parent_profit'],['扣非归母','deducted_profit'],['经营现金流','operating_cf']].map(([label,metric])=>metricCard(U,label,m.group(metric,financePeriod),U.grow(m.data,m.group(metric,financePeriod)))));
    html+=heading('收入与毛利构成')+tools+businessVisual(U,m,per);
    html+='<div class="jj-charts">'+bridge(U,m.qualityBridge(financePeriod),'归母增长质量')+bridge(U,m.grossBridge(financePeriod),'毛利、费用与归母变化')+'</div>';
    html+=heading('费用率与非经常性损益',financePeriod)+briefTable(U,['指标','本期','上年同期','同比变化'],[['销售费用率','sales_expense'],['管理费用率','admin_expense'],['财务费用率','finance_expense'],['归母净利率','parent_profit'],['扣非净利率','deducted_profit']].map(([label,metric])=>{const o=m.group(metric,financePeriod),now=R.ratio(o,groupR),old=R.ratio(R.previous(m.data,o),R.previous(m.data,groupR));return [label,U.cell(now),U.cell(old),U.cell(now&&old?{value:now.value-old.value,unit:'百分点',inputs:[...now.inputs,...old.inputs],method:'本期费用率或净利率 − 上年同期'}:null)];}).concat([['归母 − 扣非',U.cell(nonrecurring(m,financePeriod)),U.cell(nonrecurring(m,R.previous(m.data,m.group('parent_profit',financePeriod))?.period)),U.cell(nonrecurringChange(m,financePeriod))]]));
    html+='<div class="jj-charts">'+trend(U,m,'合并费用率',financePeriod,[['销售','sales_expense'],['管理','admin_expense'],['财务','finance_expense']].map(([name,metric])=>({name,row:p=>R.ratio(m.group(metric,p),m.group('revenue',p))})),'%')+trend(U,m,'经营现金流与利润',financePeriod,[['经营现金流','operating_cf'],['归母净利润','parent_profit'],['扣非归母','deducted_profit']].map(([name,metric])=>({name,row:p=>m.group(metric,p)})))+'</div>';
    html+=heading('境内外分部财务 · 原币',per)+segmentVisuals(U,m,per)+briefTable(U,['分部','币种','收入','收入同比','归母净利润','同比增减'],[['domestic','境内有限服务型'],['overseas','海外有限服务型']].map(([region,label])=>{const rev=m.segment('revenue',region,per),profit=m.segment('parent_profit',region,per);return [label,esc(rev?.currency||'—'),U.cell(rev),U.grow(m.data,rev),U.cell(profit),U.cell(m.delta(profit))];}));
    html+='<div class="jj-charts">'+feeTrend(U,m,per)+trend(U,m,'海外有限服务型 · 归母净利润',per,[{name:'海外归母',row:p=>m.segment('parent_profit','overseas',p)}],'百万欧元')+'</div>';
    const ebitda=[['EBITDA','ebitda','息税折旧摊销前的利润(EBITDA)'],['调整后EBITDA','adjusted_ebitda','调整后息税折旧摊销前的利润(EBITDA)'],['EBITDA · 不含租赁准则','ebitda','息税折旧摊销前的利润(EBITDA)-不含租赁准则']].map(([label,metric,scope])=>({label,row:m.segmentKpi(metric,scope,per)})).filter(x=>x.row);
    if(ebitda.length)html+=heading('有限服务型分部 · 未抵销跨分部交易',per)+grid(ebitda.map(x=>metricCard(U,x.label,x.row,U.grow(m.data,x.row))),'jj-three');
    const balances=[['货币资金','monetary_funds'],['资产总计','assets'],['负债合计','liabilities']].map(([label,metric])=>({label,row:m.balance(metric,financePeriod)})).filter(x=>x.row),leverage=R.ratio(m.balance('liabilities',financePeriod),m.balance('assets',financePeriod));
    if(balances.length)html+=heading('资产与现金 · Choice财报',financePeriod)+grid(balances.map(x=>metricCard(U,x.label,x.row,U.grow(m.data,x.row))).concat(leverage?[derivedCard(U,'资产负债率',leverage)]:[]));
    html+=heading('境内外收入矩阵',per)+briefTable(U,['项目 / 百万元CNY','境内有限服务型','境外有限服务型','集团披露合计','境内同比'],m.revenueParts(per).map(row=>[esc(row.label),U.cell(row.domestic),U.cell(row.overseas),U.cell(row.total),U.grow(m.data,row.domestic)]));
    html+='<details class="hr-disclosure"><summary>业务毛利率明细</summary>'+briefTable(U,['业务','收入','毛利','毛利率','毛利率同比'],['酒店客房','餐饮服务','前期加盟服务','持续加盟服务','订房渠道','会员服务','采购平台收入'].map(item=>{const scope='境内外有限服务型酒店 / '+item,rev=m.project('project_revenue',scope,per),gross=m.project('gross_profit',scope,per),margin=m.projectMargin(scope,per),old=R.ratio(R.previous(m.data,gross),R.previous(m.data,rev));return [item,U.cell(rev),U.cell(gross),U.cell(margin),U.cell(margin&&old?{value:margin.value-old.value,unit:'百分点',inputs:[...margin.inputs,...old.inputs],method:'本期毛利率 − 上年同期毛利率'}:null)];}))+'</details>';
    html+='<details class="hr-disclosure"><summary>研究记录与备份</summary>'+env.legacyLogic()+'</details>';
    return html;
  }
  function render(panel,env){const renders={compare:snapshot,operating,expansion,profit};return renders[panel]?renders[panel](env):null;}
  function bind(env){const $=id=>document.getElementById(id);for(const [id,key]of Object.entries({'jj-region':'region','jj-tier':'tier','jj-mode':'mode','jj-cohort':'cohortId','jj-segment-period':'segmentPeriod'})){if($(id))$(id).onchange=()=>{state[key]=$(id).value;if(['jj-region','jj-tier','jj-mode'].includes(id))state.cohortId='';env.refresh();};}}
  window.JinjiangResearch={menu,panels,redirects,render,bind,model};
})();
