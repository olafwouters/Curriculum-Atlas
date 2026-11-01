/* Curriculum design UI refinements. Existing data and editor handlers retained. */
(()=>{
const pick=(nl,en)=>catalogueLanguage()==='en'?en:nl;
const saved=document.getElementById('saved');const parking=document.createElement('div');parking.hidden=true;document.body.appendChild(parking);
function park(){if(saved)parking.appendChild(saved);const manage=document.getElementById('manageWorkspaces');if(manage)parking.appendChild(manage);}
const baseRender=render;
render=function(){park();for(const r of results){r.mode=String(r.mode||'').replace(/[\s,]+$/g,'');r.level=String(r.level||'').replace(/[\s,]+$/g,'');}baseRender();
 if(tab==='overview'||tab==='catalogue'){
  const panel=document.createElement('section');panel.className='card';panel.setAttribute('data-no-translate','');
  const title=document.createElement('h2');title.textContent=pick('Opleiding & werkruimte','Programme & workspace');panel.appendChild(title);
  saved.setAttribute('aria-label',pick('Opgeslagen werkruimte','Saved workspace'));panel.appendChild(saved);
  const manage=document.getElementById('manageWorkspaces');if(manage){manage.textContent=pick('Werkruimtes beheren','Manage workspaces');panel.appendChild(manage);}
  document.getElementById('view').prepend(panel);
 }
};
const baseTargets=targets;
targets=function(v){baseTargets(v);const section=document.createElement('section');section.className='target-coverage';section.setAttribute('data-no-translate','');
let html='<h2>'+pick('Waar komt het doelniveau terug?','Where is the target level addressed?')+'</h2><p>'+pick('Dit overzicht toont geplande bijdragen op het gekozen niveau, geen bewezen studentbeheersing. Toetsing alleen telt niet automatisch als beoogde beheersing.','This overview shows planned contributions at the selected level, not proven student mastery. Assessment alone does not imply intended mastery.')+'</p>';
const phaseLabels={introduced:pick('Introductie','Introduction'),practised:pick('Oefenen en verdiepen','Practice and deepen understanding'),mastery:pick('Beoogde beheersing','Intended mastery')};
for(const domain of [...new Set(F.map(o=>o.domain))]){
 const target=state.targets[domain]||{};const levelOf=v=>{const m=String(v||'').trim().match(/^(IV|III|II|I)(?![A-Za-z])/);return m?['I','II','III','IV'].indexOf(m[1]):-1;};const targetIndex=levelOf(target.level);const levelNames=[pick('I \u2014 Starten','I \u2014 Start'),pick('II \u2014 Toepassen','II \u2014 Apply'),pick('III \u2014 Verdiepen','III \u2014 Deepen'),pick('IV \u2014 Richting geven','IV \u2014 Provide direction')];
 html+='<article class="card"><h3>'+E(domain)+'</h3><p>'+pick('Doelniveau: ','Target level: ')+E(targetIndex>=0?levelNames[targetIndex]:(target.level||pick('Nog niet gekozen','Not selected')))+'</p>';
 if(targetIndex<0){html+='<p>'+pick('Kies eerst een doelniveau.','Select a target level first.')+'</p>';}
 else{let targetHasMastery=false;for(let li=0;li<=targetIndex;li++){const outcome=F.find(o=>o.domain===domain&&levelOf(o.level)===li);const contributions=[];
  if(outcome){for(const module of [...state.modules].sort((a,b)=>a.year-b.year)){const entries=[{key:outcome.id+'|'+module.id,course:null},...(module.courses||[]).map(course=>({key:outcome.id+'|'+courseKey(module,course),course}))];
   for(const entry of entries){const a=state.mappings[entry.key];if(!a)continue;const decision=a.decision||(a.status==='gap'?'gap':a.status==='excluded'?'excluded':'included');if(decision!=='included')continue;const phase=a.phase||(a.status==='introduced'?'introduced':a.status==='practised'?'practised':'');if(!phaseLabels[phase])continue;contributions.push({module,course:entry.course,phase});if(li===targetIndex&&phase==='mastery')targetHasMastery=true;}}}
  html+='<h4>'+E(levelNames[li])+'</h4>'+(contributions.length?'<ul>'+contributions.map(x=>'<li><strong>'+E(x.module.name)+'</strong> \u00b7 '+pick('Jaar ','Year ')+E(x.module.year)+(x.course?' \u00b7 '+pick('Deelvak: ','Course: ')+E(x.course.name||x.course.code):'')+' \u2014 '+E(phaseLabels[x.phase])+(x.module.elective?' \u00b7 '+pick('Keuzeonderwijs','Elective'):'')+'</li>').join('')+'</ul>':'<p>'+pick('Nog geen bijdragen vastgelegd op dit niveau.','No contributions recorded at this level yet.')+'</p>');}
  for(let li=targetIndex+1;li<=3;li++){const outcome=F.find(o=>o.domain===domain&&levelOf(o.level)===li);const above=[];
  if(outcome){for(const module of [...state.modules].sort((a,b)=>a.year-b.year)){const entries=[{key:outcome.id+'|'+module.id,course:null},...(module.courses||[]).map(course=>({key:outcome.id+'|'+courseKey(module,course),course}))];
   for(const entry of entries){const a=state.mappings[entry.key];if(!a)continue;const decision=a.decision||(a.status==='gap'?'gap':a.status==='excluded'?'excluded':'included');if(decision!=='included')continue;const phase=a.phase||(a.status==='introduced'?'introduced':a.status==='practised'?'practised':'');if(!phaseLabels[phase])continue;above.push({module,course:entry.course,phase});}}}
  if(above.length)html+='<section class="target-warning" role="alert"><h4>'+E(levelNames[li])+'</h4><p><strong>'+pick('Waarschuwing: dit niveau ligt hoger dan het beoogde doelniveau.','Warning: this level is higher than the intended target level.')+'</strong> '+pick('Controleer of de koppeling klopt of pas het doelniveau aan.','Check whether the mapping is correct or adjust the target level.')+'</p><ul>'+above.map(x=>'<li><strong>'+E(x.module.name)+'</strong> \u00b7 '+pick('Jaar ','Year ')+E(x.module.year)+(x.course?' \u00b7 '+pick('Deelvak: ','Course: ')+E(x.course.name||x.course.code):'')+' \u2014 '+E(phaseLabels[x.phase])+'</li>').join('')+'</ul></section>';}
  if(!targetHasMastery)html+='<p>'+pick('Beoogde beheersing van het doelniveau is nog niet expliciet gekoppeld aan een module of deelvak.','Intended mastery of the target level is not yet explicitly linked to a module or course.')+'</p>';}
 html+='</article>';
}
section.innerHTML=html;v.appendChild(section);
};
const style=document.createElement('style');style.textContent='.mapping-cell.column-focus:not(:hover){background:transparent!important;box-shadow:none!important;outline:none!important}.mapping-cell:hover{outline:2px solid var(--accent,#2563eb);outline-offset:-2px}.target-coverage{display:grid;gap:1rem}.target-coverage ul{padding-left:1.25rem}.target-coverage li{margin:.5rem 0}.target-coverage h4{margin:16px 0 6px}.target-warning{margin-top:16px;padding:12px 14px;border:1px solid #d92d20;border-radius:12px;background:#fff1f0;color:#b42318}.target-warning h4{color:#b42318;margin-top:0}.target-warning strong{color:#b42318}';document.head.appendChild(style);
render();
})();
