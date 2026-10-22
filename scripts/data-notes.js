(function(){
  'use strict';
  const D=SiteData,esc=D.esc,$=id=>document.getElementById(id),cache=new Map();let request=0;
  const modules={
    'regional-retail':{name:'地方社零',files:['data/regional-retail/observations.json','data/regional-retail/city-tiers.json','data/regional-retail/tier-supplement.json','data/regional-retail/history.json'],docs:['docs/regional-retail.md']},
    tourism:{name:'三峡游轮',files:['data/tourism/three-gorges-cruises.json'],docs:['docs/three-gorges-cruises.md']},
    'retail-monthly':{name:'社零月度产品',files:['data/products/retail-monthly.json'],docs:['docs/retail-monthly-product.md']},
    calendar:{name:'重要数据日历',files:['data/important-calendar.json'],docs:['docs/important-calendar.md']},
    monthly:{name:'CPI月度产品',files:['data/products/consumption-monthly.json'],docs:['docs/consumption-monthly-product.md']},
    daily:{name:'商社日报',files:['data/daily/latest.json'],docs:['docs/daily-report.md']},
    'hotel-groups':{name:'酒店集团',files:['data/hotel-update-record.json'],docs:['docs/hotel-groups.md']},
    hotel:{name:'酒店',files:['data/hotel-update-record.json','data/hotel-city-history-coverage.json','data/hotel-holiday-import-record.json'],docs:['docs/hotel-data-update.md','docs/hotel-holiday-dashboard.md']},
    dutyfree:{name:'免税',files:['data/dutyfree/holidays.json','data/dutyfree/monthly-provenance.json','data/dutyfree/sources.json','data/dutyfree/korea.json'],docs:['docs/dutyfree-holidays.md','docs/korea-dutyfree.md']},
    gold:{name:'黄金',files:['data/gold-jewelry/research.json','data/gold-jewelry/macro.json','data/gold-jewelry/observations.json'],docs:['docs/gold-jewelry-database.md']},
    macro:{name:'宏观与消费',files:['data/macro/coverage.json','data/macro/catalog.json','data/consumption-macro/observations.json','data/macro/automatic-series.json','data/macro/expectations.json'],docs:['docs/macro-data.md','docs/consumption-macro.md','docs/macro-expectations.md','docs/macro-data-quality-20261017.md']},
    companies:{name:'重点公司',files:['data/companies/issues.json','data/companies/sources.json','data/companies/workbook-disclosures.json','data/companies/hotel-research.json','data/companies/jinjiang-research-notes.json'],docs:['docs/company-database.md']},
    'domestic-hotels':{name:'国内酒店',files:['data/companies/domestic-hotels.json'],docs:['docs/domestic-hotels.md']},
    'overseas-hotels':{name:'海外酒店',files:['data/companies/overseas-hotels.json'],docs:['docs/overseas-hotels.md']},
    earnings:{name:'财报日历',files:['data/earnings-calendar.json'],docs:['docs/earnings-workbench.md']},
    research:{name:'观点纪要',files:['data/research/updates/manifest.json'],docs:['docs/research-library.md']},
    quotes:{name:'实时行情',files:['data/coverage-companies.json'],docs:['docs/realtime-quotes.md','docs/coverage-pool.md']}
  };
  function list(title,items){return '<article class="notes-panel"><h2>'+esc(title)+'</h2>'+(items.length?'<ul>'+[...new Set(items)].map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="notes-empty">当前来源记录未列出专项缺口</p>')+'</article>';}
  function sources(values){const rows=values.flatMap(x=>Array.isArray(x.sources)?x.sources:Object.values(x.sources||{}));return rows.length?'<article class="notes-panel"><h2>来源记录</h2><details><summary>'+rows.length+'条来源</summary>'+rows.map(s=>'<div class="notes-source-item">'+(D.link(s.url)?'<a target="_blank" rel="noopener" href="'+esc(D.link(s.url))+'">'+esc(s.name||s.title||s.sourceName||s.label||s.file||s.id||'来源')+' ↗</a>':esc(s.name||s.title||s.sourceName||s.label||s.file||s.id||'来源'))+'<p>'+esc([s.publisher||s.provider,s.quality,s.publishedAt?'发布 '+s.publishedAt:'',s.checkedAt?'核对 '+s.checkedAt:'',s.locator,s.note||s.notes||s.verification].filter(Boolean).join(' · '))+'</p></div>').join('')+'</details></article>':'';}
  function notes(id,values){
    const a=values[0]||{},out=[];
    if(id==='regional-retail'){const history=values[3];out.push('分省分析：省级金额与同比来自省级记录；省内城市等权、中位数及分线仅使用同期间已取得城市样本，不能代替全省增速。省内趋势固定当前期城市，缺任一城市则断线。','统计口径仅累计与当月；1—2月合并作为当月视图中的独立期间，不与2月单月混算。趋势图数值默认全部显示，可关闭并保留选择；旧版最新值选择自动转为全部显示；多线支持选中突出、勾选显隐及合并/分开，分开视图统一纵轴。末端缺期时标注最后有效期间；缺期不连线。柱状图数值默认开启。','当月补算：同年相邻累计金额相减，只补缺失字段；官方当月值和已核验争议字段优先保留。只有累计同比而无金额、缺上月累计、季度/年度频率、统计范围变化或累计倒挂时不补算。','当月同比推算：分别用本期累计金额÷(1+累计同比/100)反推两期可比累计基数，再作差作为当月分母；仅在两期金额和同比完整、分母为正且与原有当月金额一致时采用。推算值含累计舍入误差，不能称为官方单月同比。','1—2月累计只转合并口径；没有独立1月金额时不拆1月或2月。测算标签、两期输入、公式和全部原始来源随CSV导出；原始文件不改。',...(history?.notes||a.notes||[]),...(values[1]?.notes||[]),...(values[2]?.notes||[]));for(const c of history?.coverage||a.coverage||[])out.push(c.name+'：历史起点 '+(c.start||'未取得')+'；金额至 '+(c.latestAmount||'未取得')+'；同比至 '+(c.latestYoy||'未取得')+'；'+c.reason);for(const c of a.conflicts||[])out.push('待核验 '+c.key+' '+c.field+'：'+c.retained+' / '+c.other+'。冲突字段留空，保留原始来源。');if(history?.importAudit)out.push('本轮实际回执 '+history.importAudit.receiptCount+'份；官方发布页及附件 '+history.importAudit.officialSources+'份；年度、限上、子口径或语义不明排除 '+history.importAudit.ignored.length+'条；争议核验记录 '+history.importAudit.conflicts.length+'条，详见完整记录。');}
    if(id==='tourism')out.push(...(a.notes||[]));
    if(id==='calendar')out.push('只保留中国CPI、社零、美国CPI、非农和美联储议息五类；日程范围：'+a.coverageStart+'—'+a.coverageEnd+'。','全部时间为北京时间；海外原始时区单独保存，按冬夏令时换算。美联储会议日期与决议发布时间分开显示。','日期为官方计划，可能调整。“时间已过”不表示已发布或本站已更新；后续未核验日期不推算。','日历不重复维护指标数值，数据入口指向现有模块。导出包含当前地区和时间范围的日程。');
    if(id==='hotel-groups')out.push('来源：酒店之家集团数据。覆盖华住、锦江酒店（中国区）、首旅如家、亚朵。','ADR读取stay_adr（入住日期）；热度指数、房价指数分别读取stay_heat_index、stay_price_index（均按入住日期统计），指数保留两位小数；酒店数和房间数保留源表值。指数同比为同一字段同周相对变动，不等于ADR增速或OCC。','同比对齐上年同周号，未调整节假日错期；基期缺失或非正数时不强算。','源数据不含集团周度OCC、RevPAR，不用热度或价格指数代替，也不以财报数据填补。','范围：'+(a.datasets?.['hotel_group_weekly.csv']?.latestPeriod||'以源CSV为准')+'；入库时间：'+(a.importedAt||'未记录')+'。','直接读取hotel_group_weekly.csv；更新现有酒店周度数据即可，无需新增公司底稿构建步骤。');
    if(id==='monthly'||id==='retail-monthly')out.push(...(a.notes||[]));
    if(id==='overseas-hotels'||id==='domestic-hotels')out.push(...(a.notes||[]));
    if(id==='dutyfree')out.push(...(a.coverageNotes||[]),...(a.notes||[]),values[1]?.note||'',...(values[3]?.notes||[]));
    if(id==='hotel')out.push('同比默认匹配来源年/周；假期错期需单独映射与标注。','节假日经营对标按假期日序匹配两期日期，入住率差为百分点，ADR及RevPAR为相对变化。',...Object.entries(a.historicalCoverage||{}).flatMap(([file,regions])=>Object.entries(regions).map(([region,c])=>region+'：'+c.firstPeriod+' — '+c.lastPeriod+' · '+c.periodCount+'期')),'异常源记录：'+(a.sourceAnomalyCount??'未记录')+'条');
    if(id==='gold')out.push(...(a.limitations||[]),'国内金价后台按5分钟计划采集；国际行情在黄金页面打开时每15秒读取。实际更新以来源报价时间为准，网络失败保留上次报价。');
    if(id==='companies'&&values[2])out.push('三份用户底稿逐单元格转录，保留原单位、报告期、页码、证据编号和截图位置；缺失不转零。',...((values[2].issues)||[]).map(i=>i.message));
    if(id==='companies')out.push(...(values[3]?.notes||[]),...(values[4]?.notes||[]));
    if(id==='companies')out.push(...(a.issues||[]).map(i=>[i.period,i.locator,i.message].filter(Boolean).join(' · ')));
    if(id==='macro'){
      out.push(...(values[4]?.notes||[]));
      for(const [key,c] of Object.entries(a.series||{}))out.push(key+'：'+[c.start+' — '+c.end,c.count+'期',c.missingPeriods?.length?'缺期 '+c.missingPeriods.join('、'):'',c.unpublishedPeriods?.length?'官方未发布 '+c.unpublishedPeriods.map(x=>x.period+'（'+x.reason+'）').join('、'):'',c.historyShort?'历史覆盖不足':'',c.status==='error'?'更新失败，保留历史':''].filter(Boolean).join(' · '));
      const consumption=values[2]&&values[3]&&!values[3].loadError?ConsumptionMacro.mergeAutomatic(values[2],values[3]):values[2];if(consumption&&window.ConsumptionMacro)for(const i of consumption.indicators||[]){const c=ConsumptionMacro.scopeCoverage(consumption,i.id);out.push(i.name+'：'+(c?[c.start+' — '+c.end,c.count+'期',c.missingPeriods.length?'缺期 '+c.missingPeriods.join('、'):'',c.valueMissing?'数值缺失 '+c.valueMissing+'条':''].filter(Boolean).join(' · '):i.pendingReason||'暂无数据'));}
      out.push('1—2月按合并披露保留；全年不加总舍入月值；不由舍入金额重算同比。发布日期未返回时留空。');
    }
    if(id==='daily')out.push(...(a.notes||[]),'观点源最新时间：'+(a.coverage?.researchSourceTo||'未提供'),'新闻核验：'+(a.coverage?.newsStatus||'未提供'));
    if(id==='research')out.push('来源发布时间、导入时间与会议日期分别保留。原文、纪要摘要、文档附件及未转写音频分别记录；正文未提取不代表已完成整理。');
    if(id==='earnings')out.push('预计披露日期与实际公告日期分开记录；原始来源和核对时间见来源记录。');
    if(id==='quotes')out.push('行情与财报日历共用公司库；当前'+(a.companies?.length||0)+'家公司，SHEIN归消费出海。','板块热力图按当前筛选内各公司有效报价涨跌幅等权计算，不是交易所指数或市值加权。缺失与读取失败的报价不参与计算，真实零涨跌参与；各市场报价时间可能不同。','腾讯行情；页面前台每秒请求，后台暂停；报价可能延迟。更新按来源报价时间判断；读取失败保留上次报价。','涨跌幅以来源前收盘为基准；A股、港股和美股使用各自本币，不混比绝对价格。');
    return out.filter(Boolean).map(v=>typeof v==='string'?v:JSON.stringify(v));
  }
  async function render(){const id=modules[location.hash.slice(1)]?location.hash.slice(1):'dutyfree',config=modules[id],token=++request;$('notes-tabs').innerHTML=Object.entries(modules).map(([key,m])=>'<a href="#'+key+'"'+(key===id?' aria-current="page"':'')+'>'+esc(m.name)+'</a>').join('');$('notes-status').textContent='正在读取'+config.name+'说明…';$('notes-content').innerHTML='';
    const values=await Promise.all(config.files.map(async path=>{try{if(!cache.has(path))cache.set(path,await D.json(path));return cache.get(path);}catch(e){return {loadError:path};}}));if(token!==request)return;
    const failed=values.filter(v=>v.loadError),stamp=values.map(v=>v.checkedAt||v.updatedAt||v.importedAt||v.verifiedAt).filter(Boolean).sort().at(-1);$('notes-status').textContent=failed.length?'部分来源文件暂时未能读取：'+failed.map(v=>v.loadError).join('、'):'';
    $('notes-content').innerHTML=(stamp?'<p class="notes-stamp">记录更新 '+esc(stamp)+'</p>':'')+list(config.name+' · 数据来源与说明',notes(id,values))+sources(values)+'<article class="notes-panel"><h2>完整记录</h2><div class="notes-links">'+config.files.map(p=>'<a href="'+esc(p)+'" target="_blank" rel="noopener">'+esc(p.split('/').pop())+'</a>').join('')+config.docs.map(p=>'<a href="'+esc(p)+'" target="_blank" rel="noopener">'+esc(p.split('/').pop())+'</a>').join('')+'</div></article>';
  }
  addEventListener('hashchange',render);render();
})();
