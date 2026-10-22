(function(root){
'use strict';
function format(value){
  const text=String(value??'').trim();let m;
  if(!text)return text;
  const yy=year=>String(year).slice(-2),month=v=>String(Number(v)),digit={'一':1,'二':2,'三':3,'四':4};
  if((m=text.match(/^(\d{4}|\d{2})年?\s*(\d{1,2})[—–~至-](\d{1,2})月(.*)$/)))return yy(m[1])+'M'+month(m[2])+'–'+month(m[3])+m[4];
  if((m=text.match(/^(\d{4}|\d{2})(?:年|[-/·.])(\d{1,2})(?:月|[-/])(\d{1,2})(?:日)?(.*)$/)))return yy(m[1])+'/'+month(m[2])+'/'+month(m[3])+m[4];
  if((m=text.match(/^((?:19|20)\d{2}|\d{2})\/((?:19|20)\d{2}|\d{2})$/))&&(m[2].length===4||Number(m[2])>12))return yy(m[1])+'/'+yy(m[2]);
  if((m=text.match(/^FY((?:19|20)\d{2})(.*)$/i)))return 'FY'+yy(m[1])+m[2];
  if((m=text.match(/^((?:19|20)\d{2})(\d{2})(\d{2})$/)))return yy(m[1])+'/'+month(m[2])+'/'+month(m[3]);
  if((m=text.match(/^(\d{4}|\d{2})\s*-?\s*[Ww](\d{1,2})(.*)$/)))return yy(m[1])+'W'+m[2].padStart(2,'0')+m[3];
  if((m=text.match(/^(\d{4}|\d{2})\s*[-·]?\s*[Qq]([1-4])(.*)$/)))return yy(m[1])+'Q'+m[2]+m[3];
  if((m=text.match(/^[Qq]([1-4])\s*(\d{4}|\d{2})(.*)$/)))return yy(m[2])+'Q'+m[1]+m[3];
  if((m=text.match(/^(\d{4}|\d{2})年?第?([1-4一二三四])季(?:度)?(.*)$/)))return yy(m[1])+'Q'+(digit[m[2]]||m[2])+m[3];
  if((m=text.match(/^(\d{4}|\d{2})\s*[-·]?\s*[Hh]([12])(.*)$/)))return yy(m[1])+'H'+m[2]+m[3];
  if((m=text.match(/^(\d{4}|\d{2})年([上下])半年(.*)$/)))return yy(m[1])+'H'+(m[2]==='上'?1:2)+m[3];
  if((m=text.match(/^(\d{4}|\d{2})\s*[Mm](\d{1,2})(.*)$/)))return yy(m[1])+'M'+month(m[2])+m[3];
  if((m=text.match(/^(\d{4}|\d{2})(?:年|[-/·.])(\d{1,2})(?:月)?(.*)$/)))return yy(m[1])+'M'+month(m[2])+m[3];
  if((m=text.match(/^((?:19|20)\d{2})(?:年)?(.*)$/)))return yy(m[1])+m[2];
  return text;
}
const api={format};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ChartPeriod=api;
})(typeof window==='object'?window:globalThis);
