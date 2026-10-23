(function(root){
  'use strict';
  const navigation=[['industry','industry.html','行业数据','chart'],['macro','macro.html?view=indicators','宏观数据','globe'],['companies','company-database.html','重点公司','building'],['earnings','earnings.html','财报日历','calendar'],['research','research.html','观点纪要','document'],['quotes','quotes.html','实时行情','trend']];
  const legacy={'watch-assistant':'hotel-weekly-product.html','coverage-live':'quotes.html','sec-hotel':'industry.html#hotel','sec-taxfree':'industry.html#dutyfree','sec-gold':'industry.html#gold','sec-overseas':'industry.html#hotel','sec-dining':'industry.html#dining','sec-f':'quotes.html','consumer-focus':'quotes.html','sec-u':'quotes.html','sec-m':'research.html','sec-r':'research.html','sec-mkt':'research.html'};
  function route(key,search='',fallback=false){const target=legacy[key]||(fallback?'hotel-weekly-product.html':'');if(!target)return '';const url=new URL(target,'https://site.invalid/');for(const [k,v] of new URLSearchParams(search))url.searchParams.set(k,v);return url.pathname.slice(1)+url.search+url.hash;}
  async function request(path,format='json',timeout=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return format==='text'?await response.text():await response.json();}finally{clearTimeout(timer);}}
  function date(value){if(!value)return '日期未提供';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isNaN(d.getTime())?'日期未提供':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
  function save(values){const u=new URL(location.href);for(const [k,v] of Object.entries(values)){if(v===''||v==null)u.searchParams.delete(k);else u.searchParams.set(k,String(v));}history.replaceState(null,'',u.pathname+u.search+u.hash);}
  function debounce(fn,delay=150){let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};}

  const registry={
  "companies.html": {
    "section": "quotes",
    "title": "覆盖池",
    "kind": "redirect",
    "embed": false,
    "views": [
      "companies.html"
    ],
    "components": [],
    "queryParameters": [
      "company",
      "sector",
      "site-chart-interaction"
    ]
  },
  "company-database.html": {
    "section": "companies",
    "title": "重点公司数据库",
    "kind": "page",
    "embed": false,
    "views": [
      "company-database.html?company=jinjiang",
      "company-database.html?company=hworld",
      "company-database.html?company=btg",
      "company-database.html?company=atour"
    ],
    "components": [
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "sampleView",
      "company",
      "db",
      "tab",
      "kind",
      "frequency",
      "from",
      "to",
      "range",
      "region",
      "category",
      "operation",
      "currency",
      "display",
      "q",
      "ws",
      "detailCategory",
      "detailMode",
      "page"
    ]
  },
  "consumption-macro.html": {
    "section": "compatibility",
    "title": "consumption-macro.html",
    "kind": "redirect",
    "embed": false,
    "views": [
      "consumption-macro.html"
    ],
    "components": [],
    "queryParameters": []
  },
  "consumption-monthly-product.html": {
    "section": "compatibility",
    "title": "consumption-monthly-product.html",
    "kind": "redirect",
    "embed": false,
    "views": [
      "consumption-monthly-product.html"
    ],
    "components": [],
    "queryParameters": [
      "embed"
    ]
  },
  "cpi-monthly-product.html": {
    "section": "tools",
    "title": "CPI月度产品",
    "kind": "page",
    "embed": false,
    "views": [
      "cpi-monthly-product.html"
    ],
    "components": [
      "select",
      "details"
    ],
    "queryParameters": [
      "embed",
      "month",
      "window",
      "ws"
    ]
  },
  "cruise-dashboard.html": {
    "section": "industry",
    "title": "三峡游轮",
    "kind": "page",
    "embed": true,
    "views": [
      "cruise-dashboard.html#view=overview",
      "cruise-dashboard.html#view=audience",
      "cruise-dashboard.html#view=operators"
    ],
    "components": [
      "select",
      "table"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "view",
      "ws"
    ]
  },
  "daily.html": {
    "section": "daily",
    "title": "国金商社日报",
    "kind": "page",
    "embed": false,
    "views": [
      "daily.html"
    ],
    "components": [
      "select"
    ],
    "queryParameters": [
      "embed",
      "date",
      "ws"
    ]
  },
  "dashboard.html": {
    "section": "tools",
    "title": "数据浏览器",
    "kind": "page",
    "embed": false,
    "views": [
      "dashboard.html?dataset=valuation"
    ],
    "components": [
      "select"
    ],
    "queryParameters": [
      "embed",
      "q",
      "field",
      "dataset",
      "site-chart-interaction",
      "ws",
      "sort",
      "order",
      "page"
    ]
  },
  "data-notes.html": {
    "section": "tools",
    "title": "数据来源与说明",
    "kind": "page",
    "embed": false,
    "views": [
      "data-notes.html"
    ],
    "components": [],
    "queryParameters": [
      "embed",
      "ws"
    ]
  },
  "dining.html": {
    "section": "industry",
    "title": "餐饮",
    "kind": "page",
    "embed": true,
    "views": [
      "dining.html"
    ],
    "components": [
      "select",
      "table"
    ],
    "queryParameters": [
      "embed",
      "period",
      "holidays",
      "view",
      "ws"
    ]
  },
  "domestic-hotel-comparison.html": {
    "section": "companies",
    "title": "国内酒店公司对比",
    "kind": "page",
    "embed": false,
    "views": [
      "domestic-hotel-comparison.html"
    ],
    "components": [
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "sampleView",
      "company",
      "db",
      "tab",
      "kind",
      "frequency",
      "from",
      "to",
      "range",
      "region",
      "category",
      "operation",
      "currency",
      "display",
      "q",
      "ws",
      "peers"
    ]
  },
  "dutyfree-dashboard.html": {
    "section": "industry",
    "title": "免税",
    "kind": "page",
    "embed": true,
    "views": [
      "dutyfree-dashboard.html#monthly",
      "dutyfree-dashboard.html#holidays",
      "dutyfree-dashboard.html#korea"
    ],
    "components": [
      "select",
      "details",
      "table",
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "view",
      "ws",
      "krScope",
      "krRange",
      "krMode"
    ]
  },
  "earnings.html": {
    "section": "earnings",
    "title": "财报日历",
    "kind": "page",
    "embed": false,
    "views": [
      "earnings.html"
    ],
    "components": [
      "select",
      "details",
      "table",
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "view",
      "date",
      "history",
      "tab",
      "site-chart-interaction",
      "im",
      "iv",
      "region",
      "ws"
    ]
  },
  "gold-jewelry.html": {
    "section": "industry",
    "title": "黄金",
    "kind": "redirect",
    "embed": false,
    "views": [
      "gold-jewelry.html"
    ],
    "components": [],
    "queryParameters": [
      "embed"
    ]
  },
  "hotel-dashboard.html": {
    "section": "industry",
    "title": "酒店",
    "kind": "page",
    "embed": true,
    "views": [
      "hotel-dashboard.html#view=overview",
      "hotel-dashboard.html#view=cities",
      "hotel-dashboard.html#view=structure"
    ],
    "components": [
      "select",
      "details",
      "table",
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "region",
      "week",
      "view",
      "window",
      "rangeVersion",
      "supplyWindow",
      "metric",
      "mode",
      "base",
      "site-chart-interaction",
      "ws"
    ]
  },
  "hotel-groups.html": {
    "section": "industry",
    "title": "酒店集团",
    "kind": "page",
    "embed": true,
    "views": [
      "hotel-groups.html"
    ],
    "components": [
      "select",
      "details",
      "table",
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "period",
      "compare",
      "view",
      "ws"
    ]
  },
  "hotel-holiday-dashboard.html": {
    "section": "industry",
    "title": "酒店假期数据",
    "kind": "page",
    "embed": true,
    "views": [
      "hotel-holiday-dashboard.html"
    ],
    "components": [
      "select",
      "table",
      "details"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "holiday",
      "holidaySegment",
      "holidayMetric",
      "holidayDimension",
      "view",
      "ws"
    ]
  },
  "hotel-weekly-product.html": {
    "section": "tools",
    "title": "酒店周度产品",
    "kind": "page",
    "embed": false,
    "views": [
      "hotel-weekly-product.html"
    ],
    "components": [
      "select",
      "details"
    ],
    "queryParameters": [
      "embed",
      "ws"
    ]
  },
  "index.html": {
    "section": "compatibility",
    "title": "index.html",
    "kind": "redirect",
    "embed": false,
    "views": [
      "index.html"
    ],
    "components": [],
    "queryParameters": []
  },
  "industry.html": {
    "section": "industry",
    "title": "行业数据",
    "kind": "page",
    "embed": false,
    "views": [
      "industry.html#hotel",
      "industry.html?panelSector=hotel&panelView=view%3Dcities#hotel",
      "industry.html?panelSector=hotel&panelView=view%3Dstructure#hotel",
      "industry.html?panelSector=hotel&panelView=view%3Dgroups#hotel",
      "industry.html?panelSector=hotel&panelView=view%3Dholiday#hotel",
      "industry.html#dutyfree",
      "industry.html#dining",
      "industry.html#tourism",
      "industry.html#travel"
    ],
    "components": [
      "select",
      "details",
      "table"
    ],
    "queryParameters": [
      "embed",
      "real10",
      "dxy",
      "etf-flows",
      "etf-holdings",
      "central-banks",
      "managed-money",
      "goldView",
      "panelSector",
      "panelView",
      "view",
      "hotel",
      "site-chart-interaction",
      "ws"
    ]
  },
  "macro.html": {
    "section": "macro",
    "title": "核心指标",
    "kind": "page",
    "embed": false,
    "views": [
      "macro.html?view=indicators&country=CN",
      "macro.html?view=indicators&country=US",
      "macro.html?view=fedwatch",
      "macro.html?view=predictions"
    ],
    "components": [
      "details",
      "select",
      "dialog"
    ],
    "queryParameters": [
      "view",
      "embed",
      "predictionQuery",
      "predictionTopic",
      "predictionSort",
      "meeting",
      "study",
      "country",
      "group",
      "q",
      "indicator",
      "years",
      "frequency",
      "health",
      "category",
      "site-chart-interaction",
      "ws"
    ]
  },
  "overseas-hotel-comparison.html": {
    "section": "companies",
    "title": "海外酒店公司对比",
    "kind": "page",
    "embed": false,
    "views": [
      "overseas-hotel-comparison.html"
    ],
    "components": [
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "tab",
      "company",
      "backCompany",
      "mode",
      "quarter",
      "region",
      "financeRegion",
      "kind",
      "sheet",
      "q",
      "brand",
      "from",
      "peers",
      "peerRegion",
      "peerMetric",
      "peerDisplay",
      "financePeriod",
      "ws"
    ]
  },
  "overseas-hotels.html": {
    "section": "companies",
    "title": "海外酒店",
    "kind": "page",
    "embed": false,
    "views": [
      "overseas-hotels.html?company=marriott",
      "overseas-hotels.html?company=hilton",
      "overseas-hotels.html?company=hyatt",
      "overseas-hotels.html?company=ihg"
    ],
    "components": [
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "tab",
      "company",
      "backCompany",
      "mode",
      "quarter",
      "region",
      "financeRegion",
      "kind",
      "sheet",
      "q",
      "brand",
      "from",
      "peers",
      "peerRegion",
      "peerMetric",
      "peerDisplay",
      "financePeriod",
      "ws",
      "page"
    ]
  },
  "overseas.html": {
    "section": "compatibility",
    "title": "overseas.html",
    "kind": "redirect",
    "embed": false,
    "views": [
      "overseas.html"
    ],
    "components": [],
    "queryParameters": [
      "embed"
    ]
  },
  "quotes.html": {
    "section": "quotes",
    "title": "实时行情",
    "kind": "page",
    "embed": false,
    "views": [
      "quotes.html"
    ],
    "components": [
      "select",
      "details",
      "table"
    ],
    "queryParameters": [
      "site-chart-interaction",
      "embed",
      "view",
      "period",
      "symbol",
      "ws"
    ]
  },
  "regional-retail.html": {
    "section": "macro",
    "title": "地方社零",
    "kind": "page",
    "embed": false,
    "views": [
      "regional-retail.html?view=tiers",
      "regional-retail.html?view=breakdown",
      "regional-retail.html?view=provinces",
      "regional-retail.html?view=comparison",
      "regional-retail.html?view=structure"
    ],
    "components": [
      "select",
      "details",
      "table"
    ],
    "queryParameters": [
      "view",
      "province",
      "provinceBasis",
      "provinceYears",
      "provincePeriod",
      "tierBasis",
      "tierMetric",
      "tierCohort",
      "tierFrequency",
      "tierYears",
      "tierGroup",
      "tierSearch",
      "tierMissing",
      "tierPeriod",
      "level",
      "basis",
      "measure",
      "query",
      "missing",
      "years",
      "period",
      "region",
      "breakdownCity",
      "breakdownBasis",
      "breakdownYears",
      "breakdownPeriod",
      "dimension",
      "breakdownCategory",
      "embed",
      "ws"
    ]
  },
  "research.html": {
    "section": "research",
    "title": "观点纪要",
    "kind": "page",
    "embed": false,
    "views": [
      "research.html"
    ],
    "components": [
      "select",
      "details",
      "dialog"
    ],
    "queryParameters": [
      "embed",
      "kind",
      "asset",
      "topic",
      "record",
      "scope",
      "state",
      "sort",
      "range",
      "from",
      "to",
      "format",
      "file",
      "site-chart-interaction",
      "ws",
      "page",
      "archive",
      "recent"
    ]
  },
  "retail-monthly-product.html": {
    "section": "tools",
    "title": "社零月度产品",
    "kind": "page",
    "embed": false,
    "views": [
      "retail-monthly-product.html"
    ],
    "components": [
      "select",
      "details"
    ],
    "queryParameters": [
      "embed",
      "month",
      "window",
      "ws"
    ]
  },
  "search.html": {
    "section": "research",
    "title": "站内搜索",
    "kind": "page",
    "embed": false,
    "views": [
      "search.html"
    ],
    "components": [],
    "queryParameters": [
      "embed",
      "type",
      "q",
      "site-chart-interaction",
      "ws",
      "page"
    ]
  },
  "travel-dashboard.html": {
    "section": "industry",
    "title": "旅游",
    "kind": "page",
    "embed": true,
    "views": [
      "travel-dashboard.html#view=domestic",
      "travel-dashboard.html#view=inbound",
      "travel-dashboard.html#view=outbound"
    ],
    "components": [
      "select",
      "table"
    ],
    "queryParameters": [
      "embed",
      "site-chart-interaction",
      "view",
      "ws",
      "travel-domestic-period-year",
      "travel-domestic-period-scope",
      "travel-domestic-quarter",
      "travel-domestic-year",
      "travel-holiday",
      "travel-holiday-basis",
      "travel-scenic-window",
      "travel-enterprise-year",
      "travel-enterprise-scope",
      "travel-border-scope",
      "travel-destination",
      "travel-outbound-year",
      "travel-outbound-scope"
    ]
  }
};
  // Stable identities, never the current filtered position, choose category colors.
  const pages=Object.fromEntries(Object.entries(registry).map(([file,e])=>[file,[e.section,e.title]]));
  const colors=Object.freeze(['#2167a0','#ac863d','#668397','#538db5','#8d7852','#476777']);
  const companyColors=Object.freeze({jinjiang:colors[0],hworld:colors[1],btg:colors[2],atour:colors[3],marriott:colors[0],hilton:colors[1],hyatt:colors[2],ihg:colors[3]});
  function seriesColor(id){if(companyColors[id])return companyColors[id];let hash=0;for(const c of String(id||'value'))hash=(hash*31+c.codePointAt(0))>>>0;return colors[hash%colors.length];}
  const labelColors=Object.freeze(colors.map(c=>contrastColor(c)));
  function contrastColor(color){const rgb=color.slice(1).match(/../g).map(s=>parseInt(s,16));const lum=()=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);while(1.05/(lum()+.05)<4.5)for(let i=0;i<3;i++)rgb[i]=Math.floor(rgb[i]*.95);return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');}
  const numberTypes=Object.freeze({amount:{digits:2,unit:''},price:{digits:2,unit:''},count:{digits:0,unit:''},percent:{digits:1,unit:'%'},percentagePoint:{digits:1,unit:'pct'},basisPoint:{digits:0,unit:'bp'}});
  function number(value,type='amount',options={}){if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return '—';const spec={...(numberTypes[type]||numberTypes.amount),...options},n=Number(value);return (spec.signed&&n>0?'+':'')+new Intl.NumberFormat('zh-CN',{minimumFractionDigits:spec.minimumDigits??spec.digits,maximumFractionDigits:spec.digits}).format(n)+(spec.unit||'');}
  function convert(value,factor){return value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value)*factor;}
  function contextURL(value){const u=new URL(value,location.href),ws=new URLSearchParams(location.search).get("ws");if(ws&&!u.searchParams.has("ws"))u.searchParams.set("ws",ws);return u.pathname+u.search+u.hash;}
  function restoreFields(ids,prefix){const p=new URLSearchParams(location.search);for(const id of ids){const e=document.getElementById(id),v=p.get(prefix+id);if(e&&v!==null&&e.tagName==='SELECT'&&[...e.options].some(o=>o.value===v))e.value=v;}}
  function saveFields(ids,prefix){save(Object.fromEntries(ids.map(id=>[prefix+id,document.getElementById(id)?.value??''])));}
  const api={restoreFields,saveFields,contextURL,navigation,pages,registry,colors,labelColors,contrastColor,companyColors,seriesColor,numberTypes,number,convert,route,request,date,save,debounce};if(typeof module==='object'&&module.exports)module.exports=api;else root.SiteUI=api;
})(typeof window==='object'?window:globalThis);








