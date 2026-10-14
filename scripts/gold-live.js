(function(){
  'use strict';
  const host=document.getElementById('gold-live');if(!host)return;
  const D=SiteData,M=GoldLiveModel,quotes=new Map(),errors=new Set();let pending=false,controller,timer;
  const definitions=[['AU9999','上金所 Au99.99','元/克','5分钟快照'],['XAU','国际现货黄金','美元/金衡盎司','15秒读取'],['GC','COMEX 黄金期货','美元/金衡盎司','15秒读取']];
  const now=()=>new Date().toISOString();
  function accept(id,q){quotes.set(id,M.accept(quotes.get(id),q));errors.delete(id);}
  function paint(){
    for(const [id] of definitions){const el=host.querySelector('[data-gold="'+id+'"]'),q=quotes.get(id),age=q?(Date.now()-Date.parse(q.asOf))/60000:Infinity;
      el.querySelector('.gold-live-price').textContent=q?D.fmt(q.price,2):'—';
      const source=el.querySelector('.gold-live-source');if(source){const url=D.link(q?.url);source.textContent=q?.source||'来源未提供';source.hidden=!q;if(url)source.href=url;else source.removeAttribute('href');}
      const change=el.querySelector('.gold-live-change');change.textContent=Number.isFinite(q?.percent)?(q.percent>0?'+':'')+D.fmt(q.percent,2)+'%':'—';change.className='gold-live-change '+(q?.percent>0?'up':q?.percent<0?'down':'');
      el.querySelector('time').textContent=q?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(q.asOf))+' 北京时间':'等待报价';
    }
  }
  function international(signal){return new Promise((resolve,reject)=>{
    const tag=document.createElement('script');tag.charset='gbk';let done=false;
    const clean=()=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);tag.remove();delete window.v_hf_XAU;delete window.v_hf_GC;};
    const finish=(error)=>{if(done)return;done=true;clean();error?reject(error):resolve();};
    const abort=()=>finish(Error('Cancelled'));
    const timeout=setTimeout(()=>finish(Error('Timeout')),10000);
    delete window.v_hf_XAU;delete window.v_hf_GC;
    tag.onload=()=>{for(const [id,key] of [['XAU','v_hf_XAU'],['GC','v_hf_GC']]){try{accept(id,{...M.parse(window[key]),retrievedAt:now()});}catch(e){errors.add(id);}}finish();};
    tag.onerror=()=>finish(Error('Network'));signal.addEventListener('abort',abort,{once:true});tag.src='https://qt.gtimg.cn/q=hf_XAU,hf_GC&_='+Date.now();document.head.append(tag);
  });}
  function active(){return !document.hidden&&!host.closest('[hidden]');}
  async function refresh(){if(pending||!active())return;pending=true;controller=new AbortController();const signal=controller.signal,deadline=setTimeout(()=>controller.abort(),12000);
    await Promise.allSettled([
      fetch('data/gold-jewelry/live.json?_='+Math.floor(Date.now()/60000),{cache:'no-store',signal}).then(r=>{if(!r.ok)throw Error('Snapshot');return r.json();}).then(q=>accept('AU9999',q)).catch(()=>errors.add('AU9999')),
      international(signal).catch(()=>{errors.add('XAU');errors.add('GC');}).then(async()=>{if(!errors.has('XAU')||signal.aborted)return;try{const r=await fetch('https://api.gold-api.com/price/XAU',{signal});if(!r.ok)throw Error('Gold API');const q=await r.json();accept('XAU',{price:q.price,percent:null,asOf:q.updatedAt,source:'Gold API',url:'https://gold-api.com/docs'});}catch(e){errors.add('XAU');}})
    ]);clearTimeout(deadline);pending=false;paint();
  }
  host.innerHTML='<div class="gold-live-head"><h2>国内与国际金价</h2><button class="portal-button" type="button">刷新报价</button></div><div class="gold-live-grid">'+definitions.map(([id,name,unit,interval])=>'<article class="board-stat" data-gold="'+id+'"><span>'+name+'</span><strong class="gold-live-price">—</strong><span>'+unit+'</span><div class="gold-live-detail"><span class="gold-live-change">—</span><span>'+interval+'</span></div><time>等待报价</time><a class="gold-live-source" target="_blank" rel="noopener" hidden></a></article>').join('')+'</div>';
  host.querySelector('button').onclick=refresh;
  function resume(){clearInterval(timer);if(active()){refresh();timer=setInterval(refresh,15000);}else controller?.abort();}
  document.addEventListener('gold:view-change',resume);addEventListener('hashchange',resume);document.addEventListener('visibilitychange',resume);addEventListener('pagehide',()=>{clearInterval(timer);controller?.abort();});addEventListener('pageshow',resume);resume();
})();
