/* Keep report paths and targets with their owning competence, never their colour. */
(()=>{'use strict';
const coordinate=(x,y)=>Number(x)+','+Number(y);
function tagGraph(chart,outcomes){
 if(!chart)return;
 const byId=new Map(outcomes.map(o=>[o.id,o.domain])),domains=[...new Set(outcomes.map(o=>o.domain))],owners=new Map();
 for(const point of chart.querySelectorAll('g.graph-point[data-graph-key]')){
  const domain=byId.get(point.dataset.graphKey.split('|')[0]),dot=point.querySelector('circle:last-of-type');
  if(domain===undefined||!dot)continue;
  point.dataset.atlasDomain=domain;
  const key=coordinate(dot.getAttribute('cx'),dot.getAttribute('cy'));
  if(!owners.has(key))owners.set(key,new Set());owners.get(key).add(domain);
 }
 for(const line of chart.querySelectorAll('line.domain-connection')){
  const from=owners.get(coordinate(line.getAttribute('x1'),line.getAttribute('y1'))),to=owners.get(coordinate(line.getAttribute('x2'),line.getAttribute('y2')));
  const common=from&&to?[...from].filter(d=>to.has(d)):[];
  if(common.length===1)line.dataset.atlasDomain=common[0];else delete line.dataset.atlasDomain;
 }
 for(const target of chart.querySelectorAll('.target-level-line')){
  const title=target.querySelector('title')?.textContent||'';
  const matches=domains.filter(d=>{const prefix='Doelniveau '+d+': ';return title.startsWith(prefix)&&/^(IV|III|II|I)(?:\s|$)/.test(title.slice(prefix.length));});
  if(matches.length===1)target.dataset.atlasDomain=matches[0];else delete target.dataset.atlasDomain;
 }
}
function isolateGraph(chart,domain){
 if(!chart)return;
 for(const el of chart.querySelectorAll('g.graph-point,line.domain-connection,.target-level-line'))if(el.dataset.atlasDomain!==domain)el.remove();
 chart.dataset.atlasReportDomain=domain;
}
const api={tagGraph,isolateGraph};
if(typeof module==='object'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
window.AtlasGraphDomains=api;
if(typeof dashboard==='function'){
 const prior=dashboard;
 dashboard=function(view){const result=prior.apply(this,arguments);tagGraph(view.querySelector('svg.curriculum-chart'),typeof F==='undefined'?[]:F);return result;};
}
if(typeof F!=='undefined')tagGraph(document.querySelector('#view svg.curriculum-chart'),F);
function repairReport(){
 const doc=document.getElementById('qol-print-frame')?.contentDocument;
 if(!doc?.querySelector('.cover')||typeof F==='undefined')return;
 const domains=[...new Set(F.map(o=>o.domain))];
 for(const selector of ['.sheet-b','.atlas-report-graph'])[...doc.querySelectorAll(selector)].forEach((page,i)=>{
  if(i<domains.length)isolateGraph(page.querySelector('svg.curriculum-chart'),domains[i]);
 });
}
new MutationObserver(()=>queueMicrotask(repairReport)).observe(document.body,{childList:true});
repairReport();
})();
