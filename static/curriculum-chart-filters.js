/* Display-only curriculum chart filters and separate course columns. */
(()=>{'use strict';
function chartState(workspace, courses, electives){
 const modules=[], entities=new Map(), courseLinks=new Map(), used=new Set(workspace.modules.map(m=>m.id));
 let serial=0;
 for(const m of workspace.modules){
  if(!electives&&m.elective)continue;
  modules.push({...m,courses:[]});entities.set(m.id,m.id);
  if(!courses)continue;
  for(const c of m.courses||[]){
   let id;do{id='atlas-chart-course-'+serial++;}while(used.has(id));used.add(id);
   const code=encodeURIComponent(c.code),ui=m.id+'|'+code;
   modules.push({...m,id,name:'↳ '+(c.name||c.code),courses:[]});
   entities.set(m.id+'::'+code,id);entities.set(ui,id);courseLinks.set(id,ui);
  }
 }
 const entries=new Map();
 for(const [key,value] of Object.entries(workspace.mappings||{})){
  const sep=key.indexOf('|');if(sep<0)continue;
  const entity=key.slice(sep+1),id=entities.get(entity);if(id===undefined)continue;
  const projected=key.slice(0,sep+1)+id;
  if(!entries.has(projected)||entity.includes('::'))entries.set(projected,value);
 }
 return {state:{...workspace,modules,mappings:Object.fromEntries(entries)},courseLinks};
}
function originalKey(key,links){
 const sep=key.indexOf('|'),entity=links.get(key.slice(sep+1));
 return sep>=0&&entity?key.slice(0,sep+1)+entity:key;
}
function pathwaySegments(points){
 const domains=new Map();
 for(const p of points){
  if(!domains.has(p.domain))domains.set(p.domain,new Map());
  const columns=domains.get(p.domain);
  if(!columns.has(p.column))columns.set(p.column,[]);
  columns.get(p.column).push(p);
 }
 const segments=[];
 for(const columns of domains.values()){
  const ordered=[...columns].sort((a,b)=>a[0]-b[0]).map(entry=>entry[1]);
  for(let i=1;i<ordered.length;i++)for(const a of ordered[i-1])for(const b of ordered[i])segments.push([a,b]);
 }
 return segments;
}
function drawPathways(chart,projection,outcomes){
 const columns=new Map(projection.state.modules.slice().sort((a,b)=>a.year-b.year).map((m,i)=>[m.id,i]));
 const byId=new Map(outcomes.map(o=>[o.id,o])),points=[];
 for(const mark of chart.querySelectorAll('g[data-graph-key]')){
  const [oid,id]=mark.dataset.graphKey.split('|');
  if(!projection.courseLinks.has(id))continue;
  const outcome=byId.get(oid),dot=mark.querySelector('circle:last-of-type');
  if(!outcome||!dot)continue;
  points.push({domain:outcome.domain,color:outcome.color,column:columns.get(id),x:dot.getAttribute('cx'),y:dot.getAttribute('cy')});
 }
 const coords=new Set(points.map(p=>p.x+','+p.y));
 for(const line of chart.querySelectorAll('line.domain-connection')){
  if([1,2].some(i=>coords.has(line.getAttribute('x'+i)+','+line.getAttribute('y'+i))))line.remove();
 }
 const anchor=chart.querySelector('g[data-graph-key]');if(!anchor)return;
 const group=document.createElementNS(chart.namespaceURI,'g');group.setAttribute('aria-hidden','true');group.setAttribute('pointer-events','none');
 for(const [a,b] of pathwaySegments(points)){
  const line=document.createElementNS(chart.namespaceURI,'line');
  const attrs={class:'domain-connection atlas-course-pathway',x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:a.color,'stroke-width':'2','stroke-opacity':'0.72','vector-effect':'non-scaling-stroke'};
  for(const [k,v] of Object.entries(attrs))line.setAttribute(k,v);
  group.append(line);
 }
 if(group.childNodes.length)anchor.before(group);
}
if(typeof module==='object'&&module.exports)module.exports={chartState,originalKey,pathwaySegments};
if(typeof document==='undefined'||typeof dashboard!=='function')return;
const prior=dashboard;
let courses=true,electives=false;
const tx=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
dashboard=function(view){
 const workspace=state;
 if(!workspace)return prior.apply(this,arguments);
 const projection=chartState(workspace,courses,electives);
 let result;
 try{state=projection.state;result=prior.apply(this,arguments);}finally{state=workspace;}
 const chart=view.querySelector('.curriculum-chart');if(!chart)return result;
 if(courses)drawPathways(chart,projection,F);
 view.querySelectorAll('[data-graph-key]').forEach(point=>{
  const key=point.dataset.graphKey,original=originalKey(key,projection.courseLinks);
  if(key===original)return;
  point.dataset.graphKey=original;point.onclick=()=>mapping(original);
  if(point.tagName.toLowerCase()==='g')point.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mapping(original);}};
 });
 const select=view.querySelector('#year');
 if(select){
  const years=[...new Set(workspace.modules.map(m=>m.year))].sort((a,b)=>a-b);
  for(const y of years){if(!Array.from(select.options).some(o=>o.value===String(y)))select.add(new Option(tx('Jaar ','Year ')+y,String(y)));}
  select.value=year||'';
 }
 const bar=document.createElement('div');bar.className='filters atlas-chart-filters';bar.dataset.noTranslate='';
 bar.setAttribute('role','group');bar.setAttribute('aria-label',tx('Weergave curriculumgrafiek','Curriculum chart display'));
 const add=(id,label,on,toggle)=>{
  const button=document.createElement('button');button.type='button';button.id=id;button.textContent=label;
  button.setAttribute('aria-pressed',String(on));if(on)button.classList.add('primary');
  button.onclick=()=>{toggle();render();document.getElementById(id)?.focus({preventScroll:true});};bar.append(button);
 };
 add('atlas-chart-courses',tx('Deelvakken tonen','Show submodules'),courses,()=>{courses=!courses;});
 add('atlas-chart-electives',tx('Keuzeonderwijs tonen','Show electives'),electives,()=>{electives=!electives;});
 const hint=document.createElement('p');hint.className='hint';hint.dataset.noTranslate='';
 hint.textContent=(courses?tx('Leerlijnen verbinden deelvakken met een koppeling voor dezelfde competentie, ook tussen hoofdmodules. Een lijn over een leeg deelvak betekent niet dat daar een koppeling is.','Learning pathways connect submodules mapped to the same competence, even across parent modules. A line over an empty submodule does not mean it has a mapping.'):tx('Alleen modulebrede koppelingen.','Module-wide mappings only.'))+' '+(electives?tx('Inclusief keuzemodules.','Elective modules included.'):tx('Keuzemodules verborgen.','Elective modules hidden.'));
 const legend=view.querySelector('.graph-legend');(legend||chart.parentElement).before(bar,hint);
 return result;
};
})();
