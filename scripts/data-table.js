/* Enhance native tables without replacing their rows, controls or data. */
(()=>{
 'use strict';
 const selector='main table,.site-main table';
 const numeric=/^[+−–-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*(?:%|％|pct|百分点|亿元|万元|元|万人次|万人|万间|间|家|吨|点)?$/i;
 function format(table){
   if(!table.isConnected||!table.matches(selector))return;
   table.classList.add('site-data-table');
   let frame=table.parentElement;
   if(!frame.classList.contains('site-table-scroll')){
     if(!['auto','scroll'].includes(getComputedStyle(frame).overflowX)){
       frame=document.createElement('div');table.before(frame);frame.append(table);
     }
     frame.classList.add('site-table-scroll');
     frame.tabIndex=0;frame.setAttribute('role','region');
     frame.setAttribute('aria-label',table.caption?.textContent.trim()||'数据表，可横向滑动查看');
   }
   const kinds=[];
   for(const body of table.tBodies)for(const row of body.rows){
     for(const cell of row.cells){
       const value=cell.textContent.trim();
       const number=cell.colSpan===1&&numeric.test(value)&&!cell.querySelector('button,a,input');
       cell.toggleAttribute('data-table-number',number);
       if(cell.colSpan===1&&value&&!/^[-—–]+$/.test(value)){
         kinds[cell.cellIndex]=number&&kinds[cell.cellIndex]!==false;
       }
     }
   }
   if(table.tHead)for(const row of table.tHead.rows)for(const cell of row.cells)
     cell.toggleAttribute('data-table-number',cell.colSpan===1&&kinds[cell.cellIndex]===true);
 }
 const dirty=new Set();let pending=false;
 function enqueue(table){if(table)dirty.add(table)}
 function flush(){pending=false;dirty.forEach(format);dirty.clear()}
 function start(){
   document.querySelectorAll(selector).forEach(format);
   new MutationObserver(records=>{
     for(const record of records){
       const parent=record.target.nodeType===1?record.target:record.target.parentElement;
       enqueue(parent?.closest('table'));
       for(const node of record.addedNodes){
         if(node.nodeType!==1)continue;
         if(node.matches('table'))enqueue(node);
         else node.querySelectorAll('table').forEach(enqueue);
       }
     }
     if(dirty.size&&!pending){pending=true;requestAnimationFrame(flush)}
   }).observe(document.body,{subtree:true,childList:true,characterData:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
