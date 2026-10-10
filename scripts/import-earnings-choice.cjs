'use strict';
const fs = require('node:fs');
const path = require('node:path');
const M = require('./earnings-calendar-model.js');
const D = require('./site-data.js');
const ROOT = path.resolve(__dirname, '..');
const FIELDS = {'定期报告实际披露日期':'actual', '定期报告预计披露日期':'expected'};
const INDICATORS = {actual:['100000000007105','100000000051385'], expected:['100000000007104','100000000051384']};
function security(value) { return M.code(String(value || '').match(/([\d]{1,6}\.(?:SH|SZ|HK)|[A-Z]+\.O)/)?.[1]); }
function period(value) {
  const match = String(value || '').match(/(20\d{2})年?(中报|半年报|一季报|二季报|三季报|四季报|年报)/);
  return match ? match[1]+({中报:'H1',半年报:'H1',一季报:'Q1',二季报:'Q2',三季报:'Q3',四季报:'Q4',年报:'FY'}[match[2]]) : '';
}
function date(value) {
  if (value == null || ['', '-', '—', '暂无数据', '待公布'].includes(value)) return '';
  if (!M.validDate(value)) throw Error('Invalid Choice disclosure date');
  return value;
}
function fromChoice(receipts, pool, previous) {
  if (receipts.version !== 1 || receipts.provider !== 'choice-mcp' || !Array.isArray(receipts.envelopes)) throw Error('Invalid Choice receipts');
  const companies = new Map(pool.map(c => [M.code(c.code), c]));
  const records = new Map();
  let checkedAt = '';
  receipts.envelopes.forEach((envelope, ei) => {
    if (!Number.isFinite(Date.parse(envelope.checkedAt)) || !envelope.query || !['mx_ashare_finance_data','mx_hk_finance_data','mx_us_finance_data'].includes(envelope.tool)) throw Error('Invalid MCP query evidence');
    if (envelope.checkedAt > checkedAt) checkedAt = envelope.checkedAt;
    if (!Array.isArray(envelope.data)) throw Error('Invalid MCP tables');
    envelope.data.forEach((table, ti) => {
      if (!Array.isArray(table.columns) || !Array.isArray(table.items)) throw Error('Invalid Choice table');
      const first = table.columns[0], firstCode = security(first), firstPeriod = period(first), firstField = FIELDS[first];
      table.items.forEach((row, ri) => {
        const field = firstField || FIELDS[row[0]];
        if (!field) return; // Never substitute the database's actual-update date for disclosure.
        row.slice(1).forEach((value, offset) => {
          const ci = offset+1;
          const code = firstCode || (firstPeriod ? security(table.columns[ci]) : security(row[0]));
          const reportPeriod = firstPeriod || period(table.columns[ci]);
          if (!code || !reportPeriod || !companies.has(code)) throw Error('Unmapped Choice company/report period');
          // The returned column controls the period. A 2025 response to a 2026 query stays 2025.
          if (Number(reportPeriod.slice(0,4)) < Number(envelope.checkedAt.slice(0,4))-1) return;
          const reportEnd=reportPeriod.slice(0,4)+'-'+({FY:'12-31',H1:'06-30',Q1:'03-31',Q2:'06-30',Q3:'09-30',Q4:'12-31'}[M.reportType(reportPeriod)]);
          const indicator=INDICATORS[field][/\.(SH|SZ)$/.test(code)?0:1];
          const links = (table.meta?.jumpUrlList || []).map(x=>x.choiceUrl).filter(v=>{
            try { const u=new URL(v); return u.protocol==='em:' && u.hostname==='stockdatacenter' && (u.searchParams.get('code')||'').split(',').map(M.code).includes(code) && (u.searchParams.get('indId')||'').split(',').includes(indicator+'|100:'+reportEnd); } catch { return false; }
          });
          const parsed = date(value);
          if (parsed && !links.length) throw Error('Missing Choice indicator evidence');
          const id = code+'|'+reportPeriod+'|formal';
          let record = records.get(id);
          if (!record) {record={id,code,period:reportPeriod,kind:'formal',documentType:'report',title:companies.get(code).name+' '+reportPeriod,expected:'',actual:'',announcementDate:'',url:'',linkType:'',sourceId:'choice-mcp',updatedAt:envelope.checkedAt,reservations:[],history:[],evidence:{receiptFile:'data/earnings-choice-receipts.json',cells:[]}}; records.set(id,record);}
          const priorCell = record.evidence.cells.find(c=>c.field===field);
          if (priorCell && record[field]!==parsed) throw Error('Conflicting Choice cells: '+id+' '+field);
          record[field]=parsed;
          if (envelope.checkedAt>record.updatedAt) record.updatedAt=envelope.checkedAt;
          record.evidence.cells.push({field,indicator:FIELD_NAME(field),indicatorId:indicator,envelope:ei,table:ti,row:ri,column:ci,value,query:envelope.query,tool:envelope.tool,checkedAt:envelope.checkedAt,columns:table.columns,rowValues:row,choiceUrls:links});
        });
      });
    });
  });
  if (!records.size) throw Error('Empty Choice result; preserve previous snapshot');
  // Keep previously verified original documents and date-change history, independent of Choice date fields.
  for (const r of records.values()) {
    const old = previous?.records?.find(x=>x.id===r.id);
    if (old) {
      if(previous.primarySource==='choice-mcp')for(const field of ['expected','actual'])if(!r.evidence.cells.some(c=>c.field===field)){r[field]=old[field]||'';r.evidence.cells.push(...(old.evidence?.cells||[]).filter(c=>c.field===field));}
      r.history=[...(old.history||[])];
      for (const field of ['expected','actual']) if ((old[field]||'')!==(r[field]||'')) r.history.push({field,from:old[field]||'',to:r[field]||'',observedAt:r.updatedAt,sourceId:r.sourceId,previousSourceId:old.sourceId});
      if (old.url) { for(const key of ['url','linkType','title','documentType','announcementDate','announcementPublishedAt']) if(old[key])r[key]=old[key]; r.announcementSourceId=old.announcementSourceId||old.sourceId; r.originalEvidence=old.originalEvidence||old.evidence; }
      r.reservations=old.reservations||[];
    }
  }
  const sources = [{id:'choice-mcp',label:'Choice MCP · 东方财富',url:'https://choice.eastmoney.com/',checkedAt,note:'定期报告实际/预计披露日期；保留MCP回执与Choice指标标识'},...(previous?.sources||[]).filter(s=>s.id!=='choice-mcp')];
  return M.validateSnapshot({version:2,primarySource:'choice-mcp',updatedAt:checkedAt,sources,records:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id))});
}
function FIELD_NAME(field) {return Object.keys(FIELDS).find(k=>FIELDS[k]===field);}
function mergeChoice(previous, incoming) {
  M.validateSnapshot(incoming);
  if (incoming.primarySource!=='choice-mcp' || incoming.records.some(r=>r.sourceId!=='choice-mcp')) throw Error('Choice is required for active dates');
  const records=new Map((previous?.primarySource==='choice-mcp'?previous.records:[]).map(r=>[r.id,r]));
  for (const r of incoming.records) {
    const old=records.get(r.id);
    if (old?.actual&&!r.actual) throw Error('Refuse to erase actual disclosure: '+r.id);
    records.set(r.id,r);
  }
  return M.validateSnapshot({...incoming,records:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id))});
}
function main() {
  const input=process.argv[2]; if(!input)throw Error('Usage: node scripts/import-earnings-choice.cjs receipts.json');
  const receipts=JSON.parse(fs.readFileSync(input,'utf8'));
  const file=path.join(ROOT,'data/earnings-calendar.json'),previous=JSON.parse(fs.readFileSync(file,'utf8'));
  const pool=JSON.parse(fs.readFileSync(path.join(ROOT,'data/coverage-companies.json'),'utf8')).companies;
  const next=mergeChoice(previous,fromChoice(receipts,pool,previous));
  fs.writeFileSync(file+'.tmp',JSON.stringify(next,null,2)+'\n');fs.renameSync(file+'.tmp',file);
  console.log('Choice earnings: '+next.records.length+' records');
}
module.exports={security,period,fromChoice,mergeChoice};
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
