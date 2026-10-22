(function(root){
'use strict';
const total=r=>r.category==='社零总额'&&r.scope==='全口径';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function regions(data,level){return data.regions.filter(r=>level==='province'?r.level==='province':r.level==='city'||r.municipality);}
function previous(period){const [y,m]=period.split('-').map(Number);return m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');}
function observation(data,regionId,period,basis,category='社零总额',scope='全口径'){return data.observations.find(r=>r.regionId===regionId&&r.period===period&&r.basis===basis&&r.category===category&&r.scope===scope)||null;}
function compare(data,level,period,basis='ytd'){return regions(data,level).map(r=>{const o=observation(data,r.id,period,basis),p=observation(data,r.id,previous(period),basis);return {...r,period,basis,amount:o?.amount??null,yoy:o?.yoy??null,change:finite(o?.yoy)&&finite(p?.yoy)?o.yoy-p.yoy:null,provenance:o?.provenance||{},disputed:o?.disputed||{}};}).sort((a,b)=>finite(b.yoy)-finite(a.yoy)||(finite(a.yoy)&&finite(b.yoy)?b.yoy-a.yoy:0)||a.name.localeCompare(b.name,'zh-CN'));}
function periods(data,basis='ytd'){return [...new Set(data.observations.filter(r=>r.basis===basis&&total(r)).map(r=>r.period))].sort();}
function defaultPeriod(data,level='city'){return periods(data).filter(p=>p.startsWith('2026')).reverse().find(p=>compare(data,level,p).filter(x=>finite(x.yoy)).length>=6)||data.targetPeriod;}
function sourceIds(row){return [...new Set(Object.values(row.provenance||{}).map(x=>x.sourceId))];}
function history(data,id,basis='ytd'){const ps=periods(data,basis);if(!ps.length)return [];const out=[];let [y,m]=ps[0].split('-').map(Number);const end=ps.at(-1);while(true){const p=y+'-'+String(m).padStart(2,'0');if(p>end)break;const r=observation(data,id,p,basis);out.push({period:p,amount:r?.amount??null,yoy:r?.yoy??null});if(++m>12){m=1;y++;}}return out;}
function categories(data,period,basis='ytd'){return data.observations.filter(x=>x.period===period&&x.basis===basis&&!total(x));}
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
const api={finite,regions,previous,observation,compare,periods,defaultPeriod,sourceIds,history,categories,comparableBase,decompose,csvRows};
if(typeof module==='object'&&module.exports)module.exports=api;else root.RegionalRetail=api;
})(typeof window==='object'?window:globalThis);

