(function(){
'use strict';
const M=MonthlyProduct,CM=ConsumptionMacro,$=id=>document.getElementById(id),canvas=$('product'),ink='#173f60',blue='#104f87',muted='#697985',colors=['#165b9c','#5aa8df','#a64d19'];
let data=null,legal=[],report=null,busy=false,warning='',hits=[],activeMonth='',comments=new Map(),previewFrame;
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
 const legalHeight=legalLines.reduce((n,ls)=>n+ls.length*19+62,0);
 const height=3648+model.categories.length*37+commentLines.length*34+legalHeight;
 target.width=width;target.height=Math.ceil(height*width/1200);const ctx=target.getContext('2d',{alpha:false}),scale=width/1200;ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,height);
 const hit=[];
 function text(t,x,y,size=20,color=ink,weight='normal',align='left'){ctx.font=weight+' '+size+'px "Microsoft YaHei",sans-serif';ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(t),x,y);ctx.textAlign='left';}
 function line(y){ctx.fillStyle='#dae2e8';ctx.fillRect(44,y,1112,1);}
 function section(title,y){text(title,44,y,27,blue,'bold');ctx.fillStyle='#dae2e8';ctx.fillRect(44,y+16,1112,1.5);}
 function cells(headers,rows,y,widths){ctx.fillStyle=blue;ctx.fillRect(44,y,1112,44);let x=44;headers.forEach((h,i)=>{text(h,x+12,y+29,19,'#fff','bold');x+=widths[i];});let top=y+44;rows.forEach((row,i)=>{ctx.fillStyle=i%2?'#f3f7fa':'#fff';ctx.fillRect(44,top,1112,37);let x=44;row.forEach((v,j)=>{text(v,x+12,top+25,19,j===0?ink:ink,j===0?'normal':'normal');x+=widths[j];});ctx.fillStyle='#e4eaf0';ctx.fillRect(44,top+36,1112,1);top+=37;});return top;}
 function kpis(items,y){const w=1112/items.length;items.forEach((i,j)=>{const x=44+j*w;text(i[0],x,y,21,muted);text(i[1],x,y+54,43,ink,'bold');text(i[2]||'',x,y+88,22,muted);if(j<items.length-1){ctx.fillStyle='#dae2e8';ctx.fillRect(x+w-28,y-8,1,108);}});}
 function chart(x,y,title,points,series){
 const w=535,h=220,l=x+48,r=x+w-18,top=y+82,bottom=top+h;
 text(title,x,y+8,23,blue,'bold');series.forEach((s,i)=>{ctx.fillStyle=colors[i];ctx.fillRect(x+i*175,y+34,18,4);text(s.name,x+i*175+25,y+42,17,muted);});
 const values=points.flatMap(p=>series.map(s=>s.get(p))).filter(M.finite);
 let low=values.length?Math.min(0,...values):-1,high=values.length?Math.max(0,...values):1;if(low===high){low-=1;high+=1;}
 const raw=(high-low)/4,power=10**Math.floor(Math.log10(raw));let step=power;for(const f of [1,2,2.5,5,10,20]){if(f*power>=raw){step=f*power;break;}}
 low=Math.floor(low/step)*step;high=Math.ceil(high/step)*step;if(low===high)high=low+step;
 const xpos=i=>l+(r-l)*i/Math.max(1,points.length-1),ypos=v=>top+h*(high-v)/(high-low);
 for(let v=low;v<=high+step*.01;v+=step){const yy=ypos(v);ctx.strokeStyle='#e8edf1';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(l,yy);ctx.lineTo(r,yy);ctx.stroke();text(Number(v.toFixed(2)),l-9,yy+6,16,muted,'normal','right');}
 series.forEach((s,j)=>{ctx.strokeStyle=colors[j];ctx.lineWidth=2.8;ctx.beginPath();let connected=false;points.forEach((p,i)=>{const v=s.get(p);if(!M.finite(v)){connected=false;return;}if(connected)ctx.lineTo(xpos(i),ypos(v));else ctx.moveTo(xpos(i),ypos(v));connected=true;});ctx.stroke();
 const last=points.at(-1),v=last?s.get(last):null;if(M.finite(v)){ctx.fillStyle=colors[j];ctx.beginPath();ctx.arc(xpos(points.length-1),ypos(v),4,0,Math.PI*2);ctx.fill();}
 });
 const tick=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])];for(const i of tick)if(points[i])text(points[i].period.slice(2),xpos(i),bottom+29,17,muted,'normal',i===0?'left':i===points.length-1?'right':'center');
 if(!values.length)text('暂无数据',x+w/2,top+110,23,muted,'normal','center');
 hit.push({x:l,y:top,w:r-l,h,points,series});
 }
 if(logo.complete&&logo.naturalWidth)ctx.drawImage(logo,44,25,300,67);else text('SINOLINK 国金证券',44,68,32,blue,'bold');
 ctx.fillStyle='#447eaf';ctx.fillRect(920,34,236,50);text('国金商社于健',1038,69,29,'#fff','normal','center');
 ctx.fillStyle=blue;ctx.fillRect(0,120,1200,272);if(banner.complete&&banner.naturalWidth)ctx.drawImage(banner,0,120,1200,272);text('社零与CPI月度跟踪',44,260,76,'#fff','bold');text(M.monthLabel(model.period),44,330,32,'#fff');
 let y=448;
 section('社会消费品零售总额',y);y+=63;
 kpis([['社零 · '+(model.combined?'1—2月合并':'当月'),number(model.retail?.value,0)+' 亿元','同比 '+rate(model.retail?.yoy)],['餐饮收入 · '+(model.combined?'1—2月合并':'当月'),number(M.row(data,'catering',model.period)?.value,0)+' 亿元','同比 '+rate(M.row(data,'catering',model.period)?.yoy)],['社零 · 年初累计',number(model.ytd?.value,0)+' 亿元','累计同比 '+rate(model.ytd?.yoy)]],y);
 y+=145;text('全国 · 名义金额 · 未季调'+(model.combined?' · 1—2月合并披露':''),44,y,18,muted);y+=33;
 y=cells(['结构','本期金额 · 亿元','本期同比','累计金额 · 亿元','累计同比'],model.structure.map(i=>[i.name,number(i.current?.value,0),rate(i.current?.yoy),number(i.ytd?.value,0),rate(i.ytd?.yoy)]),y,[292,220,170,250,180]);
 y+=56;section('限额以上分品类',y);y+=44;
 y=cells(['品类','本期 · 亿元',...model.recent.map(p=>M.row(data,'retail',p)?.basis==='jan_feb'?p.slice(2,4)+'年1—2月同比':p.slice(2)+'同比')],model.categories.map(i=>[i.name,number(i.current?.value,0),...i.history.map(r=>rate(r?.yoy))]),y,[410,195,...model.recent.map(()=>169)]);
 y+=34;text('分品类及结构同比为披露口径；网上商品仅列累计；— 表示未披露。',44,y,18,muted);y+=52;
 chart(44,y,'社零与商品零售 · 同比 %',model.retailTrend,[{name:'社零',get:p=>p.retail?.yoy},{name:'商品零售',get:p=>p.goods?.yoy}]);
 chart(620,y,'社零与餐饮收入 · 同比 %',model.retailTrend,[{name:'社零',get:p=>p.retail?.yoy},{name:'餐饮收入',get:p=>p.catering?.yoy}]);y+=370;
 section('居民消费价格 CPI',y);y+=63;
 kpis([['CPI · 同比',rate(model.cpi?.value),'环比 '+rate(model.cpi?.mom)],['核心CPI · 同比',rate(model.core?.value),'环比 '+rate(model.core?.mom)],['CPI · 年初累计',rate(M.row(data,'cpi',model.period,'ytd')?.value),'未季调']],y);
 y+=146;text('全国 · 核心CPI扣除食品和能源',44,y,18,muted);y+=30;
 y=cells(['月份','CPI同比','CPI环比','核心CPI同比','核心CPI环比'],model.prices.map(p=>[M.monthLabel(p.period),rate(p.cpi?.value),rate(p.cpi?.mom),rate(p.core?.value),rate(p.core?.mom)]),y,[290,205,205,205,207]);
 y+=52;
 chart(44,y,'CPI与核心CPI · 同比 %',model.priceTrend,[{name:'CPI',get:p=>p.cpi?.value},{name:'核心CPI',get:p=>p.core?.value}]);
 chart(620,y,'CPI与核心CPI · 环比 %',model.priceTrend,[{name:'CPI',get:p=>p.cpi?.mom},{name:'核心CPI',get:p=>p.core?.mom}]);y+=370;
 section('研究点评',y);y+=54;commentLines.forEach(t=>{text(t,44,y,22,'#283b49');y+=34;});y+=26;line(y);y+=35;
 text('来源：国家统计局'+(model.sources.some(s=>s.licensedChoice)?' / Choice转引':'')+'；国金商社研究数据库',44,y,18,muted);y+=30;
 const pubs=[...new Set(model.sources.map(s=>s.publishedAt).filter(Boolean))].sort();text('原始披露发布：'+(pubs.length?pubs[0]+' — '+pubs.at(-1):'未提供')+' · 数据期 '+model.period,44,y,17,muted);y+=35;
 ctx.fillStyle='#f5f4f5';ctx.fillRect(0,y,1200,height-y);ctx.fillStyle='#eee8cd';ctx.fillRect(0,y,1200,5);y+=35;
 legalLines.forEach((ls,i)=>{text(i?'免责声明':'特别声明',44,y,22,'#998951','bold');y+=32;for(const t of ls){text(t,44,y,13,'#68727b');y+=19;}y+=24;});
 // Crop to the actual report height, keeping export and preview layout identical.
 const used=Math.ceil((y+30)*scale);if(used<target.height){const image=ctx.getImageData(0,0,target.width,used);target.height=used;target.getContext('2d').putImageData(image,0,0);}
 return {hits:hit,height:target.height};
}
function sourceLinks(){
 $('sources').replaceChildren();for(const s of report.sources){let u;try{u=new URL(s.url);if(u.protocol!=='https:')continue;}catch{continue;}const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener';a.textContent=s.title||s.name||s.publisher||'来源';a.title=(s.publishedAt?'发布 '+s.publishedAt+' · ':'')+(s.publisher||'');$('sources').append(a);}
}
function render(){
 if(!data||!$('month').value)return;
 try{report=M.report(data,$('month').value,$('window').value);const comment=$('comment').value.trim()||report.comments;canvas.hidden=false;const width=Math.max(760,Math.round(canvas.getBoundingClientRect().width*(devicePixelRatio||1)));const result=draw(canvas,width,report,comment);hits=result.hits;canvas.setAttribute('aria-label',report.title+'。'+comment+'。'+(report.combined?'社零1—2月合并披露。':'')+'限额以上分品类。来源：'+report.sources.map(s=>s.title||s.name).join('；'));$('generated-title').textContent=report.title;$('export').disabled=false;status(warning||report.periodLabel+' · 高清PNG 3600像素宽',Boolean(warning));sourceLinks();publishURL();}catch(e){status('生成失败：'+e.message,true);$('export').disabled=true;}
}
async function reload(){
 if(busy)return;busy=true;$('refresh').disabled=true;status('正在读取月度数据…');
 try{const original=await json('data/consumption-macro/observations.json');const errors=CM.validate(original);if(errors.length)throw Error(errors[0]);warning='';
 let incoming=original;try{incoming=CM.mergeAutomatic(original,await json('data/macro/automatic-series.json'));}catch(e){warning='补充历史读取失败，使用原始披露';}
 const nextLegal=await json('data/products/research-legal.json');if(!Array.isArray(nextLegal.paragraphs)||nextLegal.paragraphs.length!==2)throw Error('声明文件无效');
 const periods=M.months(incoming);if(!periods.length)throw Error('暂无月度数据');const requested=new URLSearchParams(location.search).get('month'),previous=$('month').value;
 data=incoming;legal=nextLegal.paragraphs;const old=previous||requested;$('month').replaceChildren(...periods.map(p=>{const o=document.createElement('option');o.value=p;o.textContent=M.monthLabel(p);return o;}));$('month').value=periods.includes(old)?old:M.preferred(data);
 activeMonth=$('month').value;$('comment').value=comments.get(activeMonth)||'';render();
 }catch(e){status('数据读取失败'+(data?'，保留当前产品':'')+'：'+e.message,true);}finally{busy=false;$('refresh').disabled=false;}
}
$('month').onchange=()=>{comments.set(activeMonth,$('comment').value);activeMonth=$('month').value;$('comment').value=comments.get(activeMonth)||'';tip.hidden=true;render();};
$('window').onchange=render;$('comment').oninput=()=>{comments.set(activeMonth,$('comment').value);render();};
$('refresh').onclick=reload;$('capture').onclick=()=>{tip.hidden=true;document.body.classList.add('capture');window.scrollTo(0,0);};$('return').onclick=()=>document.body.classList.remove('capture');
$('export').onclick=()=>{if(!report)return;const output=document.createElement('canvas');draw(output,3600,report,$('comment').value.trim()||report.comments);output.toBlob(blob=>{if(!blob){status('导出失败，请使用截图模式',true);return;}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='社零与CPI月度跟踪_'+report.period+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);},'image/png');};
canvas.onpointermove=e=>{if(document.body.classList.contains('capture'))return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*1200/rect.width,y=(e.clientY-rect.top)*1200/rect.width;const chart=hits.find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(!chart){tip.hidden=true;return;}const p=chart.points[Math.max(0,Math.min(chart.points.length-1,Math.round((x-chart.x)/chart.w*(chart.points.length-1))))];if(!p)return;tip.textContent=M.monthLabel(p.period,p.retail?.basis==='jan_feb')+'\n'+chart.series.map(s=>s.name+' '+rate(s.get(p))).join('\n');tip.hidden=false;tip.style.left=Math.min(e.clientX+12,innerWidth-230)+'px';tip.style.top=Math.max(8,e.clientY-90)+'px';};canvas.onpointerleave=()=>tip.hidden=true;
const wanted=new URLSearchParams(location.search).get('window');if(['6','12','24','all'].includes(wanted))$('window').value=wanted;
let lastWidth=0;new ResizeObserver(()=>{const width=canvas.getBoundingClientRect().width;if(!report||Math.abs(lastWidth-width)<1)return;lastWidth=width;cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(render);}).observe(document.querySelector('.stage'));
window.monthlyProduct={get report(){return report;},get data(){return data;},draw,reload};
Promise.all([document.fonts.load('400 22px "Microsoft YaHei"'),document.fonts.load('700 22px "Microsoft YaHei"')]).then(reload).catch(()=>status('字体加载失败，请刷新重试',true));
})();