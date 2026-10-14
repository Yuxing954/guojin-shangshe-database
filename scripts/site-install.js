(function(){
'use strict';
if(window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1')return;
const base=new URL('../',document.currentScript.src),home=new URL('industry.html',base).href;
let pending,entry,dialog,platform=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':'android';
const mode=matchMedia('(display-mode: standalone)'),installed=()=>mode.matches||navigator.standalone===true;
const inApp=/MicroMessenger|Weibo|DingTalk|QQ\//i.test(navigator.userAgent);
const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();pending=e;refresh();});
addEventListener('appinstalled',()=>{pending=null;if(entry)entry.hidden=true;if(dialog?.open)dialog.close();});
mode.addEventListener?.('change',()=>{if(entry)entry.hidden=installed();if(installed()&&dialog?.open)dialog.close();});
function refresh(){
 if(!dialog)return;
 dialog.querySelectorAll('[data-install-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.installPlatform===platform)));
 dialog.querySelector('#install-ios').hidden=platform!=='ios';
 dialog.querySelector('#install-android').hidden=platform!=='android';
 dialog.querySelector('#install-in-app').hidden=!inApp;
 dialog.querySelector('#install-native').hidden=!pending||inApp||platform==='ios';
}
async function install(){
 const event=pending;if(!event)return;pending=null;const button=dialog.querySelector('#install-native');button.disabled=true;
 try{await event.prompt();const choice=await event.userChoice;dialog.querySelector('#install-status').textContent=choice.outcome==='accepted'?'请在系统提示中完成添加。':'可按下方步骤手动添加。';}
 catch{dialog.querySelector('#install-status').textContent='请按下方步骤添加。';}
 finally{button.disabled=false;refresh();}
}
function init(){
 const nav=document.querySelector('.site-nav');if(!nav)return;
 entry=document.createElement('button');entry.className='site-install-entry';entry.type='button';entry.setAttribute('aria-haspopup','dialog');entry.setAttribute('aria-controls','site-install-dialog');
 entry.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 6v9m-4-4 4 4 4-4M10 19h4"/></svg><span>添加到桌面</span>';
 nav.insertBefore(entry,nav.querySelector('.site-search'));entry.hidden=installed();
 dialog=document.createElement('dialog');dialog.id='site-install-dialog';dialog.className='site-install-dialog';dialog.setAttribute('aria-labelledby','install-title');
 dialog.innerHTML='<button class="install-close" type="button" aria-label="关闭添加说明">×</button><header class="install-heading"><img src="'+new URL('scripts/assets/app/icon-192.png',base).href+'" width="56" height="56" alt=""><div><h2 id="install-title">添加到手机桌面</h2><p>国金商社数据库</p></div></header><div class="install-qr"'+(mobile?' hidden':'')+'><img src="'+new URL('scripts/assets/app/home-qr.svg',base).href+'" width="148" height="148" alt="用手机扫描打开国金商社数据库"><p>用手机扫码打开</p></div><p id="install-in-app" class="install-in-app" hidden>先点右上角“···”，选择在浏览器打开。</p><div class="install-platforms" role="group" aria-label="手机类型"><button type="button" data-install-platform="ios">iPhone / iPad</button><button type="button" data-install-platform="android">安卓</button></div><button type="button" id="install-native" hidden>添加到桌面</button><ol id="install-ios"><li>用 Safari 打开数据库。</li><li>点“分享” <span aria-hidden="true">↥</span>，选择“添加到主屏幕”。</li><li>确认名称，点“添加”。</li></ol><ol id="install-android"><li>用 Chrome、Edge 或手机自带浏览器打开。</li><li>点浏览器菜单，选择“添加到主屏幕”或“安装应用”。</li><li>按系统提示确认添加。</li></ol><div class="install-bottom"><button type="button" id="install-copy">复制数据库网址</button><span id="install-status" role="status" aria-live="polite"></span></div>';
 document.body.append(dialog);
 entry.onclick=()=>{refresh();dialog.querySelector('#install-status').textContent='';if(!dialog.open)dialog.showModal();};
 dialog.querySelector('.install-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{if(!entry.hidden)entry.focus();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.querySelectorAll('[data-install-platform]').forEach(b=>b.onclick=()=>{platform=b.dataset.installPlatform;refresh();});
 dialog.querySelector('#install-native').onclick=install;
 dialog.querySelector('#install-copy').onclick=async()=>{
  const status=dialog.querySelector('#install-status');try{await navigator.clipboard.writeText(home);status.textContent='网址已复制';}
  catch{status.textContent='长按复制：'+home;}
 };
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
