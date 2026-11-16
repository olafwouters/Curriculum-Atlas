/* Single-purpose page layout. Nodes with existing handlers are moved, not recreated. */
(()=>{'use strict';
const q=s=>document.querySelector(s),pick=(a,b)=>localStorage.getItem('compass-language')==='en'?b:a;
function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;el.dataset.noTranslate='';if(cls)el.className=cls;return el;}
function streamline(){const v=q('#view');if(!v)return;
const page=tab,context=q('#ux-context'),tools=q('.workspace-tools'),toolbar=tools?.querySelector('.toolbar');
// Page titles precede the single, short purpose statement.
const purpose=q('#page-purpose');if(purpose){let heading=[...v.children].find(el=>/^H[12]$/.test(el.tagName));if(!heading){heading=text('h1',q('#navigation-items [data-tab="'+page+'"] .nav-label')?.textContent||'', 'page-heading');if(page!=='overview')v.prepend(heading);}if(page!=='overview'&&heading)heading.after(purpose);}
const guided=['catalogue','matrix','targets','dashboard'].includes(page);const workflow=q('#ux-workflow');if(workflow)workflow.hidden=!guided;
// Legacy help legend remains in the DOM for existing info-popup handlers, but has no visual footprint.
const legend=q('#legend');if(legend){legend.hidden=true;legend.setAttribute('aria-hidden','true');legend.querySelectorAll('button').forEach(b=>b.tabIndex=-1);}
// Each page uses one navigation system and one year filter.
v.querySelectorAll('[data-switch]').forEach(b=>b.remove());
if(context){const detail=context.querySelector('span:not(.ux-save):not(.demo-badge)');if(detail&&state)detail.textContent=[state.edition?pick('Editie ','Edition ')+state.edition:'',state.cluster||''].filter(Boolean).join(' · ');}
// Use one visible save button/status. Source nodes are retained for existing code.
if(tools){tools.querySelector('#save')?.classList.toggle('redundant-control',!!context&&!context.hidden);}
// Catalogue: existing-workspace selection belongs with the file tools, not a second large panel.
if(page==='catalogue'){
 const saved=q('#saved'),panel=saved?.closest('#view > section.card');if(panel&&toolbar){toolbar.prepend(saved);const manage=q('#manageWorkspaces');if(manage)toolbar.append(manage);panel.remove();}
}
// One card per target domain, with optional evidence inside that same card.
if(page==='targets'){
 const coverage=v.querySelector('.target-coverage');if(coverage){const base=[...v.querySelectorAll('[data-target]')].map(b=>b.closest('article')||b.closest('.card'));
 [...coverage.querySelectorAll('article.card')].forEach((contribution,i)=>{const card=base[i];if(!card)return;const heading=contribution.querySelector('h3');if(heading)heading.remove();const repeated=contribution.querySelector('p');if(repeated)repeated.remove();const details=document.createElement('details');details.className='target-contributions';details.open=true;details.append(text('summary',pick('Bijdragen vanuit modules en deelvakken','Contributions from modules and courses')));details.append(text('p',pick('Geplande bijdragen op het doelniveau en de niveaus daaronder, zodat zichtbaar is waar de voorbereidende stappen zitten. Dit is geen bewijs van studentbeheersing.','Planned contributions at the target level and the levels below it, showing where the preparatory steps sit. This is not evidence of student mastery.'),'hint'));while(contribution.firstChild)details.append(contribution.firstChild);card.append(details);});coverage.remove();}
}
// Overview: one introduction and one copy of each start action.
if(page==='overview'){
 v.querySelector('.welcome')?.remove();v.querySelector('.overview-note')?.remove();if(purpose)purpose.hidden=true;
 v.querySelector('.cc-banner-chips')?.remove();
 const quick=v.querySelector('.quick-card');if(quick){quick.querySelector('[data-go="matrix"]')?.remove();const heading=quick.querySelector('h2');if(heading)heading.textContent=pick('Andere acties','Other actions');}
 if(!state){v.querySelector('#empty-demo')?.remove();v.querySelector('#empty-import')?.remove();const search=v.querySelector('.activity-card [data-go="catalogue"]');if(search)search.remove();const activity=v.querySelector('.activity-card');if(activity&&!activity.querySelector('button'))activity.remove();const map=v.querySelector('.cc-banner-actions .primary');if(map)map.textContent=pick('Opleiding zoeken →','Find programme →');}
 const workspace=v.querySelector('.cc-banner-workspace');if(workspace&&state&&/demonstr/i.test(state.programme||'')){const small=workspace.querySelector('small');if(small)small.textContent=pick('DEMONSTRATIEGEGEVENS','DEMONSTRATION DATA');}
}
// Chart explanatory text in one place, deeper caveats are optional.
if(page==='dashboard'){
 const note=v.querySelector('.ux-chart-note');if(note){const details=document.createElement('details');details.className='chart-explanation';details.append(text('summary',pick('Wat laat deze grafiek zien?','What does this chart show?')));details.append(note);v.append(details);}
}
}
const previous=render;render=function(...args){const result=previous.apply(this,args);streamline();return result;};
document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',()=>setTimeout(streamline,0)));
// Banner initialization may be delayed; perform one additional idempotent cleanup.
setTimeout(streamline,650);streamline();

// One shared domain explanation: matrix and target-level info buttons open the same popup.
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-info],.target-domain-info');if(!b||typeof help!=='function')return;let d=b.dataset.info;if(!d&&b.classList.contains('target-domain-info')){const domains=[...new Set(F.map(o=>o.domain))];const card=b.closest('article,.card'),control=card?.querySelector('[data-target]');d=domains[Number(control?.dataset.target)];}if(!d)return;e.preventDefault();e.stopImmediatePropagation();help(d);},true);
})();

/* Compact matrix menus: retain original controls and their handlers. */
(()=>{'use strict';
const q=s=>document.querySelector(s),tx=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
let current=null;
const style=document.createElement('style');
style.textContent='.atlas-matrix-tools{display:flex;align-items:end;gap:16px;flex-wrap:wrap;padding:14px 16px;margin:16px 0 20px;border:1px solid var(--line,#dce1e8);border-radius:16px;background:var(--panel,#fff)}.atlas-matrix-tools>label{display:flex;flex-direction:column;gap:4px;min-width:160px;font-size:.875rem}.atlas-matrix-tools select{margin:0!important;width:100%;min-height:44px}.atlas-matrix-menus{display:flex;gap:10px;margin-left:auto}.atlas-matrix-menus>button{display:flex;align-items:center;gap:10px;min-height:44px}.atlas-matrix-menus svg{width:20px;height:20px}.atlas-matrix-menus>button[aria-expanded="true"]{border-color:var(--accent,#e87500)}.atlas-matrix-panel{position:fixed;z-index:60;box-sizing:border-box;width:310px;max-width:calc(100vw - 16px);overflow:auto;padding:10px;border:1px solid var(--line,#dce1e8);border-radius:16px;background:var(--panel,#fff);color:var(--ink,#14213a);box-shadow:0 12px 32px #14213a24}.atlas-matrix-panel[hidden],#view .atlas-matrix-vault,body[data-view="matrix"] #workspace-controls #undo-change{display:none!important}.atlas-matrix-panel>button,.atlas-matrix-panel>label{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-height:44px;padding:10px 12px;border:0;background:transparent;color:inherit;text-align:left;border-radius:10px;font:inherit}.atlas-matrix-panel svg{flex:0 0 20px;width:20px;height:20px}.atlas-matrix-panel>button{justify-content:flex-start}.atlas-matrix-panel>button:hover,.atlas-matrix-panel>label:hover{background:var(--hover,#fff0df)}.atlas-matrix-panel>p{margin:8px 12px;color:var(--muted,#626a78);font-size:.8rem}.atlas-matrix-panel>hr{border:0;border-top:1px solid var(--line,#dce1e8);margin:8px}.atlas-matrix-panel input[type="checkbox"]{appearance:none;flex:0 0 42px;width:42px;height:24px;min-height:0;margin:0;padding:3px;border:1px solid var(--line,#bbc1ca);border-radius:999px;background:#9299a6;cursor:pointer}.atlas-matrix-panel input[type="checkbox"]::before{content:"";display:block;width:16px;height:16px;border-radius:50%;background:#fff;transform:translateX(0)}.atlas-matrix-panel input[type="checkbox"]:checked{background:#25884b}.atlas-matrix-panel input[type="checkbox"]:checked::before{transform:translateX(17px)}.atlas-matrix-panel input[type="checkbox"]:indeterminate::before{transform:translateX(8px)}.atlas-matrix-panel :disabled{opacity:.5;cursor:not-allowed}.atlas-matrix-panel :focus-visible,.atlas-matrix-menus>button:focus-visible{outline:3px solid var(--accent,#e87500);outline-offset:2px}@media(max-width:600px){.atlas-matrix-tools>label{flex:1 1 140px;min-width:0}.atlas-matrix-menus{margin-left:0;width:100%;justify-content:flex-end}}';
document.head.append(style);
function closeMenus(focus=false){if(!current)return;let trigger=null;for(const item of current.menus){if(!item.panel.hidden)trigger=item.trigger;item.panel.hidden=true;item.trigger.setAttribute('aria-expanded','false');item.trigger.querySelector('[data-atlas-chevron]').textContent='⌄';}if(focus&&trigger?.isConnected)trigger.focus();}
function dispose(){closeMenus();for(const item of current?.menus||[])item.panel.remove();current=null;}
function build(){
  const v=q('#view');if(typeof tab==='undefined'||tab!=='matrix'||!v?.querySelector('.v6-matrix')){dispose();return;}
  if(v.querySelector('.atlas-matrix-tools')){current?.sync();return;}
  dispose();
  const controls={},rows=new Set();
  for(const id of ['matrix-workmode','domains-open','domains-close','expandAll','collapseAll','csvImport','csvExport','csvFile','year','fw']){const el=v.querySelector('#'+id);if(el){controls[id]=el;const row=el.closest('.matrix-actions,.filters');if(row)rows.add(row);}}
  if(!controls.year)return;
  const bar=document.createElement('div');bar.className='atlas-matrix-tools';
  const vault=document.createElement('div');vault.className='atlas-matrix-vault';vault.hidden=true;
  for(const [id,el] of Object.entries(controls))if(!['year','fw'].includes(id))vault.append(el);
  for(const [id,nl,en] of [['year','Studiejaar','Study year'],['fw','Raamwerk','Framework']]){
    const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=tx(nl,en);label.append(caption);
    let select=controls[id];if(!select){select=document.createElement('select');select.disabled=true;select.add(new Option('DigComp 3.0','digcomp'));}label.append(select);bar.append(label);
  }
  const buttons=document.createElement('div');buttons.className='atlas-matrix-menus';bar.append(buttons);v.append(vault);
  v.querySelectorAll('[data-switch]').forEach(b=>b.remove());
  rows.forEach(row=>{if(!row.querySelector('button,select,input,label,details'))row.remove();});
  const anchor=v.querySelector('#page-purpose')||v.querySelector('h1,h2');if(anchor)anchor.after(bar);else v.prepend(bar);
  const menus=[];
  function menu(id,label,settings=false){
    const trigger=document.createElement('button');trigger.type='button';trigger.id='atlas-'+id+'-trigger';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','atlas-'+id+'-panel');
    if(settings)trigger.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>';
    const text=document.createElement('span');text.textContent=label;trigger.append(text);
    const chevron=document.createElement('span');chevron.textContent='⌄';chevron.dataset.atlasChevron='';chevron.setAttribute('aria-hidden','true');trigger.append(chevron);
    const panel=document.createElement('div');panel.className='atlas-matrix-panel';panel.id='atlas-'+id+'-panel';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-labelledby',trigger.id);buttons.append(trigger);document.body.append(panel);
    trigger.onclick=()=>{const open=panel.hidden;closeMenus();if(!open)return;current.sync();panel.hidden=false;trigger.setAttribute('aria-expanded','true');chevron.textContent='⌃';const r=trigger.getBoundingClientRect(),width=panel.getBoundingClientRect().width;panel.style.left=Math.max(8,Math.min(r.right-width,innerWidth-width-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-100))+'px';panel.style.maxHeight=Math.max(80,innerHeight-parseFloat(panel.style.top)-8)+'px';};
    menus.push({trigger,panel});return panel;
  }
  const view=menu('view',tx('Weergave','View'),true),more=menu('more',tx('Meer','More'));
  function invoke(id,trigger){closeMenus();controls[id]?.click();current?.sync();requestAnimationFrame(()=>q('#'+trigger)?.focus());}
  function toggle(panel,label,run){const row=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input');text.textContent=label;input.type='checkbox';row.append(text,input);panel.append(row);input.onchange=run;return input;}
  const focus=toggle(view,tx('Focusmodus','Focus mode'),()=>invoke('matrix-workmode','atlas-view-trigger'));
  const courses=toggle(view,tx('Deelvakken tonen','Show courses'),()=>invoke(courses.checked?'expandAll':'collapseAll','atlas-view-trigger'));
  view.append(document.createElement('hr'));const heading=document.createElement('p');heading.textContent=tx('Domeinen','Domains');view.append(heading);
  function actionIcon(id){
    const paths={'domains-open':'M4 9V4h5M4 4l6 6M20 15v5h-5M20 20l-6-6','domains-close':'m7 10 5 5 5-5',csvImport:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',csvExport:'M12 3v13m-5-5 5 5 5-5M4 15v6h16v-6',undo:'M4 10h10a6 6 0 0 1 6 6M4 10l5-5M4 10l5 5'};
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.7');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',paths[id]);icon.append(path);return icon;
  }
  function action(panel,label,id){const b=document.createElement('button');b.type='button';b.append(actionIcon(id),document.createTextNode(label));b.disabled=!controls[id];b.onclick=()=>invoke(id,panel===view?'atlas-view-trigger':'atlas-more-trigger');panel.append(b);return b;}
  action(view,tx('Alles uitklappen','Expand all'),'domains-open');action(view,tx('Alles inklappen','Collapse all'),'domains-close');
  action(more,tx('CSV importeren…','Import CSV…'),'csvImport');action(more,tx('CSV exporteren','Export CSV'),'csvExport');more.append(document.createElement('hr'));
  const undo=document.createElement('button');undo.type='button';undo.append(actionIcon('undo'),document.createTextNode(tx('Laatste wijziging ongedaan maken','Undo last change')));undo.title=tx('Gebruikt de bestaande ongedaanmaakfunctie.','Uses the existing undo action.');undo.onclick=()=>{closeMenus();q('#undo-change')?.click();requestAnimationFrame(()=>q('#atlas-more-trigger')?.focus());};more.append(undo);
  function sync(){
    focus.checked=controls['matrix-workmode']?.getAttribute('aria-pressed')==='true';focus.disabled=!controls['matrix-workmode'];
    const mm=(state?.modules||[]).filter(m=>(!controls.year.value||String(m.year)===controls.year.value)&&(m.courses||[]).length);
    const n=mm.filter(m=>expanded.has(m.id)).length;courses.checked=mm.length>0&&n===mm.length;courses.indeterminate=n>0&&n<mm.length;courses.disabled=!mm.length||!controls.expandAll||!controls.collapseAll;
    const source=q('#undo-change');undo.disabled=!source||source.disabled;
  }
  current={menus,sync};sync();
}
const previousMatrix=matrix;matrix=function(...args){const result=previousMatrix.apply(this,args);queueMicrotask(build);return result;};
const previousRender=render;render=function(...args){const result=previousRender.apply(this,args);queueMicrotask(build);return result;};
document.addEventListener('pointerdown',e=>{if(current&&!current.menus.some(m=>m.trigger.contains(e.target)||m.panel.contains(e.target)))closeMenus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&current?.menus.some(m=>!m.panel.hidden)){e.preventDefault();e.stopImmediatePropagation();closeMenus(true);}else if(e.key==='Escape'&&current&&document.body.classList.contains('matrix-workmode')){queueMicrotask(()=>{current?.sync();q('#atlas-view-trigger')?.focus();});}},true);
document.addEventListener('focusin',e=>{if(current&&!current.menus.some(m=>m.trigger.contains(e.target)||m.panel.contains(e.target)))closeMenus();});
window.addEventListener('resize',()=>{closeMenus();current?.sync();});window.addEventListener('scroll',e=>{if(current&&!current.menus.some(m=>m.panel.contains(e.target)))closeMenus();},true);
const workspace=q('#workspace-controls');if(workspace)new MutationObserver(()=>current?.sync()).observe(workspace,{childList:true,subtree:true});
document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{if(tab==='matrix')render();},0)));
queueMicrotask(build);
})();
