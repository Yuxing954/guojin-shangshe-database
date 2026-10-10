(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FedwatchModel=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function valid(s){return !!s&&/^\d{4}-\d{2}-\d{2}$/.test(s.observedDate||'')&&s.probabilityUnit==='%'&&Array.isArray(s.ranges)&&s.ranges.length>0&&s.ranges.every(r=>finite(r.lower)&&finite(r.upper)&&r.upper>r.lower&&finite(r.probability)&&r.probability>=0&&r.probability<=100)&&Math.abs(s.ranges.reduce((n,r)=>n+r.probability,0)-100)<=.15&&new Set(s.ranges.map(r=>r.lower+':'+r.upper)).size===s.ranges.length&&s.ranges.slice().sort((a,b)=>a.lower-b.lower).every((r,i,a)=>i===0||r.lower>=a[i-1].upper);}
  function snapshots(meeting,now=Date.now()){return (meeting?.snapshots||[]).filter(s=>valid(s)&&Date.parse(s.observedAt||s.observedDate+'T23:59:59Z')<=now).slice().sort((a,b)=>String(a.observedAt||a.observedDate).localeCompare(String(b.observedAt||b.observedDate)));}
  function aggregate(s,policy){if(!valid(s)||!Array.isArray(policy?.range)||policy.range.length!==2||!policy.range.every(finite))return null;const [lower,upper]=policy.range;if(upper<=lower)return null;const values={cut:0,hold:0,hike:0};for(const r of s.ranges){if(r.lower===lower&&r.upper===upper)values.hold+=r.probability;else if(r.upper<=lower)values.cut+=r.probability;else if(r.lower>=upper)values.hike+=r.probability;else return null;}return values;}
  function comparison(s,previous){return s.ranges.map(r=>{const prior=previous?.ranges.find(p=>p.lower===r.lower&&p.upper===r.upper);return {...r,previous:prior?.probability??null,change:prior?r.probability-prior.probability:null};});}
  return {valid,snapshots,aggregate,comparison};
});

