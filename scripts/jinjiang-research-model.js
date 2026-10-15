(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./hotel-research-model.js'));else root.JinjiangResearchModel=factory(root.HotelResearchModel);})(typeof globalThis!=='undefined'?globalThis:this,function(R){
  'use strict';
  const financial={region:'集团整体',scope:'全部',mode:'全部',basis:'原报告合并财务'};
  const network={region:'全球',scope:'全部',mode:'全部',basis:'酒店业务口径（含全服务型+有限服务型）'};
  const categories={region:'全球',mode:'全部',basis:'原报告规模分类'};
  const matrix={region:'集团整体',mode:'全部',basis:'原报告分部收入矩阵',currency:'CNY'};
  const projects={region:'集团整体',mode:'全部',basis:'原报告项目收入成本 / 2020年起',currency:'CNY'};
  const periodOrder=p=>Number(p.slice(0,4))*12+(/Q/.test(p)?Number(p.at(-1))*3:/H/.test(p)?Number(p.at(-1))*6:/9M$/.test(p)?9:12);
  function build(input){
    const data=input.filter(o=>o.companyId==='jinjiang'),cache=new Map();
    const get=(metric,sel,period)=>{const key=JSON.stringify([metric,sel,period]);if(!cache.has(key))cache.set(key,R.one(data,sel,metric,period));return cache.get(key);};
    const group=(metric,period)=>get(metric,financial,period);
    const project=(metric,scope,period)=>get(metric,{...projects,scope},period);
    const matrixRow=(item,region,period)=>get('project_revenue',{...matrix,scope:region+' / '+item},period);
    const scale=(metric,period)=>get(metric,network,period);
    function operating(metric,period,region='domestic',tier='all',mode='全部'){
      const scopes={all:'有限服务型酒店',mid:'中端酒店',economy:'经济型酒店'};
      const scope=scopes[tier];if(!scope||!['domestic','overseas'].includes(region))return null;
      const basis=tier==='all'?'有限服务型酒店':'原报告分类 / '+scope;
      return get(metric,{region:region==='domestic'?'中国大陆境内':'海外',scope,mode,basis},period);
    }
    function cohorts(region='domestic',mode='全部',tier='all'){
      const scope={all:'合计',mid:'中端酒店',economy:'经济型酒店'}[tier];
      return R.rows(data,{region:region==='domestic'?'中国大陆境内':'海外',mode,scope},'revpar').filter(o=>o.basis.startsWith('原报告可比酒店 /')&&!o.basis.includes('来源版本')).sort((a,b)=>periodOrder(b.period)-periodOrder(a.period));
    }
    function cohort(period,region='domestic',mode='全部',tier='all'){
      return cohorts(region,mode,tier).find(o=>periodOrder(o.period)<=periodOrder(period))||null;
    }
    function sameStoreWindows(region='domestic'){
      const rows=R.rows(data,{region:region==='domestic'?'中国大陆境内':'海外'},'revpar').filter(o=>o.basis.startsWith('原报告可比酒店 /')&&!o.basis.includes('来源版本'));
      return [...new Map(rows.map(o=>{const w={period:o.period,region:o.region,basis:o.basis,frequency:o.frequency,periodBasis:o.periodBasis};w.key=JSON.stringify(w);return [w.key,w];})).values()].sort((a,b)=>periodOrder(b.period)-periodOrder(a.period)||b.period.localeCompare(a.period));
    }
    function sameStoreValue(window,metric,mode='全部',tier='all'){
      if(!window||!['revpar','adr','occ'].includes(metric)||!['全部','直营','加盟'].includes(mode))return null;
      const scope={all:'合计',mid:'中端酒店',economy:'经济型酒店'}[tier];if(!scope)return null;
      const {period,region,basis,frequency,periodBasis}=window;
      return get(metric,{region,basis,frequency,periodBasis,scope,mode},period);
    }
    function sameStoreGrowth(o){return R.safe(o)&&o.basis.startsWith('原报告可比酒店 /')&&Number.isFinite(o.reportedYoY)?R.derived(o.reportedYoY,o.metric==='occ'?'百分点':'%',[o],'该报告固定同店样本披露同比'):null;}
    function sameStoreComparison(window,metric,mode='全部',tier='all'){
      const same=sameStoreValue(window,metric,mode,tier),region=window?.region==='中国大陆境内'?'domestic':'overseas',all=window?operating(metric,window.period,region,tier,mode):null,sameGrowth=sameStoreGrowth(same),allGrowth=R.growth(data,all);
      const comparable=R.compatible(same,all,['region','mode','currency','frequency','periodBasis'])&&same.unit===all.unit;
      const gap=comparable&&sameGrowth&&allGrowth&&sameGrowth.unit===allGrowth.unit?derive(sameGrowth.value-allGrowth.value,'百分点',[...sameGrowth.inputs,...allGrowth.inputs],'同店披露同比 − 相同期间、地区、档次、模式全口径同比'):null;
      return {same,all,sameGrowth,allGrowth,gap};
    }
    function sameStoreHistory(window){return window?sameStoreWindows(window.region==='中国大陆境内'?'domestic':'overseas').filter(w=>w.period.slice(4)===window.period.slice(4)&&w.frequency===window.frequency&&w.periodBasis===window.periodBasis&&periodOrder(w.period)<=periodOrder(window.period)).reverse():[];}
    const segment=(metric,region,period)=>get(metric,{region:region==='overseas'?'海外':'中国大陆境内',scope:'有限服务型连锁酒店',mode:'全部',basis:'原报告境内外分部'},period);
    function derive(value,unit,inputs,method){return inputs.length&&inputs.every(R.safe)?R.derived(value,unit,inputs,method):null;}
    function delta(o){const b=R.previous(data,o);return R.safe(o)&&R.safe(b)?derive(o.value-b.value,o.unit,[o,b],'本期 − 上年同期'):null;}
    function share(o,total){return R.compatible(o,total,['region','basis','currency','frequency','periodBasis'])&&o.unit===total.unit&&total.value>0?derive(o.value/total.value*100,'%', [o,total],'指定分项 / 指定总量'):null;}
    function structure(period){
      const finite=get('hotels',{...categories,scope:'有限服务型酒店'},period),mid=get('hotels',{...categories,scope:'中端酒店'},period),franchise=get('hotels',{...categories,scope:'有限服务型酒店',mode:'加盟店/加盟和管理'},period),leased=get('hotels',{...categories,scope:'有限服务型酒店',mode:'直营店/自有和租赁'},period);
      const finiteRooms=get('rooms',{...categories,scope:'有限服务型酒店'},period),midRooms=get('rooms',{...categories,scope:'中端酒店'},period);
      const economy=get('hotels',{...categories,scope:'经济型'},period),economyRooms=get('rooms',{...categories,scope:'经济型'},period),full=get('hotels',{...categories,scope:'全服务型酒店'},period);
      return {finite,mid,economy,franchise,leased,finiteRooms,midRooms,economyRooms,full,roomsPerHotel:R.roomsPerHotel(finiteRooms,finite),midShare:share(mid,finite),franchiseShare:share(franchise,finite),midRoomShare:share(midRooms,finiteRooms)};
    }
    function contractGap(period){const signed=scale('signed_hotels',period),opened=scale('hotels',period);return R.compatible(signed,opened)&&signed.unit===opened.unit&&signed.value>=opened.value?derive(signed.value-opened.value,'家',[signed,opened],'期末签约酒店 − 期末开业酒店（签约未开业差额）'):null;}
    function stockBridge(period){
      const current=scale('hotels',period);if(!R.safe(current)||current.frequency!=='季度')return null;
      const year=Number(period.slice(0,4)),q=Number(period.at(-1)),lastPeriod=q===1?(year-1)+'Q4':year+'Q'+(q-1),prior=scale('hotels',lastPeriod);
      const opened=scale('opened',period),closed=scale('closed',period),transfer=scale('to_pipeline',period),net=scale('net_opened',period);
      if(![prior,opened,closed,transfer,net].every(R.safe)||!R.compatible(opened,closed)||!R.compatible(opened,transfer)||!R.compatible(opened,net))return null;
      if(current.unit!==prior.unit||['region','scope','mode','basis','currency'].some(k=>current[k]!==prior[k]))return null;
      const expected=prior.value+opened.value-closed.value-transfer.value;
      return {prior,current,opened,closed,transfer,net,residual:derive(current.value-expected,'家',[prior,current,opened,closed,transfer],'本期末 − (上期末 + 新开 − 退出 − 转筹建)')};
    }
    function qualityBridge(period){
      const current=group('parent_profit',period),prior=R.previous(data,current),deducted=group('deducted_profit',period),priorDeducted=R.previous(data,deducted);
      if(!R.compatible(current,deducted)||!R.compatible(prior,priorDeducted))return null;
      const recurring=derive(deducted.value-priorDeducted.value,current.unit,[deducted,priorDeducted],'本期扣非归母 − 上年同期扣非归母');
      const nonrecurring=derive((current.value-deducted.value)-(prior.value-priorDeducted.value),current.unit,[current,deducted,prior,priorDeducted],'归母减扣非的同比变化');
      return {start:prior,end:current,components:[{label:'扣非利润变化',...recurring},{label:'非经常性损益变化',...nonrecurring}]};
    }
    function grossBridge(period){
      const current=group('parent_profit',period),prior=R.previous(data,current),gross=project('gross_profit','合并收入成本合计 / 合计',period),oldGross=R.previous(data,gross),rev=project('project_revenue','合并收入成本合计 / 合计',period),groupRevenue=group('revenue',period);
      if(![current,prior,gross,oldGross,rev,groupRevenue].every(R.safe)||Math.abs(rev.value-groupRevenue.value)>0.001||!R.compatible(rev,groupRevenue,['currency','frequency','periodBasis']))return null;
      const components=[{label:'毛利变化',value:gross.value-oldGross.value,unit:current.unit,inputs:[gross,oldGross]}];
      for(const [metric,label]of [['sales_expense','销售费用'],['admin_expense','管理费用'],['finance_expense','财务费用']]){const o=group(metric,period),b=R.previous(data,o);if(!R.compatible(o,current)||!R.compatible(b,prior))return null;components.push({label,value:b.value-o.value,unit:current.unit,inputs:[o,b]});}
      const remaining=current.value-prior.value-components.reduce((s,x)=>s+x.value,0);components.push({label:'税项及其他未拆分',value:remaining,unit:current.unit,inputs:[current,prior,...components.flatMap(x=>x.inputs)]});
      return {start:prior,end:current,components};
    }
    function projectMargin(scope,period){const gross=project('gross_profit',scope,period),revenue=project('project_revenue',scope,period);return R.ratio(gross,revenue);}
    function revenueParts(period){
      const items=['酒店客房','餐饮服务','前期加盟服务','持续加盟服务','订房渠道','会员服务','采购平台收入','转租收入','其他'];
      return items.map(label=>({label,domestic:matrixRow(label,'境内有限服务型酒店',period),overseas:matrixRow(label,'境外有限服务型酒店',period),total:matrixRow(label,'合计',period)}));
    }
    function hotelRevenue(period){const finite=project('project_revenue','境内外有限服务型酒店 / 合计',period),full=project('project_revenue','境内全服务型酒店 / 合计',period),total=group('revenue',period);if(!R.compatible(finite,full,['region','basis','currency','frequency','periodBasis'])||!R.safe(total)||finite.unit!==full.unit||finite.currency!==total.currency||finite.value+full.value>total.value+0.001)return null;return {...derive(finite.value+full.value,finite.unit,[finite,full],'有限服务型酒店收入 + 全服务型酒店收入'),currency:finite.currency};}
    const reportPeriods=[...new Set(R.rows(data,financial,'revenue').map(o=>o.period))].sort((a,b)=>periodOrder(b)-periodOrder(a)||b.localeCompare(a));
    const segmentPeriods=[...new Set(R.rows(data,{...projects,scope:'合并收入成本合计 / 合计'},'project_revenue').filter(o=>o.frequency==='半年'||o.frequency==='年度').map(o=>o.period))].sort((a,b)=>periodOrder(b)-periodOrder(a));
    // Compare the same reporting window across years; never interleave FY and H1.
    function samePeriods(period,count=6){return reportPeriods.filter(p=>p.slice(4)===period.slice(4)&&periodOrder(p)<=periodOrder(period)).slice(0,count).reverse();}
    function businessParts(period){return ['酒店客房','餐饮服务','前期加盟服务','持续加盟服务','订房渠道','会员服务','采购平台收入','其他'].map(label=>{const scope='境内外有限服务型酒店 / '+label;return {label,revenue:project('project_revenue',scope,period),gross:project('gross_profit',scope,period),margin:projectMargin(scope,period)};});}
    const regional=(metric,region,mode,period)=>get(metric,{region,mode,scope:'全部',basis:'原报告境内外开业签约规模',frequency:'季度'},period);
    const fullOperating=(metric,period)=>get(metric,{region:'中国大陆境内',scope:'全服务型酒店',mode:'全部',basis:'全服务型酒店'},period);
    const fullSegment=(metric,period)=>get(metric,{region:'中国大陆境内',scope:'全服务型酒店',mode:'全部',basis:'原报告境内外分部'},period);
    const segmentKpi=(metric,scope,period)=>get(metric,{region:'集团整体',scope,mode:'全部',basis:'有限服务型酒店分部 / 未抵销跨分部交易',currency:'CNY'},period);
    const balance=(metric,period)=>get(metric,{...financial,basis:'Choice财报 / 返回币种',currency:'CNY'},period);
    return {data,get,group,project,matrixRow,scale,operating,cohorts,cohort,segment,delta,share,structure,contractGap,stockBridge,qualityBridge,grossBridge,projectMargin,revenueParts,hotelRevenue,reportPeriods,segmentPeriods,periodOrder,samePeriods,businessParts,regional,fullOperating,fullSegment,segmentKpi,balance,sameStoreWindows,sameStoreValue,sameStoreGrowth,sameStoreComparison,sameStoreHistory};
  }
  return {build,financial,network,categories,matrix,projects,periodOrder};
});
