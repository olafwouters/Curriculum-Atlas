import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {readState} from './domain.mjs';
import CompetencyMatrix from './CompetencyMatrix';
import './style.css';
type Outcome={id:string;domain:string;level:string;text:string;color:string};
type Module={id:string;name:string;year:number;courses:{code:string;name:string}[]};
type Mapping=Record<string,string>;
type Workspace={programme:string;modules:Module[];mappings?:Record<string,Mapping>;framework?:string;custom?:{outcomes:Outcome[]};[key:string]:unknown};
async function api(path:string,data?:unknown){const r=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const b=await r.json();if(!r.ok)throw Error(b.error||`HTTP ${r.status}`);return b;}
function App(){
 const [state,S]=useState<Workspace|null>(null),[id,I]=useState<string|null>(null),[rev,R]=useState(0),[dirty,D]=useState(false),[busy,B]=useState(false),[message,M]=useState(''),[rows,L]=useState<{id:string;name:string}[]>([]),[fw,F]=useState<Outcome[]>([]);
 const lock=useRef(false),file=useRef<HTMLInputElement>(null);
 async function run(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;B(true);M('');try{await fn();}catch(e){M(e instanceof Error?e.message:String(e));}finally{lock.current=false;B(false);}}
 useEffect(()=>{let live=true;Promise.all([api('/api/framework'),api('/api/workspaces')]).then(([f,r])=>{if(live){F(f);L(r);}}).catch(e=>{if(live)M(e.message);});return()=>{live=false;};},[]);
 useEffect(()=>{const f=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',f);return()=>window.removeEventListener('beforeunload',f);},[dirty]);
 function change(s:Workspace){S(s);D(true);}
 const canSwitch=()=>!dirty||confirm('Niet-opgeslagen wijzigingen vervallen. Annuleren om eerst te exporteren.');
 async function open(next:string){if(!next||!canSwitch())return;await run(async()=>{const b=await api('/api/workspaces/'+encodeURIComponent(next));S(readState(b.state));I(b.id);R(b.revision);D(false);});}
 function fresh(){if(!canSwitch())return;const programme=prompt('Naam opleiding');if(!programme?.trim())return;I(null);R(0);change({programme:programme.trim(),modules:[],mappings:{}});}
 async function save(){if(!state)return;const snapshot=structuredClone(state);await run(async()=>{const b=await api('/api/save',{id,revision:rev,state:snapshot});I(b.id);R(b.revision);D(false);M('Opgeslagen · revisie '+b.revision);try{L(await api('/api/workspaces'));}catch{M('Opgeslagen; lijst vernieuwen mislukt.');}});}
 function download(){if(!state)return;const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='Curriculum-Atlas-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 async function upload(f:File){if(!canSwitch())return;await run(async()=>{if(f.size>5000000)throw Error('Maximaal 5 MB.');const b=JSON.parse(await f.text());if(b.workspaces)throw Error('Bulkback-up nog niet ondersteund. Gebruik een losse werkruimte.');const s=readState(b.state??b);I(null);R(0);change(s);M('Geïmporteerd als nieuwe werkruimte; nog niet opgeslagen.');});}
 function add(){if(!state)return;const name=prompt('Modulenaam');if(name?.trim())change({...state,modules:[...state.modules,{id:crypto.randomUUID(),name:name.trim(),year:1,courses:[]}]});}
 const outcomes=state?.framework==='custom'&&state.custom?.outcomes?.length?state.custom.outcomes:fw;
 return <><header><h1>Curriculum Atlas</h1><p>React / Node.js preview — geen volledige vervanging.</p></header><main><fieldset disabled={busy}><div className="toolbar"><button onClick={fresh}>Nieuwe werkruimte</button><select aria-label="Werkruimte" value={id||''} onChange={e=>void open(e.target.value)}><option value="">Werkruimte openen…</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button onClick={()=>void run(async()=>L(await api('/api/workspaces')))}>Lijst vernieuwen</button><button onClick={()=>file.current?.click()}>JSON import</button><input ref={file} hidden type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f);}}/><button disabled={!state} onClick={download}>JSON export</button><button disabled={!state} onClick={()=>void save()}>Opslaan</button><button disabled={!id} onClick={()=>id&&void open(id)}>Herladen</button></div></fieldset><p role="status">{busy?'Bezig…':dirty?'Niet opgeslagen':'Geen lokale wijzigingen'} · revisie {rev}</p><p role="alert">{message}</p>{state?<fieldset disabled={busy}><section><label>Opleidingsnaam<input value={state.programme} onChange={e=>change({...state,programme:e.target.value})}/></label><button onClick={add}>Module toevoegen (jaar 1)</button></section><CompetencyMatrix key={id??'unsaved'} state={state} outcomes={outcomes} busy={busy} onChange={change} onError={M}/></fieldset>:<section><h2>Open of importeer een werkruimte</h2><p>Deze preview gebruikt een eigen database, niet de Python-productiedatabase.</p></section>}</main><footer>Nog niet gemigreerd: catalogus, grafieken, CSV, bibliotheek, targets, competentiesets, sessies, jaarovergang, taal/thema en oorspronkelijke vormgeving.</footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
