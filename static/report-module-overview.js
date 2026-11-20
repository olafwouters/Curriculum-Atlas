/* Landscape report matrix and readable, dedicated graph pages. */
(()=>{'use strict';
function matrixData(st,fw){
 const domains=[...new Set(fw.map(o=>o.domain))],order=['I','II','III','IV'],rows=[];
 const included=a=>a&&(a.decision||(['gap','excluded'].includes(a.status)?a.status:'included'))==='included'&&(a.phase||['introduced','practised','assessed'].includes(a.status)||['formative','summative'].includes(a.testing));
 const cells=(m,c)=>domains.map(d=>order.filter(l=>fw.some(o=>{
  if(o.domain!==d||(String(o.level).match(/^(IV|III|II|I)(?=[.\s]|$)/)||[])[1]!==l)return false;
  const base=o.id+'|'+m.id,code=c&&encodeURIComponent(c.code),maps=st.mappings||{},key=base+'::'+code;
  return included(c?(Object.hasOwn(maps,key)?maps[key]:maps[base+'|'+code]):maps[base]);
 })).join(', '));
 for(const m of st.modules.slice().sort((a,b)=>a.year-b.year)){
  const main=cells(m),children=(m.courses||[]).map(c=>({name:c.name||c.code,code:c.code,child:true,cells:cells(m,c)})).filter(c=>c.cells.some(Boolean));
  if(main.some(Boolean)||children.length)rows.push({name:m.name,year:m.year,elective:!!m.elective,cells:main,child:false},...children);
 }
 return {domains,rows};
}
function ranges(n,size=6){const out=[];for(let i=0;i<n;i+=size)out.push([i,Math.min(n,i+size)]);return out;}
if(typeof module==='object'&&module.exports)module.exports={matrixData,ranges};
if(typeof document==='undefined')return;
function enhance(){
 const doc=document.getElementById('qol-print-frame')?.contentDocument;
 if(!doc?.querySelector('.cover')||doc.getElementById('atlas-report-module-table')||typeof state==='undefined'||!state||typeof F==='undefined')return;
 const tx=(a,b)=>localStorage.getItem('compass-language')==='en'?b:a;
 const node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const section=node('section');section.id='atlas-report-module-table';section.className='page atlas-report-matrix';
 section.append(node('h1',tx('Modules, deelvakken en competentieniveaus','Modules, submodules and competence levels')),node('p',state.programme||''),node('p',tx('Niveaus I–IV staan uitsluitend bij de module of het deelvak waarop ze zijn vastgelegd. Lege cellen betekenen geen opgenomen koppeling, niet niveau nul. Alleen gemapte onderdelen en hun modulekoppen worden getoond; keuzeonderwijs is gemarkeerd.','Levels I–IV appear only on the module or submodule where they are recorded. Empty cells mean no included mapping, not level zero. Only mapped items and their parent headings are shown; electives are labelled.')));
 const data=matrixData(state,F),table=node('table'),head=node('thead'),hr=node('tr');hr.append(node('th',tx('Module / deelvak','Module / submodule')));data.domains.forEach(d=>hr.append(node('th',d)));head.append(hr);table.append(head);
 const body=node('tbody');for(const row of data.rows){const tr=node('tr');tr.className=row.child?'child':'parent';const th=node('th',row.child?row.code+' · '+row.name:tx('Jaar ','Year ')+row.year+' · '+row.name+(row.elective?tx(' (keuze)',' (elective)'):''));th.setAttribute('scope','row');tr.append(th);row.cells.forEach(c=>tr.append(node('td',c)));body.append(tr);}table.append(body);section.append(table);doc.querySelector('.cover').after(section);
 for(const page of [...doc.querySelectorAll('.sheet-b')]){
  const original=page.querySelector('svg.curriculum-chart');if(!original)continue;
  const labels=[...original.querySelectorAll('text')].filter(t=>Number(t.getAttribute('y'))===375);
  if(!labels.length)continue;
  const vb=original.getAttribute('viewBox').trim().split(/\s+/).map(Number),height=vb[3]||430;
  const centers=labels.map(t=>Number(t.getAttribute('x'))),step=centers.length>1?centers[1]-centers[0]:Math.max(100,vb[2]-240);
  const blocks=ranges(labels.length);
  blocks.forEach(([start,end],part)=>{
   const pg=node('section');pg.className='page atlas-report-graph';
   pg.append(page.querySelector('.top').cloneNode(true),node('h1',page.querySelector('.chip')?.textContent||tx('Curriculumgrafiek','Curriculum chart')));
   pg.append(node('p',tx('Curriculumgrafiek','Curriculum chart')+' · '+(start+1)+'–'+end+' / '+labels.length));
   const root=doc.createElementNS(original.namespaceURI,'svg');root.setAttribute('viewBox','0 0 1200 600');root.setAttribute('class','atlas-print-plot');
   const crop=original.cloneNode(true),left=centers[start]-step/2,width=step*(end-start);
   crop.querySelectorAll('text').forEach(t=>{if(Number(t.getAttribute('y'))===375){const title=t.querySelector('title'),full=title?.textContent||t.textContent;t.textContent=full.length>25?full.slice(0,24)+'…':full;}});
   crop.setAttribute('x','65');crop.setAttribute('y','0');crop.setAttribute('width','1135');crop.setAttribute('height','580');crop.setAttribute('viewBox',[left,0,width,height].join(' '));crop.setAttribute('preserveAspectRatio','none');crop.style.cssText='overflow:hidden';root.append(crop);
   ['IV','III','II','I'].forEach((l,i)=>{const t=doc.createElementNS(original.namespaceURI,'text');t.setAttribute('x','15');t.setAttribute('y',String([85,165,245,325][i]*580/height+5));t.textContent=l;root.append(t);});
   pg.append(root,node('p',tx('Lijnen tonen curriculumkoppelingen, geen gemeten studentvaardigheid. Stippellijn: doelniveau. Deelvakken zonder punt zijn niet automatisch gemapt.','Lines show curriculum mappings, not measured student proficiency. Dashed line: target level. Submodules without a point are not automatically mapped.')));page.before(pg);
  });
  page.querySelector('.chart')?.remove();page.querySelector('.small')?.remove();page.querySelector('h1').textContent=tx('Aandachtspunten en teamafspraken','Points of attention and team agreements');
 }
 const style=node('style');style.textContent='@page{size:A4 landscape;margin:10mm}.atlas-report-matrix table{table-layout:fixed;width:100%;font-size:8pt}.atlas-report-matrix th,.atlas-report-matrix td{padding:1.5mm;overflow-wrap:anywhere}.atlas-report-matrix th:first-child{width:26%}.atlas-report-matrix td{text-align:center}.atlas-report-matrix tbody th{text-align:left;background:white}.atlas-report-matrix .parent th{font-weight:750;background:#edf3fa}.atlas-report-matrix .parent td{background:#edf3fa}.atlas-report-matrix .child th{font-weight:400;padding-left:5mm}.atlas-report-matrix thead{display:table-header-group}.atlas-report-matrix tr{break-inside:avoid}.atlas-report-matrix .parent{break-after:avoid}.atlas-report-matrix p,.atlas-report-graph p{font-size:8pt}.atlas-report-graph{break-inside:avoid;height:188mm;overflow:hidden}.atlas-report-graph h1{font-size:18pt;margin:1mm 0}.atlas-print-plot{display:block;width:100%;height:150mm}.atlas-print-plot text{font:14px Arial;fill:#0f1728}.atlas-print-plot .qol-high-point circle:last-child{stroke:#b42318;stroke-width:4}';doc.head.append(style);
}
new MutationObserver(enhance).observe(document.body,{childList:true});enhance();
})();
