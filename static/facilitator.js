/* Shared curriculumscan route and facilitator guide. Explicit workspace progress and profile annotations; existing save/export schema. */
((root)=>{'use strict';
const phases=[{id:'A',title:['Ontdekken','Explore']},{id:'B',title:['Richting bepalen','Set direction']},{id:'C',title:['Verbeteren','Improve']}];
const steps=[
{id:'framework',phase:'A',route:'digcomp',title:['DigComp leren kennen','Get to know DigComp'],question:['Wat betekenen deze domeinen voor onze opleiding?','What do these domains mean for our programme?'],record:['Een gedeeld begrip van het gekozen raamwerk en vragen voor het teamgesprek.','A shared understanding of the selected framework and questions for discussion.']},
{id:'current-curriculum',phase:'A',route:'matrix',title:['In kaart brengen wat we al doen','Map what we already do'],question:['Waar en hoe krijgt dit nu al een plek in het curriculum?','Where and how is this already addressed in the curriculum?'],record:['Bestaande koppelingen, onderbouwing en nog onbesproken onderdelen. Noteer verbeterideeën apart.','Existing mappings, supporting evidence and unreviewed areas. Keep improvement ideas separate.']},
{id:'profile',phase:'B',route:'sessions',title:['Beroeps- en opleidingsprofiel analyseren','Analyse professional and programme profiles'],question:['Welke ambities en keuzes volgen uit ons profiel?','Which ambitions and choices follow from our profile?'],record:['De gebruikte profielbronnen en de gevolgen voor curriculumkeuzes.','Profile sources and their implications for curriculum choices.'],note:['Leg profielbronnen, analyse en curriculumkeuzes hieronder vast. Bestaande sessienotities blijven behouden.','Record profile sources, analysis and curriculum choices below. Existing session notes are preserved.']},
{id:'levels',phase:'B',route:'targets',title:['Begin- en eindniveau vaststellen','Establish starting and ending levels'],question:['Wat veronderstellen we bij de start en wat willen we bij afstuderen bereiken?','What do we assume at entry and what should graduates achieve?'],record:['Gewenste eindniveaus met rationale; expliciete aannames en onzekerheden over het beginniveau.','Intended ending levels with rationale; explicit assumptions and uncertainties about entry levels.'],note:['Doelniveau bevat nu de eindniveaus. Noteer beginaannames voorlopig in Sessienotities; aparte beginvelden volgen later.','Target Level currently records ending levels. Keep entry assumptions in Session Notes for now; dedicated entry fields will follow later.']},
{id:'compare',phase:'C',route:'dashboard',title:['Huidige situatie vergelijken met gewenste','Compare current and desired provision'],question:['Waar zien we verschillen, ontbrekende dekking of onduidelijkheid?','Where do we see differences, missing coverage or uncertainty?'],record:['Besproken verschillen en hun onderbouwing. De grafiek toont curriculumdekking, geen gemeten studentvaardigheid.','Discussed differences and their evidence. The chart shows curriculum coverage, not measured student proficiency.']},
{id:'strengthen',phase:'C',route:'sessions',title:['Leerlijn versterken en aanvullen','Strengthen and supplement the learning pathway'],question:['Wat passen we aan, wie pakt het op en wanneer bespreken we het opnieuw?','What will change, who will take it forward and when will we review it?'],record:['Verbeteracties met domein of module, verantwoordelijke en vervolgafspraak. Een voorstel telt niet als bestaand aanbod.','Actions with a domain or module, an owner and a follow-up agreement. A proposal is not existing provision.'],note:['Leg afspraken voorlopig vast in Sessienotities. Een gestructureerd actieoverzicht volgt later.','Record agreements in Session Notes for now. A structured action list will follow later.']},
{id:'structure',phase:'C',route:'dashboard',title:['Opbouw controleren','Review the curriculum structure'],question:['Sluiten kennismaken, oefenen en beoordeling logisch op elkaar aan?','Do introduction, practice and assessment form a coherent sequence?'],record:['Een gezamenlijk oordeel over de opbouw, resterende vragen en vervolgafspraken. Jaar en competentieniveau zijn verschillende dimensies.','A joint review of the structure, remaining questions and follow-up agreements. Study year and proficiency level are different dimensions.']}
];
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

const scanStatuses=['not-started','in-progress','complete'];
const profileFields=['sources','analysis','implications'];
function readScan(value){
 if(value===undefined)return {version:1,statuses:{},profile:{}};
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!record(value)||value.version!==1||!record(value.statuses)||!record(value.profile))throw Error('Unsupported or invalid scan record');
 if(Object.keys(value).some(k=>!['version','statuses','profile'].includes(k)))throw Error('Unknown scan fields');
 for(const [key,status] of Object.entries(value.statuses))if(!steps.some(s=>s.id===key)||!scanStatuses.includes(status))throw Error('Invalid scan status');
 for(const [key,text] of Object.entries(value.profile))if(!profileFields.includes(key)||typeof text!=='string'||text.length>20000)throw Error('Invalid profile annotation');
 return JSON.parse(JSON.stringify(value));
}
function updateScan(value,section,key,next){
 const scan=readScan(value);
 if(section==='statuses'&&steps.some(s=>s.id===key)&&scanStatuses.includes(next))scan.statuses[key]=next;
 else if(section==='profile'&&profileFields.includes(key)&&typeof next==='string'&&next.length<=20000)scan.profile[key]=next;
 else throw Error('Invalid scan update');
 return scan;
}
function progress(value){const scan=readScan(value),complete=steps.filter(s=>scan.statuses[s.id]==='complete').length;return {complete,total:steps.length,percent:Math.round(complete/steps.length*100)};}

const definition=freeze({version:1,phases,steps,readScan,updateScan,progress});
if(typeof module==='object'&&module.exports)module.exports=definition;
if(typeof document==='undefined')return;
const nav=document.getElementById('navigation-items');if(!nav)return;
const tx=pair=>pair[localStorage.getItem('compass-language')==='en'?1:0];
const n=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;el.dataset.noTranslate='';return el;};

function scanError(){return tx(['Procesgegevens hebben een onbekend of ongeldig formaat. Ze zijn niet gewijzigd. Exporteer JSON voordat je dit herstelt.','Process data has an unknown or invalid format. It has not been changed. Export JSON before repairing it.']);}
function writeScan(owner,section,key,value){
 if(!owner||owner!==state)return false;
 try{owner.scanProcess=updateScan(owner.scanProcess,section,key,value);changed();refreshScan();return true;}
 catch(e){say(scanError());return false;}
}
function refreshScan(){
 if(!state)return;
 try{const scan=readScan(state.scanProcess),p=progress(scan);
 document.querySelectorAll('[data-scan-count]').forEach(el=>el.textContent=tx(['Procesvoortgang: ','Process progress: '])+p.complete+'/'+p.total+' · '+p.percent+'%');
 document.querySelectorAll('[data-scan-meter]').forEach(el=>{el.max=p.total;el.value=p.complete;el.setAttribute('aria-label',tx(['Afgeronde processtappen','Completed process steps']));});
 document.querySelectorAll('[data-scan-status]').forEach(el=>{el.value=scan.statuses[el.dataset.scanStatus]||'not-started';});
 }catch(e){}
}
function renderProgress(parent){
 if(!state)return;
 const box=n('section',undefined,'scan-progress');box.dataset.scanProgress='';box.append(n('h2',tx(['Procesvoortgang','Process progress'])));
 try{readScan(state.scanProcess);const count=n('p');count.dataset.scanCount='';count.setAttribute('role','status');count.setAttribute('aria-live','polite');const meter=n('progress');meter.dataset.scanMeter='';box.append(count,meter,n('p',tx(['Alleen expliciet afgeronde stappen tellen mee. Dit zegt niets over curriculumkwaliteit of studentvaardigheid. Statussen kunnen altijd teruggezet worden.','Only explicitly completed steps count. This does not measure curriculum quality or student proficiency. Statuses can always be reversed.'])));}
 catch(e){box.append(n('p',scanError()));}
 const saveNow=n('button',tx(['Nu opslaan','Save now']));saveNow.type='button';saveNow.onclick=()=>save();box.append(saveNow,n('p',tx(['Wijzigingen gebruiken de normale werkruimteopslag. Controleer de opslagmelding; exporteer JSON bij een opslagfout.','Changes use normal workspace saving. Check the save status; export JSON if saving fails.'])));parent.append(box);refreshScan();
}
function statusControl(step,parent){
 if(!state)return;
 const owner=state,label=n('label',tx(['Status: ','Status: '])+titleFor(step));label.className='scan-status';const select=n('select');select.dataset.scanStatus=step.id;
 for(const [value,title] of [['not-started',['Nog niet gestart','Not started']],['in-progress',['In bespreking','In progress']],['complete',['Afgerond','Complete']]]){const option=n('option',tx(title));option.value=value;select.append(option);}
 try{select.value=readScan(owner.scanProcess).statuses[step.id]||'not-started';}catch(e){select.disabled=true;}
 select.onchange=()=>writeScan(owner,'statuses',step.id,select.value);label.append(select);parent.append(label);
}
function profileEditor(parent){
 if(!state)return;
 const owner=state,section=n('section',undefined,'scan-profile');section.append(n('h3',tx(['Profielannotaties','Profile annotations'])));let scan;
 try{scan=readScan(owner.scanProcess);}catch(e){section.append(n('p',scanError()));parent.append(section);return;}
 for(const [key,title] of [['sources',['Profielbronnen en verwijzingen','Profile sources and references']],['analysis',['Beroeps- en opleidingsprofiel: analyse','Professional and programme profile: analysis']],['implications',['Gevolgen voor curriculumkeuzes','Implications for curriculum choices']]]){const label=n('label',tx(title)),area=n('textarea');area.dataset.scanProfile=key;area.maxLength=20000;area.rows=4;area.value=scan.profile[key]||'';area.oninput=()=>writeScan(owner,'profile',key,area.value);label.append(area);section.append(label);}
 section.append(n('p',tx(['Annotaties horen bij deze werkruimte. Invullen rondt geen processtap automatisch af.','Annotations belong to this workspace. Entering text does not automatically complete a step.'])));parent.append(section);
}

let selection=null,workspace=null;
function workspaceKey(){return state?(typeof id!=='undefined'&&id?'id:'+id:state):null;}
function routeFor(step){return step.id==='framework'&&state?.framework==='custom'?'custom':step.route;}
function titleFor(step){return step.id==='framework'&&state?.framework==='custom'?tx(['Raamwerk leren kennen','Get to know the framework']):tx(step.title);}
function activeStep(){const key=workspaceKey();if(key!==workspace){workspace=key;selection=null;}const selected=steps.find(s=>s.id===selection);if(selected&&routeFor(selected)===tab)return selected;const matches=steps.filter(s=>routeFor(s)===tab);return matches.length===1?matches[0]:null;}
function go(route){if(route!=='catalogue'&&!state){say(tx(['Kies of open eerst een opleiding.','Choose or open a programme first.']));return;}const button=nav.querySelector('[data-tab="'+route+'"]');if(button)button.click();else say(tx(['Dit onderdeel is nog niet beschikbaar.','This section is not available yet.']));}
function selectStep(step){workspace=workspaceKey();selection=step.id;go(routeFor(step));}
function toolLink(route,label){const a=n('a',label);a.href='#'+route;a.onclick=e=>{e.preventDefault();go(route);};return a;}
function instructions(step,container){container.append(n('h3',tx(['Gespreksvraag','Discussion question'])),n('p',tx(step.question)),n('h3',tx(['Vastleggen','Record'])),n('p',tx(step.record)));if(step.note)container.append(n('p',tx(step.note),'scan-stage-note'));}
function renderContext(step){const view=document.getElementById('view');if(!view)return;view.querySelector('#scan-context')?.remove();if(!state||!step||tab==='facilitator')return;const section=n('section',undefined,'scan-context');section.id='scan-context';section.append(n('p',tx(step.question)));const detail=n('details');detail.append(n('summary',tx(['Aanpak voor de facilitator','Facilitator guidance'])));detail.append(n('p',tx(step.record)));if(step.note)detail.append(n('p',tx(step.note),'scan-stage-note'));statusControl(step,detail);if(step.id==='profile')profileEditor(detail);const button=n('button',tx(['Volledige proceshandleiding','Full process guide']));button.type='button';button.onclick=()=>{workspace=workspaceKey();selection=step.id;go('facilitator');};detail.append(button);section.append(detail);const anchor=view.querySelector('#page-purpose')||view.querySelector('h1,h2');if(anchor)anchor.after(section);else view.prepend(section);}
function renderNavigation(flow=document.getElementById('ux-workflow')){
 if(!flow||!flow.isConnected)return;
 document.getElementById('scan-workspace-progress')?.remove();
 const step=activeStep();flow.replaceChildren();flow.classList.add('scan-workflow');flow.setAttribute('aria-label',tx(['Procesroute curriculumscan','Curriculum-scan process route']));flow.hidden=!state||!['catalogue','matrix','targets','dashboard','digcomp','custom','sessions','modules'].includes(tab);
 if(!flow.hidden){for(const phase of phases){const details=n('details',undefined,'scan-phase'),summary=n('summary',phase.id+' · '+tx(phase.title));details.append(summary);details.open=step?.phase===phase.id;for(const item of steps.filter(s=>s.phase===phase.id)){const button=n('button',(steps.indexOf(item)+1)+'. '+titleFor(item));button.type='button';button.dataset.scanStep=item.id;if(item.id===step?.id)button.setAttribute('aria-current','step');button.onclick=()=>selectStep(item);details.append(button);}details.addEventListener('toggle',()=>{if(details.open)flow.querySelectorAll('.scan-phase').forEach(other=>{if(other!==details)other.open=false;});});flow.append(details);}const guide=n('button',tx(['Proces bekijken','View process']));guide.type='button';guide.onclick=()=>go('facilitator');flow.append(guide);}
 if(!flow.hidden){const host=n('div');host.id='scan-workspace-progress';flow.before(host);renderProgress(host);}
 renderContext(step);
}
root.AtlasScanProcess=Object.freeze({...definition,renderNavigation});
const items=[['overview','Overzicht','Overview'],['custom','Eigen competenties','Custom competences'],['digcomp','DigComp 3.0-raamwerk','DigComp 3.0 Framework'],['facilitator','Instructies voor de facilitator','Facilitator instructions'],['catalogue','Catalogus','Catalogue'],['matrix','Competentiematrix','Competence matrix'],['targets','Doelniveau','Target level'],['dashboard','Curriculumgrafiek','Curriculum chart'],['library','Bibliotheek','Library'],['sessions','Sessienotities','Session Notes'],['modules','Bewerk deelvakken & modules','Edit Courses & modules']];
let entry=nav.querySelector('[data-tab="facilitator"]');if(!entry){entry=n('button');entry.type='button';entry.dataset.tab='facilitator';const icon=n('span','☷','nav-icon');icon.setAttribute('aria-hidden','true');entry.append(icon,n('span','','nav-label'));nav.append(entry);}
const demo=[...nav.children].find(x=>!x.dataset.tab&&/demo|demonstr/i.test(x.textContent));if(demo)demo.dataset.tab='demonstration';
function label(button,pair){const value=tx(pair);let text=button.querySelector('.nav-label');if(!text){[...button.childNodes].filter(x=>x.nodeType===3).forEach(x=>x.remove());text=n('span','','nav-label');button.append(text);}text.dataset.noTranslate='';if(text.textContent!==value)text.textContent=value;button.setAttribute('aria-label',value);button.title=value;}
function menu(){for(const [route,nl,en] of items){const b=nav.querySelector('[data-tab="'+route+'"]');if(b){label(b,[nl,en]);nav.append(b);}}if(demo){label(demo,['Bekijk demonstratie','View demonstration']);nav.append(demo);}}
function guide(){document.getElementById('scan-workspace-progress')?.remove();const view=document.getElementById('view');document.body.dataset.view='facilitator';document.getElementById('workspace-controls').hidden=true;document.getElementById('ux-context')?.setAttribute('hidden','');document.getElementById('ux-workflow')?.setAttribute('hidden','');nav.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='facilitator'));view.replaceChildren();const article=n('article',undefined,'facilitator-guide');article.append(n('h1',tx(['Instructies voor de facilitator','Facilitator instructions'])));if(state)article.append(n('p',state.programme||'','scan-programme'));article.append(n('p',tx(['Gebruik deze zeven stappen in drie fasen als leidraad. Terugkeren mag altijd. Markeer zelf wat nog niet gestart, in bespreking of afgerond is. Procesvoortgang wordt bij deze werkruimte opgeslagen.','Use these seven steps in three phases as a guide. You can return at any time. Explicitly mark steps as not started, in progress or complete. Process progress is saved with this workspace.'])));if(!state)article.append(toolLink('catalogue',tx(['Kies een opleiding of open een werkruimte','Choose a programme or open a workspace'])));
renderProgress(article);const chosen=steps.find(s=>s.id===selection)||steps[0];for(const phase of phases){const section=n('section',undefined,'scan-guide-phase');section.append(n('h2',tx(['Fase ','Phase '])+phase.id+' · '+tx(phase.title)));for(const step of steps.filter(s=>s.phase===phase.id)){const detail=n('details',undefined,'scan-guide-step');detail.dataset.scanStep=step.id;detail.open=step.id===chosen.id;detail.append(n('summary',(steps.indexOf(step)+1)+'. '+titleFor(step)));instructions(step,detail);statusControl(step,detail);if(step.id==='profile')profileEditor(detail);const open=n('button',tx(['Open bijbehorend onderdeel','Open related tool']));open.type='button';open.disabled=!state;open.onclick=()=>selectStep(step);detail.append(open);if(['levels','structure'].includes(step.id))detail.append(toolLink(step.id==='levels'?'sessions':'matrix',tx(step.id==='levels'?['Beginaannames noteren in Sessienotities','Record entry assumptions in Session Notes']:['Matrix openen','Open matrix'])));section.append(detail);}article.append(section);}view.append(article);refreshScan();}
const prior=render;render=function(...args){if(tab==='facilitator'){activeStep();guide();menu();return;}document.getElementById('ux-workflow')?.removeAttribute('hidden');const result=prior.apply(this,args);menu();return result;};entry.onclick=()=>{tab='facilitator';render();};
const style=n('style');style.textContent='#ux-workflow.scan-workflow{display:flex!important;flex-wrap:wrap;align-items:flex-start;gap:10px!important;margin:14px 0!important}#ux-workflow.scan-workflow[hidden]{display:none!important}#ux-workflow.scan-workflow>.scan-phase{flex:1 1 180px;min-width:0;border:1px solid var(--line,#dce1e8);border-radius:12px;background:var(--panel,#fff);padding:10px}#ux-workflow.scan-workflow summary{cursor:pointer;font-weight:650;min-height:32px}#ux-workflow.scan-workflow .scan-phase>button{display:block;width:100%;white-space:normal;text-align:left;margin-top:6px;padding:10px;min-height:44px;border-radius:10px}#ux-workflow.scan-workflow>button{min-height:44px}.scan-context{margin:14px 0 20px;padding:12px 16px;border-left:3px solid #e87500;border-radius:0 12px 12px 0;background:var(--panel,#fff)}.scan-context>p{margin:0 0 6px;font-weight:600}.scan-context summary{cursor:pointer;min-height:32px}.scan-context h3,.scan-guide-step h3{font-size:1rem;margin:14px 0 6px}.scan-stage-note{padding:10px;border:1px solid var(--line,#dce1e8);border-radius:10px;font-size:.875rem}.scan-guide-step{padding:16px;border:1px solid var(--line,#dce1e8);border-radius:14px;margin:12px 0}.scan-guide-step>summary{font-weight:650;cursor:pointer;min-height:32px}.scan-guide-step button{min-height:44px}.scan-guide-phase{margin:24px 0}.scan-programme{font-weight:650}';style.textContent+='.scan-progress{padding:16px;margin:12px 0;border:1px solid var(--line,#dce1e8);border-radius:12px}.scan-progress h2{font-size:1rem}.scan-progress progress{width:100%;height:16px}.scan-status,.scan-profile label{display:flex;flex-direction:column;gap:6px;margin:14px 0}.scan-status select{min-height:44px}.scan-profile textarea{width:100%;box-sizing:border-box}';document.head.append(style);
document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',()=>{menu();if(tab==='facilitator')render();else queueMicrotask(()=>renderNavigation());}));menu();queueMicrotask(()=>renderNavigation());
})(typeof window!=='undefined'?window:globalThis);
