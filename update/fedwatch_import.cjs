'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const F=require('../scripts/fedwatch-model.js'),G=require('../scripts/gold-macro-model.js');
const URL='https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',TITLE='CME FEDWATCH TOOL - CONDITIONAL MEETING PROBABILITIES';
function reject(message){throw Error(message);}
function parse(receipt,now=Date.now()){
 const time=Date.parse(receipt.retrievedAt);
 if(receipt.provider!=='CME FedWatch'||receipt.url!==URL||receipt.observedAt!==null)reject('source_identity');
 if(!Number.isFinite(time)||time>now||now-time>24*3600*1000)reject('stale_or_future_receipt');
 if(!Array.isArray(receipt.tables)||receipt.tables.length!==2)reject('incomplete_tables');
 const get=title=>{const matches=receipt.tables.filter(t=>t.title===title);if(matches.length!==1)reject('table_identity');return matches[0].rows;};
 const futures=get('FED FUND FUTURES'),prob=get(TITLE);
 if(futures.length!==3||futures[0].join('')!=='FED FUND FUTURES'||futures[1].length!==futures[2].length||!futures[1].length)reject('futures_shape');
 if(!Array.isArray(prob)||prob.length<3||prob[0].filter(Boolean).join('')!==TITLE||prob[1][0]!=='MEETING DATE')reject('probabilities_shape');
 const columns=prob[1].slice(1).map(label=>{const m=/^(\d+)-(\d+)$/.exec(label);if(!m)reject('rate_range');return {lower:Number(m[1])/100,upper:Number(m[2])/100,labelBps:label};});
 const rows=prob.slice(2).map(row=>{
  if(row.length!==columns.length+1)reject('missing_cells');
  const m=/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(row[0]);if(!m)reject('meeting_date');
  const date=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<=receipt.retrievedAt.slice(0,10))reject('meeting_date');
  return {meetingDate:date,probabilities:row.slice(1).map(p=>{if(p==='')return null;if(!/^\d+(?:\.\d+)?%$/.test(p))reject('probability_format');return Number(p.slice(0,-1));})};
 });
 const prices=futures[1].map((contract,i)=>{const m=/^ZQ([FGHJKMNQUVXZ])(\d{1,2})$/.exec(contract),rawPrice=futures[2][i];if(!m||!/^\d+(?:\.\d+)?$/.test(rawPrice))reject('future_format');const digits=m[2],current=Number(receipt.retrievedAt.slice(0,4));let year=digits.length===2?2000+Number(digits):Math.floor(current/10)*10+Number(digits);if(digits.length===1&&year<current)year+=10;return {contract,contractMonth:year+'-'+({F:'01',G:'02',H:'03',J:'04',K:'05',M:'06',N:'07',Q:'08',U:'09',V:'10',X:'11',Z:'12'}[m[1]]),price:Number(rawPrice),rawPrice};});
 const t={retrievedAt:receipt.retrievedAt,observedAt:null,rateUnit:'%',probabilityUnit:'%',columns,rows,futures:prices};
 if(!F.validTable(t))reject('invalid_full_table');return t;
}
const values=t=>({columns:t.columns,rows:t.rows,futures:t.futures});
function merge(previous,receipt,raw,now=Date.now()){
 const t=parse(receipt,now),old=F.latestTable(previous,now);
 if(old&&Date.parse(t.retrievedAt)<Date.parse(old.retrievedAt))reject('older_than_snapshot');
 const changed=!old||JSON.stringify(values(t))!==JSON.stringify(values(old));
 if(!changed&&previous.fedwatchUpdate?.status==='ready')return {noChange:true,data:previous,changedFiles:[]};
 const digest=crypto.createHash('sha256').update(raw).digest('hex'),stamp=t.retrievedAt.replace(/[-:.]/g,''),id='cme-full-'+stamp,receiptPath='data/macro/fedwatch-receipt-'+stamp+'.json';
 const data=structuredClone(previous);if(data.sources.some(s=>s.id===id)||data.fedwatchTables.some(s=>s.sourceId===id))reject('duplicate_capture');
 Object.assign(t,{sourceId:id,receiptPath,receiptSha256:digest});
 data.checkedAt=[data.checkedAt,t.retrievedAt.slice(0,10)].sort().at(-1);
 data.sources.push({id,name:'CME FedWatch 完整概率表与联邦基金期货',url:URL,quality:'primary',observedAt:null,publishedAt:null,retrievedAt:t.retrievedAt,evidence:{kind:'browser_dom_table_rows',path:receiptPath,sha256:digest},sha256:digest,retrieval:'browser_dom_excerpt',checkedAt:t.retrievedAt.slice(0,10)});
 data.fedwatchTables.push(t);
 for(const row of t.rows){
  let meeting=data.meetings.find(m=>m.meetingDate===row.meetingDate);if(!meeting){meeting={meetingDate:row.meetingDate,rateUnit:'%',snapshots:[]};data.meetings.push(meeting);}
  meeting.snapshots.push({observedDate:null,observedAt:null,retrievedAt:t.retrievedAt,timezone:'America/Chicago',sourceId:id,quality:'primary',probabilityUnit:'%',ranges:t.columns.flatMap((r,i)=>row.probabilities[i]===null?[]:[{lower:r.lower,upper:r.upper,probability:row.probabilities[i]}]),missingRanges:t.columns.filter((r,i)=>row.probabilities[i]===null).map(r=>({lower:r.lower,upper:r.upper}))});
 }
 data.meetings.sort((a,b)=>a.meetingDate.localeCompare(b.meetingDate));
 data.fedwatchUpdate={status:'ready',attemptedAt:t.retrievedAt,sourceUrl:URL,observedAt:null,retrievedAt:t.retrievedAt,meetingProbabilities:{status:'ready',meetings:t.rows.length,rateRanges:t.columns.length,changed},fundFutures:{status:'ready',contracts:t.futures.length,changed},evidence:{path:receiptPath,sha256:digest},note:'整表源时点未披露；获取时间与源观察时间分开保存。'};
 const errors=G.validate(data);if(errors.length)reject('merged_data_invalid: '+errors.join(';'));
 return {noChange:false,data,receiptPath,digest,meetings:t.rows.length,contracts:t.futures.length,changedFiles:['data/gold-jewelry/macro.json',receiptPath]};
}
function run(root,receiptFile){
 const target=path.join(root,'data/gold-jewelry/macro.json'),raw=fs.readFileSync(receiptFile),receipt=JSON.parse(raw),previous=JSON.parse(fs.readFileSync(target,'utf8')),result=merge(previous,receipt,raw);
 if(!result.noChange){const saved=path.join(root,result.receiptPath);fs.mkdirSync(path.dirname(saved),{recursive:true});if(fs.existsSync(saved)&&!fs.readFileSync(saved).equals(raw))reject('receipt_collision');fs.writeFileSync(saved,raw);const temp=target+'.fedwatch.tmp';fs.writeFileSync(temp,JSON.stringify(result.data,null,2)+'\n');fs.renameSync(temp,target);}
 const {data,...summary}=result;return summary;
}
if(require.main===module){try{const i=process.argv.indexOf('--receipt');if(i<0||!process.argv[i+1])reject('receipt_required');console.log(JSON.stringify(run(path.resolve(__dirname,'..'),process.argv[i+1])));}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;}}
module.exports={parse,merge,run};
