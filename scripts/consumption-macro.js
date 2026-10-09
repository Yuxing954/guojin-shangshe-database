(async function(){
  'use strict';
  const M=ConsumptionMacro,$=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>M.finite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
  const pct=v=>M.finite(v)?(v>0?'+':'')+num(v)+'%':'—';
  const tone=v=>M.finite(v)?v>0?'cm-up':v<0?'cm-down':'':'';
  const options=(id,values,chosen)=>{$(id).innerHTML=values.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('');if(values.some(([v])=>v===chosen))$(id).value=chosen;};
  let data,byId,sources,items=[],page=0,selected='',history=[];
  const sourceLink=s=>s&&M.official(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${esc(s.publisher)} ↗</a>`:'—';
  const value=(i,r)=>!r?'—':num(r.value)+(M.finite(r.value)?' '+esc(i.unit):'');
  const label=r=>r.basis==='jan_feb'?r.period.slice(0,4)+'年1—2月':r.period;
  function download(name,rows){if(!rows.length)return;const url=URL.createObjectURL(new Blob([M.csv(data,rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const filters=()=>({group:$('group').value,frequency:$('frequency').value,status:$('connection').value,query:$('query').value});
  const latestRow=i=>M.latest(data,i.id,$('frequency').value);
  function saveUrl(){const params=new URLSearchParams();for(const [key,id] of [['group','group'],['frequency','frequency'],['status','connection'],['q','query']])if($(id).value)params.set(key,$(id).value);if(selected)params.set('indicator',selected);window.history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():''));}
  function renderDirectory(){
    const count=items.length;page=Math.min(page,Math.max(0,Math.ceil(count/12)-1));
    $('directory').innerHTML=items.slice(page*12,page*12+12).map(i=>{const r=latestRow(i),s=r?sources.get(r.sourceId):null;return `<tr><td><button class="cm-select" data-id="${esc(i.id)}" aria-pressed="${selected===i.id}">${esc(i.name)}</button><small>${esc(i.group)}</small></td><td>${value(i,r)}<small>${esc(i.valueLabel)}</small></td><td class="${tone(r?.yoy)}">${pct(r?.yoy)}</td><td>${r?esc(label(r))+'<small>'+esc(M.frequencies[r.frequency]+' · '+M.bases[r.basis])+'</small>':'—'}</td><td>${s?'<time>'+esc(s.publishedAt)+'</time><small>'+sourceLink(s)+'</small>':i.sourceUrl?'<a href="'+esc(i.sourceUrl)+'" target="_blank" rel="noopener noreferrer">官方入口 ↗</a>':'—'}</td><td><span class="cm-tag ${i.status==='pending'?'pending':''}">${i.status==='pending'?'待接入':'已接入'}</span>${r?.quality==='estimate'?'<small class="cm-tag estimate">预计</small>':''}</td></tr>`;}).join('')||'<tr><td colspan="6">没有符合筛选条件的指标</td></tr>';
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
    const canYoy=rows.some(r=>M.finite(r.yoy));$('measure').querySelector('[value="yoy"]').disabled=!canYoy;if(!canYoy)$('measure').value='value';$('measure').querySelector('[value="value"]').textContent=i?i.valueLabel:'原始值';renderTrend();
  }
  function drawChart(i,rows,field){
    const el=$('chart'),valid=rows.filter(r=>M.finite(r[field]));
    if(!valid.length){el.innerHTML='<div class="cm-empty">所选区间没有已收录数据</div>';return;}
    const holiday=rows[0].frequency==='holiday',unit=field==='yoy'?'%':i.unit,w=Math.max(300,el.clientWidth||900),h=270,L=58,R=22,T=28,B=45;
    const raw=valid.map(r=>r[field]);let lo=Math.min(...raw),hi=Math.max(...raw);const pad=(hi-lo||Math.abs(hi)*.1||1)*.15;lo-=pad;hi+=pad;if(holiday){lo=Math.min(0,lo);hi=Math.max(0,hi);}
    const times=rows.map(r=>Date.parse(r.endDate+'T00:00:00Z')),xmin=Math.min(...times),xmax=Math.max(...times);
    const xx=r=>holiday?L+(rows.indexOf(r)+.5)/rows.length*(w-L-R):L+(Date.parse(r.endDate+'T00:00:00Z')-xmin)/(xmax-xmin||1)*(w-L-R);
    const yy=v=>T+(hi-v)/(hi-lo)*(h-T-B);
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(i.name+' '+(field==='yoy'?'官方同比':i.valueLabel)+'历史趋势')}" preserveAspectRatio="xMidYMid meet"><title>${esc(i.name)} · ${esc(unit)}</title><text x="${L}" y="15" fill="#818897" font-size="12">${esc(unit)}</text>`;
    for(let k=0;k<5;k++){const v=lo+(hi-lo)*k/4,y=yy(v);svg+=`<line x1="${L}" x2="${w-R}" y1="${y}" y2="${y}" stroke="#e9ebf1"/><text x="${L-10}" y="${y+4}" fill="#818897" text-anchor="end" font-size="12">${esc(num(v))}</text>`;}
    if(lo<0&&hi>0)svg+=`<line x1="${L}" x2="${w-R}" y1="${yy(0)}" y2="${yy(0)}" stroke="#b7bbc7" stroke-dasharray="4 4"/>`;
    if(!holiday)for(const seg of M.segments(rows,field))svg+=`<path d="${seg.map((r,k)=>(k?'L':'M')+xx(r)+','+yy(r[field])).join(' ')}" fill="none" stroke="#5158aa" stroke-width="2.4"/>`;
    rows.forEach((r,k)=>{if(!M.finite(r[field]))return;const title=label(r)+' · '+M.bases[r.basis]+' · '+num(r[field])+unit;
      if(holiday){const width=Math.min(75,(w-L-R)/rows.length*.45);svg+=`<rect x="${xx(r)-width/2}" y="${Math.min(yy(0),yy(r[field]))}" width="${width}" height="${Math.max(1,Math.abs(yy(0)-yy(r[field])))}" fill="#5158aa" opacity=".85"><title>${esc(title)}</title></rect>`;}
      svg+=`<circle data-row="${k}" tabindex="0" cx="${xx(r)}" cy="${yy(r[field])}" r="4" fill="white" stroke="#5158aa" stroke-width="2" aria-label="${esc(title)}"><title>${esc(title)}</title></circle>`;
    });
    const step=Math.max(1,Math.ceil(rows.length/Math.max(2,Math.floor(w/110))));rows.forEach((r,k)=>{if(holiday||k===0||k===rows.length-1||(k%step===0&&rows.length-k>step/2))svg+=`<text x="${xx(r)}" y="${h-14}" fill="#818897" text-anchor="${holiday?'middle':k===0?'start':k===rows.length-1?'end':'middle'}" font-size="11">${esc(label(r))}</text>`;});
    el.innerHTML=svg+'</svg><div class="cm-chart-tooltip" aria-live="polite"></div>';
    const tip=el.querySelector('.cm-chart-tooltip');el.querySelectorAll('circle').forEach(p=>{const r=rows[Number(p.dataset.row)],show=()=>tip.textContent=label(r)+' · '+M.bases[r.basis]+' · '+num(r[field])+unit+' · 发布 '+sources.get(r.sourceId).publishedAt;p.addEventListener('mouseenter',show);p.addEventListener('focus',show);});
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
    $('history').innerHTML=history.slice().reverse().map(r=>{const s=sources.get(r.sourceId),notes=[r.note,M.finite(r.mom)?'环比 '+pct(r.mom):'',M.finite(r.realYoy)?'实际同比 '+pct(r.realYoy):'',r.quality==='estimate'?'预计':''].filter(Boolean);return `<tr><td>${esc(label(r))}</td><td>${esc(M.bases[r.basis])}</td><td>${num(r.value)}</td><td class="${tone(r.yoy)}">${pct(r.yoy)}</td><td>${esc(notes.join('；')||'—')}</td><td><time>${esc(s.publishedAt)}</time></td><td>${sourceLink(s)}<small>${esc(s.title)}</small></td></tr>`;}).join('')||'<tr><td colspan="7">没有已收录数据</td></tr>';
    $('chart-caption').textContent=history.length?`${history[0].period} — ${history.at(-1).period} · ${history.length} 条已收录 · ${M.bases[$('basis').value]||''}${$('basis').value==='month'?'；1—2月合并':''}${history[0].frequency==='holiday'?'；不同假期分别展示':'；缺期断线'}`:'';
  }
  try{
    const response=await fetch('data/consumption-macro/observations.json',{cache:'no-cache'});if(!response.ok)throw new Error('数据读取失败（'+response.status+'）');data=await response.json();const errors=M.validate(data);if(errors.length)throw new Error('数据校验失败：'+errors.slice(0,3).join('；'));
    byId=new Map(data.indicators.map(i=>[i.id,i]));sources=new Map(data.sources.map(s=>[s.id,s]));
    $('asof').textContent='来源核验 '+data.checkedAt;
    $('coverage').textContent=`已接入 ${data.indicators.filter(i=>i.status==='connected').length} · 待接入 ${data.indicators.filter(i=>i.status==='pending').length}`;
    $('kpis').innerHTML=['retail','catering','online_goods','cpi','income_national','spending_national'].map(id=>{const i=byId.get(id),r=M.latest(data,id),s=sources.get(r.sourceId);return `<button class="cm-kpi" data-id="${id}"><span>${esc(i.name)}</span><strong>${num(r.value)}<small>${esc(i.unit)}</small></strong><em class="${id==='retail'?'':tone(r.yoy)}">${M.finite(r.yoy)?'同比 '+pct(r.yoy):esc(i.valueLabel)}</em><span class="cm-meta">${esc(label(r)+' · '+M.bases[r.basis])}</span><time>发布 ${esc(s.publishedAt)}</time></button>`;}).join('');
    options('group',[['','全部类别'],...[...new Set(data.indicators.map(i=>i.group))].map(g=>[g,g])]);
    const params=new URLSearchParams(location.search);for(const [key,id] of [['group','group'],['frequency','frequency'],['status','connection']])if([...$(id).options].some(o=>o.value===params.get(key)))$(id).value=params.get(key);$('query').value=params.get('q')||'';selected=byId.has(params.get('indicator'))?params.get('indicator'):'retail';
    $('coverage-notes').innerHTML='<p>官方来源 '+data.sources.length+' 份 · 记录 '+data.observations.length+' 条 · 核验 '+esc(data.checkedAt)+'</p><p>社零及CPI：2025—2026已披露期间；社零全年：2023—2025；居民收支：2024—2026。服务零售仅收录2026年1—8月。</p><p>历史抓取缺口：2025年2月、6月CPI；2025年4月社零。消费者信心、商务部重点监测及2026国庆旅游数据待接入。</p>';
    $('content').hidden=false;$('status').hidden=true;
    for(const id of ['group','frequency','connection'])$(id).addEventListener('change',applyFilters);$('query').addEventListener('input',applyFilters);
    $('reset').addEventListener('click',()=>{for(const id of ['group','frequency','connection','query'])$(id).value='';applyFilters();});
    $('prev').addEventListener('click',()=>{page--;renderDirectory();});$('next').addEventListener('click',()=>{page++;renderDirectory();});
    $('indicator').addEventListener('change',()=>choose($('indicator').value));$('series-frequency').addEventListener('change',configureBasis);
    for(const id of ['basis','measure','from','to'])$(id).addEventListener('change',renderTrend);
    $('clear-range').addEventListener('click',()=>{$('from').value='';$('to').value='';renderTrend();});
    $('export-series').addEventListener('click',()=>download('消费宏观-'+selected+'-'+$('basis').value+'.csv',history));
    $('export-latest').addEventListener('click',()=>download('消费宏观-筛选结果.csv',items.map(latestRow).filter(Boolean)));
    $('kpis').querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>{for(const id of ['group','frequency','connection','query'])$(id).value='';selected=b.dataset.id;applyFilters();$('trend-panel').scrollIntoView({behavior:'smooth'});}));
    $('measure').value='yoy';applyFilters();
  }catch(error){$('status').hidden=false;$('status').textContent=error.message||'加载失败，请刷新重试';$('status').setAttribute('role','alert');$('content').hidden=true;}
})();
