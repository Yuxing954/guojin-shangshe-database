'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
let inline=0,scripts=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(__dirname).filter(f=>f.endsWith('.js'))){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});scripts++;}
for(const file of pages){
 const html=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!/^<<<<<<<|^=======|^>>>>>>>/m.test(html),file+' merge conflict');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc\s*=/i.test(match[1])&&match[2].trim()&&!/type=["']application\//i.test(match[1])){new vm.Script(match[2],{filename:file});inline++;}}
 const head=html.slice(0,html.indexOf('</head>')),styles=[...head.matchAll(/<link\b[^>]*href="(scripts\/[^"?]+\.css)[^"\s]*"/g)].map(m=>m[1]);
 for(const match of html.matchAll(/(?:src|href)="(scripts\/[^"?#]+)[^"\s]*"/g))assert.ok(fs.existsSync(path.join(root,match[1])),file+' missing '+match[1]);
 if(!styles.includes('scripts/site.css'))continue; // Redirects have no workspace.
 assert.equal(styles.filter(s=>s==='scripts/site.css').length,1,file+' shared base');
 assert.ok(head.indexOf('scripts/site-ui.js')>=0&&head.indexOf('scripts/site-ui.js')<head.indexOf('scripts/site-shell.js'),file+' dependency ordering');
 if(html.includes('data-design="workspace"')){
  assert.equal(styles.at(-1),'scripts/workspace-design.css',file+' canonical design must load last');
  assert.equal(styles.filter(s=>s==='scripts/workspace-design.css').length,1,file+' duplicate design');
 }
 for(const adapter of ['scripts/industry-design.css','scripts/macro-design.css','scripts/company-design.css']){
  if(styles.includes(adapter))assert.ok(styles.indexOf(adapter)>styles.indexOf('scripts/site-polish.css'),file+' adapter dependency');
 }
}
console.log('PASS: '+pages.length+' entrypoints, '+scripts+' scripts, '+inline+' inline scripts; asset dependencies and canonical design order');
