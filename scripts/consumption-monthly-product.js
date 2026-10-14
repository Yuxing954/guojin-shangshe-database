(function(){
'use strict';
const M=MonthlyProduct,CM=ConsumptionMacro,$=id=>document.getElementById(id),canvas=$('product'),ink='#173f60',blue='#104f87',muted='#667582',colors=['#165b9c','#66a9dc','#a64d19'],TYPE={section:24,chart:22,body:22,table:20,meta:18};
let insights={},data=null,legal=[],report=null,busy=false,warning='',hits=[],activeMonth='',comments=new Map(),previewFrame;
const banner=new Image();banner.onload=()=>{if(report)render();};banner.src='scripts/assets/hotel-weekly/title.png';
const logo=new Image();logo.onload=()=>{if(report)render();};logo.src='scripts/assets/hotel-weekly/logo.png';
const tip=document.createElement('div');tip.className='monthly-tooltip';tip.hidden=true;document.body.append(tip);
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
async function json(path){const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch(path,{cache:'no-store',signal:c.signal});if(!r.ok)throw Error(path+'：HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
function publishURL(){const u=new URL(location.href);u.searchParams.set('month',$('month').value);u.searchParams.set('window',$('window').value);history.replaceState(null,'',u.pathname+u.search);}
function number(v,d=1){return M.finite(v)?M.display(v,d):'—';}
function rate(v){return M.rate(v);}
function textLines(ctx,text,width,size){ctx.font=size+'px "Microsoft YaHei",sans-serif';const out=[];for(const part of String(text).split('\n')){let line='';for(const ch of part){if(ctx.measureText(line+ch).width>width&&line){out.push(line);line=ch;}else line+=ch;}out.push(line);}return out;}
function draw(target,width,model,comment){
 const measure=target.getContext('2d'),commentLines=textLines(measure,comment,1112,22),legalLines=legal.map(p=>textLines(measure,p,1112,13));
 const legalHeight=legalLines.reduce((n,ls)=>n+ls.length*18+62,0);
 const height=4600+model.priceCategories.length*37+commentLines.length*34+legalHeight;
 target.width=width;target.height=Math.ceil(height*width/1200);const ctx=target.getContext('2d',{alpha:false}),scale=width/1200;ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,height);
 const hit=[];
 function text(t,x,y,size=20,color=ink,weight='normal',align='left'){ctx.font=weight+' '+size+'px "Microsoft YaHei",sans-serif';ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(t),x,y);ctx.textAlign='left';}
 function line(y){ctx.fillStyle='#dae2e8';ctx.fillRect(44,y,1112,1);}
 function section(title,y){text(title,44,y,TYPE.section,blue,'bold');ctx.fillStyle='#c9d6e0';ctx.fillRect(44,y+16,1112,1.5);}
 function cells(headers,rows,y,widths,emphasize=-1){ctx.fillStyle=blue;ctx.fillRect(44,y,1112,44);let x=44;headers.forEach((h,i)=>{text(h,x+12,y+29,TYPE.table,'#fff','bold');x+=widths[i];});let top=y+44;rows.forEach((row,i)=>{ctx.fillStyle=i%2?'#f3f7fa':'#fff';ctx.fillRect(44,top,1112,37);let x=44;row.forEach((v,j)=>{text(v,x+12,top+25,TYPE.table,i===emphasize&&j>0?(String(v).startsWith('-')?'#287f70':String(v).startsWith('+')?'#b94c5c':ink):ink,i===emphasize?'bold':'normal');x+=widths[j];});ctx.fillStyle='#e4eaf0';ctx.fillRect(44,top+36,1112,1);top+=37;});return top;}
 function kpis(items,y){const w=1112/items.length;items.forEach((i,j)=>{const x=44+j*w;text(i[0],x,y,21,muted);text(i[1],x,y+54,43,ink,'bold');text(i[2]||'',x,y+88,22,muted);if(j<items.length-1){ctx.fillStyle='#dae2e8';ctx.fillRect(x+w-28,y-8,1,108);}});}

 function marker(x,y,square,color){ctx.fillStyle='#fff';ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();if(square)ctx.rect(x-3,y-3,6,6);else ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
 function chart(x,y,title,points,series){
 const w=536,h=206,l=x+49,r=x+w-10,top=y+88,bottom=top+h,inset=28;
 text(title,x,y,TYPE.chart,'#627b8e','bold');
 series.forEach((s,i)=>{const lx=x+i*270;ctx.strokeStyle=colors[i];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lx,y+35);ctx.lineTo(lx+22,y+35);ctx.stroke();marker(lx+11,y+35,i===1,colors[i]);text(s.name+'  '+rate(s.get(points.at(-1)||{})),lx+31,y+42,TYPE.meta,colors[i],'bold');});
 const values=points.flatMap(p=>series.map(s=>s.get(p))).filter(M.finite);
 let low=values.length?Math.min(0,...values):-1,high=values.length?Math.max(0,...values):1;if(low===high){low-=1;high+=1;}
 const raw=(high-low)/4,power=10**Math.floor(Math.log10(raw));let step=power;
 for(const factor of [1,2,2.5,5,10,20]){if(factor*power<raw)continue;const lo=Math.floor(low/(factor*power))*factor*power;if(lo+4*factor*power>=high){step=factor*power;low=lo;high=lo+4*step;break;}}
 const xpos=i=>points.length===1?(l+r)/2:l+inset+(r-l-2*inset)*i/Math.max(1,points.length-1),ypos=v=>top+h*(high-v)/(high-low);
 for(let i=0;i<=4;i++){const v=high-i*step,yy=ypos(v);ctx.strokeStyle='#edf0f3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(l,yy);ctx.lineTo(r,yy);ctx.stroke();text(Number(v.toFixed(2)),l-10,yy+6,18,'#73808b','normal','right');}
 ctx.strokeStyle='#cbd4dc';ctx.beginPath();ctx.moveTo(l,ypos(0));ctx.lineTo(r,ypos(0));ctx.stroke();
 series.forEach((s,j)=>{ctx.strokeStyle=colors[j];ctx.lineWidth=3;ctx.beginPath();let connected=false;points.forEach((p,i)=>{const v=s.get(p);if(!M.finite(v)){connected=false;return;}if(connected)ctx.lineTo(xpos(i),ypos(v));else ctx.moveTo(xpos(i),ypos(v));connected=true;});ctx.stroke();points.forEach((p,i)=>{const v=s.get(p);if(M.finite(v)&&(points.length<=26||i===points.length-1))marker(xpos(i),ypos(v),j===1,colors[j]);});});
 const tick=[...new Set(Array.from({length:4},(_,i)=>Math.round(i*(points.length-1)/3)))];for(const i of tick)if(points[i])text(points[i].period.slice(2),xpos(i),bottom+30,TYPE.meta,'#73808b','normal','center');
 if(!values.length)text('暂无数据',x+w/2,top+110,23,muted,'normal','center');
 hit.push({x:l+inset,y:top,w:r-l-2*inset,h,points,series});
 }
 function categoryBars(y,rows){
 const lineHeight=43,top=y+58,labelWidth=304,barWidth=300,first=44+labelWidth,second=first+394;
 text('重点分项 · 价格变化',44,y,TYPE.section,blue,'bold');text('同比 %',first,y+10,TYPE.meta,muted,'bold');text('环比 %',second,y+10,TYPE.meta,muted,'bold');
 const ranges=['yoy','mom'].map(key=>{const values=rows.map(r=>r[key]).filter(M.finite);return {key,max:Math.max(1,...values.map(Math.abs))};});
 rows.forEach((row,i)=>{const yy=top+i*lineHeight;if(i%2===0){ctx.fillStyle='#f3f7fa';ctx.fillRect(44,yy-25,1112,lineHeight);}text(row.name,56,yy,TYPE.table,ink);
 ranges.forEach((r,j)=>{const value=row[r.key],left=j?second:first,zero=left+barWidth/2,color=!M.finite(value)||value===0?'#7b8490':value>0?'#c23d3d':'#21816b';ctx.strokeStyle='#cbd4dc';ctx.beginPath();ctx.moveTo(zero,yy-20);ctx.lineTo(zero,yy+10);ctx.stroke();
 if(M.finite(value)){const len=value/r.max*(barWidth/2-18);ctx.fillStyle=color;ctx.fillRect(Math.min(zero,zero+len),yy-14,Math.max(2,Math.abs(len)),14);}text(rate(value),left+barWidth+8,yy,TYPE.table,color,'bold');});
 });
 hit.push({type:'category',x:44,y:top-25,w:1112,h:rows.length*lineHeight,rows,lineHeight});
 return top+rows.length*lineHeight+20;
 }

 if(logo.complete&&logo.naturalWidth)ctx.drawImage(logo,44,25,300,67);else text('SINOLINK 国金证券',44,68,32,blue,'bold');
 ctx.fillStyle='#447eaf';ctx.fillRect(920,34,236,50);text('国金商社于健',1038,70,32,'#fff','normal','center');
 ctx.fillStyle=blue;ctx.fillRect(0,120,1200,272);if(banner.complete&&banner.naturalWidth)ctx.drawImage(banner,0,120,1200,272);text(model.title,44,260,88,'#fff','bold');text('发布日期：'+(model.freshness.publishedAt?model.freshness.publishedAt.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日') :'未提供'),44,330,32,'#fff');

 let y=450;
 section('当期核心指标',y);y+=52;
 const cards=[['CPI同比',model.cpi?.value,'较上月',M.row(data,'cpi',M.monthAt(M.monthIndex(model.period)-1))?.value],['CPI环比',model.cpi?.mom,'较上月',M.row(data,'cpi',M.monthAt(M.monthIndex(model.period)-1))?.mom],['核心CPI同比',model.core?.value,'较上月',M.row(data,'core_cpi',M.monthAt(M.monthIndex(model.period)-1))?.value],['核心CPI环比',model.core?.mom,'较上月',M.row(data,'core_cpi',M.monthAt(M.monthIndex(model.period)-1))?.mom]];
 cards.forEach(([name,v,label,previous],i)=>{const x=44+i*282;text(name,x,y+31,21,muted);text(rate(v),x,y+86,44,ink,'bold');if(i<3){ctx.fillStyle='#e1e6ea';ctx.fillRect(x+262,y+16,1,115);}const delta=M.finite(v)&&M.finite(previous)?v-previous:null;text(M.finite(delta)?label+' '+(delta>0?'+':'')+M.display(delta)+'pct':'暂无可比数据',x,y+125,25,delta>0?'#c23d3d':delta<0?'#21816b':'#68737e','bold');});
 y+=185;
 if(model.headline){text(model.headline,44,y+10,TYPE.body,ink,'bold');y+=75;}
 chart(44,y,'CPI与核心CPI · 同比 %',model.priceTrend,[{name:'CPI',get:p=>p.cpi?.value},{name:'核心CPI',get:p=>p.core?.value}]);
 chart(620,y,'CPI与核心CPI · 环比 %',model.priceTrend,[{name:'CPI',get:p=>p.cpi?.mom},{name:'核心CPI',get:p=>p.core?.mom}]);y+=380;
 if(model.priceCategories.length)y=categoryBars(y,model.priceCategories);
 y+=30;
 section('研究点评',y);y+=54;commentLines.forEach(t=>{text(t,44,y,22,'#283b49');y+=34;});y+=42;section('近期数据 · %',y);y+=36;y=cells(['月份','CPI同比','CPI环比','核心CPI同比','核心CPI环比'],model.prices.slice(-3).map(p=>[M.monthLabel(p.period),rate(p.cpi?.value),rate(p.cpi?.mom),rate(p.core?.value),rate(p.core?.mom)]),y,[290,205,205,205,207],Math.min(3,model.prices.length)-1);y+=42;line(y);y+=35;
 text('来源：国家统计局'+(model.sources.some(s=>s.licensedChoice)?' / Choice转引':'')+'；国金商社研究数据库',44,y,18,muted);y+=30;
 text('数据月份 '+model.period+' · 官方发布 '+(model.freshness.publishedAt||'未提供')+' · 入库核对 '+(model.freshness.updatedAt||'未提供'),44,y,17,muted);y+=35;
 ctx.fillStyle='#f5f4f5';ctx.fillRect(0,y,1200,height-y);ctx.fillStyle='#eee8cd';ctx.fillRect(0,y,1200,5);y+=35;
 legalLines.forEach((ls,i)=>{text(i?'免责声明':'特别声明',44,y,22,'#998951','bold');y+=32;for(const t of ls){text(t,44,y,13,'#68727b');y+=18;}y+=24;});
 // Crop to the actual report height, keeping export and preview layout identical.
 const used=Math.ceil((y+30)*scale);if(used<target.height){const image=ctx.getImageData(0,0,target.width,used);target.height=used;target.getContext('2d').putImageData(image,0,0);}
 return {hits:hit,height:target.height};
}
function sourceLinks(){
 $('sources').replaceChildren();for(const s of report.sources){let u;try{u=new URL(s.url);if(u.protocol!=='https:')continue;}catch{continue;}const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener';a.textContent=s.title||s.name||s.publisher||'来源';a.title=(s.publishedAt?'发布 '+s.publishedAt+' · ':'')+(s.publisher||'');$('sources').append(a);}
}
function render(){
 if(!data||!$('month').value)return;
 try{report=M.report(data,$('month').value,$('window').value,insights);const comment=$('comment').value.trim()||report.comments;canvas.hidden=false;const width=Math.max(760,Math.round(canvas.getBoundingClientRect().width*(devicePixelRatio||1)));const result=draw(canvas,width,report,comment);hits=result.hits;canvas.setAttribute('aria-label',report.title+'。发布日期：'+(report.freshness.publishedAt||'未提供')+'。'+comment+'。来源：'+report.sources.map(s=>s.title||s.name).join('；'));$('generated-title').textContent=report.title;document.querySelector('.product-header h1').textContent=report.title;$('export').disabled=false;status(warning||report.periodLabel+' · 最新收录 '+report.freshness.latest+' · 高清PNG 3600像素宽',Boolean(warning));sourceLinks();publishURL();}catch(e){status('生成失败：'+e.message,true);$('export').disabled=true;}
}
async function reload(){
 if(busy)return;busy=true;$('refresh').disabled=true;status('正在读取月度数据…');
 try{const original=await json('data/consumption-macro/observations.json');const errors=CM.validate(original);if(errors.length)throw Error(errors[0]);warning='';
 let incoming=original;try{incoming=CM.mergeAutomatic(original,await json('data/macro/automatic-series.json'));}catch(e){warning='补充历史读取失败，使用原始披露';}
 insights=await json('data/products/consumption-monthly-insights.json');incoming=M.mergeReleases(incoming,insights);const releaseErrors=CM.validate(incoming);if(releaseErrors.length)throw Error(releaseErrors[0]);
 const nextLegal=await json('data/products/research-legal.json');if(!Array.isArray(nextLegal.paragraphs)||nextLegal.paragraphs.length!==2)throw Error('声明文件无效');
 const periods=M.months(incoming);if(!periods.length)throw Error('暂无月度数据');const requested=new URLSearchParams(location.search).get('month'),previous=$('month').value;
 data=incoming;legal=nextLegal.paragraphs;const old=previous||requested;$('month').replaceChildren(...periods.map(p=>{const o=document.createElement('option');o.value=p;o.textContent=M.monthLabel(p);return o;}));$('month').value=periods.includes(old)?old:M.preferred(data);
 activeMonth=$('month').value;$('comment').value=comments.get(activeMonth)||'';render();
 }catch(e){status('数据读取失败'+(data?'，保留当前产品':'')+'：'+e.message,true);}finally{busy=false;$('refresh').disabled=false;}
}
$('month').onchange=()=>{comments.set(activeMonth,$('comment').value);activeMonth=$('month').value;$('comment').value=comments.get(activeMonth)||'';tip.hidden=true;render();};
$('window').onchange=render;$('comment').oninput=()=>{comments.set(activeMonth,$('comment').value);render();};
$('refresh').onclick=reload;$('capture').onclick=()=>{tip.hidden=true;document.body.classList.add('capture');window.scrollTo(0,0);};$('return').onclick=()=>document.body.classList.remove('capture');
$('export').onclick=()=>{if(!report)return;const output=document.createElement('canvas');draw(output,3600,report,$('comment').value.trim()||report.comments);output.toBlob(blob=>{if(!blob){status('导出失败，请使用截图模式',true);return;}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='CPI月度跟踪_'+report.period+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);},'image/png');};
canvas.onpointermove=e=>{if(document.body.classList.contains('capture'))return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*1200/rect.width,y=(e.clientY-rect.top)*1200/rect.width;const chart=hits.find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(!chart){tip.hidden=true;return;}if(chart.type==='category'){const row=chart.rows[Math.min(chart.rows.length-1,Math.max(0,Math.floor((y-chart.y)/chart.lineHeight)))];tip.textContent=row.name+'\n同比 '+rate(row.yoy)+' · 环比 '+rate(row.mom);tip.hidden=false;tip.style.left=Math.min(e.clientX+12,innerWidth-230)+'px';tip.style.top=Math.max(8,e.clientY-90)+'px';return;}const p=chart.points[Math.max(0,Math.min(chart.points.length-1,Math.round((x-chart.x)/chart.w*(chart.points.length-1))))];if(!p)return;tip.textContent=M.monthLabel(p.period,p.retail?.basis==='jan_feb')+'\n'+chart.series.map(s=>s.name+' '+rate(s.get(p))).join('\n');tip.hidden=false;tip.style.left=Math.min(e.clientX+12,innerWidth-230)+'px';tip.style.top=Math.max(8,e.clientY-90)+'px';};canvas.onpointerleave=()=>tip.hidden=true;
const wanted=new URLSearchParams(location.search).get('window');if(['6','12','24','all'].includes(wanted))$('window').value=wanted;
let lastWidth=0;new ResizeObserver(()=>{const width=canvas.getBoundingClientRect().width;if(!report||Math.abs(lastWidth-width)<1)return;lastWidth=width;cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(render);}).observe(document.querySelector('.stage'));
window.monthlyProduct={get report(){return report;},get data(){return data;},draw,reload};
Promise.all([document.fonts.load('400 22px "Microsoft YaHei"'),document.fonts.load('700 22px "Microsoft YaHei"')]).then(reload).catch(()=>status('字体加载失败，请刷新重试',true));
})();