(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZsxqContent=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function attribute(source,name){
    const attrs=String(source||'');
    const doubleQuoted=attrs.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*"([^"]*)"','i'));
    if(doubleQuoted)return doubleQuoted[1];
    const singleQuoted=attrs.match(new RegExp("(?:^|\\s)"+name+"\\s*=\\s*'([^']*)'","i"));
    return singleQuoted?singleQuoted[1]:'';
  }
  function decode(value){
    const raw=String(value||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    try{return decodeURIComponent(raw);}catch(_){return raw;}
  }
  function plain(value){
    return String(value??'').replace(/<e\b([^>]*?)\/\s*>/gi,function(_,attrs){
      const title=decode(attribute(attrs,'title')||attribute(attrs,'text')||attribute(attrs,'alt'));
      const type=attribute(attrs,'type').toLowerCase();
      if(type==='hashtag')return title;
      if(type.indexOf('text_')===0)return title;
      if(type==='link')return title||decode(attribute(attrs,'url'));
      return title;
    });
  }
  return {plain};
});