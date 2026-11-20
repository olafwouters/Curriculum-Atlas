/* Reuse saved demo workspaces without resetting edits or deleting copies. */
(()=>{'use strict';
function demoKind(s){
 if(!s)return '';
 if(['digcomp','das'].includes(s.atlasDemoKind))return s.atlasDemoKind;
 if(s.source||!/^(?:DAS\s+)?demonstrati(?:e|on)\b/i.test(s.programme||'')||!s.modules?.length)return '';
 if(!s.modules.every(m=>/^(?:demo\d+|dig-demo-\d+)$/.test(m.id)))return '';
 if(s.framework==='custom')return /\bDAS\b/i.test((s.programme||'')+' '+(s.custom?.name||''))?'das':'';
 return !s.framework||s.framework==='digcomp'?'digcomp':'';
}
if(typeof module==='object'&&module.exports)module.exports={demoKind};
if(typeof document==='undefined')return;
const prior=install;let pending=null;
const tx=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
install=function(s){
 const kind=demoKind(s);if(!kind)return prior.apply(this,arguments);
 if(demoKind(state)===kind)return;
 if(pending){say(tx('Demonstratie wordt al geopend.','A demonstration is already opening.'));return pending;}
 const initialState=state,initialId=id;
 pending=(async()=>{
  const rows=await api('/api/workspaces');if(!Array.isArray(rows))throw Error(tx('Ongeldige werkruimtelijst.','Invalid workspace list.'));
  const candidates=rows.filter(w=>!w.archived).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||''))||String(a.id).localeCompare(String(b.id)));
  let found=null;
  for(let i=0;i<candidates.length&&!found;i+=4){
   const group=candidates.slice(i,i+4),loaded=await Promise.all(group.map(w=>api('/api/workspaces/'+encodeURIComponent(w.id))));
   loaded.forEach(w=>{if(!w.state||!Array.isArray(w.state.modules))throw Error(tx('Werkruimtegegevens ontbreken.','Workspace data is missing.'));});
   const at=loaded.findIndex(w=>demoKind(w.state)===kind);if(at!==-1)found=group[at];
  }
  if(state!==initialState||id!==initialId)return;
  if(found){
   const saved=document.getElementById('saved');if(!saved)throw Error(tx('Werkruimtekeuze ontbreekt.','Workspace selector is missing.'));
   if(![...saved.options].some(o=>o.value===String(found.id)))saved.add(new Option(found.name||found.programme||kind,String(found.id)));
   saved.value=String(found.id);saved.dispatchEvent(new Event('change',{bubbles:true}));return;
  }
  if(!canSwitch())return;
  return prior.call(this,{...s,atlasDemoKind:kind});
 })().catch(error=>say(tx('Demonstratie niet geopend; er is geen kopie gemaakt. ','Demo not opened; no copy was created. ')+error.message)).finally(()=>{pending=null;});
 return pending;
};
})();
