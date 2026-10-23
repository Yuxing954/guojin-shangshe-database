(function(){
 'use strict';
 const D=SiteData,M=CompanyDatabaseModel,A=CompanyOverviewModel,$=id=>document.getElementById(id),esc=D.esc;
 let context,profiles,active='overview',compareRequest=0,operatingSeries=[],financialPeriods=[];
 const profilePromise=D.json('data/companies/profiles.json').then(x=>profiles=x.companies);
 const metric=id=>context.catalog.metrics.find(x=>x.id===id)?.name||id;
 const unit=o=>[o?.unit==='百万元'?(o.currency==='USD'?'百万美元':o.currency==='HKD'?'百万港元':'百万元'):o?.unit,o?.currency].filter(Boolean).join(' / ');
 const signed=(v,d=1)=>(v>0?'+':'')+D.fmt(v,d);
 const issue=o=>o&&(o.sourceConflict||context.issues.some(i=>[o.id,o.originalSource?.observationId].filter(Boolean).includes(i.selectedId)||[o.id,o.originalSource?.observationId].filter(Boolean).includes(i.observationId)||(i.observationIds||[]).includes(o.id)));
 const src=o=>o?'<button class="db-evidence" data-observation="'+esc(o.id)+'" aria-label="查看'+esc(metric(o.metric))+'来源">'+esc(o.sourceId.startsWith('choice-')?'Choice':o.sourceId.startsWith('workbook-')?'底稿':o.verification?'原披露':'底稿')+' ↗</button>':'';
 const value=o=>o?D.fmt(o.value,o.unit==='家'||o.unit==='间'?0:2):'暂无数据';
 function amount(o){if(!o)return {text:'暂无数据',unit:''};return o.unit==='百万元'?{text:D.fmt(o.value/100,2),unit:(o.currency==='USD'?'亿美元':o.currency==='HKD'?'亿港元':'亿元')+' / '+o.currency}:{text:value(o),unit:unit(o)};}
 function cell(o,withPeriod=true){return o?'<strong>'+value(o)+'</strong> <span class="db-muted">'+esc(unit(o))+'</span>'+src(o)+(issue(o)?'<small class="db-flag">口径待核验</small>':'')+(withPeriod?'<small>'+esc(o.period+' · '+o.periodBasis)+'</small>':''):'<span class="db-muted">暂无数据</span>';}
 function change(o,rows){const y=A.yoy(rows,o);return y?'<span class="db-change">'+esc(y.kind)+' '+signed(y.value)+(y.unit==='%'?'%':' '+esc(y.unit))+'</span>':'<span class="db-muted">同比暂无数据</span>';}
 function card(name,o,rows,compact=false){const a=amount(o);return '<article class="db-kpi site-kpi"><span>'+esc(name)+'</span><strong>'+esc(a.text)+'</strong><small>'+esc(a.unit)+'</small><div>'+change(o,rows)+'</div><small>'+esc(o?o.period+' · '+o.periodBasis:'暂无数据')+'</small><div class="db-kpi-foot">'+src(o)+(o&&!compact?'<button class="db-evidence" data-history="'+esc(o.id)+'">历史 ↗</button>':'')+'</div>'+(issue(o)?'<span class="db-flag">口径待核验</span>':'')+'</article>';}
 function ratioCard(label,n,d){const ratio=A.ratio(n,d);return '<article class="db-kpi site-kpi"><span>'+esc(label)+'</span><strong>'+(ratio===null?'暂无数据':D.fmt(ratio,2)+'%')+'</strong><div class="db-kpi-foot">'+src(n)+src(d)+'</div><small>'+esc(ratio===null?'暂无可比输入':d.period+' · '+d.periodBasis)+'</small></article>';}
 function table(headers,body){return '<div class="portal-table-scroll"><table class="portal-table db-matrix"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';}
 function show(view){
  if(view==='evidence'){location.href='data-notes.html#companies';return;}
  const compare=view==='compare';active=compare?'overview':view;
  for(const v of ['overview','financial','history']){ $('db-view-'+v).hidden=v!==active;const b=document.querySelector('[data-view="'+v+'"]');b.classList.toggle('active',v===active);b.setAttribute('aria-selected',String(v===active));}
  const u=new URL(location.href);u.searchParams.set('db-view',active);u.searchParams.delete('db-chapter');history.replaceState(null,'',u);
  if(compare){$('db-compare-panel').open=true;paintCompare();}
  if(window.SiteCharts)window.SiteCharts.scan?.();
 }
 function trendBlock(o,rows,title){const series=A.history(rows,o),changes=series.map(r=>A.yoy(rows,r)),hasGrowth=changes.some(y=>y&&(y.unit==='%'||y.unit==='百分点'));const plot=series.length&&window.SiteCharts?.paired?window.SiteCharts.paired(series.map((r,i)=>({period:r.period,x:M.period(r.period),value:r.value,change:changes[i]&&(changes[i].unit==='%'||changes[i].unit==='百分点')?changes[i].value:null})),{width:Math.max(260,($('db-operating-trends')?.clientWidth||$('db-financial-trends')?.clientWidth||document.querySelector('.db-section').clientWidth)-38),name:title||metric(o.metric),unit:unit(o),changeUnit:o.metric==='occ'?'百分点':'%',mode:'value',gap:o.frequency==='季度'?3:o.frequency==='半年'?6:12}).html:series.length?D.trend(series.map(r=>({date:r.period,value:r.value,unit:unit(r)})),title):'<p class="portal-empty">暂无数据</p>';return '<article class="db-block"><h3>'+esc(title||metric(o?.metric||''))+'</h3><small>'+esc(o?o.frequency+' · '+unit(o)+' · '+A.description(o):'暂无数据')+'</small>'+plot+(o?'<button class="db-evidence" data-history="'+esc(o.id)+'">完整历史 ↗</button>':'')+'</article>';}
 function paintStructure(p,rows){const groups=p.structures.map(g=>{const s=A.structure(rows,p,g);return '<article class="db-block"><h3>'+esc(g.title)+'</h3><small>'+esc(s.total?s.total.period+' · '+A.description(s.total):'暂无数据')+'</small>'+table(['项目','数量','占比'],s.rows.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+cell(x.row,false)+'</td><td>'+(x.share===null?'暂无数据':D.fmt(x.share,1)+'%')+'</td></tr>').join(''))+(s.residual!==null&&Math.abs(s.residual)>0.01?'<p class="db-flag">分项与总量差额 '+D.fmt(s.residual,0)+' '+esc(s.total.unit)+' · 未归一化</p>':'')+'</article>';});
  const total=A.latest(rows,p.financial,'revenue');const items=total?['managed_revenue','leased_revenue','retail_revenue','hotel_revenue','other_revenue'].map(m=>A.latest(rows,{...p.financial,frequency:total.frequency},m,total.period)).filter(Boolean):[];
  if(items.length)groups.push('<article class="db-block"><h3>收入结构</h3><small>'+esc(total.period+' · '+total.periodBasis+' · '+total.currency)+'</small>'+table(['项目','百万元','收入占比'],items.map(o=>{const r=A.ratio(o,total);return '<tr><td>'+esc(metric(o.metric))+(o.companyId==='btg'&&o.metric==='other_revenue'?'（景区）':'')+'</td><td>'+cell(o,false)+'</td><td>'+(r===null?'暂无数据':D.fmt(r,1)+'%')+'</td></tr>';}).join(''))+(Math.abs(items.reduce((a,o)=>a+o.value,0)-total.value)>0.1?'<p class="db-flag">分项未完整覆盖或源表未勾稽 · 保留原值</p>':'')+'</article>');
  if(p.id==='atour'){
   const brandRows=A.pick(rows,{frequency:'年度',basis:'品牌酒店'},'hotels'),period=M.filter(brandRows).at(-1)?.period,total=A.latest(rows,{...p.scale,frequency:'年度'},'hotels',period),names=[...new Set(brandRows.filter(o=>o.period===period).map(o=>o.scope))];
   groups.push('<article class="db-block"><h3>品牌矩阵 · 酒店数</h3><small>'+esc(period||'暂无数据')+' · 年末 · 加盟 + 直营</small>'+table(['品牌','酒店数','总门店占比'],names.map(name=>{const own=brandRows.filter(o=>o.period===period&&o.scope===name),n=own.reduce((a,o)=>a+o.value,0);return '<tr><td>'+esc(name)+'</td><td>'+D.fmt(n,0)+own.map(src).join(' ')+'</td><td>'+(total?D.fmt(n/total.value*100,2)+'%':'暂无数据')+'</td></tr>';}).join(''))+'</article>');
  }
  $('db-structure').innerHTML=groups.join('')||'<p class="portal-empty">暂无结构数据</p>';
 }
 function paintOperating(){if(!context||!profiles)return;const {rows,company:c}=context,p=profiles[c.id],o=operatingSeries.find(x=>M.seriesKey(x)===$('db-operating-lens').value),period=$('db-operating-period').value;
  const sel=o?Object.fromEntries(['region','scope','mode','basis','frequency','currency','periodBasis'].map(k=>[k,o[k]])):p.operating;
  const selected=['revpar','adr','occ'].map(m=>A.latest(rows,m==='occ'?Object.fromEntries(Object.entries(sel).filter(([k])=>k!=='currency')):sel,m,period));
  $('db-operating-note').textContent=(o?A.description(o):'暂无经营范围');
  $('db-operating').innerHTML=selected.map((r,i)=>card(metric(['revpar','adr','occ'][i]),r,rows)).join('');
  const trend=$('db-operating-trend').value;const selectedTrend=selected[['revpar','adr','occ'].indexOf(trend)];$('db-operating-trends').innerHTML=trendBlock(selectedTrend,rows,metric(trend));
  const snap=A.snapshot(rows,p,period),scopeLabel=o=>o?[o.region,o.scope,o.mode].filter(v=>v&&v!=='全部').join(' / '):'暂无数据';const opened=A.latest(rows,p.opened||p.scale,'opened',p.opened?.frequency==='半年'?period?.replace('Q2','H1'):period),pipeline=A.latest(rows,p.pipeline||p.scale,'pipeline',period);$('db-scale-note').textContent='酒店/客房：'+scopeLabel(snap.hotels)+' · 新开：'+scopeLabel(opened)+' · 储备：'+scopeLabel(pipeline);$('db-scale').innerHTML=['hotels','rooms'].map(m=>card(metric(m),snap[m],rows)).join('')+['opened','pipeline'].map(m=>card(metric(m),A.latest(rows,p[m]||p.scale,m,m==='opened'&&p.opened?.frequency==='半年'?period?.replace('Q2','H1'):period),rows)).join('');
 }
 function operatingOptions(keep=false){const {rows,company:c}=context,p=profiles[c.id],previous=$('db-operating-lens').value;operatingSeries=M.series(A.pick(rows,{frequency:'季度'},'revpar')).map(x=>x.row);
  $('db-operating-lens').innerHTML=operatingSeries.map(o=>'<option value="'+esc(M.seriesKey(o))+'">'+esc(A.description(o).replace(' · 期间平均',''))+'</option>').join('');
  const defaultRow=A.latest(rows,p.operating,'revpar');if(keep&&operatingSeries.some(o=>M.seriesKey(o)===previous))$('db-operating-lens').value=previous;else if(defaultRow)$('db-operating-lens').value=M.seriesKey(defaultRow);
  operatingPeriods();
 }
 function operatingPeriods(){const o=operatingSeries.find(x=>M.seriesKey(x)===$('db-operating-lens').value),rows=A.history(context.rows,o),periods=[...new Set(rows.map(r=>r.period))].reverse();$('db-operating-period').innerHTML=periods.map(p=>'<option>'+esc(p)+'</option>').join('');paintOperating();}
 function financeOptions(){const p=profiles[context.company.id],source=$('db-financial-source').value,sel=source==='choice'?p.choiceFinancial:p.financial;financialPeriods=[...new Set(A.pick(context.rows,sel,'revenue').map(o=>o.period))].reverse();$('db-financial-period').innerHTML=financialPeriods.map(p=>'<option>'+esc(p)+'</option>').join('');paintFinancial();}
 function paintFinancial(){if(!context||!profiles)return;const {rows,company:c}=context,p=profiles[c.id],source=$('db-financial-source').value,period=$('db-financial-period').value,s=A.financial(rows,p,period||undefined,source),profit=s[s.profitMetric],r=s.revenue,cf=s.operating_cf;
  $('db-financial-note').textContent=r?[r.period,r.periodBasis,r.currency,s.source==='choice'?'Choice':'研究底稿 / 原报告'].filter(Boolean).join(' · '):'暂无所选财务数据';
  $('db-finance').innerHTML=card('营业收入',r,rows)+card(metric(s.profitMetric),profit,rows)+card('经营现金流净额',cf,rows);
  $('db-quality').innerHTML=ratioCard(metric(s.profitMetric)+' / 收入',profit,r)+ratioCard('经营现金流 / 收入',cf,r)+(s.assets&&s.liabilities?'<article class="db-kpi site-kpi"><span>资产负债率</span><strong>'+D.fmt(A.ratio(s.liabilities,s.assets),2)+'%</strong><small>负债总额 / 资产总额 · '+esc(s.assets.period)+'</small><div>'+src(s.liabilities)+src(s.assets)+'</div></article>':'')+(s.deducted_profit?card('扣非归母净利润',s.deducted_profit,rows):'');
  const cashMetrics=s.source==='choice'?[p.cashMetric,'assets','liabilities']:['cash','debt','adjusted_ebitda'];
  $('db-liquidity').innerHTML=table(['指标','数值','定义与期间'],cashMetrics.map(m=>{const o=s[m];return '<tr><td>'+esc(metric(m))+'</td><td>'+cell(o,false)+'</td><td>'+esc(o?o.period+' · '+A.description(o):'暂无所选期间数据')+'</td></tr>';}).join(''));
  const trend=$('db-financial-trend').value;const selectedTrend=trend==='profit'?profit:trend==='operating_cf'?cf:r;$('db-financial-trends').innerHTML=trendBlock(selectedTrend,rows,trend==='profit'?metric(s.profitMetric):metric(trend));
  const annualPeriods=[...new Set(A.pick(rows,{...(source==='choice'?p.choiceFinancial:p.financial),frequency:'年度'},'revenue').map(o=>o.period)),...A.pick(rows,{...p.choiceFinancial,frequency:'年度'},'revenue').map(o=>o.period)].filter((x,i,arr)=>arr.indexOf(x)===i).sort().slice(-5);
  $('db-annual').innerHTML=table(['年度','收入 / 百万原币','收入同比','利润 / 百万原币','利润口径','经营现金流 / 百万原币'],annualPeriods.map(per=>{const a=A.financial(rows,p,per,source);return '<tr><td>'+esc(per)+'</td><td>'+cell(a.revenue,false)+'</td><td>'+change(a.revenue,rows)+'</td><td>'+cell(a[a.profitMetric],false)+'</td><td>'+esc(metric(a.profitMetric))+'<small>'+esc(a.source==='choice'?'Choice / '+(a.revenue?.currency||''):'底稿 / '+(a.revenue?.currency||''))+'</small></td><td>'+cell(a.operating_cf,false)+'</td></tr>';}).join('')||'<tr><td colspan="6">暂无年度财务数据</td></tr>');
 }
 function paintOverview(){if(!context||!profiles)return;const {company:c,rows}=context,p=profiles[c.id];
  $('db-profile').innerHTML='<h2>'+esc(c.name)+'</h2><span>'+esc(c.market+' · '+c.code)+'</span>';
  $('db-intro').textContent=p.intro;
  $('db-business-logic').innerHTML=p.businessLogic.map((t,i)=>'<article class="db-logic"><h4>'+esc(p.businessLines[i]||'业务')+'</h4><p>'+esc(t)+'</p></article>').join('');
  paintStructure(p,rows);operatingOptions();$('db-financial-source').value='research';financeOptions();
  $('db-watch').innerHTML=p.watch.map(t=>'<li>'+esc(t)+'</li>').join('');
 }
 async function paintCompare(){if(!context||!profiles)return;const token=++compareRequest,mode=$('db-compare-kind').value; $('db-compare-quarter-label').hidden=mode!=='operating';$('db-compare-year-label').hidden=mode==='operating';$('db-compare-source-label').hidden=mode==='operating';$('db-compare-status').textContent='正在读取同业数据…';try{
  const datasets=await Promise.all(context.catalog.companies.map(async c=>({company:c,rows:(await context.loadCompany(c)).observations,p:profiles[c.id]})));if(token!==compareRequest)return;
  let body,scopes=[];
  if(mode==='operating'){const period=$('db-compare-period').value;
   body=datasets.map(({company:c,rows,p})=>{const s=A.snapshot(rows,p,period);scopes.push('<li><strong>'+esc(c.name)+'</strong>：规模 '+esc(A.description(s.hotels))+'；经营 '+esc(A.description(s.revpar))+'。</li>');return '<tr><td><button class="db-evidence" data-select-company="'+esc(c.id)+'">'+esc(c.name)+'</button><small>'+esc(c.code)+'</small></td><td>'+cell(s.hotels,false)+'</td><td>'+cell(s.rooms,false)+'</td><td>'+cell(s.revpar,false)+'</td><td>'+cell(s.adr,false)+'</td><td>'+cell(s.occ,false)+'</td></tr>';}).join('');
   $('db-comparison').innerHTML=table(['公司','已开业酒店 / 家','客房 / 间','RevPAR','ADR','入住率'],body);$('db-compare-status').textContent=period+' · 同一季度；规模与量价范围按各公司披露。';
  }else{const per=$('db-compare-year').value;
   body=datasets.map(({company:c,rows,p})=>{const s=A.financial(rows,p,per,$('db-compare-source').value),n=s[s.profitMetric];scopes.push('<li><strong>'+esc(c.name)+'</strong>：'+esc(s.source==='choice'?'Choice，接口展示精度':'研究底稿 / 原报告')+'；'+esc(s.revenue?.currency||'暂无币种')+'；'+esc(s.revenue?.periodBasis||'暂无数据')+'；'+esc(metric(s.profitMetric))+'</li>');return '<tr><td><button class="db-evidence" data-select-company="'+esc(c.id)+'">'+esc(c.name)+'</button><small>'+esc(s.revenue?.currency||'暂无数据')+'</small></td><td>'+cell(s.revenue,false)+'</td><td>'+change(s.revenue,rows)+'</td><td>'+cell(n,false)+'<small>'+esc(metric(s.profitMetric))+'</small></td><td>'+change(n,rows)+'</td><td>'+cell(s.operating_cf,false)+'</td></tr>';}).join('');
   $('db-comparison').innerHTML=table(['公司 / 币种','收入 / 百万原币','收入同比','利润 / 百万原币','利润同比','经营现金流 / 百万原币'],body);$('db-compare-status').textContent=per+' · 同一报告期；缺失值不回填。币种不同，不比较绝对金额；净利润与归母定义单列。';
  }
  $('db-compare-scopes').innerHTML='<details><summary>展开统计范围与财务定义</summary><ul>'+scopes.join('')+'</ul></details>';
 }catch(e){$('db-compare-status').textContent='同业数据读取失败，请重试';}}
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
 $('db-compare-panel').ontoggle=()=>{if($('db-compare-panel').open)paintCompare();};
 document.addEventListener('click',e=>{const hb=e.target.closest('[data-history]');if(hb&&context){context.toHistory(hb.dataset.history);show('history');}if(e.target.closest('[data-open-evidence]'))show('evidence');const selected=e.target.closest('[data-select-company]');if(selected&&context){context.select(selected.dataset.selectCompany);show('overview');}});
 for(const id of ['db-compare-period','db-compare-kind','db-compare-year','db-compare-source'])$(id).onchange=paintCompare;
 $('db-operating-lens').onchange=operatingPeriods;$('db-operating-period').onchange=paintOperating;$('db-financial-source').onchange=financeOptions;$('db-financial-period').onchange=paintFinancial;$('db-operating-trend').onchange=paintOperating;$('db-financial-trend').onchange=paintFinancial;
 document.addEventListener('companydb:selected',async e=>{context=e.detail;await profilePromise;paintOverview();if($('db-compare-panel').open)paintCompare();});
 const params=new URLSearchParams(location.search),oldView=params.get('db-view'),oldChapter=params.get('db-chapter');show(oldView==='evidence'?'evidence':oldView==='compare'?'compare':oldView==='history'?'history':oldView==='financial'||oldChapter==='financial'?'financial':'overview');
})();




