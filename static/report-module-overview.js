/* Add a module-by-competence overview to the existing PDF team report. */
(()=>{'use strict';
function moduleOverview(workspace,outcomes){
 const levels=['I','II','III','IV'],domains=[...new Set(outcomes.map(o=>o.domain))];
 const eligible=a=>{
  if(!a)return false;
  const decision=a.decision||(['gap','excluded'].includes(a.status)?a.status:'included');
  return decision==='included'&&!!(a.phase||['introduced','practised','assessed'].includes(a.status)||['formative','summative'].includes(a.testing));
 };
 const sorted=set=>levels.filter(l=>set.has(l));
 const rows=workspace.modules.slice().sort((a,b)=>a.year-b.year).map(m=>{
  const cells=domains.map(domain=>{
   const main=new Set(),child=new Set();
   for(const o of outcomes.filter(o=>o.domain===domain)){
    const level=(String(o.level).match(/^(IV|III|II|I)(?=[.\s—–-]|$)/)||[])[1];if(!level)continue;
    if(eligible(workspace.mappings?.[o.id+'|'+m.id]))main.add(level);
    for(const c of m.courses||[]){
     const base=o.id+'|'+m.id,code=encodeURIComponent(c.code),key=base+'::'+code;
     const a=Object.hasOwn(workspace.mappings||{},key)?workspace.mappings[key]:workspace.mappings?.[base+'|'+code];
     if(eligible(a))child.add(level);
    }
   }
   return {main:sorted(main),child:sorted(child)};
  });
  return {name:m.name,year:m.year,elective:!!m.elective,cells};
 });
 return {domains,rows};
}
if(typeof module==='object'&&module.exports)module.exports=moduleOverview;
if(typeof document==='undefined')return;
function enhance(){
 const frame=document.getElementById('qol-print-frame'),doc=frame?.contentDocument;
 if(!doc?.querySelector('.cover')||doc.getElementById('atlas-report-module-table')||typeof state==='undefined'||!state||typeof F==='undefined')return;
 const nl=localStorage.getItem('compass-language')!=='en',tx=(a,b)=>nl?a:b;
 const model=moduleOverview(state,F),section=doc.createElement('section');section.id='atlas-report-module-table';
 const node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 for(let start=0;start<model.domains.length;start+=5){
  const page=node('section');page.className='page atlas-module-overview';
  page.append(node('h1',tx('Modules en competentieniveaus','Modules and competence levels')));
  page.append(node('p',state.programme||''));
  page.append(node('p',tx('Module: rechtstreeks vastgelegde modulebrede niveaus. Deelvakken: alle vastgelegde niveaus in de deelvakken; dit betekent niet dat elk deelvak elk niveau behandelt.','Module: explicitly recorded module-wide levels. Submodules: all recorded levels in the submodules; this does not mean every submodule covers every level.')));
  page.append(node('p',tx('Alle modules, inclusief gemarkeerd keuzeonderwijs. Een streepje betekent geen opgenomen koppeling, niet niveau nul. Gaten en uitgesloten koppelingen tellen niet mee.','All modules, including labelled electives. A dash means no included mapping, not level zero. Gaps and excluded mappings are not counted.')));
  const table=node('table'),head=node('thead'),hr=node('tr');hr.append(node('th',tx('Jaar / module','Year / module')));
  for(const domain of model.domains.slice(start,start+5))hr.append(node('th',domain));
  head.append(hr);table.append(head);const body=node('tbody');
  for(const row of model.rows){
   const tr=node('tr');tr.append(node('th',tx('Jaar ','Year ')+row.year+' · '+row.name+(row.elective?tx(' (keuze)',' (elective)'):'')));
   for(const cell of row.cells.slice(start,start+5)){
    const td=node('td');td.append(node('div','Module: '+(cell.main.join(', ')||'—')),node('div',tx('Deelvakken: ','Submodules: ')+(cell.child.join(', ')||'—')));tr.append(td);
   }
   body.append(tr);
  }
  table.append(body);page.append(table);section.append(page);
 }
 const style=node('style');style.textContent='.atlas-module-overview p{font-size:8pt;margin:2mm 0}.atlas-module-overview table{table-layout:fixed;margin-top:4mm;font-size:7.5pt}.atlas-module-overview th,.atlas-module-overview td{overflow-wrap:anywhere;padding:2mm;vertical-align:top}.atlas-module-overview th:first-child{width:28%}.atlas-module-overview tbody th{font-weight:500;background:#f7f8fb}.atlas-module-overview thead{display:table-header-group}.atlas-module-overview tr{break-inside:avoid;page-break-inside:avoid}.atlas-module-overview td div+div{margin-top:1mm}';
 doc.head.append(style);doc.querySelector('.cover').after(section);
}
new MutationObserver(enhance).observe(document.body,{childList:true});enhance();
})();
