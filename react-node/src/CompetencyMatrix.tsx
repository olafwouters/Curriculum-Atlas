import React,{useEffect,useRef,useState} from 'react';
import {groupOutcomes,mappingSummary,createLevelDrafts,updateLevelDraft,applyLevelDrafts} from './matrix-model.mjs';

type Outcome={id:string;domain:string;level:string;text:string;color:string};
type Module={id:string;name:string;year:number;courses:{code:string;name:string}[]};
type Mapping=Record<string,string>;
type Workspace={programme:string;modules:Module[];mappings?:Record<string,Mapping>;[key:string]:unknown};
type Group={domain:string;color:string;outcomes:Outcome[]};
type Drafts=Record<string,{key:string;level:string;exists:boolean;value:Mapping}>;
type Context={group:Group;module:Module;code?:string;drafts:Drafts};
const choices:Record<string,Record<string,string>>={phase:{'':'Nog te bespreken',introduced:'Kennismaken',practised:'Oefenen',mastery:'Beoogde beheersing'},testing:{unknown:'Onbekend',none:'Geen',formative:'Formatief',summative:'Summatief',elsewhere:'Elders'},review:{unreviewed:'Nog te bespreken',supported:'Onderbouwd',attention:'Aandachtspunt'},decision:{included:'Aanwezig / bespreken',gap:'Ontbreekt',excluded:'Uitgesloten'}};

export default function CompetencyMatrix({state,outcomes,onChange,onError,busy}:{state:Workspace;outcomes:Outcome[];onChange:(s:Workspace)=>void;onError:(s:string)=>void;busy:boolean}) {
  const [context,setContext]=useState<Context|null>(null);
  let groups:Group[];
  try {groups=groupOutcomes(outcomes);}
  catch(error) {return <section><h2>Competentiematrix</h2><p role="alert">{error instanceof Error?error.message:String(error)}</p></section>;}
  const columns=state.modules.flatMap(m=>[{m,code:undefined as string|undefined,label:m.name},...m.courses.map(c=>({m,code:c.code,label:c.code+' · '+c.name}))]);
  function open(group:Group,module:Module,code?:string) {
    try {setContext({group,module,code,drafts:createLevelDrafts(state,group.outcomes,module.id,code)});}
    catch(error) {onError(error instanceof Error?error.message:String(error));}
  }
  return <section><h2>Competentiematrix</h2><p>Kies een domein bij een module of deelvak. Niveaus en beschrijvingen staan naast elkaar in het venster. Opslaan is handmatig.</p>
    <div className="scroll"><table><thead><tr><th scope="col">Competentiedomein</th>{columns.map(c=><th scope="col" key={JSON.stringify([c.m.id,c.code])}>{c.label}<small>Jaar {c.m.year}</small></th>)}</tr></thead>
      <tbody>{groups.map(g=><tr key={g.domain}><th scope="row"><span className="domain" style={{borderColor:g.color}}>{g.domain}</span></th>{columns.map(c=>{const summary=mappingSummary(state.mappings,g.outcomes,c.m.id,c.code);return <td key={JSON.stringify([c.m.id,c.code])}><button type="button" onClick={()=>open(g,c.m,c.code)} aria-label={g.domain+' · '+c.label+' · mappings bewerken'}>Bewerken</button><small>{summary.ambiguous?'Dubbele mappings: controle nodig':summary.count===0?'Nog geen mapping':summary.count+' mapping'+(summary.count===1?'':'s')}</small></td>;})}</tr>)}</tbody>
    </table></div>
    {context&&<AlignmentDialog state={state} context={context} busy={busy} onChange={onChange} onClose={()=>setContext(null)}/>}
  </section>;
}

function AlignmentDialog({state,context,busy,onChange,onClose}:{state:Workspace;context:Context;busy:boolean;onChange:(s:Workspace)=>void;onClose:()=>void}) {
  const {group,module,code}=context;
  const [drafts,setDrafts]=useState<Drafts>(context.drafts);
  const [selected,select]=useState(()=>group.outcomes.find(o=>context.drafts[o.id].exists)?.id??group.outcomes[0].id);
  const [changed,setChanged]=useState<Set<string>>(()=>new Set());
  const [error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const active=group.outcomes.find(o=>o.id===selected)!;
  const value=drafts[selected].value;
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(changed.size){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[changed.size]);
  function update(field:string,value:string) {setDrafts(d=>updateLevelDraft(d,selected,field,value));setChanged(s=>new Set([...s,selected]));}
  function cancel() {if(!changed.size||window.confirm('Wijzigingen voor alle niveaus in dit venster verwerpen?'))onClose();}
  function apply(e:React.FormEvent) {
    e.preventDefault();setError('');
    try {if(changed.size)onChange(applyLevelDrafts(state,drafts,changed));onClose();}
    catch(error) {setError(error instanceof Error?error.message:String(error));}
  }
  return <dialog ref={dialog} className="alignment-dialog" aria-labelledby="alignment-title" onCancel={e=>{e.preventDefault();cancel();}}>
    <form onSubmit={apply}><fieldset disabled={busy}>
      <h2 id="alignment-title">{group.domain}</h2><p>{module.name} · {code??'Modulebreed'}</p>
      <p>Kies een niveau. Wisselen bewaart de bewerkingen in dit venster; toepassen verwerkt alle gewijzigde niveaus.</p>
      <fieldset><legend>Niveau en beschrijving</legend><div className="level-options"><div className="level-grid" style={{gridTemplateColumns:`repeat(${group.outcomes.length}, minmax(240px, 1fr))`}}>
        {group.outcomes.map(o=><label key={o.id} className={'level-card'+(o.id===selected?' selected':'')}><span className="level-heading"><input type="radio" name="atlas-level" value={o.id} checked={o.id===selected} onChange={()=>select(o.id)}/><strong>{o.level}</strong></span><span className="level-description">{o.text}</span><small>{changed.has(o.id)?'Gewijzigd in dit venster':drafts[o.id].exists?'Bestaande mapping':'Nog geen mapping'}</small></label>)}
      </div></div></fieldset>
      <h3>Constructive alignment · {active.level}</h3>
      {Object.entries({intended:'Beoogde leeruitkomst',evidence:'Leeractiviteit',assessment:'Beoordeling en criteria',rationale:'Rationale en afspraken'}).map(([field,label])=><label key={field}>{label}<textarea value={value[field]||''} onChange={e=>update(field,e.target.value)}/></label>)}
      {Object.entries({phase:'Curriculumfunctie',testing:'Toetsing',review:'Gespreksstatus',decision:'Besluit'}).map(([field,label])=><label key={field}>{label}<select value={value[field]} onChange={e=>update(field,e.target.value)}>{Object.entries(choices[field]).map(([v,text])=><option key={v} value={v}>{text}</option>)}</select></label>)}
      {value.testing==='elsewhere'&&<label>Beoordelingsmodule<select value={value.elsewhere||''} onChange={e=>update('elsewhere',e.target.value)}><option value="">Kies module</option>{state.modules.filter(m=>m.id!==module.id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
      <p role="alert">{error}</p><div className="toolbar"><button type="submit">Alle gewijzigde niveaus toepassen</button><button type="button" onClick={cancel}>Annuleren</button></div>
    </fieldset></form>
  </dialog>;
}
