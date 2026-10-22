// Import fresh connector receipts and reviewed official records. Never fabricates missing periods.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const provinceNames='北京 天津 河北 山西 内蒙古 辽宁 吉林 黑龙江 上海 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 广西 海南 重庆 四川 贵州 云南 西藏 陕西 甘肃 青海 宁夏 新疆'.split(' ');
const cityNames='广州 深圳 成都 杭州 武汉 南京 苏州 西安 郑州 长沙 合肥 青岛 宁波 厦门 济南 福州 沈阳 大连 昆明 南宁 贵阳 南昌 石家庄 太原 长春 哈尔滨 呼和浩特 海口 兰州 西宁 银川 乌鲁木齐 拉萨'.split(' ');
const parents='广东 广东 四川 浙江 湖北 江苏 江苏 陕西 河南 湖南 安徽 山东 浙江 福建 山东 福建 辽宁 辽宁 云南 广西 贵州 江西 河北 山西 吉林 黑龙江 内蒙古 海南 甘肃 青海 宁夏 新疆 西藏'.split(' ');
const regions=[...provinceNames.map((name,i)=>({id:'p'+i,name,level:'province',municipality:['北京','天津','上海','重庆'].includes(name)})),...cityNames.map((name,i)=>({id:'c'+i,name,level:'city',parent:parents[i]}))];
const registry=[...regions.filter(x=>x.level==='city'),...regions.filter(x=>x.level==='province')];
function geography(name){return registry.find(r=>name.includes(r.name));}
function numeric(raw,amount=false,name=''){if(raw==null||/^[-—\s]*$/.test(String(raw)))return null;const v=Number(String(raw).replace(/,/g,'').replace(/(?:万亿|亿元?|万元?|元|%|亿)/g,''));if(!Number.isFinite(v))return null;if(!amount)return v;const text=String(raw);if(text.includes('万亿'))return v*10000;if(text.includes('亿'))return v;if(text.includes('万'))return v/10000;if(name.includes('(亿元)'))return v;if(name.includes('(万元)'))return v/10000;if(name.includes('(元)'))return v/1e8;return null;}
function period(s){if(/^\d{4}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{4})-Q([1-4])$/);return m?m[1]+'-'+String(+m[2]*3).padStart(2,'0'):null;}
function build(dir,officialPaths=[],existing=null){
 const observations=new Map(),sources=[],sourceMap=new Map(),conflicts=[],ignored=[];
 function source(s){const record={...s};delete record.file;if(record.releaseDate)record.publishedAt=record.releaseDate;if(!sourceMap.has(record.id)){sourceMap.set(record.id,record);sources.push(record)}return record.id}
 function put(r,field,value,provenance,priority){
  if(value==null)return;const key=[r.regionId,r.period,r.basis,r.category,r.scope].join('|');
  const row=observations.get(key)||{...r,amount:null,yoy:null,provenance:{}};const old=row.provenance[field];
  if(old&&Math.abs(row[field]-value)>Math.max(field==='yoy'?0.06:0.06,Math.abs(value)*0.0005))conflicts.push({key,field,retained:old.priority>=priority?row[field]:value,other:old.priority>=priority?value:row[field],sourceIds:[old.sourceId,provenance.sourceId],reason:'来源精度或修订差异；官方原始披露优先，未用舍入金额重算同比'});
  if(!old||priority>old.priority){row[field]=value;row.provenance[field]={...provenance,priority};} observations.set(key,row);
 }
 for(const file of fs.readdirSync(dir).filter(x=>/^choice.*\.json$/.test(x)).sort()){
  const receipt=fs.readFileSync(path.join(dir,file),'utf8'),d=JSON.parse(receipt);let body;try{body=JSON.parse(d.response.content[0].text)}catch{ignored.push({file,reason:'非结构化或无数据回执'});continue;}
  for(const [ti,t] of (body.data||[]).entries()){
   if(!/（月）|（季）/.test(t.columns?.[0]||'')){ignored.push({file,sheet:t.sheetName,reason:'年度或非月季数据不混入月度累计'});continue;}
   const id='choice-'+hash(receipt+ti).slice(0,16),codes=(t.meta?.jumpUrlList||[]).flatMap(x=>{try{return new URL((x.choiceUrl||'').split('#')[1]?'https://choice.invalid/'+x.choiceUrl.split('#')[1]:x.choiceUrl).searchParams.get('macroids')?.split(',')||[]}catch{return []}});
   source({id,name:t.sheetName,publisher:[...new Set((t.items||[]).map(x=>x[1]))].join('、'),provider:'东方财富 Choice / 妙想 MCP',quality:'secondary',url:t.meta?.jumpUrlList?.[0]?.choiceUrl||null,retrievedAt:d.retrievedAt,releaseDate:null,receiptSha256:hash(receipt),codeCandidates:codes,codeMapping:'表级候选代码，不按行序配对',query:d.query});
   for(const row of t.items||[]){
    const name=row[0]||'',geo=geography(name);
    if(!geo||!name.includes('社会消费品零售')||/限额|城镇|乡村|农村|剔除|不含汽车|除汽车/.test(name)){ignored.push({file,name,reason:'地区或全口径总量不匹配'});continue;}
    let basis=name.includes('累计')?'ytd':name.includes('当月')?'month':null;
    const field=/同比/.test(name)?'yoy':/累计值|当月值/.test(name)?'amount':null;
    if(!basis||!field){ignored.push({file,name,reason:'当月或累计语义不明确，不推测'});continue;}
    for(let i=2;i<t.columns.length;i++){const p=period(t.columns[i]);if(!p)continue;const value=numeric(row[i],field==='amount',name);put({regionId:geo.id,period:p,basis,category:'社零总额',scope:'全口径'},field,value,{sourceId:id,originalName:name,publisher:row[1],raw:row[i],frequency:/（季）/.test(t.columns[0])?'quarterly':'monthly',precision:field==='amount'?'接口显示金额，可能舍入':'来源原值'},row[1]==='国家统计局'?10:11);}
   }
  }
 }
 for(const officialPath of officialPaths){
  const d=JSON.parse(fs.readFileSync(officialPath,'utf8'));for(const s of d.sources||[])source(s);
  for(const r of d.records||[]){const geo=geography(r.region);if(!geo)throw Error('Unknown geography '+r.region);let category=r.category==='社会消费品零售总额'?'社零总额':r.category;
   for(const basis of ['month','ytd','combined']){const valueKey=basis+'Value',yoyKey=basis+'Yoy';if(r[valueKey]==null&&r[yoyKey]==null)continue;const scope=r.scope||(category==='社零总额'||['商品零售','餐饮收入'].includes(category)?'全口径':'限额以上');
    const spec={regionId:geo.id,period:r.period,basis,category,scope},provenance={sourceId:r.sourceId,originalName:r.category,locator:r.locator,frequency:'monthly',rawUnit:r.unit||'亿元',precision:'官方原表精度'};
    put(spec,'amount',r[valueKey],provenance,100);put(spec,'yoy',r[yoyKey],provenance,100);
   }
  }
 }
 // Conflicting secondary values are unavailable until checked against the original disclosure.
 for(const conflict of conflicts){const row=observations.get(conflict.key);if(row&&row.provenance[conflict.field].priority<100){row.disputed=row.disputed||{};row.disputed[conflict.field]=true;row[conflict.field]=null;}}
 if(existing){for(const s of existing.sources||[])source(s);for(const old of existing.observations||[]){const key=[old.regionId,old.period,old.basis,old.category,old.scope].join('|'),current=observations.get(key);if(!current)observations.set(key,old);else for(const f of ['amount','yoy']){if(current[f]==null&&!current.disputed?.[f]&&old[f]!=null){current[f]=old[f];current.provenance[f]=old.provenance[f];}else if(old[f]!=null&&old.provenance?.[f]?.priority===100&&current.provenance?.[f]?.priority<100){current[f]=old[f];current.provenance[f]=old.provenance[f];}}}}
 const rows=[...observations.values()].sort((a,b)=>a.regionId.localeCompare(b.regionId)||a.period.localeCompare(b.period)||a.basis.localeCompare(b.basis)||a.category.localeCompare(b.category,'zh-CN'));
 const targetPeriod=rows.map(r=>r.period).sort().at(-1)||existing?.targetPeriod||'2026-09';
 const gaps=regions.map(r=>{const rr=rows.filter(x=>x.regionId===r.id&&x.category==='社零总额'&&x.basis==='ytd');return {regionId:r.id,name:r.name,latestAmount:rr.filter(x=>x.amount!=null).at(-1)?.period||null,latestYoy:rr.filter(x=>x.yoy!=null).at(-1)?.period||null,amountCount:rr.filter(x=>x.amount!=null).length,yoyCount:rr.filter(x=>x.yoy!=null).length,targetPeriod,status:rr.some(x=>x.period==='2026-09'&&x.amount!=null&&x.yoy!=null)?'current':rr.length?'partial':'no_results',reason:rr.length?'未取得的月份或字段留空；不将累计同比替代单月同比':'本次接口未返回匹配的月季序列；年度、限上或城乡子口径未代填'};});
 return {schemaVersion:1,updatedAt:process.env.REGIONAL_RETAIL_CHECKED_AT||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),targetPeriod,historyStart:'2024-01',regions,observations:rows,sources,coverage:gaps,conflicts,importAudit:{ignored,receipts:fs.readdirSync(dir).filter(x=>/^choice.*\.json$/.test(x)).length},notes:['地方社零为名义金额；单位统一为亿元，同比为%。省级与城市级分开展示，四个直辖市可在城市视图查看。','只比较所选同一统计期及同一当月/累计口径；最新期未取得不沿用旧值填入。1—2月合并值单独保留，不拆为1月或2月。','Choice保留接口显示精度；万亿/亿/元按单位换算，原始文本和表级候选代码保留，未按返回顺序猜代码。接口未给发布日期时留空。','2026年部分地区改用产业活动单位在地统计；限上企业范围也会变化。同比保留官方可比口径，不用历年已公布金额重算。','品类增量、贡献、剔除后增速由本期金额和官方同比反推可比基数，均标测算。限上11类以外残差还包括未列商品及餐饮，不能解释为全体限额以下。','广州原文商品分类未明确给出限上统计范围，保留原文口径，未与限上同名品类强行合并。上海餐费收入在限上商品表内，保留限上口径，不作为全口径餐饮。','北京附件页面日期元数据与报告期冲突，发布日期留空；附件命名日期和网页原始元数据分别留存。','31省级地区及33个非直辖重点城市为本次查询范围，覆盖状态不代表各地均已取得2026年9月完整数据。']};
}
if(require.main===module){const [dir,...official]=process.argv.slice(2);if(!dir)throw Error('Usage: node scripts/import-regional-retail.cjs <fresh-receipts-dir> <reviewed-official.json> ...');const target='data/regional-retail/observations.json';const previous=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):null;const d=build(dir,official,previous);fs.mkdirSync('data/regional-retail',{recursive:true});fs.writeFileSync('data/regional-retail/observations.json',JSON.stringify(d)+'\n');console.log(JSON.stringify({regions:d.regions.length,observations:d.observations.length,sources:d.sources.length,provincesWithData:d.coverage.filter(x=>x.regionId.startsWith('p')&&x.status!=='no_results').length,citiesWithData:d.coverage.filter(x=>x.regionId.startsWith('c')&&x.status!=='no_results').length,current:d.coverage.filter(x=>x.status==='current').length,conflicts:d.conflicts.length},null,2));}
module.exports={build,numeric,period,regions};

