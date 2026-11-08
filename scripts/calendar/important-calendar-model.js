(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ImportantCalendar=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const clockFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const date=value=>dayFormat.format(new Date(value));
const clock=value=>clockFormat.format(new Date(value));
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function validate(data){
 if(data.version!==1||!validDate(data.coverageStart)||!validDate(data.coverageEnd)||data.coverageStart>data.coverageEnd||!validDate(data.checkedAt))throw Error('重要数据日历配置无效');
 if(!Array.isArray(data.series)||data.series.length!==5||new Set(data.series.map(s=>s.id)).size!==5)throw Error('重要数据仅保留五类');
 const ids=new Set();for(const e of data.events){
  const s=data.series.find(s=>s.id===e.series);
  if(!s||ids.has(e.id)||!validDate(e.date)||!Number.isFinite(Date.parse(e.scheduledAt))||e.status!=='scheduled')throw Error('重要数据日期无效');
  const local=new Intl.DateTimeFormat('sv-SE',{timeZone:e.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(e.scheduledAt));
  if(local!==e.date+' '+e.time||date(e.scheduledAt)<data.coverageStart||date(e.scheduledAt)>data.coverageEnd)throw Error('发布时间或时区不一致');
  if(!/^https:\/\//.test(e.sourceUrl||s.sourceUrl))throw Error('缺少官方来源');ids.add(e.id);
 }return data;
}
function select(data,{now=Date.now(),month='',region='',kind=''}={}){
 const end=now+60*86400000;
 return data.events.map(e=>({...data.series.find(s=>s.id===e.series),...e,title:data.series.find(s=>s.id===e.series).name,beijingDate:date(e.scheduledAt),beijingTime:clock(e.scheduledAt)}))
 .filter(e=>(!region||e.region===region)&&(!kind||e.series===kind)&&(month?e.beijingDate.startsWith(month):Date.parse(e.scheduledAt)>=now&&Date.parse(e.scheduledAt)<=end))
 .sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt));
}
function days(month){
 const first=new Date(month+'-01T00:00:00Z'),offset=(first.getUTCDay()+6)%7;first.setUTCDate(1-offset);
 return Array.from({length:42},(_,i)=>{const d=new Date(first);d.setUTCDate(first.getUTCDate()+i);return d.toISOString().slice(0,10);});
}
function shift(month,n){const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);}
const escapeIcs=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function calendar(events,stamp=new Date()){
 const utc=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sinolink//Important Calendar//CN','CALSCALE:GREGORIAN'];
 for(const e of events)lines.push('BEGIN:VEVENT','UID:'+e.id+'@guojin-shangshe','DTSTAMP:'+utc(stamp),'DTSTART:'+utc(e.scheduledAt),'SUMMARY:'+escapeIcs(e.title+' · '+e.period),'DESCRIPTION:'+escapeIcs('官方日程，可能调整；北京时间 '+e.beijingDate+' '+e.beijingTime+'。'+e.focus),'URL:'+e.sourceUrl,'END:VEVENT');
 lines.push('END:VCALENDAR');
 // RFC 5545: fold at 75 UTF-8 octets without splitting a code point.
 return lines.map(line=>{let out='',part='',size=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=c;size+=n;}return out+part;}).join('\r\n')+'\r\n';
}
return {date,clock,validDate,validate,select,days,shift,calendar};
});
