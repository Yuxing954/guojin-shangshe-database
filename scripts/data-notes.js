(function(){
  'use strict';
  const D=SiteData,esc=D.esc,$=id=>document.getElementById(id),cache=new Map();let request=0;
  const modules={
    daily:{name:'商社日报',files:['data/daily/latest.json'],docs:['docs/daily-report.md']},
    hotel:{name:'酒店',files:['data/hotel-update-record.json','data/hotel-city-history-coverage.json','data/hotel-holiday-import-record.json'],docs:['docs/hotel-data-update.md','docs/hotel-holiday-dashboard.md']},
    dutyfree:{name:'免税',files:['data/dutyfree/holidays.json','data/dutyfree/monthly-provenance.json','data/dutyfree/sources.json'],docs:['docs/dutyfree-holidays.md']},
    gold:{name:'黄金',files:['data/gold-jewelry/research.json','data/gold-jewelry/macro.json','data/gold-jewelry/observations.json'],docs:['docs/gold-jewelry-database.md']},
    dining:{name:'餐饮',files:['data/sectors/dining.json'],docs:[]},
    macro:{name:'宏观与消费',files:['data/macro/coverage.json','data/macro/catalog.json','data/consumption-macro/observations.json','data/macro/automatic-series.json'],docs:['docs/macro-data.md','docs/consumption-macro.md']},
    companies:{name:'重点公司',files:['data/companies/issues.json','data/companies/sources.json'],docs:['docs/company-database.md']},
    earnings:{name:'财报日历',files:['data/earnings-calendar.json'],docs:['docs/earnings-workbench.md']},
    research:{name:'观点纪要',files:['data/research/updates/manifest.json'],docs:['docs/research-library.md']},
    quotes:{name:'实时行情',files:['data/coverage-companies.json'],docs:['docs/realtime-quotes.md','docs/coverage-pool.md']}
  };
  function list(title,items){return '<article class="notes-panel"><h2>'+esc(title)+'</h2>'+(items.length?'<ul>'+[...new Set(items)].map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="notes-empty">当前来源记录未列出专项缺口</p>')+'</article>';}
  function sources(values){const rows=values.flatMap(x=>Array.isArray(x.sources)?x.sources:Object.values(x.sources||{}));return rows.length?'<article class="notes-panel"><h2>来源记录</h2><details><summary>'+rows.length+'条来源</summary>'+rows.map(s=>'<div class="notes-source-item">'+(D.link(s.url)?'<a target="_blank" rel="noopener" href="'+esc(D.link(s.url))+'">'+esc(s.name||s.title||s.sourceName||s.label||s.file||s.id||'来源')+' ↗</a>':esc(s.name||s.title||s.sourceName||s.label||s.file||s.id||'来源'))+'<p>'+esc([s.publisher||s.provider,s.quality,s.publishedAt?'发布 '+s.publishedAt:'',s.checkedAt?'核对 '+s.checkedAt:'',s.locator,s.note||s.notes||s.verification].filter(Boolean).join(' · '))+'</p></div>').join('')+'</details></article>':'';}
  function notes(id,values){
    const a=values[0]||{},out=[];
    if(id==='dutyfree')out.push(...(a.coverageNotes||[]),...(a.notes||[]),values[1]?.note||'');
    if(id==='hotel')out.push('同比默认匹配来源年/周；假期错期需单独映射与标注。','节假日经营对标按假期日序匹配两期日期，入住率差为百分点，ADR及RevPAR为相对变化。',...Object.entries(a.historicalCoverage||{}).flatMap(([file,regions])=>Object.entries(regions).map(([region,c])=>region+'：'+c.firstPeriod+' — '+c.lastPeriod+' · '+c.periodCount+'期')),'异常源记录：'+(a.sourceAnomalyCount??'未记录')+'条');
    if(id==='gold')out.push(...(a.limitations||[]),'国内金价后台按5分钟计划采集；国际行情在黄金页面打开时每15秒读取。实际更新以来源报价时间为准，网络失败保留上次报价。');
    if(id==='dining')out.push(...(a.gaps||[]).map(g=>g.metric+'：'+g.reason));
    if(id==='companies')out.push(...(a.issues||[]).filter(i=>!i.companyId||i.companyId==='hworld').map(i=>[i.period,i.locator,i.message].filter(Boolean).join(' · ')));
    if(id==='macro'){
      for(const [key,c] of Object.entries(a.series||{}))out.push(key+'：'+[c.start+' — '+c.end,c.count+'期',c.missingPeriods?.length?'缺期 '+c.missingPeriods.join('、'):'',c.historyShort?'历史覆盖不足':'',c.status==='error'?'更新失败，保留历史':''].filter(Boolean).join(' · '));
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
    $('notes-content').innerHTML=(stamp?'<p class="notes-stamp">记录更新 '+esc(stamp)+'</p>':'')+list(config.name+' · 覆盖与口径',notes(id,values))+sources(values)+'<article class="notes-panel"><h2>完整记录</h2><div class="notes-links">'+config.files.map(p=>'<a href="'+esc(p)+'" target="_blank" rel="noopener">'+esc(p.split('/').pop())+'</a>').join('')+config.docs.map(p=>'<a href="'+esc(p)+'" target="_blank" rel="noopener">'+esc(p.split('/').pop())+'</a>').join('')+'</div></article>';
  }
  addEventListener('hashchange',render);render();
})();


