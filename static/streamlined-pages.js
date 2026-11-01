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
