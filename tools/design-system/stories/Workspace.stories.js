import '../../../scripts/tabler-app/app.css';
import {metricCard, tableCard, chart, tabs,empty} from '../../../scripts/tabler-app/common.js';
export default {title:'工作台/公共组件'};
const rows=[{period:'26Q1',value:0},{period:'26Q2',value:null},{period:'26Q3',value:12}];
export const Metric={render:()=>metricCard({label:'演示指标',value:'12',unit:'元',period:'26Q3',href:'#',points:rows,change:0,changeLabel:'同比'})};
export const Missing={render:()=>empty('所选期间暂无披露')};
export const Table={render:()=>tableCard({title:'期间与数值',columns:[{key:'period',label:'期间'},{key:'value',label:'数值（元）',numeric:true}],rows})};
export const Tabs={render:()=>tabs([['a','本期','#a'],['b','历史','#b']],'a')};
export const Trend={render:()=>{const el=document.createElement('div');requestAnimationFrame(()=>chart(el,rows,{label:'演示指标',unit:'元'}));return el;}};