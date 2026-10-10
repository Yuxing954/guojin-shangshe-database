(function(root){
'use strict';
const TYPES={FY:'年报',H1:'半年报',Q1:'一季报',Q2:'二季报',Q3:'三季报',Q4:'四季报'},KINDS={formal:'正式公告',forecast:'业绩预告',flash:'业绩快报'};
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
function code(v){v=String(v||'').trim().toUpperCase();const hk=v.match(/^(\d{1,5})\.HK$/);return hk?hk[1].padStart(5,'0')+'.HK':v;}
function url(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch(e){return '';}}
function addDays(v,n){const d=new Date(v+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function weekDays(v){const day=new Date(v+'T00:00:00Z').getUTCDay();const start=addDays(v,-((day+6)%7));return Array.from({length:7},(_,i)=>addDays(start,i));}
function monthDays(y,m){const start=weekDays(new Date(Date.UTC(y,m,1)).toISOString().slice(0,10))[0];return Array.from({length:42},(_,i)=>addDays(start,i));}
function reportType(period){return period.slice(4);}
function validateSnapshot(s){
 if(!s||s.version!==2||!Array.isArray(s.sources)||!Array.isArray(s.records)||!Number.isFinite(Date.parse(s.updatedAt)))throw Error('财报数据格式无效');
 const ids=new Set(),sources=new Set();for(const src of s.sources){if(!src.id||sources.has(src.id)||!src.label||!url(src.url)||!Number.isFinite(Date.parse(src.checkedAt)))throw Error('来源记录无效');sources.add(src.id);}
 for(const r of s.records){if(!r.id||ids.has(r.id)||!code(r.code)||!/^20\d{2}(FY|H1|Q[1-4])$/.test(r.period)||!KINDS[r.kind]||!sources.has(r.sourceId)||!r.evidence||!Number.isFinite(Date.parse(r.updatedAt)))throw Error('财报记录或来源无效');ids.add(r.id);
 for(const k of ['expected','actual','announcementDate'])if(r[k]&&!validDate(r[k]))throw Error('披露日期无效');
 if(r.kind!=='formal'&&r.actual)throw Error('业绩预告不能标为正式披露');if(r.actual&&r.actual>r.updatedAt.slice(0,10))throw Error('未来日期不能标为已披露');
 if(r.url&&(!url(r.url)||r.linkType!=='original'))throw Error('公告原文链接无效');
 for(const reservation of r.reservations||[]){if(!validDate(reservation.date)||reservation.announcedAt&&!validDate(reservation.announcedAt)||reservation.url&&!url(reservation.url))throw Error('预约历史无效');}
 for(const h of r.history||[]){if(!['expected','actual','announcementDate','url'].includes(h.field)||!Number.isFinite(Date.parse(h.observedAt)))throw Error('变更记录无效');}
 }
 return s;
}
function status(r,today){if(r.kind!=='formal')return r.announcementDate?'已公告':'待公布';if(r.actual)return '已披露';if(r.expected)return r.expected<today?'预约日已过':r.sourceId==='choice-mcp'?'预计披露':'已预约';return '待公布';}
function recent(pool,s,today){
 const formal=rows(pool,s,'').filter(r=>r.kind==='formal');
 return pool.map(c=>{const records=formal.filter(r=>r.code===code(c.code));
  const latest=records.filter(r=>r.actual&&r.actual<=today).sort((a,b)=>b.actual.localeCompare(a.actual)||b.period.localeCompare(a.period))[0];
  const next=records.filter(r=>!r.actual&&r.expected>=today).sort((a,b)=>a.expected.localeCompare(b.expected))[0];
  const overdue=records.filter(r=>!r.actual&&r.expected&&r.expected<today&&(!latest||r.expected>latest.actual)).sort((a,b)=>b.expected.localeCompare(a.expected))[0];
  return {...c,code:code(c.code),latest,next,overdue};
 }).sort((a,b)=>(b.latest?.actual||'').localeCompare(a.latest?.actual||'')||a.code.localeCompare(b.code));
}
function rows(pool,s,period){const sources=new Map(s.sources.map(x=>[x.id,x]));const result=[];for(const c0 of pool){const c={...c0,code:code(c0.code)};const matches=s.records.filter(r=>code(r.code)===c.code&&(!period||r.period===period));for(const r of matches)result.push({...c,...r,code:c.code,source:sources.get(r.sourceId)});if(period&&!matches.some(r=>r.kind==='formal'))result.push({...c,id:c.code+'|'+period+'|pending',period,kind:'formal',expected:'',actual:'',announcementDate:'',reservations:[],history:[]});}return result;}
function filter(rows,f){const q=String(f.search||'').trim().toLowerCase();return rows.filter(r=>(!f.sector||r.sector===f.sector)&&(!f.market||r.market===f.market)&&(!f.type||reportType(r.period)===f.type)&&(!f.kind||r.kind===f.kind)&&(!f.status||status(r,f.today)===f.status)&&(!f.watched||f.watch.includes(code(r.code)))&&(!q||[r.name,r.code,r.sector,r.title,r.period].join(' ').toLowerCase().includes(q)));}
function eventsFor(rows,mode='disclosure'){return rows.flatMap(r=>{const date=mode==='announcement'?r.announcementDate:r.kind==='formal'?(r.actual||r.expected):r.announcementDate;return date?[{...r,date,dateLabel:mode==='announcement'?'公告发布':r.kind==='formal'?(r.actual?'实际披露':r.sourceId==='choice-mcp'?'预计披露':'预约披露'):KINDS[r.kind]}]:[];}).sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code)||a.id.localeCompare(b.id));}
function upcoming(rows,today,days){return rows.filter(r=>r.kind==='formal'&&!r.actual&&r.expected>=today&&r.expected<=addDays(today,days)).sort((a,b)=>a.expected.localeCompare(b.expected)||a.code.localeCompare(b.code));}
function csvCell(v){let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(rows,today){return '\uFEFF'+[['公司','代码','行业','市场','报告期','类型','预约披露日','实际披露日','公告发布日期','状态','来源','来源核验时间','原文链接'],...rows.map(r=>[r.name,r.code,r.sector,r.market,r.period,KINDS[r.kind],r.expected,r.actual,r.announcementDate,status(r,today),r.source?.label,r.updatedAt,r.url])].map(r=>r.map(csvCell).join(',')).join('\r\n');}
function icsText(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,'\\$&');}
function foldLine(line){const parts=[];let part='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>75){parts.push(part);part=' ';bytes=1;}part+=c;bytes+=n;}parts.push(part);return parts.join('\r\n');}
function calendar(rows,{today,days=3,mode='disclosure',stamp=new Date().toISOString()}={}){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sinolink//Earnings Calendar//CN','CALSCALE:GREGORIAN'];for(const e of eventsFor(rows,mode)){lines.push('BEGIN:VEVENT','UID:'+icsText(e.id+'|'+mode)+'@sinolink-earnings','DTSTAMP:'+stamp.replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;VALUE=DATE:'+e.date.replace(/-/g,''),'DTEND;VALUE=DATE:'+addDays(e.date,1).replace(/-/g,''),'SUMMARY:'+icsText(e.name+' '+e.period+' '+e.dateLabel),'DESCRIPTION:'+icsText((e.title||KINDS[e.kind])+'；来源：'+(e.source?.label||'')+'；预约：'+(e.expected||'待公布')+'；实际：'+(e.actual||'待公布')));if(url(e.url))lines.push('URL:'+url(e.url));if(mode==='disclosure'&&e.kind==='formal'&&!e.actual&&e.expected>=today)lines.push('BEGIN:VALARM','TRIGGER:-P'+days+'D','ACTION:DISPLAY','DESCRIPTION:'+icsText(e.name+' 预约财报披露'),'END:VALARM');lines.push('END:VEVENT');}lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';}
const api={TYPES,KINDS,validDate,code,url,addDays,weekDays,monthDays,reportType,recent,validateSnapshot,status,rows,filter,eventsFor,upcoming,csvCell,csv,calendar};if(typeof module==='object'&&module.exports)module.exports=api;else root.EarningsCalendar=api;
})(typeof window==='object'?window:globalThis);
