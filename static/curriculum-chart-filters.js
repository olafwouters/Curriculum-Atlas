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
if(typeof module==='object'&&module.exports)module.exports={chartState,originalKey};
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
 hint.textContent=(courses?tx('Deelvakken staan na hun module op de horizontale as. De volgorde binnen een module is geen individuele leerroute.','Submodules have their own labels after the parent module on the horizontal axis. Their order does not represent an individual learning pathway.'):tx('Alleen modulebrede koppelingen.','Module-wide mappings only.'))+' '+(electives?tx('Inclusief keuzemodules.','Elective modules included.'):tx('Keuzemodules verborgen.','Elective modules hidden.'));
 const legend=view.querySelector('.graph-legend');(legend||chart.parentElement).before(bar,hint);
 return result;
};
})();
