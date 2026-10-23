'use strict';
// Shared appearance belongs to the component layer. Data geometry is deliberately excluded.
const common=/\.(?:site-(?:subnav|segment|kpi|panel|button|filters|status|tag|search)|board-(?:stat|panel|filters|kpis)|[\w-]+-(?:kpi|button|filters|pager|dialog))(?![\w-])/;
function checkCSS(file,css,exceptions=[]){
 if(/--site-(?:accent|soft|bg|ink|line|muted|up|down)\s*:/.test(css))throw Error(file+': local global-theme override');
 for(const m of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)){
  const selector=m[1].trim();if(!common.test(selector))continue;
  for(const d of m[2].matchAll(/(?:^|;)\s*(color|background(?:-color)?|font-size|border-radius)\s*:\s*([^;]+)/g)){
   const declaration=d[1]+':'+d[2].trim();if(!/#|\b\d+px\b|\b(?:white|black)\b/.test(declaration))continue;
   if(!exceptions.some(e=>e.file===file&&e.selector===selector&&e.declaration===declaration&&e.reason))throw Error(file+': shared appearance '+selector+' '+declaration);
  }
 }
}
module.exports={checkCSS};
