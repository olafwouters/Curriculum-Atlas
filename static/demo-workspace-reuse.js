/* One shared four-year demo, with independent DAS and DigComp mappings. */
(()=>{'use strict';
const marker='das-digcomp-four-year-v1';
const combined=s=>s?.atlasDemoKind===marker;
function buildCombined(input,set,language='nl'){
 if(input.framework!=='digcomp'||input.modules?.length!==16||input.modules.some(m=>m.courses?.length!==2)||[1,2,3,4].some(y=>input.modules.filter(m=>m.year===y).length!==4))throw Error('Combined demo requires the four-year DigComp structure.');
 const s=structuredClone(input),en=language==='en',tx=(nl,english)=>en?english:nl,roman=['I','II','III','IV'];
 const domains=[...new Set((set.outcomes||[]).map(o=>o.domain))];if(domains.length!==10)throw Error('Expected the ten-domain DAS demonstration set.');
 const lookup=new Map();for(const d of domains)for(const r of roman){const found=set.outcomes.filter(o=>o.domain===d&&String(o.level).split('.')[0].trim()===r);if(found.length!==1)throw Error('DAS framework mismatch: '+d+' '+r);lookup.set(d+'|'+r,found[0]);}
 const ids=new Set(set.outcomes.map(o=>o.id));if(Object.keys(s.mappings).some(k=>ids.has(k.split('|')[0])))throw Error('DAS and DigComp outcome IDs overlap.');
 s.atlasDemoKind=marker;s.programme=tx('Demonstratie DAS + DigComp 3.0 — vier jaar','DAS + DigComp 3.0 demonstration — four years');s.custom={name:set.name,outcomes:structuredClone(set.outcomes)};
 const basic=[1,1,1,2,2,2,2,2,2,3,3,3,3,3,3,3],advanced=[1,1,2,2,2,2,3,3,3,3,3,3,3,3,4,4];
 const extended=new Set(['Onderzoeken','Experimenteren','Ontwikkelen','Modelleren']);
 s.modules.forEach((m,i)=>m.courses.forEach((c,j)=>domains.forEach(d=>{
  const n=(extended.has(d)?advanced:basic)[i],o=lookup.get(d+'|'+roman[n-1]),phase=j?'mastery':i===0?'introduced':'practised',testing=j?'summative':i===0?'none':'formative';
  const context=m.name+' / '+c.name;
  s.mappings[o.id+'|'+m.id+'::'+encodeURIComponent(c.code)]={phase,testing,status:j?'assessed':phase,review:'supported',decision:'included',intended:context+' — '+o.text,evidence:tx('Fictieve Applied Science-casus binnen ','Fictional Applied Science case within ')+context+'. '+(j?tx('Lever een zelfstandig beroepsproduct met onderbouwing, resultaten en reflectie.','Submit an independent professional product with justification, results and reflection.'):tx('Werk een analyse en plan uit, bespreek feedback en verbeter de aanpak.','Develop an analysis and plan, discuss feedback and improve the approach.'))+' '+tx('Competentiespecifieke taakeis: ','Competence-specific task requirement: ')+o.text,assessment:j?tx('Summatief: individueel portfolio en mondelinge verantwoording. Beoordeel uitvoering, onderbouwing en bewijs op niveau ','Summative: individual portfolio and oral justification. Assess execution, justification and evidence at level ')+roman[n-1]+' ('+d+').':i===0?tx('Begeleide introductie zonder afzonderlijke beoordeling.','Guided introduction without separate assessment.'):tx('Formatieve feedback op plan, uitvoering en verbetervoorstel.','Formative feedback on the plan, execution and improvement proposal.'),rationale:tx('Fictieve DAS-taakeis bij dit deelvak, geen gemeten studentvaardigheid. De originele DAS-leeruitkomst is ongewijzigd opgenomen.','Fictional DAS task requirement for this submodule, not measured student proficiency. The original Dutch DAS learning outcome is retained unchanged.'),elsewhere:'',bloom:''};
 })));
 domains.forEach(d=>{const n=extended.has(d)?4:3,o=lookup.get(d+'|'+roman[n-1]);s.targets[d]={relevance:'Relevant',level:o.level,rationale:tx('Fictief DAS-eindniveau bij deze vierjarige demonstratie: ','Fictional DAS exit level for this four-year demonstration: ')+roman[n-1]+'.'};});
 s.notes+='\n\n'+tx('Eén gedeelde structuur met afzonderlijke DAS- en DigComp-mappings en eindniveaus. Wisselen van raamwerk verwijdert geen gegevens. Alle casussen zijn fictief.','One shared structure with separate DAS and DigComp mappings and targets. Switching frameworks does not delete data. All cases are fictional.');return s;
}
if(typeof module==='object'&&module.exports)module.exports={buildCombined,combined};
if(typeof document==='undefined')return;
const tx=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
const priorInstall=install;let pending=null;
install=function(s){
 const candidate=s?.framework==='digcomp'&&s.modules?.length===16&&s.modules.every(m=>/^dig-demo-\d+$/.test(m.id));
 if(!candidate)return priorInstall.apply(this,arguments);
 if(combined(state))return;
 if(pending)return pending;
 const initialState=state,initialId=id;
 pending=(async()=>{
  const rows=await api('/api/workspaces');if(!Array.isArray(rows))throw Error('Invalid workspace list.');
  const candidates=rows.filter(w=>!w.archived).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||''))||String(a.id).localeCompare(String(b.id)));let found=null;
  for(let i=0;i<candidates.length&&!found;i+=4){const group=candidates.slice(i,i+4),loaded=await Promise.all(group.map(w=>api('/api/workspaces/'+encodeURIComponent(w.id))));loaded.forEach(w=>{if(!Array.isArray(w.state?.modules))throw Error('Workspace data is missing.');});const at=loaded.findIndex(w=>combined(w.state));if(at!==-1)found=group[at];}
  if(state!==initialState||id!==initialId)return;
  if(found){const saved=document.getElementById('saved');if(!saved)throw Error('Workspace selector is missing.');if(![...saved.options].some(o=>o.value===String(found.id)))saved.add(new Option(found.name||found.programme,String(found.id)));saved.value=String(found.id);saved.dispatchEvent(new Event('change',{bubbles:true}));return;}
  const response=await fetch('/static/demo-das-set.json');if(!response.ok)throw Error('DAS demonstration set could not load.');const next=buildCombined(s,await response.json(),localStorage.getItem('compass-language'));
  if(state!==initialState||id!==initialId||!canSwitch())return;
  return priorInstall.call(this,next);
 })().catch(error=>say(tx('Demonstratie niet geopend; geen kopie gemaakt. ','Demo not opened; no copy created. ')+error.message)).finally(()=>{pending=null;});return pending;
};
function controls(){
 const old=document.getElementById('atlas-demo-framework');old?.remove();if(!combined(state))return;
 const view=document.getElementById('view');if(!view)return;const section=document.createElement('section');section.id='atlas-demo-framework';section.className='filters';section.dataset.noTranslate='';section.setAttribute('aria-label',tx('Demonstratieraamwerk','Demonstration framework'));
 const label=document.createElement('span');label.textContent=tx('Demonstratieraamwerk:','Demonstration framework:');section.append(label);
 for(const [value,text] of [['digcomp','DigComp 3.0'],['custom','DAS']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-pressed',String((state.framework==='custom'?'custom':'digcomp')===value));button.onclick=()=>{if(!combined(state)||state.framework===value)return;if(busy){say(tx('Wacht tot opslaan klaar is.','Wait until saving finishes.'));return;}state.framework=value;changed();render();};section.append(button);}view.prepend(section);
}
const priorRender=render;render=function(...args){const result=priorRender.apply(this,args);controls();return result;};
document.addEventListener('click',event=>{if(!event.target.closest?.('#demo'))return;const dig=document.querySelector('#dialog[open] [data-demo="dig"]'),das=document.querySelector('#dialog[open] [data-demo="das"]');if(dig)dig.textContent=tx('DAS + DigComp 3.0 — vier jaar, 16 modules, 32 deelvakken','DAS + DigComp 3.0 — four years, 16 modules, 32 submodules');if(das)das.remove();});
const style=document.createElement('style');style.textContent='@media print{#atlas-demo-framework{display:none!important}}';document.head.append(style);controls();
})();
