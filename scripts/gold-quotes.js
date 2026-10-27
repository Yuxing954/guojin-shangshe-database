(function(){
'use strict';
const $=id=>document.getElementById(id),root=$('gold-market'),stock=$('stock-market');
if(!root||!stock)return;
let interval='D',observer,timer,sequence=0,mounted=false;
const item={symbol:'OANDA:XAUUSD',source:'https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA'};
function active(){return location.hash==='#gold'&&!document.hidden;}
function dispose(){sequence++;clearTimeout(timer);observer?.disconnect();$('gold-widget').replaceChildren();mounted=false;root.dataset.state='idle';}
function fail(){root.dataset.state='error';$('gold-state').hidden=false;$('gold-state').textContent='金价图表暂时无法连接，请重试或打开来源。';$('gold-retry').hidden=false;}
function load(force=false){
 if(!active())return;
 if(mounted&&!force)return;
 dispose();mounted=true;const current=sequence;
 root.dataset.state='loading';$('gold-state').hidden=false;$('gold-state').textContent='正在连接金价 K 线…';$('gold-retry').hidden=true;
 const container=document.createElement('div');container.className='tradingview-widget-container';
 const chart=document.createElement('div');chart.className='tradingview-widget-container__widget';
 const credit=document.createElement('div');credit.className='tradingview-widget-copyright';
 const link=document.createElement('a');link.href=item.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='TradingView · OANDA';credit.append(link);
 container.append(chart,credit);$('gold-widget').append(container);
 observer=new MutationObserver(()=>{
  const frame=container.querySelector('iframe');if(!frame||frame.dataset.goldObserved)return;
  frame.dataset.goldObserved='true';frame.title='伦敦金现 K线 · TradingView / OANDA';
  if(current!==sequence)return;clearTimeout(timer);root.dataset.state='embedded';$('gold-state').hidden=true;$('gold-retry').hidden=true;
 });
 observer.observe(container,{childList:true,subtree:true});
 const script=document.createElement('script');script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';script.async=true;
 script.textContent=JSON.stringify({autosize:true,symbol:item.symbol,interval,timezone:'Asia/Shanghai',theme:'light',style:'1',locale:'zh_CN',hide_side_toolbar:true,hide_volume:true,allow_symbol_change:false,save_image:false,calendar:false,support_host:'https://www.tradingview.com'});
 script.onerror=()=>{if(current===sequence&&active()){clearTimeout(timer);observer.disconnect();mounted=false;fail();}};
 container.append(script);timer=setTimeout(()=>{if(current===sequence&&active())fail();},20000);
}
function select(){
 const gold=location.hash==='#gold';stock.hidden=gold;root.hidden=!gold;
 document.querySelectorAll('[data-quote-market]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.quoteMarket==='gold')===gold)));
 if(gold)load();else{dispose();dispatchEvent(new Event('resize'));}
}
$('quote-market-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-quote-market]');if(b)location.hash=b.dataset.quoteMarket==='gold'?'gold':'';});
$('gold-periods').addEventListener('click',e=>{const b=e.target.closest('[data-gold-period]');if(!b||b.dataset.goldPeriod===interval)return;interval=b.dataset.goldPeriod;document.querySelectorAll('[data-gold-period]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));load(true);});
$('gold-refresh').onclick=$('gold-retry').onclick=()=>load(true);
addEventListener('hashchange',select);document.addEventListener('visibilitychange',()=>{if(active())load();else dispose();});addEventListener('pagehide',dispose);addEventListener('pageshow',select);select();
})();
