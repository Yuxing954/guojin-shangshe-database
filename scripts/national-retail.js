(function(){
'use strict';
const M=NationalRetail,R=RetailMonthly,C=ConsumptionMacro,$=id=>document.getElementById(id),finite=R.finite;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=1)=>finite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const signed=(v,d=2)=>finite(v)?(v!==0&&Math.abs(v)<.5*10**(-d)?(v>0?'+':'−')+'<'+num(10**(-d),d):(v>0?'+':'')+num(v,d)):'—';
const safe=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:'';}catch{return '';}};
let data,model,warning='',busy=false;
async function json(path){const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch(path,{cache:'no-store',signal:c.signal});if(!r.ok)throw Error(path+'：HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
function keep(){const p=new URLSearchParams();for(const k of ['month','basis','window','dimension','measure'])p.set(k,$('national-'+k).value);history.replaceState(null,'',location.pathname+'?'+p);}
function months(wanted){const p=M.periods(data,$('national-basis').value);$('national-month').replaceChildren(...p.map(value=>Object.assign(document.createElement('option'),{value,textContent:$('national-basis').value==='ytd'?value.slice(0,4)+'年1—'+Number(value.slice(5))+'月':R.monthLabel(value,R.row(data,'retail',value)?.basis==='jan_feb')})));$('national-month').value=p.includes(wanted)?wanted:p[0];}
function bars(rows,field,digits,unit){const max=Math.max(.01,...rows.map(r=>Math.abs(r[field])).filter(finite));return rows.map(r=>{const v=r[field],w=finite(v)?Math.abs(v)/max*48:0;return '<div class="national-bar-row" tabindex="0" title="'+esc(r.name+'：'+signed(v,digits)+unit+'；金额 '+num(r.row?.value,0)+'亿元；同比 '+signed(r.row?.yoy,1)+'%')+'"><span>'+esc(r.name)+'</span><div class="national-track"><i class="'+(v<0?'negative':'positive')+'" style="left:'+(v<0?50-w:50)+'%;width:'+w+'%"></i></div><b class="'+(v<0?'national-negative':'national-positive')+'">'+signed(v,digits)+unit+'</b></div>';}).join('');}
function trend(){
 const host=$('national-trend'),rows=model.trend,W=Math.max(280,Math.round(host.clientWidth)),H=248,L=38,T=20,B=H-35,right=W-14,values=rows.flatMap(r=>[r.total?.yoy,r.exAuto?.yoy]).filter(finite);
 if(!values.length){host.innerHTML='<p>暂无该区间同比数据</p>';return;}
 let lo=Math.min(0,...values),hi=Math.max(...values);if(hi===lo)hi=lo+1;const pad=(hi-lo)*.12;lo-=pad;hi+=pad;
 const x=i=>L+(right-L)*i/Math.max(1,rows.length-1),y=v=>T+(B-T)*(hi-v)/(hi-lo);
 let svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="全国社零与除汽车零售同比趋势，单位百分比；缺失月份断线">';
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);svg+='<line class="site-axis-rule" x1="'+L+'" x2="'+right+'" y1="'+yy+'" y2="'+yy+'" stroke="#e8edf1"/><text x="'+(L-7)+'" y="'+(yy+4)+'" text-anchor="end">'+num(v)+'</text>';}
 const points=[];
 [['total','#2167a0'],['exAuto','#ac863d']].forEach(([key,color])=>{let line=[],previous=null;function flush(){if(line.length)svg+='<polyline points="'+line.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2.3"/>';line=[];}
 rows.forEach((r,i)=>{const v=r[key]?.yoy;if(!finite(v)){flush();previous=null;return;}if(previous&&(r[key].basis!==previous.basis||model.basis==='ytd'&&r.period.slice(0,4)!==previous.period.slice(0,4)))flush();line.push(x(i)+','+y(v));previous=r[key];if(i===rows.length-1)svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="'+color+'"/>';});flush();});
 rows.forEach((r,i)=>{points.push({x:x(i),labels:[['total','社零'],['exAuto','除汽车']].filter(([key])=>finite(r[key]?.yoy)).map(([key])=>({x:x(i),y:y(r[key].yoy),text:signed(r[key].yoy,1),kind:'value'})),text:(r.total?.basis==='jan_feb'?R.monthLabel(r.period,true):r.period)+'\n社零 '+signed(r.total?.yoy,1)+'%\n除汽车 '+signed(r.exAuto?.yoy,1)+'%'});});
 const ticks=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])];for(const i of ticks)svg+='<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="'+(i===0?'start':i===rows.length-1?'end':'middle')+'">'+esc(rows[i].period.replace('-','.'))+'</text>';
 svg+='</svg>';host.innerHTML=svg;SiteCharts.attach(host,points);
}
function draw(){
 if(!data)return;
 try{model=M.report(data,$('national-month').value,$('national-basis').value,$('national-window').value);
 $('national-status').textContent=warning||model.label+' · 名义增速'+(model.source?.publishedAt?' · 发布 '+model.source.publishedAt:' · 发布日期未提供');
 $('national-status').classList.toggle('error',Boolean(warning));
 $('national-source').href=safe(model.source?.url)||'data-notes.html#national-retail';$('national-source').textContent=model.source?.licensedChoice?'Choice 转引 ↗':'国家统计局 ↗';
 const names=['社零同比','除汽车同比','商品零售同比','餐饮收入同比'];
 $('national-kpis').innerHTML=model.cards.map((r,i)=>'<article class="national-kpi"><span>'+names[i]+'</span><strong>'+signed(r.row?.yoy,1)+'<small>%</small></strong><div>'+num(r.row?.value,0)+' <span>亿元</span></div><small>'+ (finite(r.delta)?'较上月 '+signed(r.delta)+' pp':model.basis==='ytd'?'年初累计':model.combined?'1—2月合并':'无可比上月')+'</small></article>').join('');
 const dimension=model.decompositions[$('national-dimension').value];
 $('national-contribution').innerHTML=bars(dimension.items.map(i=>({...i,pp:i.impact?.pp})),'pp',2,'');
 $('national-residual').textContent=finite(dimension.residual)?'舍入及口径差异 '+signed(dimension.residual)+' pp':'缺少金额或同比，拉动暂不可计算';
 const measure=$('national-measure').value,field=measure==='pp'?'pp':'yoy';
 const categories=model.categories.map(i=>({...i,pp:i.impact?.pp,yoy:i.row?.yoy})).sort((a,b)=>finite(b[field])-finite(a[field])||(finite(a[field])&&finite(b[field])?b[field]-a[field]:0));
 $('national-category-unit').textContent=measure==='pp'?'对社零拉动 · 测算 / pp':'同比 / %';
 $('national-categories').innerHTML=bars(categories,field,measure==='pp'?2:1,measure==='pp'?'':'%');
 $('national-category-scope').textContent='限额以上商品 · '+categories.filter(i=>finite(i.row?.yoy)).length+'/'+categories.length+'项有同比 · 拉动不合计为全国增速';
 const rows=[...model.cards,...model.decompositions.location.items,...model.extras,...model.categories],unique=[...new Map(rows.map(r=>[r.id,r])).values()];
 $('national-table').innerHTML=unique.map(i=>'<tr><th scope="row">'+esc(i.name)+'</th><td>'+(/^category_|^above_/.test(i.id)?'限额以上':i.id==='online_goods'?'网上商品':'全国')+'</td><td>'+num(i.row?.value,0)+'</td><td>'+signed(i.row?.yoy,1)+'</td><td>'+signed(i.delta)+'</td><td>'+signed(i.impact?.increment,1)+'</td><td>'+signed(i.impact?.pp)+'</td><td>'+(safe(i.source?.url)?'<a target="_blank" rel="noopener" href="'+esc(safe(i.source.url))+'">来源 ↗</a>':'—')+'</td></tr>').join('');
 $('national-download').disabled=false;$('national-content').hidden=false;trend();keep();
 }catch(e){$('national-status').textContent='显示失败：'+e.message;$('national-status').classList.add('error');$('national-download').disabled=true;}
}
async function reload(){if(busy)return;busy=true;$('national-retry').hidden=true;$('national-status').textContent='正在读取全国社零…';try{
 const [original,insights]=await Promise.all([json('data/consumption-macro/observations.json'),json('data/products/retail-monthly-insights.json')]);
 let errors=C.validate(original);if(errors.length)throw Error(errors[0]);let next=R.mergeReleases(original,insights);errors=C.validate(next);if(errors.length)throw Error(errors[0]);
 warning='';try{next=C.mergeAutomatic(next,await json('data/macro/automatic-series.json'));}catch{warning='补充历史读取失败，当前使用原始披露';}
 const wanted=$('national-month').value||new URLSearchParams(location.search).get('month');data=next;months(wanted);draw();
 }catch(e){$('national-status').textContent='数据读取失败'+(data?'，保留当前看板':'')+'：'+e.message;$('national-status').classList.add('error');$('national-retry').hidden=false;}finally{busy=false;}}
const params=new URLSearchParams(location.search);for(const k of ['basis','window','dimension','measure']){const el=$('national-'+k);if([...el.options].some(o=>o.value===params.get(k)))el.value=params.get(k);el.onchange=()=>{if(k==='basis')months($('national-month').value);draw();};}
$('national-month').onchange=draw;$('national-retry').onclick=reload;
$('national-download').onclick=()=>{if(!model)return;const u=URL.createObjectURL(new Blob([M.csv(data,model)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='全国社零-'+model.period+'-'+model.basis+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
let timer;new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{if(model)trend();},80);}).observe($('national-trend'));
window.nationalRetail={get model(){return model;},get data(){return data;},reload};
reload();
})();
