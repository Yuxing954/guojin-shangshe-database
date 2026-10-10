(async function(){
  'use strict';
  const M=ConsumptionMacro,$=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>M.finite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
  const pct=v=>M.finite(v)?(v>0?'+':'')+num(v)+'%':'—';
  const tone=v=>M.finite(v)?v>0?'cm-up':v<0?'cm-down':'':'';
  const options=(id,values,chosen)=>{$(id).innerHTML=values.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('');if(values.some(([v])=>v===chosen))$(id).value=chosen;};
  let data,byId,sources,items=[],page=0,selected='',history=[],retailGroup='categories';
  const measures={combo:'数值＋同比',value:'原始值',yoy:'官方同比',mom:'官方环比',realYoy:'实际同比'};
  const published=(r,s)=>s?.publishedAt||r?.releaseDate||'来源未提供';
  async function loadJson(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw new Error('数据读取失败（'+response.status+'）');return await response.json();}finally{clearTimeout(timer);}}
  const sourceLink=s=>s&&(M.official(s.url)||M.licensedSource(s))?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${esc(s.publisher)} ↗</a>`:'—';
  const value=(i,r)=>!r?'—':num(r.value)+(M.finite(r.value)?' '+esc(i.unit):'');
  const label=r=>r.basis==='jan_feb'?r.period.slice(0,4)+'年1—2月':r.period;
  function download(name,rows){if(!rows.length)return;const url=URL.createObjectURL(new Blob([M.csv(data,rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const filters=()=>({group:$('group').value,frequency:$('frequency').value,status:$('connection').value,query:$('query').value});
  const latestRow=i=>M.latest(data,i.id,$('frequency').value);
  function saveUrl(){const params=new URLSearchParams();for(const [key,id] of [['group','group'],['frequency','frequency'],['status','connection'],['q','query']])if($(id).value)params.set(key,$(id).value);if(selected)params.set('indicator',selected);window.history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():''));}
  function renderDirectory(){
    const count=items.length;page=Math.min(page,Math.max(0,Math.ceil(count/12)-1));
    $('directory').innerHTML=items.slice(page*12,page*12+12).map(i=>{const r=latestRow(i),s=r?sources.get(r.sourceId):null;return `<tr><td><button class="cm-select" data-id="${esc(i.id)}" aria-pressed="${selected===i.id}">${esc(i.name)}</button><small>${esc(i.group)}</small></td><td>${value(i,r)}<small>${esc(i.valueLabel)}</small></td><td class="${tone(r?.yoy)}">${pct(r?.yoy)}</td><td>${r?esc(label(r))+'<small>'+esc(M.frequencies[r.frequency]+' · '+M.bases[r.basis])+'</small>':'—'}</td><td>${s?'<time>'+esc(published(r,s))+'</time><small>'+sourceLink(s)+'</small>':i.sourceUrl?'<a href="'+esc(i.sourceUrl)+'" target="_blank" rel="noopener noreferrer">官方入口 ↗</a>':'—'}</td><td><span class="cm-tag ${i.status==='pending'?'pending':''}">${i.status==='pending'?'待接入':i.updateStatus==='error'?'更新失败':'已接入'}</span>${r?.quality==='estimate'?'<small class="cm-tag estimate">预计</small>':''}</td></tr>`;}).join('')||'<tr><td colspan="6">没有符合筛选条件的指标</td></tr>';
    $('page-label').textContent=count?`${page*12+1}—${Math.min(page*12+12,count)} / ${count} 项指标`:'0 项指标';$('prev').disabled=page===0;$('next').disabled=(page+1)*12>=count;$('export-latest').disabled=!items.some(i=>latestRow(i));
    $('directory').querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.id,true)));
  }
  function choose(id,scroll=false){selected=id;$('indicator').value=id;configureFrequency();renderDirectory();saveUrl();if(scroll)$('trend-panel').scrollIntoView({behavior:'smooth',block:'start'});}
  function applyFilters(){page=0;items=M.directory(data,filters());options('indicator',items.map(i=>[i.id,i.name]),selected);if(!items.some(i=>i.id===selected))selected=items[0]?.id||'';if(selected)$('indicator').value=selected;configureFrequency();renderDirectory();saveUrl();}
  function configureFrequency(){
    const available=[...new Set(M.records(data,selected).map(r=>r.frequency))];const global=$('frequency').value;
    const scope=M.defaultScope(data,selected,global);options('series-frequency',available.map(f=>[f,M.frequencies[f]]),scope?.frequency);$('series-frequency').disabled=!available.length;configureBasis();
  }
  function configureBasis(){
    const frequency=$('series-frequency').value,available=[...new Set(M.records(data,selected,{frequency}).map(r=>r.basis==='jan_feb'?'month':r.basis))];
    options('basis',available.map(b=>[b,b==='month'?'当月 / 1—2月合并':M.bases[b]]),M.defaultScope(data,selected,frequency)?.basis);$('basis').disabled=!available.length;
    const i=byId.get(selected),rows=M.records(data,selected,{frequency,basis:$('basis').value});
    for(const option of $('measure').options)option.disabled=option.value==='combo'?!rows.some(r=>M.finite(r.value)&&M.finite(r.yoy)):!rows.some(r=>M.finite(r[option.value]));
    if($('measure').selectedOptions[0]?.disabled)$('measure').value=[...$('measure').options].find(o=>!o.disabled)?.value||'value';
    $('measure').querySelector('[value="value"]').textContent=i?i.valueLabel:'原始值';renderTrend();
  }
  function drawChart(i,rows,field){
    const el=$('chart');if(field==='combo'||field==='value'&&!['%','点'].includes(i.unit)){const breaks=new Set(M.segments(rows,'yoy').map(segment=>segment[0]));SiteCharts.drawPaired(el,rows.map(r=>({period:label(r),breakBefore:breaks.has(r),x:Date.parse(r.endDate+'T00:00:00Z'),value:r.value,change:r.yoy})),{name:i.name,unit:i.unit,mode:field==='combo'?'combo':'value',gap:{monthly:65,quarterly:120,annual:400}[rows[0]?.frequency]*86400000});return;}
    const chartPoints=[],valid=rows.filter(r=>M.finite(r[field]));
    if(!valid.length){el.innerHTML='<div class="cm-empty">所选区间没有已收录数据</div>';return;}
    const holiday=rows[0].frequency==='holiday',unit=field==='value'?i.unit:'%',w=Math.max(300,el.clientWidth||900),h=310,L=78,R=22,T=28,B=45;
    const raw=valid.map(r=>r[field]);let lo=Math.min(...raw),hi=Math.max(...raw);const pad=(hi-lo||Math.abs(hi)*.1||1)*.15;lo-=pad;hi+=pad;if(holiday){lo=Math.min(0,lo);hi=Math.max(0,hi);}
    const times=rows.map(r=>Date.parse(r.endDate+'T00:00:00Z')),xmin=Math.min(...times),xmax=Math.max(...times);
    const xx=r=>holiday?L+(rows.indexOf(r)+.5)/rows.length*(w-L-R):L+(Date.parse(r.endDate+'T00:00:00Z')-xmin)/(xmax-xmin||1)*(w-L-R);
    const yy=v=>T+(hi-v)/(hi-lo)*(h-T-B);
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(i.name+' '+(field==='value'?i.valueLabel:measures[field])+'历史趋势')}" preserveAspectRatio="xMidYMid meet"><title>${esc(i.name)} · ${esc(unit)}</title><text x="${L}" y="15" fill="#818897" font-size="12">${esc(unit)}</text>`;
    for(let k=0;k<5;k++){const v=lo+(hi-lo)*k/4,y=yy(v);svg+=`<line x1="${L}" x2="${w-R}" y1="${y}" y2="${y}" stroke="#e9ebf1"/><text x="${L-10}" y="${y+4}" fill="#818897" text-anchor="end" font-size="12">${esc(num(v))}</text>`;}
    if(lo<0&&hi>0)svg+=`<line x1="${L}" x2="${w-R}" y1="${yy(0)}" y2="${yy(0)}" stroke="#b7bbc7" stroke-dasharray="4 4"/>`;
    if(!holiday)for(const seg of M.segments(rows,field))svg+=`<path d="${seg.map((r,k)=>(k?'L':'M')+xx(r)+','+yy(r[field])).join(' ')}" fill="none" stroke="#5158aa" stroke-width="2.4"/>`;
    rows.forEach((r,k)=>{if(!M.finite(r[field]))return;const title=label(r)+' · '+M.bases[r.basis]+' · '+num(r[field])+unit;
      if(holiday){const width=Math.min(75,(w-L-R)/rows.length*.45);svg+=`<rect x="${xx(r)-width/2}" y="${Math.min(yy(0),yy(r[field]))}" width="${width}" height="${Math.max(1,Math.abs(yy(0)-yy(r[field])))}" fill="#5158aa" opacity=".85"><title>${esc(title)}</title></rect>`;}
      svg+=`<circle data-row="${k}" data-chart-point="${chartPoints.length}" tabindex="0" cx="${xx(r)}" cy="${yy(r[field])}" r="4" fill="white" stroke="#5158aa" stroke-width="2" aria-label="${esc(title)}"><title>${esc(title)}</title></circle>`;
      chartPoints.push({x:xx(r),y:yy(r[field]),text:title});
    });
    const step=Math.max(1,Math.ceil(rows.length/Math.max(2,Math.floor(w/110))));rows.forEach((r,k)=>{if(holiday||k===0||k===rows.length-1||(k%step===0&&rows.length-k>step/2))svg+=`<text x="${xx(r)}" y="${h-14}" fill="#818897" text-anchor="${holiday?'middle':k===0?'start':k===rows.length-1?'end':'middle'}" font-size="11">${esc(label(r))}</text>`;});
    el.innerHTML=svg+'</svg><div class="cm-chart-tooltip" aria-live="polite"></div>';
    ResearchChart.attach(el,chartPoints);
  }
  function renderRetail(reset=false){
    const basis=$('retail-basis').value,scope=M.records(data,'retail',{frequency:basis==='year'?'annual':'monthly',basis});
    if(reset)options('retail-period',scope.slice().reverse().map(r=>[r.period,label(r)]),scope.at(-1)?.period);
    const result=M.retailBreakdown(data,{basis,period:$('retail-period').value,group:retailGroup});
    $('retail-context').textContent=result.reference?label(result.reference)+' · '+M.bases[result.reference.basis]:'暂无数据';
    $('retail-note').textContent=retailGroup==='categories'?'限额以上单位分品类：展示金额与官方同比，不能相加替代社零总额。':retailGroup==='channels'?'各项单独比较；线上与线下存在交叉，不能直接相加。当月未披露的线上数据，请切换年初累计。':'总额、商品、餐饮与限额以上分别展示，不重复加总。';
    const maximum=Math.max(1,...result.items.map(x=>Math.abs(x.row?.yoy||0)));
    $('retail-bars').innerHTML=result.items.map(({indicator:i,row:r})=>{const source=sources.get(r?.sourceId),tooltip=r?label(r)+'\n'+value(i,r)+'  |  同比 '+pct(r.yoy):'暂无数据';
      return `<button class="retail-row" data-id="${esc(i.id)}" aria-label="${esc(i.name+' · '+tooltip)}" data-chart-tooltip="${esc(tooltip)}"><span class="retail-row-title">${esc(i.name)}</span><span class="retail-row-amount">${r?value(i,r):'暂无数据'}</span><span class="retail-row-rate ${tone(r?.yoy)}">${pct(r?.yoy)}</span><span class="retail-track"><span style="width:${r&&M.finite(r.yoy)?Math.abs(r.yoy)/maximum*100:0}%" class="${tone(r?.yoy)}"></span></span></button>`;
    }).join('');
    document.querySelectorAll('[data-retail]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.retail===retailGroup)));
    $('retail-bars').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{for(const id of ['group','frequency','connection','query'])$(id).value='';selected=b.dataset.id;applyFilters();$('series-frequency').value=basis==='year'?'annual':'monthly';configureBasis();if([...$('basis').options].some(o=>o.value===basis))$('basis').value=basis;renderTrend();$('trend-panel').scrollIntoView({behavior:'smooth',block:'start'});});
  }
  function renderTrend(){
    const i=byId.get(selected),from=$('from').value,to=$('to').value,invalid=Boolean(from&&to&&from>to);
    $('range-error').hidden=!invalid;$('range-error').textContent='开始日期须不晚于结束日期';
    history=i&&!invalid?M.records(data,i.id,{frequency:$('series-frequency').value,basis:$('basis').value,from,to}):[];
    $('export-series').disabled=!history.length;$('from').max=to||'';$('to').min=from||'';
    $('trend-title').textContent=i?i.name+' · 历史趋势':'历史趋势';$('series-definition').textContent=i?(i.status==='pending'?i.pendingReason+'；'+i.definition:i.definition):'';
    if(!i||i.status==='pending'){ $('chart').innerHTML='<div class="cm-empty">'+(i?'待接入 · 无可核验序列':'请选择指标')+'</div>';}
    else drawChart(i,history,$('measure').value);
    $('value-heading').textContent=i?i.valueLabel+' / '+i.unit:'数值';
    $('history').innerHTML=history.slice().reverse().map(r=>{const s=sources.get(r.sourceId),notes=[r.note,M.finite(r.mom)?'环比 '+pct(r.mom):'',M.finite(r.realYoy)?'实际同比 '+pct(r.realYoy):'',r.quality==='estimate'?'预计':''].filter(Boolean);return `<tr><td>${esc(label(r))}</td><td>${esc(M.bases[r.basis])}</td><td>${num(r.value)}</td><td class="${tone(r.yoy)}">${pct(r.yoy)}</td><td>${esc(notes.join('；')||'—')}</td><td><time>${esc(published(r,s))}</time></td><td>${sourceLink(s)}${r.supplementSourceId?' · '+sourceLink(sources.get(r.supplementSourceId)):''}<small>${esc(s.title)}</small></td></tr>`;}).join('')||'<tr><td colspan="7">没有已收录数据</td></tr>';
    const missing=history.filter(r=>!M.finite(r[$('measure').value==='combo'?'value':$('measure').value])).length;
    $('chart-caption').textContent=history.length?`${history[0].period} — ${history.at(-1).period} · ${history.length} 条已收录 · ${M.bases[$('basis').value]||''}${missing?'；所选字段缺失 '+missing+' 条':''}${$('basis').value==='month'?'；1—2月合并':''}${history[0].frequency==='holiday'?'；不同假期分别展示':'；缺期断线'}`:'';
  }
  try{
    $('retry-load').onclick=()=>location.reload();
    data=await loadJson('data/consumption-macro/observations.json');const errors=M.validate(data);if(errors.length)throw new Error('数据校验失败：'+errors.slice(0,3).join('；'));
    try{data=M.mergeAutomatic(data,await loadJson('data/macro/automatic-series.json'));}catch{$('automatic-warning').hidden=false;}
    byId=new Map(data.indicators.map(i=>[i.id,i]));sources=new Map(data.sources.map(s=>[s.id,s]));
    $('asof').textContent='最近检查 '+(data.automaticCheckedAt||data.checkedAt).slice(0,10);
    $('coverage').textContent=data.indicators.length+' 项消费指标';
    $('kpis').innerHTML=['retail','catering','online_goods','cpi','income_national','spending_national'].map(id=>{const i=byId.get(id),r=M.latest(data,id),s=sources.get(r.sourceId);return `<button class="cm-kpi" data-id="${id}"><span>${esc(i.name)}</span><strong>${num(r.value)}<small>${esc(i.unit)}</small></strong><em class="${id==='retail'?'':tone(r.yoy)}">${M.finite(r.yoy)?'同比 '+pct(r.yoy):esc(i.valueLabel)}</em><span class="cm-meta">${esc(label(r)+' · '+M.bases[r.basis])}</span><time>发布 ${esc(published(r,s))}</time></button>`;}).join('');
    options('group',[['','全部类别'],...[...new Set(data.indicators.map(i=>i.group))].map(g=>[g,g])]);
    const params=new URLSearchParams(location.search);for(const [key,id] of [['group','group'],['frequency','frequency'],['status','connection']])if([...$(id).options].some(o=>o.value===params.get(key)))$(id).value=params.get(key);$('query').value=params.get('q')||'';selected=byId.has(params.get('indicator'))?params.get('indicator'):'retail';
    $('coverage-notes').innerHTML=data.indicators.map(i=>{const c=M.scopeCoverage(data,i.id);return '<p>'+esc(i.name+'：'+(c?c.start+' — '+c.end+' · '+c.count+'期'+(c.missingPeriods.length?' · 区间缺期 '+c.missingPeriods.join('、'):'')+(c.structuralPeriods.length?' · 全年原披露另列 '+c.structuralPeriods.join('、'):'')+(c.valueMissing?' · 数值缺失 '+c.valueMissing+'条':'')+(c.yoyMissing&&!['%','点'].includes(i.unit)?' · 官方同比缺失 '+c.yoyMissing+'条':'')+(i.updateStatus==='error'?' · 更新失败，保留历史':''):(i.pendingReason||'暂无数据')))+(i.automaticSeries||[]).map(s=>'<small>'+esc((s.measure==='yoy'?'同比':'数值')+'补充：'+(s.coverage?.historyShort?'历史覆盖不足；':'')+(s.status==='error'?'更新失败；':'')+'检查 '+(s.checkedAt||'未提供').slice(0,10))+'</small>').join('')+'</p>';}).join('')+'<p>区间连续不代表已更新至最近应发布月份。1—2月不拆分；全年使用原披露或年末累计，不加总舍入月值；不由舍入金额重算同比或环比。Choice未返回发布日期时留空。</p>';
    $('content').hidden=false;$('status').hidden=true;
    for(const id of ['group','frequency','connection'])$(id).addEventListener('change',applyFilters);$('query').addEventListener('input',applyFilters);
    $('reset').addEventListener('click',()=>{for(const id of ['group','frequency','connection','query'])$(id).value='';applyFilters();});
    $('prev').addEventListener('click',()=>{page--;renderDirectory();});$('next').addEventListener('click',()=>{page++;renderDirectory();});
    $('indicator').addEventListener('change',()=>choose($('indicator').value));$('series-frequency').addEventListener('change',configureBasis);
    for(const id of ['basis','measure','from','to'])$(id).addEventListener('change',renderTrend);
    $('clear-range').addEventListener('click',()=>{$('from').value='';$('to').value='';renderTrend();});
    $('export-series').addEventListener('click',()=>download('消费专题-'+selected+'-'+$('basis').value+'.csv',history));
    $('export-latest').addEventListener('click',()=>download('消费专题-筛选结果.csv',items.map(latestRow).filter(Boolean)));
    $('kpis').querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>{for(const id of ['group','frequency','connection','query'])$(id).value='';selected=b.dataset.id;applyFilters();$('trend-panel').scrollIntoView({behavior:'smooth'});}));
    $('retail-basis').onchange=()=>renderRetail(true);$('retail-period').onchange=()=>renderRetail();document.querySelectorAll('[data-retail]').forEach(b=>b.onclick=()=>{retailGroup=b.dataset.retail;renderRetail();});renderRetail(true);
    $('measure').value='combo';applyFilters();
  }catch(error){$('status').hidden=false;$('status').textContent=error.message||'加载失败，请刷新重试';$('status').setAttribute('role','alert');$('content').hidden=true;}
})();
