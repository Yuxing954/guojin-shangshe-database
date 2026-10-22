(function(){
 'use strict';
 const M=RegionalRetail,T=RegionalRetailTiers,C=RegionalRetailCharts,D=SiteData,E=D.esc,F=M.finite,$=id=>document.getElementById(id);
 // Retain old shared links while offering only cumulative and monthly controls.
 const q=new URLSearchParams(location.search);let changed=false;
 for(const [b,p] of [['basis','period'],['tierBasis','tierPeriod'],['breakdownBasis','breakdownPeriod']])if(q.get(b)==='combined'){q.set(b,'month');q.set(p,(q.get(p)||'2026-02').slice(0,7)+'c');changed=true;}
 if(changed)history.replaceState(null,'',location.pathname+'?'+q+location.hash);
 let data,registry,rows=[];
 const num=(v,d=1)=>F(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—',pct=v=>F(v)?(v>0?'+':'')+num(v)+'%':'—';
 const opts=(values,value)=>values.map(v=>'<option value="'+E(v.id||v)+'"'+((v.id||v)===value?' selected':'')+'>'+E(v.name||M.periodLabel(v))+'</option>').join('');
 const links=r=>M.sourceIds(r).map(id=>{const s=data.sources.find(x=>x.id===id),url=s&&D.link(s.url);return url?'<a href="'+E(url)+'" target="_blank" rel="noopener">来源 ↗</a>':'';}).join(' ');
 function bars(host,list){C.control(host);const max=Math.max(1,...list.map(r=>Math.abs(r.value)));host.innerHTML=list.length?list.map(r=>'<div class="regional-bars"><span>'+E(r.label)+'</span><div class="track"><i style="background:'+(r.value<0?'#71a398':'#b98287')+';left:'+(r.value<0?50-Math.abs(r.value)/max*48:50)+'%;width:'+Math.abs(r.value)/max*48+'%"></i></div><b>'+pct(r.value)+'</b></div>').join(''):'<p class="regional-empty">所选期间暂无数据</p>';}
 function trend(){if(!data)return;const s=rows.find(r=>r.id===$('province-region').value);if(!s)return;const period=$('province-period').value,basis=$('province-basis').value,years=Number($('province-years').value),anchor=new Set(s.cities.filter(r=>F(r.yoy)).map(r=>r.id));
 const points=M.displayCalendar(data,[M.windowStart(period,years),data.historyStart||'0000-01'].sort().at(-1),period,basis).map(p=>{const valid=T.cityRows(data,registry,p,basis).filter(r=>anchor.has(r.id)&&F(r.yoy));return {period:p,periodLabel:M.periodLabel(p),value:anchor.size&&valid.length===anchor.size?T.stats(valid).average:null,n:valid.length};});
 C.draw($('province-trend'),[{label:s.name+'省级披露',points:M.seriesHistory(data,s.id,basis,'社零总额','全口径',years,period)},{label:'省内城市等权（固定'+anchor.size+'城）',points}]);
 $('province-legend').innerHTML='<span><i style="background:'+C.colors[0]+'"></i>省级披露同比</span><span><i style="background:'+C.colors[1]+'"></i>省内城市等权 · 固定'+anchor.size+'城</span>';SiteUI.save({provinceYears:years});}
 function render(){if(!data)return;const period=$('province-period').value,basis=$('province-basis').value;rows=T.provinces(data,registry,period,basis);const s=rows.find(r=>r.id===$('province-region').value);if(!s)return;
 $('province-title').textContent=s.name+' · '+M.periodLabel(period)+' · '+(basis==='ytd'?'年初累计':'当月');
 const k=(label,value,sub)=>'<article class="regional-kpi"><span>'+E(label)+'</span><strong>'+E(value)+'</strong><small>'+E(sub)+'</small></article>';
 $('province-kpis').innerHTML=k('省级社零总额',num(s.amount,2),'亿元 · 省级披露')+k('省级同比',pct(s.yoy),'全省口径')+k('省内城市等权同比',pct(s.sample.average),s.sample.n+' / '+s.cities.length+'个已收录城市有同比')+k('城市正增长占比',pct(s.sample.positiveShare),s.sample.positive+' / '+s.sample.n+'城');
 const valid=rows.filter(r=>F(r.yoy)),rank=valid.findIndex(r=>r.id===s.id);const cs=s.cities.filter(r=>F(r.yoy)).sort((a,b)=>b.yoy-a.yoy);
 $('province-insight').textContent=(rank>=0?'省级同比在已取得的'+valid.length+'个省级地区中列第'+(rank+1)+'。':'本期省级同比暂缺。')+(cs.length?'省内已取得城市样本：'+cs[0].name+pct(cs[0].yoy)+(cs.length>1?'至'+cs.at(-1).name+pct(cs.at(-1).yoy):'')+'，中位数'+pct(s.sample.median)+'。':'本期省内城市同比暂缺。');
 bars($('province-ranking'),valid.map(r=>({label:r.name,value:r.yoy})));bars($('province-tiers'),s.groups.filter(g=>F(g.average)).map(g=>({label:g.label+'（'+g.n+'城）',value:g.average})));
 $('province-table').innerHTML=rows.map(r=>'<tr><td><button data-province-id="'+r.id+'">'+E(r.name)+'</button></td><td>'+num(r.amount,2)+'</td><td>'+pct(r.yoy)+'</td><td>'+pct(r.sample.average)+'</td><td>'+r.sample.n+' / '+r.cities.length+'</td><td>'+links(r)+'</td></tr>').join('');
 $('province-cities').innerHTML=s.cities.length?s.cities.sort((a,b)=>Number(F(b.yoy))-Number(F(a.yoy))||(F(a.yoy)&&F(b.yoy)?b.yoy-a.yoy:0)).map(r=>'<tr><td>'+E(r.name)+'</td><td>'+E(registry.groups?.find(g=>g.id===r.group)?.label||'未分级')+'</td><td>'+num(r.amount,2)+(r.provenance?.amount?.derived?' <small>测算</small>':'')+'</td><td>'+pct(r.yoy)+(r.provenance?.yoy?.derived?' <small>推算</small>':'')+'</td><td>'+links(r)+'</td></tr>').join(''):'<tr><td colspan="5">暂无已收录城市</td></tr>';
 trend();SiteUI.save({province:s.id,provincePeriod:period,provinceBasis:basis});}
 function sync(preferred){const ps=M.periods(data,$('province-basis').value);$('province-period').innerHTML=opts(ps.slice().reverse(),ps.includes(preferred)?preferred:ps.at(-1));}
 function load(d,r){data=d;registry=r.groups?r:{groups:[],cities:[]};const p=new URLSearchParams(location.search);$('province-region').innerHTML=opts(M.regions(data,'province'),p.get('province')||'p18');$('province-basis').value=p.get('provinceBasis')==='month'?'month':'ytd';$('province-years').value=['1','3','5'].includes(p.get('provinceYears'))?p.get('provinceYears'):'5';sync(p.get('provincePeriod')||T.broadPeriod(data,registry));render();}
 $('province-region').onchange=render;$('province-period').onchange=render;$('province-basis').onchange=()=>{sync($('province-period').value);render();};$('province-years').onchange=trend;$('province-table').onclick=e=>{const b=e.target.closest('[data-province-id]');if(b){$('province-region').value=b.dataset.provinceId;render();}};
 $('province-csv').onclick=()=>D.downloadCsv(rows.map(r=>({省份:r.name,期间:M.periodLabel(r.period),口径:r.basis,省级社零亿元:r.amount,省级同比:r.yoy,省内城市等权同比:r.sample.average,城市中位数:r.sample.median,有效城市:r.sample.n,已收录城市:r.cities.length,正增长城市占比:r.sample.positiveShare,样本城市:r.cities.filter(c=>F(c.yoy)).map(c=>c.name).join('、'),省级来源:M.sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.url||'').join(' ')})),'分省社零-'+$('province-period').value+'.csv');
 window.RegionalProvinceDashboard={load,redraw:trend};
})();
