(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotesPoller=api;})(typeof window==='object'?window:{},function(){
  'use strict';
  // UI cadence is independent of the unverified public provider's request allowance.
  const UI_INTERVAL=1000,PROVIDER_INTERVAL=15000;
  function create({request,isActive,onTick=()=>{},now=Date.now,setTimer=setInterval,clearTimer=clearInterval}){
    let timer=null,pending=false,nextAt=0,failures=0,controller=null,stopped=false;
    function state(){return {pending,nextAt,failures,remaining:Math.max(0,Math.ceil((nextAt-now())/1000))};}
    async function check(){
      onTick(state());
      if(stopped||!isActive()||pending||now()<nextAt)return false;
      pending=true;controller=new AbortController();const current=controller;
      nextAt=now()+PROVIDER_INTERVAL;
      try{const ok=await request(current.signal);if(!current.signal.aborted){failures=ok===false?failures+1:0;nextAt=Math.max(nextAt,now()+(failures?Math.min(300000,PROVIDER_INTERVAL*2**Math.min(failures,5)):0));}}
      catch(e){if(!current.signal.aborted){failures++;nextAt=Math.max(nextAt,now()+Math.min(300000,PROVIDER_INTERVAL*2**Math.min(failures,5)));}}
      finally{pending=false;controller=null;if(!stopped&&isActive())onTick(state());}
      return true;
    }
    function pause(){if(timer!==null)clearTimer(timer);timer=null;controller?.abort();}
    function sync(){pause();if(!stopped&&isActive()){timer=setTimer(check,UI_INTERVAL);check();}}
    function stop(){stopped=true;pause();}
    function resume(){stopped=false;sync();}
    return {check,sync,pause,stop,resume,state};
  }
  return {create,UI_INTERVAL,PROVIDER_INTERVAL};
});
