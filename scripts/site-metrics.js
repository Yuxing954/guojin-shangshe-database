(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SiteMetrics=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Definitions describe display/search only. Financial transformations remain in the existing models.
 const definitions=[
  {id:'hotel-revpar',name:'酒店 RevPAR',aliases:['每间可供出租客房收入','revpar'],unit:'元',digits:1,frequency:'weekly',source:'酒店之家',transforms:['value','reportedYoY'],href:'hotel-dashboard.html#view=overview&metric=revpar'},
  {id:'hotel-adr',name:'酒店 ADR',aliases:['平均房价','adr'],unit:'元',digits:1,frequency:'weekly',source:'酒店之家',transforms:['value','reportedYoY'],href:'hotel-dashboard.html#view=overview&metric=adr'},
  {id:'hotel-occ',name:'酒店 OCC',aliases:['入住率','出租率','occ'],unit:'%',digits:1,frequency:'weekly',source:'酒店之家',transforms:['value','reportedYoY'],href:'hotel-dashboard.html#view=overview&metric=occ'},
  {id:'dutyfree-korea-sales',name:'韩国免税销售额',aliases:['韩国免税','销售金额'],unit:'亿美元',digits:2,frequency:'monthly',source:'韩国免税店协会',transforms:['value','reportedYoY'],href:'dutyfree-dashboard.html#view=korea'},
  {id:'regional-retail',name:'地方社会消费品零售总额',aliases:['地方社零','地区社零'],unit:'亿元',digits:2,frequency:'monthly',source:'各地统计机构',transforms:['value','reportedYoY'],href:'regional-retail.html'}
 ];
 const macroAliases={'cn-cpi':['CPI','居民消费价格'],'cn-retail':['社零','社会消费品零售总额'],'cn-pmi':['PMI','采购经理指数'],'cn-gdp':['GDP','国内生产总值'],'us-cpi':['美国CPI'],'us-nfp':['非农']};
 function fromCatalog(catalog){return (catalog.series||[]).map(s=>({id:s.id,name:s.name,aliases:[s.id,...(macroAliases[s.id]||[])],unit:s.unit||'',digits:s.precision??2,frequency:s.frequency,source:catalog.sources?.[s.source]?.name||s.source,transforms:['value'],href:'macro.html?view=indicators&study=workspace&country='+encodeURIComponent(s.country)+'&indicator='+encodeURIComponent(s.id)}));}
 function searchItems(defs=definitions){return defs.map(s=>({id:'metric:'+s.id,title:s.name,kind:'industry',aliases:s.aliases,href:s.href,module:s.id.startsWith('hotel-')?'酒店':s.href.startsWith('macro')?'宏观数据':'行业数据',period:'',source:s.source,frequency:s.frequency}));}
 return {definitions,fromCatalog,searchItems};
});
