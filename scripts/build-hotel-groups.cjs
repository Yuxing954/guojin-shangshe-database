'use strict';
// A small, reproducible read model. The source observations are never modified.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A=require('./company-overview-model.js'),M=require('./company-database-model.js');
function build(root){
 const inputs=new Map(),read=f=>{const raw=fs.readFileSync(path.join(root,f));inputs.set(f,crypto.createHash('sha256').update(raw).digest('hex'));return JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));};
 const catalog=read('data/companies/catalog.json'),profiles=read('data/companies/profiles.json'),supp=read('data/companies/supplements.json'),work=read(catalog.workbookDisclosuresFile),sources=read(catalog.sourcesFile).sources,issues=[...(read(catalog.issuesFile).issues||[]),...(work.issues||[])];
 const supplement=(supp.parts||[]).flatMap(p=>read(p).observations);
 const definitions={revpar:['RevPAR','operating'],occ:['OCC','operating'],adr:['ADR','operating'],hotels:['酒店数','scale'],rooms:['房间数','scale'],opened:['新开店','opened'],pipeline:['筹建酒店','pipeline'],revenue:['营业收入','financial'],profit:['利润','financial']};
 const companies=['hworld','jinjiang','btg','atour'].map(id=>{
  const c=catalog.companies.find(c=>c.id===id),p=profiles.companies[id];if(!c||!p)throw Error('缺少集团配置：'+id);
  const index=read(c.file);let rows=index.parts?index.parts.flatMap(f=>read(f).observations):index.observations;
  if(rows.length!==c.count)throw Error(id+' 历史数据数量不一致');
  rows=A.merge(rows,supplement.filter(o=>o.companyId===id));
  const extra=(work.companyParts[id]||[]).flatMap(f=>read(f).observations);
  if(extra.length!==(work.counts[id]||0))throw Error(id+' 底稿数量不一致');rows=A.merge(rows,extra);
  const series={};
  for(const [key,[name,kind]] of Object.entries(definitions)){
   if(!p[kind])continue;const metric=key==='profit'?p.profitMetric:key;
   const selector={...p[kind],frequency:'季度',...(kind==='financial'?{periodBasis:'单季',currency:'CNY'}:{})};
   const picked=A.pick(rows,selector,metric).filter(o=>/^\d{4}Q[1-4]$/.test(o.period)&&Number.isFinite(o.value));
   const latest=picked.at(-1);if(!latest)continue;
   // Explicitly fix the unit, currency, period basis and reporting scope.
   const own=picked.filter(o=>M.seriesKey(o)===M.seriesKey(latest));
   if(new Set(own.map(o=>o.period)).size!==own.length)throw Error(id+' '+key+' 存在重复可比期');
   const observations=own.map(o=>{
    const change=A.yoy(rows,o),flag=issues.some(i=>[o.id,o.originalSource?.observationId].filter(Boolean).some(id=>i.selectedId===id||i.observationId===id||(i.observationIds||[]).includes(id)));
    const keep=['id','period','value','status','sourceId','locator','report','pages','formula','rawValue','originalUnit','note','verification','reportUrl','evidenceIds','screenshotLocator','originalSource','sourceConflict'];
    return {...Object.fromEntries(keep.filter(k=>o[k]!=null&&o[k]!=='').map(k=>[k,o[k]])),...(flag?{issue:true}:{}),yoy:change?{value:change.value,unit:change.unit,kind:change.kind,priorId:change.prior?.id||null}:null};
   });
   series[key]={metric,name:key==='profit'?(metric==='parent_profit'?'归母净利润':'净利润'):name,...Object.fromEntries(['frequency','periodBasis','unit','currency','region','scope','mode','basis'].map(k=>[k,latest[k]??null])),observations};
  }
  return {id,name:c.name,code:c.code,series};
 });
 const sourceList=[...sources,...supp.sources,...work.sources],used=new Set(companies.flatMap(c=>Object.values(c.series).flatMap(s=>s.observations.flatMap(o=>[o.sourceId,o.originalSource?.id].filter(Boolean)))));
 return {schemaVersion:1,updatedAt:[catalog.updatedAt,profiles.updatedAt,work.updatedAt].filter(Boolean).sort().at(-1),companies,sources:sourceList.filter(s=>used.has(s.id)),inputFiles:[...inputs].sort(([a],[b])=>a.localeCompare(b)).map(([file,sha256])=>({file,sha256})),notes:['各集团保留各自的经营范围，不作同店排名或加总。','季度财务只取单季人民币口径；不将半年、累计或全年值当作季度值。','底稿转录、底稿推算和原披露核对按来源原状态列示；未逐项重新核验原PDF。','同比使用同一序列的上年同期；OCC变化单位为pct。缺失、冲突或非正基数不强算增速。']};
}
if(require.main===module){const root=path.resolve(process.argv.find(a=>a.startsWith('--root='))?.slice(7)||path.join(__dirname,'..')),output=path.join(root,'data/hotel-groups.json'),content=JSON.stringify(build(root))+'\n';if(process.argv.includes('--check')){if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==content)throw Error('酒店集团数据需更新：node scripts/build-hotel-groups.cjs');console.log('Hotel group data is current');}else{fs.writeFileSync(output,content);console.log('Built '+Buffer.byteLength(content)+' bytes');}}
module.exports={build};
