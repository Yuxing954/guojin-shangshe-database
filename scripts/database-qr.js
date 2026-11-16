(function(){
'use strict';
const button=document.getElementById('database-qr-download'),status=document.getElementById('database-qr-status'),image=document.getElementById('database-qr-image');
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='';
 let url;
 try{
  await image.decode();
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1080,1080);ctx.drawImage(image,0,0,1080,1080);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed');
  url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='国金商社数据库二维码.png';document.body.append(a);a.click();a.remove();status.textContent='二维码图片已生成';
 }catch(e){status.textContent='下载失败，请重试或长按二维码保存';}
 finally{button.disabled=false;if(url)setTimeout(()=>URL.revokeObjectURL(url),10000);}
});
})();
