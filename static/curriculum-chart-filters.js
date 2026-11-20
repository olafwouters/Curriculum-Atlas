/* Display-only curriculum chart filters. */
(()=>{'use strict';
function chartState(workspace, courses, electives){
 const modules=workspace.modules.filter(m=>electives||!m.elective);
 const entities=new Set();
 for(const m of modules){
  entities.add(m.id);
  if(courses)for(const c of m.courses||[]){const code=encodeURIComponent(c.code);entities.add(m.id+'::'+code);entities.add(m.id+'|'+code);}
 }
 const mappings=Object.fromEntries(Object.entries(workspace.mappings||{}).filter(([key])=>{const sep=key.indexOf('|');return sep>=0&&entities.has(key.slice(sep+1));}));
 return {...workspace,modules:courses?modules:modules.map(m=>({...m,courses:[]})),mappings};
}
if(typeof module==='object'&&module.exports)module.exports=chartState;
if(typeof document==='undefined'||typeof dashboard!=='function')return;
const prior=dashboard;
let courses=true,electives=false;
const tx=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
dashboard=function(view){
 const workspace=state;
 if(!workspace)return prior.apply(this,arguments);
 let result;
 try{state=chartState(workspace,courses,electives);result=prior.apply(this,arguments);}finally{state=workspace;}
 const chart=view.querySelector('.curriculum-chart');if(!chart)return result;
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
 hint.textContent=(courses?tx('Module- en deelvakkoppelingen.','Module and submodule mappings.'):tx('Alleen modulebrede koppelingen.','Module-wide mappings only.'))+' '+(electives?tx('Inclusief keuzemodules.','Elective modules included.'):tx('Keuzemodules verborgen.','Elective modules hidden.'));
 const legend=view.querySelector('.graph-legend');(legend||chart.parentElement).before(bar,hint);
 return result;
};
})();
