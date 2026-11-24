'use strict';
// Keep static first paint identical to the runtime shell on pre-rendered entrypoints.
const fs=require('node:fs'),path=require('node:path'),U=require('./site-ui.js');
const root=path.resolve(__dirname,'..');
let changed=0;
for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.html'))){
  const target=path.join(root,file),before=fs.readFileSync(target,'utf8');
  if(!/<aside class="site-nav\b/.test(before)&&file!=='research.html')continue;
  const [section,title]=U.pages[file]||['tools','研究工具'];
  const nav='<aside class="site-nav navbar navbar-vertical">'+U.shellNavigation(file,section,false)+'</aside>';
  const bar='<header class="site-workspace-bar">'+U.workspaceBar(title)+'</header>';
  let after=/<aside class="site-nav\b/.test(before)?before.replace(/<aside class="site-nav\b[^>]*>[\s\S]*?<\/aside>/,nav):before.replace(/<body\b[^>]*>/,match=>match+'\n'+nav);
  if(/<header class="site-workspace-bar"/.test(after))after=after.replace(/<header class="site-workspace-bar"[^>]*>[\s\S]*?<\/header>/,bar);
  else after=after.replace(nav,nav+'\n'+bar);
  if(after!==before){fs.writeFileSync(target,after);changed++;}
}
console.log('Updated '+changed+' static shells');
