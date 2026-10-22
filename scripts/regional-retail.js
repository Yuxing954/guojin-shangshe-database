(function(){
'use strict';
SiteUI.pages['regional-retail.html']=['macro','地方社零'];
const M=RegionalRetail,D=SiteData,$=id=>document.getElementById(id),esc=D.esc,finite=M.finite;
let data,currentRows=[],structureRows=[],caseData=null,view='comparison';
const num=(v,d=1)=>finite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct=v=>finite(v)?(v>0?'+':'')+num(v)+'%':'—';
const color=v=>!finite(v)||v===0?'':v>0?'regional-pos':'regional-neg';
function option(values,selected){return values.map(x=>'<option value="'+esc(x.value??x)+'"'+((x.value??x)===selected?' selected':'')+'>'+esc(x.label??x)+'</option>').join('');}
function links(row){return M.sourceIds(row).map(id=>{const s=data.sources.find(x=>x.id===id);if(!s)return '';const url=D.link(s.url);return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener" title="'+esc([s.publisher,s.releaseDate?'发布 '+s.releaseDate:'发布日期未提供',row.provenance?.amount?.originalName||row.provenance?.yoy?.originalName].filter(Boolean).join(' · '))+'">'+(['provider','secondary'].includes(s.quality)?'Choice':s.quality==='official-repost'?'转载':'原文')+' ↗</a>':'来源未返回';}).join(' ');}
function kpi(label,value,sub=''){return '<article class="regional-kpi"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></article>';}
function syncPeriods(basisId,periodId,preferred){const ps=M.periods(data,$(basisId).value);const selected=ps.includes(preferred)?preferred:ps.at(-1);$(periodId).innerHTML=option(ps.slice().reverse(),selected);}
function renderComparison(){
 const level=$('level').value,period=$('period').value,basis=$('basis').value,query=$('regional-search').value.trim();
 currentRows=M.compare(data,level,period,basis).filter(r=>!query||r.name.includes(query)||r.parent?.includes(query));
 const valid=currentRows.filter(r=>finite(r.yoy)),positive=valid.filter(r=>r.yoy>0).length,negative=valid.filter(r=>r.yoy<0).length,sorted=valid.map(r=>r.yoy).sort((a,b)=>a-b),n=sorted.length,median=n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null;
 $('comparison-title').textContent=period+' · '+(basis==='ytd'?'年初累计':basis==='combined'?'1—2月合并':'当月')+' · '+(level==='city'?'城市':'省级地区');
 $('comparison-count').textContent=currentRows.length+'个地区 / '+valid.length+'个有同比数据';
 $('comparison-summary').innerHTML=kpi('有同比数据',valid.length+' / '+currentRows.length,'所选同一统计期')+kpi('正增长地区',String(positive),'同比 > 0')+kpi('负增长地区',String(negative),'同比 < 0')+kpi('同比中位数',pct(median),'有数据地区');
 const max=Math.max(1,...valid.map(r=>Math.abs(r.yoy)));
 $('comparison-bars').innerHTML=valid.length?valid.map(r=>'<div class="regional-bars"><span>'+esc(r.name)+'</span><div class="track"><i style="background:'+(r.yoy<0?'#71a398':'#b98287')+';left:'+(r.yoy<0?50-Math.abs(r.yoy)/max*48:50)+'%;width:'+Math.abs(r.yoy)/max*48+'%"></i></div><b class="'+color(r.yoy)+'">'+pct(r.yoy)+'</b></div>').join(''):'<div class="regional-empty">所选统计期暂无同比数据</div>';
 $('comparison-table').innerHTML=currentRows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+num(r.amount,2)+'</td><td class="'+color(r.yoy)+'">'+(r.disputed.yoy?'待核验':num(r.yoy))+'</td><td>'+num(r.change)+'</td><td>'+links(r)+'</td></tr>').join('');
 const previous=$('history-region').value,geo=M.regions(data,level);$('history-region').innerHTML=option(geo.map(r=>({value:r.id,label:r.name})),geo.some(r=>r.id===previous)?previous:geo[0]?.id);renderHistory();
 SiteUI.save({level,period,basis,view});
}
function renderHistory(){
 const id=$('history-region').value,basis=$('basis').value,points=M.history(data,id,basis),valid=points.filter(p=>finite(p.yoy)),name=data.regions.find(r=>r.id===id)?.name||'';
 if(!valid.length){$('history-chart').innerHTML='<p class="regional-empty">暂无所选口径的历史同比</p>';return;}
 const lo=Math.min(0,...valid.map(p=>p.yoy)),hi=Math.max(0,...valid.map(p=>p.yoy)),span=hi-lo||1,x=i=>55+i*880/Math.max(1,points.length-1),y=v=>190-(v-lo)/span*145;
 let paths=[],segment=[];points.forEach((p,i)=>{if(finite(p.yoy))segment.push(x(i)+','+y(p.yoy));else if(segment.length){paths.push(segment);segment=[];}});if(segment.length)paths.push(segment);
 $('history-chart').innerHTML='<p class="regional-series-title">'+esc(name)+' · 官方同比（%）</p><svg class="regional-chart" viewBox="0 0 990 230" role="img" aria-label="'+esc(name)+'官方同比历史趋势，缺期断线"><title>'+esc(name)+'官方同比历史趋势</title>'+[lo,(lo+hi)/2,hi].map(v=>'<line x1="55" x2="935" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e3e6ef"/><text x="2" y="'+(y(v)+4)+'">'+num(v)+'</text>').join('')+paths.map(seg=>'<polyline points="'+seg.join(' ')+'" fill="none" stroke="#5969a4" stroke-width="2.4"/>').join('')+points.map((p,i)=>finite(p.yoy)?'<circle cx="'+x(i)+'" cy="'+y(p.yoy)+'" r="3" fill="#5969a4"><title>'+p.period+'：'+pct(p.yoy)+'</title></circle>':'').join('')+'<text x="55" y="220">'+points[0].period+'</text><text x="935" y="220" text-anchor="end">'+points.at(-1).period+'</text></svg>';
}
function renderStructure(){
 const period=$('structure-period').value,basis=$('structure-basis').value,city=$('structure-city').value;
 structureRows=M.categories(data,period,basis).filter(r=>!city||r.regionId===city).sort((a,b)=>a.regionId.localeCompare(b.regionId)||a.category.localeCompare(b.category,'zh-CN'));
 $('structure-title').textContent=period+' · '+(basis==='ytd'?'年初累计':basis==='combined'?'1—2月合并':'当月')+' · 品类与消费形态';
 $('structure-table').innerHTML=structureRows.length?structureRows.map(r=>'<tr><td>'+esc(data.regions.find(x=>x.id===r.regionId)?.name)+'</td><td>'+esc(r.category)+'</td><td>'+esc(r.scope)+'</td><td>'+num(r.amount,2)+'</td><td class="'+color(r.yoy)+'">'+num(r.yoy)+'</td><td>'+links(r)+'</td></tr>').join(''):'<tr><td colspan="6" class="regional-empty">所选城市与统计期暂无结构数据</td></tr>';
}
function renderBeijing(){
 const id=data.regions.find(r=>r.name==='北京').id,c=caseData=M.decompose(data,id,'2026-09','month');
 if(!c){$('beijing-kpis').innerHTML='<p class="regional-empty">北京9月原始数据暂未取得</p>';return;}
 $('beijing-kpis').innerHTML=kpi('9月社零总额',num(c.total.amount,2),'亿元')+kpi('9月官方同比',pct(c.total.yoy),'全口径')+kpi('通讯器材增量占比',num(c.communication?.incrementShare)+'%','测算')+kpi('剔除通讯器材后同比',pct(c.exCommunication),'测算');
 $('beijing-table').innerHTML=c.rows.map(r=>'<tr><td>'+esc(r.category)+'</td><td>'+num(r.amount,2)+'</td><td class="'+color(r.yoy)+'">'+num(r.yoy)+'</td><td class="'+color(r.increment)+'">'+num(r.increment,2)+'</td><td>'+num(r.contributionPp,2)+'</td><td>'+links(r)+'</td></tr>').join('')+'<tr><td>未列商品及餐饮（残差）</td><td>—</td><td>—</td><td>'+num(c.residual,2)+'</td><td>'+num(c.residual/c.base*100,2)+'</td><td>'+links(c.total)+'</td></tr>';
 const ytd=M.observation(data,id,'2026-09','ytd');
 $('beijing-exclusions').innerHTML=kpi('1—9月官方同比',pct(ytd?.yoy),'累计口径')+kpi('剔除汽车后同比',pct(c.exAuto),'测算')+kpi('剔除通讯与汽车后同比',pct(c.exBoth),'测算')+kpi(c.rows.length+'类同比中位数',pct(c.median),'限上已披露品类');
}
function setView(next){view=['tiers','comparison','structure','beijing'].includes(next)?next:'comparison';for(const key of ['tiers','comparison','structure','beijing'])$(key).hidden=key!==view;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));SiteUI.save({view});}
async function load(){
 $('regional-status').textContent='正在读取地方社零…';$('regional-retry').hidden=true;
 try{data=await D.json('data/regional-retail/observations.json');if(!data.regions?.length||!data.observations?.length)throw Error('空数据');data=await RegionalTierDashboard.load(data);const p=new URLSearchParams(location.search);$('level').value=p.get('level')==='province'?'province':'city';$('basis').value=['ytd','month','combined'].includes(p.get('basis'))?p.get('basis'):'ytd';syncPeriods('basis','period',p.get('period')||M.defaultPeriod(data,$('level').value));
 syncPeriods('structure-basis','structure-period','2026-08');const ids=[...new Set(data.observations.filter(r=>r.category!=='社零总额').map(r=>r.regionId))];$('structure-city').innerHTML=option([{value:'',label:'全部已披露城市'},...ids.map(id=>({value:id,label:data.regions.find(r=>r.id===id)?.name}))],'');
 $('regional-status').textContent='记录更新 '+data.updatedAt;$('regional-content').hidden=false;renderComparison();renderStructure();renderBeijing();setView(p.get('view')||'comparison');
 }catch(e){$('regional-status').textContent='地方社零读取失败：'+e.message;$('regional-content').hidden=true;$('regional-retry').hidden=false;}
}
$('regional-retry').onclick=load;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('level').onchange=()=>{syncPeriods('basis','period',$('level').value==='province'?data.targetPeriod:M.defaultPeriod(data));renderComparison();};
$('basis').onchange=()=>{syncPeriods('basis','period',$('period').value);renderComparison();};
$('period').onchange=renderComparison;$('regional-search').oninput=SiteUI.debounce(renderComparison);$('history-region').onchange=renderHistory;
$('structure-basis').onchange=()=>{syncPeriods('structure-basis','structure-period',$('structure-period').value);renderStructure();};$('structure-period').onchange=renderStructure;$('structure-city').onchange=renderStructure;
$('regional-csv').onclick=()=>{const names=new Set(currentRows.map(r=>r.name));D.downloadCsv(M.csvRows(data,$('level').value,$('period').value,$('basis').value).filter(r=>names.has(r.地区)),'地方社零-'+$('period').value+'.csv');};
$('history-csv').onclick=()=>D.downloadCsv(M.history(data,$('history-region').value,$('basis').value).map(r=>{const o=M.observation(data,$('history-region').value,r.period,$('basis').value);return {地区:data.regions.find(x=>x.id===$('history-region').value)?.name,期间:r.period,口径:$('basis').value,金额亿元:r.amount,官方同比百分比:r.yoy,来源:o?M.sourceIds(o).map(id=>data.sources.find(s=>s.id===id)?.url).join(' '):''};}),'地方社零历史.csv');
$('structure-csv').onclick=()=>D.downloadCsv(structureRows.map(r=>({城市:data.regions.find(x=>x.id===r.regionId)?.name,期间:r.period,口径:r.basis,分类:r.category,统计范围:r.scope,金额亿元:r.amount,官方同比百分比:r.yoy,来源:M.sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.url).join(' ')})),'城市社零结构-'+$('structure-period').value+'.csv');
$('beijing-csv').onclick=()=>{if(!caseData)return;D.downloadCsv([...caseData.rows.map(r=>({品类:r.category,期间:'2026-09',金额亿元:r.amount,官方同比百分比:r.yoy,可比基数亿元测算:r.base,同比增量亿元测算:r.increment,拉动社零百分点测算:r.contributionPp,增量占比百分比测算:r.incrementShare,来源:M.sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.url).join(' ')})),{品类:'未列商品及餐饮（残差）',期间:'2026-09',同比增量亿元测算:caseData.residual,拉动社零百分点测算:caseData.residual/caseData.base*100}],'北京9月社零贡献测算.csv');};
load();
})();


