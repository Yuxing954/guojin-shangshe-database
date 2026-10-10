(function(){
 'use strict';
 const D=SiteData,M=CompanyDatabaseModel,A=CompanyOverviewModel,$=id=>document.getElementById(id),esc=D.esc;
 let context,profiles,active='overview',compareRequest=0;
 const profilePromise=D.json('data/companies/profiles.json').then(x=>profiles=x.companies);
 const metric=id=>context.catalog.metrics.find(x=>x.id===id)?.name||id;
 const unit=o=>[o?.unit,o?.currency].filter(Boolean).join(' / ');
 const signed=(v,d=1)=>(v>0?'+':'')+D.fmt(v,d);
 const src=o=>o?'<button class="db-evidence" data-observation="'+esc(o.id)+'" aria-label="查看'+esc(metric(o.metric))+'来源">'+esc(o.verification?'原披露':'底稿')+' ↗</button>':'';
 const value=o=>o?D.fmt(o.value,o.unit==='家'||o.unit==='间'?0:2):'暂无数据';
 function cell(o,withPeriod=true){const flagged=o&&(o.sourceConflict||context.issues.some(i=>i.selectedId===o.id||i.observationId===o.id||(i.observationIds||[]).includes(o.id)));return o?'<strong>'+value(o)+'</strong> <span class="db-muted">'+esc(unit(o))+'</span>'+src(o)+(flagged?'<small class="db-flag">口径待核验</small>':'')+(withPeriod?'<small>'+esc(o.period+' · '+o.periodBasis)+'</small>':''):'<span class="db-muted">暂无数据</span>';}
 function change(o,rows){const y=A.yoy(rows,o);return y?'<span class="db-change">'+esc(y.kind)+' '+signed(y.value)+(y.unit==='%'?'%':' '+esc(y.unit))+'</span>':'<span class="db-muted">同比暂无可比基期</span>';}
 function card(name,o,rows){const flagged=o&&(o.sourceConflict||context.issues.some(i=>i.selectedId===o.id||i.observationId===o.id||(i.observationIds||[]).includes(o.id)));return '<article class="db-kpi"><span>'+esc(name)+'</span><strong>'+value(o)+'</strong><small>'+esc(unit(o))+'</small><div>'+change(o,rows)+'</div><small>'+esc(o?o.period+' · '+o.periodBasis:'暂无数据')+'</small><div class="db-kpi-foot">'+src(o)+(o?'<button class="db-evidence" data-history="'+esc(o.id)+'">历史 ↗</button>':'')+'</div>'+(flagged?'<span class="db-flag">口径待核验</span>':'')+(o?'<small>'+esc(M.seriesLabel(o))+'</small>':'')+'</article>';}
 function show(view){active=view;for(const v of ['overview','compare','history','evidence']){const el=$('db-view-'+v);el.hidden=v!==view;const b=document.querySelector('[data-view="'+v+'"]');b.classList.toggle('active',v===view);b.setAttribute('aria-selected',String(v===view));}const u=new URL(location.href);u.searchParams.set('db-view',view);history.replaceState(null,'',u);if(view==='compare')paintCompare();}
 function table(headers,body){return '<div class="portal-table-scroll"><table class="portal-table db-matrix"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';}
 function paintStructure(p,rows){const groups=p.structures.map(g=>{const s=A.structure(rows,p,g);return '<article class="db-block"><h3>'+esc(g.title)+'</h3><small>'+esc(s.total?s.total.period+' · '+M.seriesLabel(s.total):'暂无数据')+'</small>'+table(['项目','数量','占比'],s.rows.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+cell(x.row,false)+'</td><td>'+(x.share===null?'暂无数据':D.fmt(x.share,1)+'%')+'</td></tr>').join(''))+(s.residual!==null&&Math.abs(s.residual)>0.01?'<p class="db-flag">分项与总量差额 '+D.fmt(s.residual,0)+' '+esc(s.total.unit)+' · 未归一化</p>':'')+'</article>';});
 const total=A.latest(rows,p.financial,'revenue');const items=['managed_revenue','leased_revenue','retail_revenue','hotel_revenue','other_revenue'].map(m=>A.latest(rows,{...p.financial,frequency:total?.frequency},m,total?.period)).filter(Boolean);
 if(items.length)groups.push('<article class="db-block"><h3>收入结构</h3><small>'+esc(total.period+' · '+total.periodBasis+' · '+total.currency)+'</small>'+table(['项目','百万元','收入占比'],items.map(o=>'<tr><td>'+esc(metric(o.metric))+(o.companyId==='btg'&&o.metric==='other_revenue'?'（景区）':'')+'</td><td>'+cell(o,false)+'</td><td>'+D.fmt(A.ratio(o,total),1)+'%</td></tr>').join(''))+(Math.abs(items.reduce((a,o)=>a+o.value,0)-total.value)>0.1?'<p class="db-flag">分项未完整覆盖或源表未勾稽 · 保留原值</p>':'')+'</article>');
 if(p.id==='atour'){
  const brandRows=A.pick(rows,{frequency:'年度',basis:'品牌酒店'},'hotels'),period=M.filter(brandRows).at(-1)?.period,total=A.latest(rows,{...p.scale,frequency:'年度'},'hotels',period);
  const names=[...new Set(brandRows.filter(o=>o.period===period).map(o=>o.scope))];
  groups.push('<article class="db-block"><h3>品牌矩阵 · 酒店数</h3><small>'+esc(period||'暂无数据')+' · 年末 · 加盟 + 直营</small>'+table(['品牌','酒店数','总门店占比'],names.map(name=>{const own=brandRows.filter(o=>o.period===period&&o.scope===name),n=own.reduce((a,o)=>a+o.value,0);return '<tr><td>'+esc(name)+'</td><td>'+D.fmt(n,0)+own.map(src).join(' ')+'</td><td>'+(total?D.fmt(n/total.value*100,2)+'%':'暂无数据')+'</td></tr>';}).join(''))+'</article>');
 }
 $('db-structure').innerHTML=groups.join('')||'<p class="portal-empty">暂无结构数据</p>';
 }
 function paintOverview(){if(!context||!profiles)return;const {company:c,rows}=context,p=profiles[c.id],snap=A.snapshot(rows,p);
 $('db-profile').innerHTML='<div><p class="eyebrow">'+esc(c.market+' / '+c.code)+'</p><h2>'+esc(c.name)+'</h2><p>'+esc(p.intro)+'</p><div class="db-tags">'+p.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div></div><div class="db-profile-meta"><strong>'+rows.filter(A.actual).length+' 条历史</strong><span>预测 '+rows.filter(o=>o.status==='forecast').length+' · 待核验 '+rows.filter(o=>o.status==='pending').length+'</span><button class="db-evidence" data-open-evidence>档案来源与缺口 ↗</button></div>';
 $('db-scale').innerHTML=['hotels','rooms'].map(m=>card(metric(m),snap[m],rows)).join('')+['opened','pipeline'].map(m=>card(metric(m),A.latest(rows,p[m]||p.scale,m),rows)).join('');
 $('db-operating').innerHTML=['revpar','adr','occ'].map(m=>card(metric(m),snap[m],rows)).join('');
 $('db-finance').innerHTML=['revenue',p.profitMetric,'operating_profit'].map(m=>card(metric(m),snap[m],rows)).join('');
 const profit=snap[p.profitMetric],revenue=snap.revenue,margin=A.ratio(profit,revenue);
 $('db-finance').innerHTML+= '<article class="db-kpi"><span>'+esc(metric(p.profitMetric))+' / 收入</span><strong>'+(margin===null?'暂无数据':D.fmt(margin,2)+'%')+'</strong><small>同期间、同币种计算</small><div class="db-kpi-foot">'+src(profit)+src(revenue)+'</div><small>'+esc(margin===null?'利润与收入无可比期间':revenue.period+' · '+revenue.periodBasis)+'</small></article>';
 paintStructure(p,rows);
 const cashMetrics=['operating_cf','cash','debt','adjusted_ebitda'],cash=cashMetrics.map(m=>A.latest(rows,p.financial,m));
 $('db-liquidity').innerHTML=table(['指标','数值','期间与口径'],cash.map((o,i)=>'<tr><td>'+esc(metric(cashMetrics[i]))+'</td><td>'+cell(o,false)+'</td><td>'+esc(o?o.period+' · '+o.periodBasis+' · '+M.seriesLabel(o):'暂无数据')+'</td></tr>').join(''));
 $('db-overview-trends').innerHTML=['revpar','revenue',p.profitMetric].map(m=>{const latest=snap[m],series=A.history(rows,latest).slice(-12);return '<article class="db-block"><h3>'+esc(metric(m))+'</h3><small>'+esc(latest?latest.frequency+' · '+unit(latest)+' · '+M.seriesLabel(latest):'暂无数据')+'</small>'+(series.length?D.trend(series.map(o=>({date:o.period,value:o.value})),c.name+' '+metric(m)):'<p class="portal-empty">暂无数据</p>')+(latest?'<button class="db-evidence" data-history="'+esc(latest.id)+'">完整历史 ↗</button>':'')+'</article>';}).join('');
 const annual=A.pick(rows,{...p.financial,frequency:'年度'},'revenue').slice(-5);
 $('db-annual').innerHTML=table(['年度','收入 / 百万元','同比','利润口径','利润 / 百万元','利润 / 收入'],annual.map(o=>{const n=A.latest(rows,{...p.financial,frequency:'年度'},p.profitMetric,o.period),ratio=A.ratio(n,o);return '<tr><td>'+esc(o.period)+'</td><td>'+cell(o,false)+'</td><td>'+change(o,rows)+'</td><td>'+esc(metric(p.profitMetric))+'</td><td>'+cell(n,false)+'</td><td>'+(ratio===null?'暂无数据':D.fmt(ratio,2)+'%')+'</td></tr>';}).join('')||'<tr><td colspan="6">暂无年度财务数据</td></tr>');
 $('db-watch').innerHTML=p.watch.map(t=>'<li>'+esc(t)+'</li>').join('');
 paintEvidence(p,rows);
 }
 function paintEvidence(p,rows){const companyIssues=context.issues.filter(i=>i.companyId===p.id||rows.some(o=>i.selectedId===o.id||i.observationId===o.id||(i.observationIds||[]).includes(o.id)));
 companyIssues.push(...rows.filter(o=>o.sourceConflict).map(o=>({message:o.period+' · '+metric(o.metric)+' · 本次报告列示 '+o.value+'；旧底稿 '+o.originalSource.value+'。两组来源均保留，未假定为同一可比基期。'})));
 $('db-gaps').innerHTML=p.gaps.map(t=>'<li>'+esc(t)+'</li>').join('');
 const coverage=context.catalog.metrics.map(m=>{const own=rows.filter(o=>o.metric===m.id),a=own.filter(A.actual),f=own.filter(o=>o.status==='forecast');if(!own.length)return '';const series=M.series(a),last=M.filter(a).at(-1);return '<tr><td>'+esc(m.name)+'</td><td>'+a.length+'</td><td>'+f.length+'</td><td>'+esc(last?.period||'暂无数据')+'</td><td>'+series.length+'</td></tr>';}).join('');
 $('db-coverage').innerHTML=table(['指标','历史记录','预测','最新历史期间','口径序列数'],coverage||'<tr><td colspan="5">暂无数据</td></tr>');
 const sourceIDs=new Set([...rows.map(o=>o.sourceId),...p.evidence]);const list=context.sources.filter(s=>sourceIDs.has(s.id));
 $('db-sources').innerHTML=list.map(s=>'<article class="db-source-item"><strong>'+esc(s.file)+'</strong><p>'+esc(s.relativePath)+'</p><span>'+esc(s.verification)+'</span><small>'+esc(s.pages||'单元格 / CSV行号见记录')+'</small></article>').join('')||'<p class="portal-empty">暂无专项资料</p>';
 $('db-issues').innerHTML=companyIssues.map(i=>'<li>'+esc(i.message)+'</li>').join('')||'<li>当前入库记录暂无已登记冲突</li>';
 $('db-issues-count').textContent=companyIssues.length+' 项登记问题';
 }
 async function paintCompare(){if(!context||!profiles)return;const token=++compareRequest;$('db-compare-status').textContent='正在读取同业数据…';try{
  const datasets=await Promise.all(context.catalog.companies.map(async c=>({company:c,rows:(await context.loadCompany(c)).observations,p:profiles[c.id]})));if(token!==compareRequest)return;
  const period=$('db-compare-period').value;
  const mode=$('db-compare-kind').value;
  let body;
  if(mode==='operating'){
   body=datasets.map(({company:c,rows,p})=>{const s=A.snapshot(rows,p,period||undefined);return '<tr><td><button class="db-evidence" data-select-company="'+esc(c.id)+'">'+esc(c.name)+'</button><small>'+esc(c.code)+'</small></td><td>'+cell(s.hotels)+'</td><td>'+cell(s.rooms)+'</td><td>'+cell(s.revpar)+'</td><td>'+cell(s.adr)+'</td><td>'+cell(s.occ)+'</td><td>'+esc(M.seriesLabel(s.revpar||{...p.operating})||'暂无数据')+'</td></tr>';}).join('');
   $('db-comparison').innerHTML=table(['公司','酒店数 / 期末','客房数 / 期末','RevPAR','ADR','入住率','经营指标口径'],body);
  }else{
   const fy=$('db-compare-year').value;
   body=datasets.map(({company:c,rows,p})=>{const sel={...p.financial,frequency:'年度'},r=A.latest(rows,sel,'revenue',fy),n=A.latest(rows,sel,p.profitMetric,fy),margin=A.ratio(n,r);return '<tr><td>'+esc(c.name)+'</td><td>'+cell(r)+'</td><td>'+change(r,rows)+'</td><td>'+esc(metric(p.profitMetric))+'</td><td>'+cell(n)+'</td><td>'+change(n,rows)+'</td><td>'+(margin===null?'暂无数据':D.fmt(margin,2)+'%')+'</td></tr>';}).join('');
   $('db-comparison').innerHTML=table(['公司','年度收入','收入同比','利润口径','年度利润','利润同比','利润 / 收入'],body);
  }
  $('db-compare-status').textContent=mode==='operating'?(period||'各公司最新期间')+' · 保留各公司定义与币种':'年度财务 · '+$('db-compare-year').value+' · 净利润与归母口径单列';
  $('db-compare-period').hidden=mode!=='operating';$('db-compare-year').hidden=mode==='operating';
 }catch(e){$('db-compare-status').textContent='同业数据读取失败，请重试';}}
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
 document.addEventListener('click',e=>{const historyButton=e.target.closest('[data-history]');if(historyButton&&context){context.toHistory(historyButton.dataset.history);show('history');}if(e.target.closest('[data-open-evidence]'))show('evidence');const selected=e.target.closest('[data-select-company]');if(selected&&context){context.select(selected.dataset.selectCompany);show('overview');}});
 for(const id of ['db-compare-period','db-compare-kind','db-compare-year'])$(id).onchange=paintCompare;
 document.addEventListener('companydb:selected',async e=>{context=e.detail;await profilePromise;paintOverview();if(active==='compare')paintCompare();});
 show(['overview','compare','history','evidence'].includes(new URLSearchParams(location.search).get('db-view'))?new URLSearchParams(location.search).get('db-view'):'overview');
})();
