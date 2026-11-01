/* Radar chart: highest level per competence, shown under the curriculum chart. */
(()=>{'use strict';
const RN=['I','II','III','IV'],pick=(a,b)=>localStorage.getItem('compass-language')==='en'?b:a,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lvl=o=>RN.indexOf(String(o.level).split('.')[0].trim())+1;
function radarData(st,fw,yr){
 const mods=new Set(st.modules.filter(m=>!yr||String(m.year)===yr).map(m=>m.id)),byId=new Map(fw.map(o=>[o.id,o])),ds=[...new Set(fw.map(o=>o.domain))],offer={},assessed={};
 ds.forEach(d=>{offer[d]=0;assessed[d]=0});
 for(const [k,a] of Object.entries(st.mappings||{})){
  const [oid,rest='']=k.split('|'),o=byId.get(oid);if(!o||!mods.has(rest.split('::')[0]))continue;
  if(a.decision==='gap'||a.decision==='excluded')continue;
  const phase=a.phase||(a.status==='introduced'||a.status==='practised'?a.status:''),testing=a.testing||(a.status==='assessed'?'summative':'unknown');
  if(!phase&&testing!=='formative'&&testing!=='summative')continue;
  const L=lvl(o);if(L<1)continue;
  offer[o.domain]=Math.max(offer[o.domain],L);if(testing==='summative')assessed[o.domain]=Math.max(assessed[o.domain],L);
 }
 return ds.map(d=>{const t=st.targets&&st.targets[d];return {domain:d,offer:offer[d],assessed:assessed[d],target:t?Math.max(0,RN.indexOf(String(t.level||'').split('.')[0].trim())+1):0}});
}
function radarSvg(rows){
 const n=rows.length,W=800,H=620,cx=W/2,cy=H/2+5,R=200,ang=i=>(-90+i*360/n)*Math.PI/180,pt=(i,v)=>[cx+R*v/4*Math.cos(ang(i)),cy+R*v/4*Math.sin(ang(i))],f=x=>x.toFixed(1);
 let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(pick('Spinnenwiel: niveau per competentie','Radar chart: level per competence'))+'" style="width:100%;max-width:820px;height:auto">';
 for(let L=1;L<=4;L++)s+='<polygon points="'+rows.map((_,i)=>pt(i,L).map(f).join(',')).join(' ')+'" fill="none" stroke="#c9c4d4" stroke-width="'+(L===4?1.5:1)+'"/>';
 rows.forEach((r,i)=>{const [x,y]=pt(i,4),c=Math.cos(ang(i)),lx=cx+(R+16)*c,ly=cy+(R+16)*Math.sin(ang(i)),lab=r.domain.length>26?r.domain.slice(0,25)+'\u2026':r.domain;
  s+='<line x1="'+cx+'" y1="'+cy+'" x2="'+f(x)+'" y2="'+f(y)+'" stroke="#c9c4d4"/><text x="'+f(lx)+'" y="'+f(ly+4)+'" font-size="13" fill="#2b2540" text-anchor="'+(c>.3?'start':c<-.3?'end':'middle')+'"><title>'+esc(r.domain)+'</title>'+esc(lab)+'</text>'});
 for(let L=1;L<=4;L++)s+='<text x="'+(cx+5)+'" y="'+f(cy-R*L/4-3)+'" font-size="11" fill="#6b647f">'+RN[L-1]+'</text>';
 const poly=(key,stroke,fill,dash,w)=>{const p=rows.map((r,i)=>pt(i,r[key]).map(f).join(',')).join(' ');return '<polygon points="'+p+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>'};
 s+=poly('offer','#1F7A6E','rgba(42,157,143,.22)','',2.5)+poly('assessed','#5B3A99','rgba(91,58,153,.10)','',2.5)+poly('target','#1b1b1b','none','7 5',2);
 rows.forEach((r,i)=>{if(r.offer){const [x,y]=pt(i,r.offer);s+='<circle cx="'+f(x)+'" cy="'+f(y)+'" r="4" fill="#1F7A6E"/>'}if(r.assessed){const [x,y]=pt(i,r.assessed);s+='<rect x="'+f(x-4)+'" y="'+f(y-4)+'" width="8" height="8" fill="#5B3A99"/>'}});
 return s+'</svg>';
}
function radarHtml(rows){
 const nm=v=>v?RN[v-1]:'\u2013';
 const legend='<ul class="hint" style="list-style:none;display:flex;flex-wrap:wrap;gap:16px;padding:0;margin:8px 0"><li><span style="color:#1F7A6E">\u25CF</span> '+pick('Hoogste niveau in het curriculum','Highest level in the curriculum')+'</li><li><span style="color:#5B3A99">\u25A0</span> '+pick('Hoogste niveau met summatieve beoordeling','Highest level with summative assessment')+'</li><li><span>\u2504\u2504</span> '+pick('Doelniveau','Target level')+'</li></ul>';
 const table='<details><summary>'+pick('Waarden als tabel','Values as table')+'</summary><table><thead><tr><th>'+pick('Competentie','Competence')+'</th><th>'+pick('Curriculum','Curriculum')+'</th><th>'+pick('Summatief beoordeeld','Summatively assessed')+'</th><th>'+pick('Doelniveau','Target level')+'</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.domain)+'</td><td>'+nm(r.offer)+'</td><td>'+nm(r.assessed)+'</td><td>'+nm(r.target)+'</td></tr>').join('')+'</tbody></table></details>';
 return '<h3>'+pick('Niveau per competentie','Level per competence')+'</h3><p class="hint">'+pick('Het spinnenwiel toont per competentie het hoogste niveau (I\u2013IV) dat het curriculum aanbiedt en summatief beoordeelt. Het beschrijft taakeisen in het curriculum, geen gemeten studentvaardigheid. Gaten en bewust uitgesloten koppelingen tellen niet mee.','The radar chart shows, per competence, the highest level (I\u2013IV) the curriculum offers and assesses summatively. It describes task requirements in the curriculum, not measured student proficiency. Gaps and deliberately excluded mappings are not counted.')+'</p>'+(rows.length<3?'<p>'+pick('Een spinnenwiel heeft minstens drie competenties nodig.','A radar chart needs at least three competences.')+'</p>':radarSvg(rows)+legend)+table;
}
globalThis.__radar={radarData,radarSvg,radarHtml};
const prior=dashboard;
dashboard=function(v){prior.apply(this,arguments);try{
  v.querySelector('#radar-section')?.remove();if(!state||!F||!F.length)return;
  const sec=document.createElement('section');sec.id='radar-section';sec.className='card';sec.innerHTML=radarHtml(radarData(state,F,typeof year==='undefined'?'':year));
  const svg=v.querySelector('svg'),anchor=svg?(svg.parentElement===v?svg:svg.parentElement):null;anchor?anchor.after(sec):v.append(sec);
 }catch(e){console.error('radar',e)}};
})();
