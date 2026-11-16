/* Original Python app: overview and domain-grouped matrix interface. */
(()=>{
const previous=render;
function navigate(t){tab=t;render();}
function overview(){
 const mm=state?.modules||[],maps=Object.values(state?.mappings||{}),mapped=maps.filter(a=>a.phase||['introduced','practised','assessed'].includes(a.status)).length,pending=maps.filter(a=>!a.review||a.review==='unreviewed').length;
 const hour=new Date().getHours(),greeting=hour<12?'Goedemorgen':hour<18?'Goedemiddag':'Goedenavond';
 $('#view').innerHTML='<div class="welcome"><div><h1>'+greeting+'</h1><p>Jouw curriculumomgeving in één overzicht</p></div><button class="primary" id="overview-new">Nieuwe opleiding</button></div><div class="overview-grid"><div class="stat-card"><p>Actieve modules</p><strong>'+mm.length+'</strong></div><div class="stat-card"><p>Vastgelegde koppelingen</p><strong>'+mapped+'</strong></div><div class="stat-card"><p>Nog te bespreken</p><strong>'+pending+'</strong></div><section class="quick-card"><h2>Snel starten</h2><button data-go="matrix">Matrix openen</button><button data-go="dashboard">Curriculumgrafiek</button><button id="overview-demo">Bekijk demonstratie</button><button id="overview-import">Werkruimte importeren</button></section><section class="activity-card"><h2>'+(state?'Modules in je werkruimte':'Je curriculum verkennen')+'</h2>'+ (mm.length?mm.slice(0,6).map((m,i)=>'<button class="activity-row" data-go="modules"><span class="activity-icon">'+String(i+1).padStart(2,'0')+'</span><span>'+E(m.name)+'</span><span class="activity-year">Jaar '+E(m.year)+'</span></button>').join(''):'<button class="activity-row" data-go="catalogue"><span class="activity-icon">C</span><span>Opleiding zoeken in de catalogus</span><span class="activity-year">Start</span></button><button class="activity-row" id="empty-demo"><span class="activity-icon">M</span><span>Competentiematrix verkennen</span><span class="activity-year">Demo</span></button><button class="activity-row" id="empty-import"><span class="activity-icon">J</span><span>Bestaande werkruimte importeren</span><span class="activity-year">JSON</span></button>')+'</section></div><p class="overview-note">'+(state?E(state.programme):'Open een werkruimte of bekijk de demonstratie. Tellers tonen echte gegevens, geen fictieve deelnemers.')+'</p>';
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));$('#overview-new').onclick=()=>$('#new').click();$('#overview-demo').onclick=()=>$('#demo').click();$('#overview-import').onclick=()=>$('#import').click();const ed=$('#empty-demo'),ei=$('#empty-import');if(ed)ed.onclick=()=>$('#demo').click();if(ei)ei.onclick=()=>$('#import').click();
}
render=function(){document.body.dataset.view=tab;if(tab==='overview'){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('#workspace-controls').hidden=true;overview();return;}$('#workspace-controls').hidden=false;previous();};
$('#global-search').onsubmit=e=>{e.preventDefault();query=$('#global-query').value.trim();navigate('catalogue');const input=document.querySelector('#searchForm [name="q"]');if(input){input.value=query;document.getElementById('searchForm').requestSubmit();}};
$('#profile').onclick=()=>dialog('Lokale werkruimte','<p>Curriculum Compass v10 draait lokaal op je computer. Dit profielicoon is geen account of inlogfunctie.</p><p>Gebruik Werkruimte & bestanden voor import, export en opslag.</p>');
// Start on overview even when the asynchronous legacy initialization finishes.
tab='overview';render();
})();

/* Domain rows and level cards for the original Python-backed interface. */
(function () {
  'use strict';
  const clone = x => typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x));
  function parse(key) {
    const at=key.indexOf('|');
    if(at<1)throw Error('Ongeldige mapping-sleutel.');
    const oid=key.slice(0,at),tail=key.slice(at+1),sep=tail.includes('::')?'::':'|',parts=tail.split(sep);
    if(parts.length>2||!parts[0]||(parts.length===2&&!parts[1]))throw Error('Ongeldige mapping-sleutel.');
    const mid=parts[0],encoded=parts[1],code=encoded===undefined?undefined:decodeURIComponent(encoded);
    return {oid,mid,code,encoded,ui:oid+'|'+mid+(encoded===undefined?'':'|'+encoded)};
  }
  function resolve(maps,key) {
    const p=parse(key),base=p.oid+'|'+p.mid;
    if(p.encoded===undefined)return base;
    const a=base+'::'+p.encoded,b=base+'|'+p.encoded;
    if(Object.hasOwn(maps,a)&&Object.hasOwn(maps,b))throw Error('Dubbele mappings voor hetzelfde deelvak; niets is overschreven.');
    return Object.hasOwn(maps,a)?a:Object.hasOwn(maps,b)?b:a;
  }
  function normalise(a={}) {
    a=a||{};
    return {...a,phase:a.phase||(['introduced','practised'].includes(a.status)?a.status:''),testing:a.testing||(a.status==='assessed'?'summative':'unknown'),review:a.review||'unreviewed',decision:a.decision||(['gap','excluded'].includes(a.status)?a.status:'included')};
  }
  function groups(outcomes) {
    const map=new Map();
    outcomes.forEach(o=>{if(!map.has(o.domain))map.set(o.domain,[]);map.get(o.domain).push(o);});
    return [...map.values()];
  }
  function commit(original,entries) {
    const next=clone(original);next.mappings=next.mappings||{};
    for(const [requested,fields] of entries) {
      const p=parse(requested),m=next.modules.find(m=>m.id===p.mid);
      if(!m||(p.code!==undefined&&!(m.courses||[]).some(c=>c.code===p.code)))throw Error('Module of deelvak niet gevonden.');
      const key=resolve(next.mappings,requested),a={...normalise(next.mappings[key]),...fields};
      if(a.testing==='elsewhere'&&!next.modules.some(m=>m.id===a.elsewhere&&m.id!==p.mid))throw Error('Kies een andere beoordelingsmodule.');
      a.status=a.decision==='gap'?'gap':a.decision==='excluded'?'excluded':a.phase==='mastery'?'practised':a.phase||(a.testing==='summative'?'assessed':'unreviewed');
      next.mappings[key]=a;
    }
    if(entries.length)next.schemaVersion=6;
    return next;
  }
  function domainRoute(outcomes,key,domain,visited=new Map()) {
    const p=parse(key),current=outcomes.find(o=>o.id===p.oid),os=outcomes.filter(o=>o.domain===domain);
    if(!current||!os.length)throw Error('Domein of leeruitkomst niet gevonden.');
    const rank=v=>(String(v).match(/^(IV|III|II|I)(?=[.\s—–-]|$)/)||[])[1]||String(v);
    const chosen=os.find(o=>o.id===visited.get(domain))||os.find(o=>rank(o.level)===rank(current.level))||os[0];
    return chosen.id+'|'+p.mid+(p.encoded===undefined?'':'|'+p.encoded);
  }
  function iconName(domain,reference,custom=false) {
    return ['search','chat','pencil','shield','gear'][custom?-1:reference.indexOf(domain)]||'grid';
  }
  function iconSvg(name) {
    const paths={
      search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
      chat:'<path d="M14 14H8l-5 4V8a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1"/><path d="M16 9h1a5 5 0 0 1 5 5v7l-4-3h-3a4 4 0 0 1-4-4v-1a4 4 0 0 1 5-4Z"/>',
      pencil:'<path d="m4 16-1 5 5-1L21 7a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0Z M14 6l4 4 M4 16l4 4"/>',
      shield:'<path d="M12 3 3 6v6c0 5 9 9 9 9s9-4 9-9V6Z M7 12l3 3 7-7"/>',
      gear:'<path d="m10 2-1 3-3 .5-2 3L6 11v2l-2 2.5 2 3L9 19l1 3h4l1-3 3-.5 2-3-2-2.5v-2l2-2.5-2-3L15 5l-1-3Z"/><circle cx="12" cy="12" r="4"/>',
      grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      check:'<path d="m5 12 4 4L19 6"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(Object.hasOwn(paths,name)?paths[name]:paths.grid)+'</svg>';
  }
  const api={parse,resolve,normalise,groups,commit,domainRoute,iconName,iconSvg};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const tx=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
  const style=document.createElement('style');
  style.textContent='#dialog.atlas-level-dialog{width:min(1200px,96vw);max-width:96vw}.atlas-level-options{overflow-x:auto;padding:5px}.atlas-level-grid{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);gap:12px}.atlas-level-card{display:flex;flex-direction:column;gap:10px;padding:14px;border:2px solid var(--line,#aebdcd);border-radius:12px;cursor:pointer;min-width:240px}.atlas-level-card:has(input:checked){border-color:var(--accent,#165a99)}.atlas-level-card:focus-within{outline:3px solid #bc7900;outline-offset:2px}.atlas-level-card input{width:auto;display:inline;margin-right:8px}.atlas-level-card p{white-space:pre-wrap;line-height:1.5;margin:0;font-weight:normal}.atlas-domain-mapping small{display:block}';
  style.textContent+='.atlas-domain-icon{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;width:40px;height:40px;border-radius:12px;background:var(--domain,#64748b);color:#14213a;box-shadow:inset 0 0 0 20px #ffffff66}.atlas-domain-icon svg{width:26px;height:26px;display:block}#legend.legend button[data-help]::before{content:none!important;display:none!important}#legend.legend button[data-help]>.atlas-domain-icon{margin:0!important;opacity:1!important}.domain-toggle>span:last-child{display:inline-flex;align-items:center;gap:10px}.v6-matrix .atlas-domain-icon{width:32px;height:32px;border-radius:9px}.v6-matrix .atlas-domain-icon svg{width:22px;height:22px}#dialog.atlas-level-dialog .atlas-domain-nav{order:-4;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px}#dialog.atlas-level-dialog .atlas-domain-nav button{position:relative;display:flex;align-items:center;gap:10px;padding:14px 28px 14px 14px;text-align:left;border:2px solid var(--line,#c4cbd6);border-radius:18px;background:var(--atlas-reference-surface,#fff);color:var(--ink,#14213a);font:inherit;min-width:0;overflow-wrap:anywhere}#dialog.atlas-level-dialog .atlas-domain-nav button[aria-pressed="true"]{border-color:var(--domain);box-shadow:inset 0 0 0 1px var(--domain)}#dialog.atlas-level-dialog .atlas-domain-check{position:absolute;top:8px;right:7px;width:18px;height:18px;border-radius:50%;background:var(--domain);color:#14213a}#dialog.atlas-level-dialog .atlas-domain-check svg{width:18px;height:18px}#dialog.atlas-level-dialog .atlas-domain-nav button:focus-visible{outline:3px solid var(--ink,#14213a);outline-offset:3px}#dialog.atlas-level-dialog .atlas-domain-context{order:-3;display:flex;align-items:center;gap:12px}#dialog.atlas-level-dialog .atlas-domain-context strong,#dialog.atlas-level-dialog .atlas-domain-context small{display:block}#dialog.atlas-level-dialog #form>.breadcrumb{display:none}#dialog.atlas-level-dialog .atlas-domain-status{font-size:.85rem;color:var(--atlas-reference-muted,#526077)}@media(max-width:600px){#dialog.atlas-level-dialog .atlas-domain-nav{grid-template-columns:minmax(0,1fr)}}';
  document.head.append(style);
  let session=null;
  const dlg=document.getElementById('dialog');
  const previousMapping=mapping;
  const read=form=>{const data=new FormData(form);data.delete('atlas-level-choice');return Object.fromEntries(data.entries());};
  function restore(form,values) {
    for(const el of form.querySelectorAll('input[name],textarea[name],select[name]'))if(Object.hasOwn(values,el.name))el.value=values[el.name]??'';
  }
  function capture() {
    if(!session)return;
    const form=document.getElementById('form');if(!form)return;
    const fields=read(form);
    if(JSON.stringify(fields)===session.baseline)session.drafts.delete(session.key);else session.drafts.set(session.key,fields);
  }
  function domainIcon(domain) {
    const os=F.filter(o=>o.domain===domain),value=os[0]?.color||'';
    const span=document.createElement('span');span.className='atlas-domain-icon';
    span.style.setProperty('--domain',/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)?value:'#64748b');
    span.innerHTML=iconSvg(iconName(domain,groups(FD).map(os=>os[0].domain),F!==FD));
    return span;
  }
  function decorateDomains() {
    const ds=groups(F).map(os=>os[0].domain);
    document.querySelectorAll('#legend [data-help]').forEach(button=>{
      const domain=ds[Number(button.dataset.help)];
      if(domain&&!button.querySelector('.atlas-domain-icon'))button.prepend(domainIcon(domain));
    });
    document.querySelectorAll('.v6-matrix tr.group').forEach(row=>{
      const info=row.querySelector('[data-info]');if(!info)return;
      const label=row.querySelector('.domain-toggle')?.lastElementChild||info;
      if(!label.querySelector('.atlas-domain-icon'))label.prepend(domainIcon(info.dataset.info));
    });
  }
  function domainNavigation(form,o,p,m) {
    session.visited.set(o.domain,o.id);
    const nav=document.createElement('nav');nav.className='atlas-domain-nav';
    nav.setAttribute('aria-label',tx('Domeinen binnen deze module of dit deelvak','Domains within this module or course'));
    groups(F).forEach((os,index)=>{
      const domain=os[0].domain,active=domain===o.domain,button=document.createElement('button');
      button.type='button';button.dataset.atlasDomain=String(index);
      button.setAttribute('aria-pressed',String(active));
      const icon=domainIcon(domain);button.style.setProperty('--domain',icon.style.getPropertyValue('--domain'));
      const label=document.createElement('span');label.textContent=domain;button.append(icon,label);
      if(active){const check=document.createElement('span');check.className='atlas-domain-check';check.innerHTML=iconSvg('check');check.setAttribute('aria-hidden','true');button.append(check);}
      button.onclick=()=>{if(active)return;capture();try{const target=domainRoute(F,keyFor(p),domain,session.visited);openLevel(target,session);document.querySelector('[data-atlas-domain="'+index+'"]').focus();}catch(error){say(error.message);}};
      nav.append(button);
    });
    const context=document.createElement('div');context.className='atlas-domain-context';
    const text=document.createElement('div'),title=document.createElement('strong'),subtitle=document.createElement('small');
    title.textContent=o.domain;
    const course=(m.courses||[]).find(c=>c.code===p.code);
    subtitle.textContent=m.name+' · '+tx('Jaar ','Year ')+m.year+(course?' · '+course.code+' · '+course.name:'');
    text.append(title,subtitle);context.append(domainIcon(o.domain),text);form.prepend(nav,context);
    const status=document.createElement('p');status.className='atlas-domain-status';status.setAttribute('role','status');form.append(status);
    const update=()=>{status.textContent=session.drafts.size+' '+tx('gewijzigde koppeling(en) in dit venster; nog niet toegepast.','changed mapping(s) in this dialog; not yet applied.');};
    form.addEventListener('input',()=>{capture();update();});form.addEventListener('change',()=>{if(document.getElementById('form')===form){capture();update();}});update();
  }
  function keyFor(p){return p.oid+'|'+p.mid+(p.encoded===undefined?'':'|'+p.encoded);}
  function openLevel(key,existing) {
    try {
      const p=parse(key),o=F.find(o=>o.id===p.oid),m=state.modules.find(m=>m.id===p.mid);
      if(!o||!m)throw Error('Leeruitkomst of module niet gevonden.');
      const resolved=resolve(state.mappings||{},key),nextSession=existing||{drafts:new Map(),visited:new Map()};
      if(dlg.open)dlg.close();
      previousMapping(p.ui);
      const form=document.getElementById('form');if(!form)return;
      session=nextSession;session.key=resolved;
      restore(form,normalise(state.mappings?.[resolved]));session.baseline=JSON.stringify(read(form));
      if(session.drafts.has(resolved))restore(form,session.drafts.get(resolved));
      dlg.classList.add('atlas-level-dialog');
      const box=document.createElement('fieldset');box.className='atlas-level-options';
      const legend=document.createElement('legend');legend.textContent=tx('Niveau en beschrijving','Level and description');box.append(legend);
      const grid=document.createElement('div');grid.className='atlas-level-grid';box.append(grid);
      F.filter(x=>x.domain===o.domain).forEach(x=>{
        const label=document.createElement('label');label.className='atlas-level-card';
        const heading=document.createElement('strong'),radio=document.createElement('input');radio.type='radio';radio.name='atlas-level-choice';radio.checked=x.id===o.id;
        radio.value=x.id;radio.setAttribute('aria-label',x.level);
        radio.onchange=()=>{capture();openLevel(x.id+'|'+p.mid+(p.encoded===undefined?'':'|'+p.encoded),session);dlg.querySelector('.atlas-level-card input:checked')?.focus();};
        heading.append(radio,document.createTextNode(x.level));const description=document.createElement('p');description.textContent=x.text;label.append(heading,description);grid.append(label);
      });
      form.prepend(box);
      domainNavigation(form,o,p,m);
      const outcome=document.getElementById('alignmentOutcome');
      if(outcome)outcome.onchange=()=>{capture();openLevel(outcome.value+'|'+p.mid+(p.encoded===undefined?'':'|'+p.encoded),session);};
      form.onsubmit=e=>{e.preventDefault();capture();try{const updated=commit(state,[...session.drafts]);const modified=session.drafts.size;session=null;dlg.close();if(modified){state=updated;changed();render();}}catch(error){say(error.message);}};
      const submit=form.querySelector('button.primary');if(submit)submit.textContent=p.code===undefined?tx('Alle wijzigingen in deze module opslaan','Save all changes in this module'):tx('Alle wijzigingen in dit deelvak opslaan','Save all changes in this course');
    } catch(error) {say(error.message);}
  }
  mapping=function(key){openLevel(key,null);};
  const previousMatrix=matrix;
  matrix=function(view) {
    previousMatrix(view);
    const table=view.querySelector('.v6-matrix');if(!table)return;
    table.tHead.rows[0].cells[0].textContent=tx('Competentiedomein','Competence domain');
    for(const os of groups(F)) {
      const header=[...table.tBodies[0].rows].find(r=>r.classList.contains('group')&&r.querySelector('[data-info]')?.dataset.info===os[0].domain);
      const rows=[];for(let r=header?.nextElementSibling;r&&!r.classList.contains('group');r=r.nextElementSibling)rows.push(r);
      if(!rows.length)continue;
      const first=rows[0];first.cells[0].textContent=tx('Koppelingen','Mappings');
      for(let col=1;col<first.cells.length;col++) {
        const keys=rows.map(r=>r.cells[col]?.querySelector('[data-map]')?.dataset.map).filter(Boolean),button=first.cells[col].querySelector('[data-map]');
        if(!button||!keys.length)continue;
        let count=0,ambiguous=false;const values=[];
        for(const key of keys){try{const resolved=resolve(state.mappings||{},key);if(Object.hasOwn(state.mappings||{},resolved)){count++;values.push(normalise(state.mappings[resolved]));}}catch{ambiguous=true;}}
        button.classList.add('atlas-domain-mapping');button.textContent=ambiguous?tx('Dubbele mappings controleren','Review duplicate mappings'):count?count+' '+tx('koppeling(en)','mapping(s)'):tx('Koppeling bespreken','Discuss mapping');
        for(const [field,value,nl,en] of [['phase','introduced','Kennismaken','Introduced'],['phase','practised','Oefenen','Practised'],['phase','mastery','Beoogde beheersing','Intended mastery'],['testing','summative','Summatief','Summative'],['testing','formative','Formatief','Formative'],['decision','gap','Ontbreekt','Gap'],['decision','excluded','Uitgesloten','Excluded'],['review','attention','Aandachtspunt','Attention']]){const n=values.filter(a=>a[field]===value).length;if(n){const s=document.createElement('small');s.textContent=n+' · '+tx(nl,en);button.append(s);}}
        const p=parse(keys[0]),module=state.modules.find(m=>m.id===p.mid);
        if(p.code===undefined&&module?.courses?.length){
          let covered=0;
          for(const c of module.courses){if(os.some(o=>{try{const k=resolve(state.mappings||{},o.id+'|'+courseKey(module,c)),a=normalise(state.mappings?.[k]);return a.decision==='included'&&(!!a.phase||['summative','formative'].includes(a.testing));}catch{return false;}}))covered++;}
          if(covered){const s=document.createElement('small');s.textContent=covered+'/'+module.courses.length+' '+tx('deelvakken gekoppeld','courses mapped');button.append(s);}
        }
        button.setAttribute('aria-label',(module?.name||p.mid)+' · '+os[0].domain+(p.code?' · '+p.code:'')+' · '+tx('Koppelingen bewerken','Edit mappings'));
        button.onclick=()=>mapping(keys.find(k=>{try{return Object.hasOwn(state.mappings||{},resolve(state.mappings||{},k));}catch{return true;}})||keys[0]);
      }
      rows.slice(1).forEach(r=>r.remove());
    }
  };
  function guard(event) {
    if(!session)return;capture();
    if(session.drafts.size&&!confirm(tx('Wijzigingen voor alle domeinen en niveaus verwerpen?','Discard edits for all domains and levels?'))){event.preventDefault();event.stopImmediatePropagation();}
  }
  document.getElementById('close').addEventListener('click',guard,true);
  dlg.addEventListener('cancel',guard,true);
  dlg.addEventListener('click',event=>{if(event.target!==dlg)return;const r=dlg.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)guard(event);},true);
  dlg.addEventListener('close',()=>{if(!dlg.open){session=null;dlg.classList.remove('atlas-level-dialog');}});
  const priorDomainRender=render;render=function(...args){const result=priorDomainRender.apply(this,args);queueMicrotask(decorateDomains);return result;};
  queueMicrotask(decorateDomains);
  window.addEventListener('beforeunload',event=>{if(session){capture();if(session.drafts.size){event.preventDefault();event.returnValue='';}}});
})();
