const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../scripts/consumption-macro-model.js'),data=require('../data/consumption-macro/observations.json');
test('expanded consumption history preserves units, combined months, annual originals and field gaps',()=>{
  const feed=require('../data/macro/automatic-series.json'),d=M.mergeAutomatic(data,feed);
  assert.equal(d.indicators.filter(i=>i.status==='pending').length,1);
  const confidence=M.records(d,'confidence');assert.equal(confidence.length,128);assert.equal(confidence[0].period,'2016-01');assert.equal(confidence.at(-1).value,89.5);assert.ok(confidence.every(r=>r.yoy===null));
  const food=M.records(d,'category_0',{frequency:'monthly',basis:'month'});assert.equal(food.find(r=>r.period==='2016-02').basis,'jan_feb');assert.equal(food.some(r=>r.period.endsWith('-01')),false);
  const makeup=M.records(d,'category_4',{frequency:'monthly',basis:'month'});assert.ok(makeup.length>=107);assert.equal(makeup.find(r=>r.period==='2025-04').value,309);assert.equal(makeup.find(r=>r.period==='2025-04').yoy,7.2);
  assert.ok(M.scopeCoverage(d,'category_4').yoyMissing>0);assert.equal(M.scopeCoverage(d,'cpi').valueMissing,0);
  const sports=M.records(d,'category_7',{frequency:'monthly',basis:'ytd'});assert.equal(sports[0].period,'2016-02');assert.equal(M.latest(d,'category_7','annual').period,'2025');
  const annual=M.records(d,'income_urban',{frequency:'annual',basis:'year'});assert.equal(annual[0].period,'2016');assert.match(annual[0].note,/年末累计/);assert.equal(annual.find(r=>r.period==='2025').value,56502);
  assert.equal(M.latest(d,'service_retail','annual').period,'2025');assert.equal(M.records(d,'cpi',{frequency:'annual'}).some(r=>r.period==='2016'),false);
  const breakdown=M.retailBreakdown(d,{basis:'year',period:'2017'});assert.equal(breakdown.reference.frequency,'annual');assert.ok(breakdown.items.filter(x=>x.row).length>=15);
  const holiday=M.latest(d,'holiday_2026_national_trips');assert.equal(holiday.value,8.26);assert.equal(holiday.yoy,null);assert.match(holiday.note,/日均同比/);
});
test('quarter and annual gaps break lines and a separately disclosed year is not a missing Q4',()=>{
  const d=structuredClone(data),row=M.records(d,'income_national',{frequency:'quarterly',basis:'ytd'})[0];
  assert.equal(M.segments([{...row,period:'2024-Q1',endDate:'2024-03-31'},{...row,period:'2024-Q3',endDate:'2024-09-30'}]).length,2);
  assert.equal(M.segments([{...row,frequency:'annual',basis:'year',period:'2022',endDate:'2022-12-31'},{...row,frequency:'annual',basis:'year',period:'2024',endDate:'2024-12-31'}]).length,2);
  const coverage=M.scopeCoverage(d,'income_national',{frequency:'quarterly',basis:'ytd'});assert.ok(coverage.structuralPeriods.includes('2024-Q4'));assert.ok(!coverage.missingPeriods.includes('2024-Q4'));
});
test('duplicate, future and unreviewed frequency overrides reject the supplemental feed',()=>{
  for(const mutate of [f=>f.series['consumer-confidence'].observations.push({...f.series['consumer-confidence'].observations[0]}),f=>f.series['consumer-confidence'].observations[0].period='2099-01',f=>f.series['consumer-confidence'].observations[0].frequency='annual',f=>f.series['consumer-confidence'].observations[0].value=201]){
    const feed=structuredClone(require('../data/macro/automatic-series.json'));mutate(feed);assert.throws(()=>M.mergeAutomatic(data,feed));
  }
});
test('failure of one field is retained when another field refresh succeeds and CSV attributes both',()=>{
  const feed=structuredClone(require('../data/macro/automatic-series.json'));feed.series['consumer-retail'].status='error';
  const d=M.mergeAutomatic(data,feed);assert.equal(d.indicators.find(i=>i.id==='retail').updateStatus,'error');
  const r=M.records(d,'retail',{frequency:'monthly',basis:'month'}).find(r=>r.period==='2016-03');assert.ok(r.fieldSources.value&&r.fieldSources.yoy);assert.notEqual(r.fieldSources.value,r.fieldSources.yoy);assert.match(M.csv(d,[r]),/数值来源/);
});
test('shared automatic history fills real gaps, preserves exact amounts and dates, attributes supplementary fields',()=>{
  const auto=require('../data/macro/automatic-series.json'),merged=M.mergeAutomatic(data,auto);
  assert.ok(M.records(merged,'cpi',{frequency:'monthly',basis:'month'}).length>=128);
  assert.ok(M.records(merged,'cpi').find(r=>r.period==='2025-02'));
  const missing=M.records(merged,'retail',{frequency:'monthly',basis:'month'}).find(r=>r.period==='2025-04');
  assert.ok(M.finite(missing.value));assert.equal(missing.yoy,5.1);assert.equal(missing.value,37174);assert.match(M.csv(merged,[missing]),/2025-05-19/);
  const verified=M.records(merged,'retail',{frequency:'monthly',basis:'month'}).find(r=>r.period==='2026-08');assert.equal(verified.value,39824);assert.equal(merged.sources.find(s=>s.id===verified.sourceId).publishedAt,'2026-09-15');
  const historical=M.records(merged,'cpi').find(r=>r.period==='2016-01');assert.equal(merged.sources.find(s=>s.id===historical.sourceId).publishedAt,null);
  assert.equal(M.records(data,'retail').some(r=>r.period==='2025-04'),true);
  assert.ok(M.important.every(id=>merged.indicators.some(i=>i.id===id)));assert.equal(M.important.length,8);
});
test('unapproved, wrong units and wrong frequency automatic records fail closed',()=>{
  const auto=require('../data/macro/automatic-series.json');
  for(const mutate of [d=>d.publicRedistributionApproved=false,d=>d.series['consumer-cpi'].spec.unit='元',d=>d.series['consumer-cpi'].observations[0].period='2016-Q1',d=>d.series['consumer-cpi'].sourceUrl='https://choicew2z.eastmoney.com.evil.example/']){
    const bad=structuredClone(auto);mutate(bad);assert.throws(()=>M.mergeAutomatic(data,bad));
  }
});
test('official source integrity and independent release dates',()=>{assert.deepEqual(M.validate(data),[]);assert.equal(data.indicators.filter(i=>i.status==='connected').length,48);assert.equal(data.indicators.filter(i=>i.status==='pending').length,2);assert.equal(M.latest(data,'retail').value,39824);assert.equal(M.latest(data,'retail').yoy,.4);assert.equal(M.latest(data,'core_cpi').value,1);assert.equal(M.latest(data,'income_national').value,22981);assert.equal(data.sources.find(s=>s.id==='household-2026-Q2').publishedAt,'2026-07-15');});
test('frequency filters never replace annual values with monthly or quarterly values',()=>{assert.equal(M.latest(data,'retail','annual').period,'2025');assert.equal(M.latest(data,'retail','monthly').period,'2026-08');assert.equal(M.latest(data,'income_national','quarterly').basis,'ytd');assert.equal(M.latest(data,'income_national','monthly'),null);assert.ok(M.directory(data,{frequency:'quarterly'}).every(i=>M.records(data,i.id,{frequency:'quarterly'}).length));});
test('Jan-Feb combined records, missing months and cumulative resets are not interpolated',()=>{const rows=M.records(data,'retail',{frequency:'monthly',basis:'month'});assert.ok(!rows.some(r=>r.period.endsWith('-01')));assert.ok(rows.find(r=>r.period==='2026-02').basis==='jan_feb');assert.equal(rows.find(r=>r.period==='2025-04').value,37174);const parts=M.segments(rows.filter(r=>r.period!=='2025-04'));assert.ok(!parts.some(part=>part.some(r=>r.period==='2025-03')&&part.some(r=>r.period==='2025-05')));const ytd=M.segments(M.records(data,'retail',{frequency:'monthly',basis:'ytd'}));assert.ok(ytd.every(part=>new Set(part.map(r=>r.period.slice(0,4))).size===1));});
test('new and legacy online retail definitions remain separate',()=>{assert.ok(M.records(data,'online_total').every(r=>r.period.startsWith('2026')));assert.ok(M.records(data,'online_total_legacy').every(r=>!r.period.startsWith('2026')));assert.equal(M.latest(data,'online_goods').basis,'ytd');assert.equal(M.latest(data,'online_total').value,134766);assert.equal(M.latest(data,'online_services').value,50571);});
test('raw confidence is pending while licensed history connects it; travel meanings remain explicit',()=>{assert.equal(M.latest(data,'confidence'),null);assert.equal(M.directory(data,{frequency:'holiday',status:'pending'}).length,1);const service=M.latest(data,'service_retail');assert.equal(service.value,4.9);assert.equal(service.yoy,null);const travel=M.latest(data,'holiday_travel');assert.equal(travel.quality,'estimate');assert.equal(travel.yoy,null);assert.match(travel.note,/日均同比/);const national=M.records(data,'holiday_trips').find(r=>r.period==='2025-国庆中秋');assert.equal(national.yoy,null);});
test('date intervals include boundaries and empty results are empty',()=>{const rows=M.records(data,'retail',{frequency:'monthly',basis:'month',from:'2026-08-31',to:'2026-08-31'});assert.equal(rows.length,1);assert.equal(M.records(data,'retail',{from:'2027-01-01'}).length,0);assert.equal(M.directory(data,{query:'不可能匹配的字符串'}).length,0);assert.ok(M.directory(data,{query:'化妆品'}).some(i=>i.id==='category_4'));});
test('invalid references, duplicates, fake domains and future releases fail validation',()=>{for(const mutate of [d=>d.observations.push({...d.observations[0]}),d=>d.observations[0].sourceId='missing',d=>d.observations[0].value='0',d=>d.sources[0].url='https://stats.gov.cn.evil.example/a',d=>d.sources[0].publishedAt='2099-01-01']){const bad=structuredClone(data);mutate(bad);assert.ok(M.validate(bad).length);}});
test('CSV uses BOM, quotes, metadata, empty nulls, real zero and formula protection',()=>{const d=structuredClone(data),r={...M.latest(d,'retail'),value:0,yoy:null,note:'=HYPERLINK("bad")'};const text=M.csv(d,[r]);assert.ok(text.startsWith('\ufeff'));assert.match(text,/"0","亿元",""/);assert.match(text,/"'=HYPERLINK\(""bad""\)"/);assert.match(text,/"2026-09-15"/);assert.match(text,/https:\/\/www.stats.gov.cn/);assert.equal(text.split('\r\n').length,2);});
test('one macro entry opens the consumption topic while preserving existing destinations',()=>{for(const page of ['index.html','industry.html','research.html','quotes.html','macro.html','consumption-macro.html']){let nav;const document={body:{classList:{add(){}},dataset:{},prepend(el){nav=el;}},head:{append(){}},createElement(){return{};},querySelector(){return null;},querySelectorAll(){return[];}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/site-shell.js'),'utf8'),{document,location:{pathname:'/'+page,hash:''}});assert.doesNotMatch(nav.innerHTML,/>消费宏观</);assert.match(nav.innerHTML,/href="consumption-macro.html"/);assert.match(nav.innerHTML,/宏观数据/);assert.match(nav.innerHTML,/行业数据/);assert.doesNotMatch(nav.innerHTML,/公司数据/);assert.doesNotMatch(nav.innerHTML,/href="companies\.html/);assert.match(nav.innerHTML,/实时行情/);if(page==='consumption-macro.html')assert.equal(document.body.dataset.siteSection,'macro');}});
