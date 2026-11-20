/* Cluster-filtered workspace switching and non-destructive catalogue import checks. */
(()=>{'use strict';
const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('nl');
function identity(st){
 const match=String(st.source||st.path||'').match(/\/programme\/(20\d{2})\/([^/?#]+)/i);
 if(!match)return '';
 let slug;try{slug=decodeURIComponent(match[2]);}catch{return '';}
 const edition=String(st.edition||match[1]).match(/20\d{2}/)?.[0];
 return edition?norm(slug)+'|'+edition:'';
}
function ordered(items){return items.slice().sort((a,b)=>String(a.programme||a.name||'').localeCompare(String(b.programme||b.name||''),'nl',{sensitivity:'base',numeric:true})||String(a.edition||'').localeCompare(String(b.edition||''))||String(a.id).localeCompare(String(b.id)));}
function matching(items,path){const key=identity({source:path});return key?items.filter(w=>w.curriculumKey===key):[];}
if(typeof module==='object'&&module.exports)module.exports={identity,ordered,matching};
if(typeof document==='undefined')return;
const q=s=>document.querySelector(s),tx=(a,b)=>localStorage.getItem('compass-language')==='en'?b:a;
const rawApi=api,cache=new Map();let list=[],pending=0,copyIntent=null;
let cluster='';try{cluster=sessionStorage.getItem('atlas-workspace-cluster')||'';}catch{}
async function indexed(items){
 let next=0;const output=new Array(items.length);
 await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{
  while(next<items.length){const i=next++,w=items[i];let item=cache.get(w.id);
   if(!item||item.revision!==w.revision||item.updated!==w.updated){
    const loaded=await rawApi('/api/workspaces/'+encodeURIComponent(w.id)),st=loaded.state;
    if(!st||!Array.isArray(st.modules))throw Error(tx('Werkruimtegegevens ontbreken.','Workspace data is missing.'));
    item={...w,cluster:String(st.cluster||'').trim(),curriculumKey:identity(st),programme:st.programme||w.programme||w.name,edition:st.edition||w.edition||''};cache.set(w.id,item);
   }
   output[i]={...item,...w,cluster:item.cluster,curriculumKey:item.curriculumKey,programme:item.programme,edition:item.edition};
  }
 }));return ordered(output);
}
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function paint(){
 const saved=q('#saved');if(!saved)return;
 let host=q('#atlas-workspace-cluster-field');
 if(!host){host=node('label');host.id='atlas-workspace-cluster-field';host.dataset.noTranslate='';const caption=node('span'),select=node('select');select.id='atlas-workspace-cluster';host.append(caption,select);const anchor=saved.closest('label')||saved;anchor.before(host);select.onchange=()=>{cluster=select.value;try{sessionStorage.setItem('atlas-workspace-cluster',cluster);}catch{}paint();};}
 host.querySelector('span').textContent=tx('Cluster','Cluster');const filter=host.querySelector('select');filter.setAttribute('aria-label',tx('Werkruimtes filteren op cluster','Filter workspaces by cluster'));
 const clusters=[...new Set(list.map(w=>w.cluster).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}));
 const options=[['',tx('Alle clusters','All clusters')],['__none__',tx('Zonder cluster','No cluster')],...clusters.map(c=>[c,c])];
 filter.replaceChildren(...options.map(([value,label])=>new Option(label,value)));if(cluster&&!options.some(([v])=>v===cluster))filter.add(new Option(cluster,cluster));filter.value=cluster;
 const counts=new Map();for(const w of list)if(w.curriculumKey)counts.set(w.curriculumKey,(counts.get(w.curriculumKey)||0)+1);
 const visible=list.filter(w=>!cluster||(cluster==='__none__'?!w.cluster:w.cluster===cluster)),current=typeof id==='undefined'?'':String(id||'');
 saved.replaceChildren(new Option(tx('Open werkruimte…','Open workspace…'),''));
 for(const w of visible){const duplicate=(counts.get(w.curriculumKey)||0)>1;const label=(w.programme||w.name)+(w.edition?' ('+w.edition+')':'')+(duplicate?' · '+tx('zelfde curriculum','same curriculum')+' · '+String(w.id).slice(-6):'');saved.add(new Option(label,String(w.id)));}
 saved.value=visible.some(w=>String(w.id)===current)?current:'';
 let note=q('#atlas-workspace-count');if(!note){note=node('small');note.id='atlas-workspace-count';note.dataset.noTranslate='';host.append(note);}note.textContent=visible.length+' / '+list.length+' '+tx('werkruimtes · A–Z','workspaces · A–Z');
}
const priorListing=listing;listing=async function(...args){
 const token=++pending;await priorListing.apply(this,args);
 try{const entries=await indexed(await rawApi('/api/workspaces'));if(token!==pending)return;list=entries;paint();}
 catch(error){say(tx('Clusterfilter niet geladen: ','Cluster filter could not load: ')+error.message);}
};
function openExisting(w){
 const saved=q('#saved');if(!saved)return;
 if(![...saved.options].some(o=>o.value===String(w.id)))saved.add(new Option(w.name||w.programme,String(w.id)));
 saved.value=String(w.id);q('#dialog').close();saved.dispatchEvent(new Event('change',{bubbles:true}));
}
const priorInstall=install;install=function(workspace){
 if(copyIntent&&identity(workspace)===copyIntent.key){workspace=structuredClone(workspace);workspace.atlasCurriculumName=workspace.programme;workspace.programme=copyIntent.name;copyIntent=null;}
 return priorInstall.apply(this,[workspace]);
};
const priorPreview=preview;let previewToken=0;
preview=async function(path){
 if(q('#dialog')?.open){say(tx('Sluit eerst het huidige venster.','Close the current dialog first.'));return;}
 const token=++previewToken;let entries;
 try{entries=await indexed(await rawApi('/api/workspaces?all=1'));}catch(error){say(tx('Import gestopt: bestaande werkruimtes konden niet worden gecontroleerd. ','Import stopped: existing workspaces could not be checked. ')+error.message);return;}
 if(token!==previewToken)return;
 const matches=matching(entries,path);if(!matches.length)return priorPreview.apply(this,arguments);
 dialog(tx('Deze opleiding is al geïmporteerd','This curriculum is already imported'),'<div id="atlas-existing-workspaces" data-no-translate></div>');
 const host=q('#atlas-existing-workspaces');host.append(node('p',tx('Open een bestaande werkruimte om mappings, doelen en sessienotities te behouden. Er wordt niets overschreven of samengevoegd.','Open an existing workspace to retain mappings, targets and session notes. Nothing is overwritten or merged.')));
 for(const w of matches){const b=node('button',(w.programme||w.name)+' ('+w.edition+')'+(w.archived?tx(' · gearchiveerd',' · archived'):'')+' · '+String(w.id).slice(-6));b.type='button';b.className='choice';b.onclick=()=>openExisting(w);host.append(b);}
 const copy=node('button',tx('Maak aparte kopie','Create separate copy'));copy.type='button';copy.onclick=async()=>{
  const used=new Set(entries.map(w=>norm(w.programme||w.name)));let i=2,name;do{name=(matches[0].programme||matches[0].name)+' — '+tx('kopie ','copy ')+i++;}while(used.has(norm(name)));
  const chosen=prompt(tx('Geef de aparte kopie een unieke naam:','Give the separate copy a unique name:'),name);if(chosen===null)return;
  if(!chosen.trim()||used.has(norm(chosen))){say(tx('Kies een unieke, niet-lege naam.','Choose a unique, non-empty name.'));return;}
  q('#dialog').close();copyIntent={key:identity({source:path}),name:chosen.trim()};
  try{await priorPreview.call(this,path);if(!q('#dialog')?.open)copyIntent=null;}catch(error){copyIntent=null;say(error.message);}
 };
 const cancel=node('button',tx('Annuleren','Cancel'));cancel.type='button';cancel.onclick=()=>q('#dialog').close();host.append(copy,cancel);
};
q('#dialog')?.addEventListener('close',()=>{setTimeout(()=>{if(!q('#dialog')?.open)copyIntent=null;},0);});
document.addEventListener('change',e=>{if(e.target.id==='atlas-workspace-cluster')return;if(e.target.id==='saved')setTimeout(paint,0);});
const style=node('style');style.textContent='#atlas-workspace-cluster-field{display:grid;gap:6px;font-size:12px}#atlas-workspace-cluster{width:100%;min-height:44px}#atlas-workspace-count{color:var(--muted,#626a78)}#atlas-existing-workspaces{display:grid;gap:10px}#atlas-existing-workspaces button{min-height:44px;text-align:left;white-space:normal}';document.head.append(style);
new MutationObserver(()=>{const saved=q('#saved'),host=q('#atlas-workspace-cluster-field'),anchor=saved?.closest('label')||saved;if(host&&anchor&&host.parentElement!==anchor.parentElement)anchor.before(host);}).observe(document.body,{childList:true,subtree:true});
listing();
})();
