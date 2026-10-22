(function(root){
'use strict';
const total=r=>r.category==='社零总额'&&r.scope==='全口径';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const indexes=new WeakMap();
function index(data){if(!indexes.has(data)){const byKey=new Map(),byPeriod=new Map();for(const r of data.observations){byKey.set([r.regionId,r.period,r.basis,r.category,r.scope].join('|'),r);const key=r.period+'|'+r.basis;if(!byPeriod.has(key))byPeriod.set(key,[]);byPeriod.get(key).push(r);}indexes.set(data,{byKey,byPeriod});}return indexes.get(data);}
function regions(data,level){return data.regions.filter(r=>level==='province'?r.level==='province':r.level==='city'||r.municipality);}
function previous(period){const [y,m]=period.split('-').map(Number);return m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');}
function observation(data,regionId,period,basis,category='社零总额',scope='全口径'){return index(data).byKey.get([regionId,period,basis,category,scope].join('|'))||null;}
function compare(data,level,period,basis='ytd'){return regions(data,level).map(r=>{const o=observation(data,r.id,period,basis),p=observation(data,r.id,previous(period),basis);return {...r,period,basis,amount:o?.amount??null,yoy:o?.yoy??null,change:finite(o?.yoy)&&finite(p?.yoy)?o.yoy-p.yoy:null,provenance:o?.provenance||{},disputed:o?.disputed||{}};}).sort((a,b)=>finite(b.yoy)-finite(a.yoy)||(finite(a.yoy)&&finite(b.yoy)?b.yoy-a.yoy:0)||a.name.localeCompare(b.name,'zh-CN'));}
function periods(data,basis='ytd'){return [...new Set(data.observations.filter(r=>r.basis===basis&&total(r)).map(r=>r.period))].sort();}
function defaultPeriod(data,level='city'){return periods(data).filter(p=>p.startsWith('2026')).reverse().find(p=>compare(data,level,p).filter(x=>finite(x.yoy)).length>=6)||data.targetPeriod;}
function sourceIds(row){return [...new Set(Object.values(row.provenance||{}).map(x=>x.sourceId))];}
function history(data,id,basis='ytd'){const ps=periods(data,basis);if(!ps.length)return [];const out=[];let [y,m]=ps[0].split('-').map(Number);const end=ps.at(-1);while(true){const p=y+'-'+String(m).padStart(2,'0');if(p>end)break;const r=observation(data,id,p,basis);out.push({period:p,amount:r?.amount??null,yoy:r?.yoy??null});if(++m>12){m=1;y++;}}return out;}
function categories(data,period,basis='ytd'){return (index(data).byPeriod.get(period+'|'+basis)||[]).filter(x=>!total(x));}
function comparableBase(amount,yoy){return finite(amount)&&amount>=0&&finite(yoy)&&yoy>-100?amount/(1+yoy/100):null;}
function decompose(data,regionId,period,basis='month'){
 const t=observation(data,regionId,period,basis);if(!t)return null;const base=comparableBase(t.amount,t.yoy);if(!finite(base)||base<=0)return null;
 const increment=t.amount-base;
 const rows=data.observations.filter(r=>r.regionId===regionId&&r.period===period&&r.basis===basis&&r.scope==='限额以上'&&!['餐费收入','餐饮收入'].includes(r.category)).map(r=>{const b=comparableBase(r.amount,r.yoy);return {...r,base:b,increment:finite(b)?r.amount-b:null,contributionPp:finite(b)?(r.amount-b)/base*100:null,incrementShare:finite(b)&&Math.abs(increment)>1e-8?(r.amount-b)/increment*100:null};}).filter(r=>finite(r.increment)).sort((a,b)=>b.increment-a.increment);
 const excluded=cats=>{const selected=rows.filter(r=>cats.includes(r.category));if(selected.length!==cats.length)return null;const den=base-selected.reduce((s,r)=>s+r.base,0);return den>0?((t.amount-selected.reduce((s,r)=>s+r.amount,0))/den-1)*100:null;};
 const values=rows.map(r=>r.yoy).sort((a,b)=>a-b),n=values.length,median=n?(n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2):null;
 return {total:t,base,increment,rows,median,communication:rows.find(r=>r.category==='通讯器材类')||null,exCommunication:excluded(['通讯器材类']),exAuto:excluded(['汽车类']),exBoth:excluded(['通讯器材类','汽车类']),residual:increment-rows.reduce((s,r)=>s+r.increment,0)};
}
function csvRows(data,level,period,basis){return compare(data,level,period,basis).map(r=>({地区:r.name,层级:r.level==='province'?(r.municipality?'直辖市':'省级'):'城市',统计期:r.period,口径:r.basis==='ytd'?'年初累计':r.basis==='combined'?'1—2月合并':'当月',社零总额亿元:r.amount,官方同比百分比:r.yoy,累计增速较上月变化百分点:r.change,金额来源:r.provenance.amount?.sourceId||'',同比来源:r.provenance.yoy?.sourceId||'',来源链接:sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.url||'').join(' '),发布日期:sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.releaseDate||'').filter(Boolean).join(' ')}));}
const dimensions={goods:{label:'限上商品品类',scope:'限额以上'},usage:{label:'商品用途（吃穿用烧）',scope:'全口径'},form:{label:'消费形态（商品/餐饮）',scope:'全口径'},industry:{label:'行业（批零/住餐）',scope:'全口径'},location:{label:'城乡',scope:'全口径'}};
function rowDimension(r){if(r.dimension)return r.dimension;if(r.scope==='限额以上'&&r.category.endsWith('类'))return 'goods';if(['吃类商品','穿类商品','用类商品','烧类商品'].includes(r.category))return 'usage';if(['商品零售','餐饮收入'].includes(r.category)&&r.scope==='全口径')return 'form';if(['批发零售业','住宿餐饮业'].includes(r.category))return 'industry';return null;}
function availableDimensions(data,id,period,basis){const rows=categories(data,period,basis).filter(r=>r.regionId===id&&finite(r.amount)&&finite(r.yoy));return Object.entries(dimensions).filter(([key])=>rows.filter(r=>rowDimension(r)===key).length>=2).map(([id,spec])=>({id,...spec}));}
function breakdown(data,id,period,basis='month',dimension='goods'){
 const t=observation(data,id,period,basis),base=t&&comparableBase(t.amount,t.yoy);if(!finite(base)||base<=0)return null;const increment=t.amount-base;
 const rows=categories(data,period,basis).filter(r=>r.regionId===id&&rowDimension(r)===dimension&&r.scope===dimensions[dimension]?.scope).map(r=>{const b=comparableBase(r.amount,r.yoy);return {...r,base:b,increment:finite(b)?r.amount-b:null,contributionPp:finite(b)?(r.amount-b)/base*100:null,incrementShare:finite(b)&&Math.abs(increment)>1e-8?(r.amount-b)/increment*100:null};}).filter(r=>finite(r.base)&&r.base>0).sort((a,b)=>Math.abs(b.contributionPp)-Math.abs(a.contributionPp));
 if(!rows.length)return null;
 const values=rows.map(r=>r.yoy).sort((a,b)=>a-b),n=values.length,median=n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2;
 const exclude=category=>{const r=rows.find(r=>r.category===category);return r&&base>r.base?((t.amount-r.amount)/(base-r.base)-1)*100:null;};
 return {total:t,base,increment,rows,dimension,median,exclude,residual:increment-rows.reduce((s,r)=>s+r.increment,0)};
}
function expandHistory(snapshot){const observations=[];for(const s of snapshot.series||[])for(const point of s.points){const [period,amount,yoy,raw]=point,meta={sourceId:s.pointSources?raw:s.sourceId,originalName:s.pointSources?(point[4]||s.originalName):s.originalName,locator:s.pointSources?point[5]:undefined,frequency:s.originalFrequency,rawUnit:s.rawUnit,priority:s.priority,precision:s.priority>=100?'官方原表精度':'来源显示精度'};if(!s.pointSources)meta.raw=raw;observations.push({regionId:s.regionId,period,basis:s.basis,category:s.category,scope:s.scope,dimension:s.dimension||null,amount,yoy,provenance:{...(finite(amount)?{amount:meta}:{}),...(finite(yoy)?{yoy:meta}:{})}});}return {...snapshot,observations};}
function calendar(start,end,frequency='monthly'){const out=[];let [y,m]=start.split('-').map(Number);while(true){const p=y+'-'+String(m).padStart(2,'0');if(p>end)break;if(frequency!=='quarterly'||m%3===0)out.push(p);if(++m>12){m=1;y++;}}return out;}
function windowStart(end,years=5){const [y,m]=end.split('-').map(Number),date=new Date(Date.UTC(y,m-1-(years*12-1),1));return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0');}
function seriesHistory(data,id,basis,category='社零总额',scope='全口径',years=5,end=data.targetPeriod){return calendar([windowStart(end,years),data.historyStart||'0000-01'].sort().at(-1),end).filter(p=>basis!=='combined'||p.endsWith('-02')).map(period=>{const r=observation(data,id,period,basis,category,scope);return {period,value:r?.yoy??null,amount:r?.amount??null,provenance:r?.provenance||{}};});}
const api={finite,regions,previous,observation,compare,periods,defaultPeriod,sourceIds,history,categories,comparableBase,decompose,csvRows,dimensions,rowDimension,availableDimensions,breakdown,expandHistory,calendar,windowStart,seriesHistory};
if(typeof module==='object'&&module.exports)module.exports=api;else root.RegionalRetail=api;
})(typeof window==='object'?window:globalThis);


