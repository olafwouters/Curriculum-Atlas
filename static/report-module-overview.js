/* Compact angled chart labels and complete, single-page landscape report graphs. */
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
function ranges(n){return n>0?[[0,n]]:[];}
function labelLines(text){
 const lines=[''];
 for(const word of String(text).split(/\s+/))for(const part of word.match(/.{1,36}/gu)||[]){
  const i=lines.length-1;
  if(lines[i]&&lines[i].length+part.length+1>36)lines.push(part);
  else lines[i]+=(lines[i]?' ':'')+part;
 }
 return lines;
}
function chartLayout(count,print=false){
 const left=150,right=250,width=print?1200:Math.max(720,left+count*72+right);
 const plot=width-left-right,step=plot/Math.max(count,1),font=print?Math.min(12,step*.3):12;
 return {left,right,width,plot,step,font};
}
function compactChart(chart,print=false){
 if(!chart)return;
 const labels=[...chart.querySelectorAll('text')].filter(t=>t.hasAttribute('data-atlas-label')||Number(t.getAttribute('y'))===375);
 if(!labels.length)return;
 const vb=(chart.getAttribute('viewBox')||'').trim().split(/\s+/).map(Number);
 const oldLeft=Number(chart.dataset.atlasPlotLeft||210),oldPlot=Number(chart.dataset.atlasPlotWidth||(vb[2]-oldLeft-30));
 if(!(oldPlot>0))return;
 const layout=chartLayout(labels.length,print),scale=layout.plot/oldPlot;
 const move=x=>layout.left+(x-oldLeft)*scale;
 for(const el of chart.querySelectorAll('[x],[x1],[x2],[cx]'))for(const attr of ['x','x1','x2','cx']){
  if(!el.hasAttribute(attr))continue;
  const x=Number(el.getAttribute(attr));
  if(Number.isFinite(x)&&x>=oldLeft-1)el.setAttribute(attr,String(move(x)));
 }
 let height=470;
 for(const label of labels){
  const full=label.dataset.atlasFullName||label.querySelector('title')?.textContent||label.textContent;
  label.dataset.atlasLabel='';label.dataset.atlasFullName=full;
  const lines=labelLines(full),x=Number(label.getAttribute('x')),y=375;
  label.textContent='';
  const title=chart.ownerDocument.createElementNS(chart.namespaceURI,'title');title.textContent=full;label.append(title);
  lines.forEach((line,i)=>{const span=chart.ownerDocument.createElementNS(chart.namespaceURI,'tspan');span.setAttribute('x',String(x));span.setAttribute('dy',i?'1.2em':'0');span.textContent=line;label.append(span);});
  label.setAttribute('y',String(y));label.setAttribute('text-anchor','start');label.setAttribute('transform','rotate(45 '+x+' '+y+')');
  label.setAttribute('aria-label',full);label.style.setProperty('font-size',layout.font+'px','important');
  label.style.setProperty('font-weight',full.startsWith('↳')?'400':'600','important');
  const extent=(Math.max(...lines.map(s=>s.length))*layout.font*.65+lines.length*layout.font*1.2)/Math.sqrt(2);
  height=Math.max(height,y+extent+25);
 }
 for(const text of chart.querySelectorAll('text')){
  if(Number(text.getAttribute('y'))===402||text.hasAttribute('data-atlas-year')){
   text.dataset.atlasYear='';text.setAttribute('y','355');text.style.setProperty('font-size',Math.min(10,layout.font)+'px','important');
  }
 }
 chart.dataset.atlasPlotLeft=String(layout.left);chart.dataset.atlasPlotWidth=String(layout.plot);
 chart.setAttribute('viewBox','0 0 '+layout.width+' '+Math.ceil(height));chart.setAttribute('preserveAspectRatio','xMidYMid meet');
 chart.setAttribute('width',String(layout.width));chart.setAttribute('height',String(Math.ceil(height)));
 chart.style.cssText=print?'display:block;width:100%;height:100%;min-width:0;max-width:100%;overflow:visible':'display:block;width:max(100%, '+layout.width+'px)!important;height:auto!important;min-width:0!important;max-width:none!important;overflow:visible';
}
if(typeof module==='object'&&module.exports)module.exports={matrixData,ranges,labelLines,chartLayout,compactChart};
if(typeof document==='undefined')return;
if(typeof dashboard==='function'){
 const prior=dashboard;
 dashboard=function(view){const result=prior.apply(this,arguments);compactChart(view.querySelector('svg.curriculum-chart'));return result;};
}
compactChart(document.querySelector('#view svg.curriculum-chart'));
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
  const pg=node('section');pg.className='page atlas-report-graph';pg.style.setProperty('--dc',page.style.getPropertyValue('--dc')||'#1262a5');
  const top=page.querySelector('.top');if(top)pg.append(top.cloneNode(true));
  pg.append(node('h1',page.querySelector('.chip')?.textContent||tx('Curriculumgrafiek','Curriculum chart')));
  const chart=original.cloneNode(true);compactChart(chart,true);chart.classList.add('atlas-print-plot');
  const plot=node('div');plot.className='atlas-print-plot-box';plot.append(chart);pg.append(plot);
  pg.append(node('p',page.querySelector('.small')?.textContent||tx('Lijnen tonen curriculumkoppelingen, geen gemeten studentvaardigheid. Stippellijn: doelniveau. Deelvakken zonder punt zijn niet automatisch gemapt.','Lines show curriculum mappings, not measured student proficiency. Dashed line: target level. Submodules without a point are not automatically mapped.')));
  page.before(pg);page.querySelector('.chart')?.remove();page.querySelector('.small')?.remove();
  const heading=page.querySelector('h1');if(heading)heading.textContent=tx('Aandachtspunten en teamafspraken','Points of attention and team agreements');
 }
 const style=node('style');style.textContent='@page{size:A4 landscape;margin:10mm}.atlas-report-matrix table{table-layout:fixed;width:100%;font-size:8pt}.atlas-report-matrix th,.atlas-report-matrix td{padding:1.5mm;overflow-wrap:anywhere}.atlas-report-matrix th:first-child{width:26%}.atlas-report-matrix td{text-align:center}.atlas-report-matrix tbody th{text-align:left;background:white}.atlas-report-matrix .parent th{font-weight:750;background:#edf3fa}.atlas-report-matrix .parent td{background:#edf3fa}.atlas-report-matrix .child th{font-weight:400;padding-left:5mm}.atlas-report-matrix thead{display:table-header-group}.atlas-report-matrix tr{break-inside:avoid}.atlas-report-matrix .parent{break-after:avoid}.atlas-report-matrix p,.atlas-report-graph p{font-size:8pt}.atlas-report-graph{box-sizing:border-box;display:flex;flex-direction:column;gap:1.5mm;break-inside:avoid;page-break-inside:avoid;height:188mm;width:100%}.atlas-report-graph h1{font-size:18pt;margin:1mm 0}.atlas-report-graph>.top,.atlas-report-graph>h1,.atlas-report-graph>p{flex:none}.atlas-print-plot-box{flex:1 1 0;min-height:0;width:100%}.atlas-print-plot{display:block;width:100%!important;height:100%!important;min-width:0!important;max-width:100%!important}.atlas-print-plot text{font:12px Arial;fill:#0f1728}.atlas-print-plot .qol-high-point circle:last-child{stroke:#b42318;stroke-width:4}';doc.head.append(style);
}
new MutationObserver(enhance).observe(document.body,{childList:true});enhance();
})();
