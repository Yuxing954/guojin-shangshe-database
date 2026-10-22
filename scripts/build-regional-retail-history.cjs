// Build a compact, source-linked history from fresh provider receipts and reviewed official rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const pools={江苏:'南京 苏州 无锡 常州 南通 扬州 泰州 镇江 淮安 盐城 宿迁 连云港 徐州',浙江:'杭州 宁波 温州 绍兴 湖州 嘉兴 金华 衢州 舟山 台州 丽水',安徽:'合肥 芜湖 蚌埠 淮南 马鞍山 淮北 铜陵 安庆 黄山 滁州 阜阳 宿州 六安 亳州 池州 宣城',福建:'福州 厦门 泉州 漳州 莆田 三明 南平 龙岩 宁德',广东:'广州 深圳 珠海 汕头 佛山 韶关 湛江 肇庆 江门 茂名 惠州 梅州 汕尾 河源 阳江 清远 东莞 中山 潮州 揭阳 云浮',河南:'郑州 洛阳 开封 平顶山 安阳 鹤壁 新乡 焦作 濮阳 许昌 漯河 三门峡 南阳 商丘 信阳 周口 驻马店',湖北:'武汉 黄石 十堰 宜昌 襄阳 鄂州 荆门 孝感 荆州 黄冈 咸宁 随州 恩施',湖南:'长沙 株洲 湘潭 衡阳 邵阳 岳阳 常德 张家界 益阳 郴州 永州 怀化 娄底 湘西',四川:'成都 自贡 攀枝花 泸州 德阳 绵阳 广元 遂宁 内江 乐山 南充 眉山 宜宾 广安 达州 雅安 巴中 资阳 阿坝 甘孜 凉山',江西:'南昌 景德镇 萍乡 九江 新余 鹰潭 赣州 吉安 宜春 抚州 上饶',山东:'济南 青岛 淄博 枣庄 东营 烟台 潍坊 济宁 泰安 威海 日照 临沂 德州 聊城 滨州 菏泽',陕西:'西安 宝鸡 咸阳 铜川 渭南 延安 榆林 汉中 安康 商洛',广西:'南宁 柳州 桂林 梧州 北海 防城港 钦州 贵港 玉林 百色 贺州 河池 来宾 崇左',云南:'昆明 曲靖 玉溪 保山 昭通 丽江 普洱 临沧 楚雄 红河 文山 西双版纳 大理 德宏 怒江 迪庆'};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function numeric(raw,amount,name=''){if(raw==null||/^[-—\s]*$/.test(String(raw)))return null;const text=String(raw).replace(/,/g,''),n=Number(text.replace(/万亿|亿元?|万元?|元|%|亿/g,''));if(!Number.isFinite(n))return null;if(!amount)return n;if(text.includes('万亿'))return n*10000;if(text.includes('亿')||name.includes('(亿元)'))return n;if(text.includes('万')||name.includes('(万元)'))return n/10000;return n/1e8;}
function build(dir,base,extra,official,start='2021-10',end='2026-09'){
 const regionMap=new Map([...base.regions,...(extra.regions||[])].map(r=>[r.name,r])),sources=[],series=[],ignored=[],conflicts=[];
 for(const [parent,names]of Object.entries(pools))for(const name of names.split(' '))if(!regionMap.has(name))regionMap.set(name,{id:'city-'+hash(parent+name).slice(0,8),name,level:'city',parent});
 const cityNames=[...regionMap.values()].filter(r=>r.level==='city').sort((a,b)=>b.name.length-a.name.length),provinces=base.regions.filter(r=>r.level==='province').sort((a,b)=>b.name.length-a.name.length),used=new Set();
 const original=new Map([...base.observations,...(extra.observations||[])].map(r=>[[r.regionId,r.period,r.basis,r.category,r.scope].join('|'),r]));
 for(const file of fs.readdirSync(dir).filter(x=>/^choice-.*\.json$/.test(x)).sort()){
  const bytes=fs.readFileSync(path.join(dir,file)),receipt=JSON.parse(bytes);let body;try{body=JSON.parse(receipt.response.content[0].text);}catch{ignored.push({file,reason:'non-structured receipt'});continue;}
  if(!body.data?.length){ignored.push({file,reason:'未返回匹配数据'});continue;}
  for(const [i,table]of body.data.entries()){
   const freq=/（月）/.test(table.columns?.[0])?'monthly':/（季）/.test(table.columns?.[0])?'quarterly':null;
   if(!freq){ignored.push({file,sheet:table.sheetName,reason:'年度或未知频率未入库'});continue;}
   const sid='history-choice-'+hash(bytes.toString()+i).slice(0,14),url=table.meta?.jumpUrlList?.[0]?.choiceUrl||null;
   let usedSource=false;
   for(const row of table.items||[]){
    const name=row[0]||'';
    if(!/社会消费品零售(?:总额|额)/.test(name)||/限额|限上|限下|城镇|乡村|农村|市区|市辖区|商品零售|零售业|餐饮|网上|网络|电商/.test(name)){ignored.push({file,name,reason:'非全市全口径总额'});continue;}
    const aliases={'恩施土家族苗族自治州':'恩施州','湘西土家族苗族自治州':'湘西州','大理白族自治州':'大理州','文山壮族苗族自治州':'文山州','红河哈尼族彝族自治州':'红河州','楚雄彝族自治州':'楚雄州','西双版纳傣族自治州':'西双版纳州','德宏傣族景颇族自治州':'德宏州','怒江傈僳族自治州':'怒江州','迪庆藏族自治州':'迪庆州','凉山彝族自治州':'凉山州','阿坝藏族羌族自治州':'阿坝州','甘孜藏族自治州':'甘孜州'};
    let geoName=name.replace(/:全市社会消费品/g,':社会消费品');for(const [raw,canonical]of Object.entries(aliases))geoName=geoName.replaceAll(raw,canonical);geoName=geoName.replace(/维吾尔|壮族|回族/g,'');
    const match=r=>new RegExp('(?:^|[:：])'+r.name+'(?:省|市|州|自治区|自治州)?(?=[:：]|$)').test(geoName),city=cityNames.find(match);
    let province=provinces.find(match),prefix=geoName.split('社会消费品')[0];
    for(const r of provinces)prefix=prefix.replaceAll(r.name,'');
    prefix=prefix.replace(/全省|全市|全国|中国|自治区|自治州|省|市|[:：\s]/g,'');
    // An unknown lower-level city must never fall back to its province.
    const region=city||(!prefix?province:null),tokens=geoName.split(/[:：]/),geos=[...cityNames,...provinces];
    const validName=tokens.every(token=>geos.some(r=>new RegExp('^'+r.name+'(?:省|市|州|自治区|自治州)?$').test(token))||/^(?:社会消费品零售(?:总额|额)(?:\([^)]*\))?|全省|全市|全州|全州合计|全市总计|全省总计|总计|合计|累计值(?:\([^)]*\))?|当月值(?:\([^)]*\))?|累计同比(?:\([^)]*\))?|当月同比(?:\([^)]*\))?)$/.test(token));
    const basis=name.includes('累计')?'ytd':name.includes('当月')?'month':null,field=/同比/.test(name)?'yoy':/累计值|当月值/.test(name)?'amount':null;
    if(!region||!basis||!field||!validName){ignored.push({file,name,reason:'地区、全口径总额或累计/当月语义不明确'});continue;}
    const points=[];
    for(let j=2;j<table.columns.length;j++){
     const p=table.columns[j].replace(/^(\d{4})-Q([1-4])$/,(_,y,q)=>y+'-'+String(Number(q)*3).padStart(2,'0'));if(!/^\d{4}-\d{2}$/.test(p)||p<start||p>end)continue;
     const value=numeric(row[j],field==='amount',name);if(value===null)continue;if((field==='yoy'&&value<=-100)||(field==='amount'&&value<0)){ignored.push({file,name,period:p,reason:'数值越界'});continue;}
     const key=[region.id,p,basis,'社零总额','全口径'].join('|'),old=original.get(key),tolerance=field==='yoy'?.06:Math.max(.06,Math.abs(value)*.0005);
     if(old?.disputed?.[field]){conflicts.push({regionId:region.id,period:p,basis,field,existing:null,incoming:value,sourceId:sid,reason:'原有争议字段继续留空，需原始披露核验'});continue;}
     if(old&&finite(old[field])&&old.provenance?.[field]?.priority<100&&Math.abs(old[field]-value)>tolerance){conflicts.push({regionId:region.id,period:p,basis,field,existing:old[field],incoming:value,sourceId:sid,reason:'与已有转引值超出精度容差，本轮不覆盖'});continue;}
     points.push([p,field==='amount'?value:null,field==='yoy'?value:null,String(row[j])]);
    }
    if(points.length){series.push({regionId:region.id,category:'社零总额',scope:'全口径',basis,sourceId:sid,field,originalName:name,originalFrequency:freq,rawUnit:field==='amount'?'元（回执中文量级已换为亿元）':'%',priority:20,points});used.add(region.name);usedSource=true;}
   }
   if(usedSource)sources.push({id:sid,name:table.sheetName,publisher:[...new Set(table.items.map(r=>r[1]))].join('、'),provider:'东方财富Choice / 妙想',quality:'secondary',url,releaseDate:null,publishedAt:null,retrievedAt:receipt.retrievedAt,receiptSha256:hash(bytes),query:receipt.query,locator:table.sheetName,note:'金额保留回执显示精度，未据舍入金额重算官方同比；表级候选代码不按行序分配。'});
  }
 }
 // Multiple provider rows for the same cell may disagree. Do not choose one by return order.
 const cells=new Map();
 for(const s of series)for(const point of s.points){const field=s.field,key=[s.regionId,point[0],s.basis,field].join('|'),i=field==='amount'?1:2,previous=cells.get(key);if(!previous){cells.set(key,{value:point[i],refs:[[point,i]],sourceIds:[s.sourceId],disputed:false});continue;}const tolerance=field==='yoy'?.06:Math.max(.06,Math.abs(point[i])*.0005);if(Math.abs(previous.value-point[i])>tolerance){previous.disputed=true;conflicts.push({regionId:s.regionId,period:point[0],basis:s.basis,field,existing:previous.value,incoming:point[i],sourceIds:[...previous.sourceIds,s.sourceId],reason:'本次转引序列之间存在差异，该字段不入库，待官方核验'});}previous.refs.push([point,i]);previous.sourceIds.push(s.sourceId);}
 for(const cell of cells.values())if(cell.disputed)for(const [point,i]of cell.refs)point[i]=null;
 for(const s of series)s.points=s.points.filter(p=>finite(p[1])||finite(p[2]));
 const groups=new Map();
 for(const r of official.observations){if(r.period<start||r.period>end)continue;const p=r.provenance.amount||r.provenance.yoy,key=[r.regionId,r.basis,r.category,r.scope,r.dimension].join('|');if(!groups.has(key))groups.set(key,{regionId:r.regionId,category:r.category,scope:r.scope,dimension:r.dimension,basis:r.basis,pointSources:true,originalName:r.category,originalFrequency:'monthly',rawUnit:p.rawUnit||'原表',priority:120,points:[]});groups.get(key).points.push([r.period,r.amount,r.yoy,p.sourceId,p.originalName,p.locator]);}
 series.push(...groups.values());sources.push(...official.sources);for(const r of base.regions.filter(r=>r.municipality))used.add(r.name);
 const updatedAt=sources.map(s=>s.retrievedAt).filter(Boolean).sort().at(-1);
 return {schemaVersion:2,updatedAt,historyStart:start,targetPeriod:end,regions:[...regionMap.values()].filter(r=>used.has(r.name)),sources,series,importAudit:{receiptCount:fs.readdirSync(dir).filter(x=>/^choice-.*\.json$/.test(x)).length,officialSources:official.sources.length,ignored,conflicts},notes:['历史查询范围2021年10月至2026年9月；实际覆盖与最新发布月份分别按地区、口径保留。原有快照不删改。','北京55个发布期至2026-09，上海54个发布期至2026-08。每年1月未独立发布不构造；上海2022—2024年2月原表提供真实单月值，保留为当月，其他合并期单列。','早期原表以吃、穿、用、烧等全口径用途为主；北京2026、上海2025起提供限上细品类。按所选期实际可用拆解维度切换，不跨口径拼接。','所有贡献和剔除后同比用本期金额及官方同比反推可比基数，标为测算；全口径分组与限上商品不混合求和。','省级与城市比较仅使用相同期间、相同当月/累计口径；季度数据只放在季度末，不能填入其他月份。省份不代替城市，直辖市只计一次。','Choice实际返回年度、限上、城乡或市区序列均在审计中排除；未给累计或当月语义的同比不猜测使用。未知发布日期留空。','北京网页日期元数据部分早于报告期结束，未采用异常日期作为发布日期。源URL、附件URL、哈希及原始日期分别保留。','分类、统计范围或基数变化按原文保留。2026年产业活动单位在地统计与此前口径不强行改成同一可比金额序列。','消费全景独立页面退役，核心宏观复用的原始数据和历史仍保留。']};
}
if(require.main===module){
 const [dir,officialFile,target='data/regional-retail/history.json']=process.argv.slice(2);if(!dir||!officialFile)throw Error('Usage: node scripts/build-regional-retail-history.cjs <fresh-receipts> <official-normalized.json> [output.json]');
 const base=JSON.parse(fs.readFileSync('data/regional-retail/observations.json')),extra=JSON.parse(fs.readFileSync('data/regional-retail/tier-supplement.json')),result=build(dir,base,extra,JSON.parse(fs.readFileSync(officialFile))),M=require('./regional-retail-model.js'),T=require('./regional-retail-tier-model.js'),all=T.merge(T.merge(base,extra),M.expandHistory(result));
 result.coverage=all.regions.map(r=>{const rows=all.observations.filter(o=>o.regionId===r.id&&o.category==='社零总额'&&o.scope==='全口径'&&o.basis==='ytd').sort((a,b)=>a.period.localeCompare(b.period)),amount=rows.filter(o=>finite(o.amount)),yoy=rows.filter(o=>finite(o.yoy)),periods=new Set(rows.filter(o=>finite(o.amount)||finite(o.yoy)).map(o=>o.period)),frequency=periods.size&&[...periods].every(p=>Number(p.slice(5))%3===0)?'quarterly':'monthly',expected=M.calendar(result.historyStart,result.targetPeriod,frequency).filter(p=>frequency==='quarterly'||!p.endsWith('-01'));
  return {regionId:r.id,name:r.name,level:r.level,start:rows[0]?.period||null,latestAmount:amount.at(-1)?.period||null,latestYoy:yoy.at(-1)?.period||null,amountCount:amount.length,yoyCount:yoy.length,observedFrequency:frequency,missingPeriods:expected.filter(p=>!periods.has(p)),reason:periods.size?'本次未取得月份或字段不补值；季末数据不填到其他月份':'未取得匹配的月季全口径序列'};
 });
 fs.writeFileSync(target,JSON.stringify(result)+'\n');console.log(JSON.stringify({regions:result.regions.length,sources:result.sources.length,series:result.series.length,points:result.series.reduce((s,r)=>s+r.points.length,0),receipts:result.importAudit.receiptCount,conflicts:result.importAudit.conflicts.length,citiesWithData:result.coverage.filter(r=>r.level==='city'&&(r.amountCount||r.yoyCount)).length}));
}
module.exports={build,numeric,pools};
