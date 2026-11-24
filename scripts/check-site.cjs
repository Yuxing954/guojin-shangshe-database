'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),pages=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
const app=fs.readFileSync(path.join(__dirname,'tabler-app/app.js'),'utf8');
const nativePages=new Set([...app.matchAll(/'([^']+\.html)':\[/g)].map(m=>m[1]));nativePages.add('index.html');
for(const file of ['domestic-hotel-comparison.html','overseas-hotel-comparison.html'])nativePages.delete(file);
let inline=0,scripts=0,modules=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(__dirname).filter(f=>f.endsWith('.js'))){
 const code=fs.readFileSync(file,'utf8');
 if(file.includes(path.sep+'tabler-app'+path.sep)){cp.execFileSync(process.execPath,['--check',file],{stdio:'pipe'});modules++;}
 else new vm.Script(code,{filename:file});
 scripts++;
 if(file.includes(path.sep+'tabler-app'+path.sep))for(const m of code.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g))assert.ok(fs.existsSync(path.resolve(path.dirname(file),m[1])),file+' missing import '+m[1]);
}
for(const file of pages){
 const html=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!/^<<<<<<<|^=======|^>>>>>>>/m.test(html),file+' merge conflict');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/i.test(m[1])&&m[2].trim()&&!/type=["']application\//i.test(m[1])){new vm.Script(m[2],{filename:file});inline++;}
 for(const m of html.matchAll(/(?:src|href)="(scripts\/[^"?#]+)[^"\s]*"/g))assert.ok(fs.existsSync(path.join(root,m[1])),file+' missing '+m[1]);
 if(nativePages.has(file)){
  const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"?]+)[^"]*"/g)].map(m=>m[1]);
  assert.deepEqual(styles,['scripts/vendor/tabler/tabler.min.css','scripts/tabler-app/app.css'],file+' uses official Tabler and scoped app additions');
  assert.equal((html.match(/type="module" src="scripts\/tabler-app\/app.js/g)||[]).length,1,file+' loads native application exactly once');
  assert.ok(!/scripts\/(?:site-shell|workspace-design|site-polish|tabler-integration|dashboard-compact|industry-design)/.test(html),file+' must not load the retired UI');
  assert.match(html,/name="viewport"/);assert.match(html,/<html lang="zh-CN"/);
 }
}
assert.match(fs.readFileSync(path.join(__dirname,'vendor/tabler/tabler.min.css'),'utf8').slice(0,300),/Tabler v1\.7\.5/);
for(const file of nativePages)assert.ok(pages.includes(file),file+' has an entry page');
console.log(`PASS: ${pages.length} entrypoints, ${scripts} scripts (${modules} ES modules), ${inline} inline scripts; native Tabler assets and module dependencies`);
