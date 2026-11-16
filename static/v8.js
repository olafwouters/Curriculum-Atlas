/* v8 glass UI extension: legacy storage and mapping API preserved. */
(()=>{
const summaries=[
'Informatie en gegevens vinden, beoordelen en ordenen met digitale en AI-hulpmiddelen. Kritisch omgaan met betrouwbaarheid, misleiding en beperkingen van zoektools.',
'Digitaal communiceren en samenwerken met respect voor anderen. Informatie verantwoord delen en bewust omgaan met online deelname, identiteit en digitale voetafdruk.',
'Digitale inhoud maken, bewerken en combineren, ook met AI. Aandacht voor toegankelijkheid, auteursrecht, transparantie en instructies aan computers.',
'Apparaten, gegevens, privacy en welzijn beschermen. Digitale risico’s herkennen en technologie bewust gebruiken met aandacht voor gezondheid en duurzaamheid.',
'Digitale problemen oplossen, geschikte hulpmiddelen kiezen en creatief gebruiken. Eigen leerbehoeften herkennen en blijven ontwikkelen bij veranderende technologie.'
];
function help(d){const ds=[...new Set(F.map(x=>x.domain))],os=F.filter(x=>x.domain===d);dialog(d,'<p class="domain-intro">'+E(F===FD?(summaries[ds.indexOf(d)]||'Samenhangende digitale vaardigheden.'):'Eigen competentie met onderliggende leeruitkomsten.')+'</p>'+(F===FD?'<p class="hint">Redactionele uitleg op basis van de meegeleverde leeruitkomsten, geen letterlijk DigComp-citaat.</p>':'')+'<h3>Leeruitkomsten per niveau</h3>'+os.map((o,i)=>'<details class="domain-level" '+(!i?'open':'')+'><summary>'+E(F===FD?(['I — Starten','II — Toepassen','III — Verdiepen','IV — Richting geven'][i]||o.level):o.level)+'</summary><p>'+E(o.text)+'</p></details>').join(''));$('#dialog').classList.add('domain-dialog');}
function decorate(){if(!F.length)return;const ds=[...new Set(F.map(x=>x.domain))];$('#legend').innerHTML=ds.map((d,i)=>'<button type="button" data-help="'+i+'" style="--domain:'+F.find(x=>x.domain===d).color+'" aria-label="Uitleg '+E(d)+'">'+E(d)+'<span aria-hidden="true">ⓘ</span></button>').join('');document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>help(ds[Number(b.dataset.help)]));document.querySelectorAll('[data-info]').forEach(b=>b.onclick=()=>help(b.dataset.info));document.querySelectorAll('.v6-matrix [data-map]').forEach(b=>{b.onmouseenter=()=>{const mid=b.dataset.map.split('|')[1];document.querySelectorAll('.v6-matrix [data-map]').forEach(x=>x.classList.toggle('column-focus',x.dataset.map.split('|')[1]===mid));};b.onmouseleave=()=>document.querySelectorAll('.column-focus').forEach(x=>x.classList.remove('column-focus'));});}
const previousRender=render;render=function(){previousRender();decorate();};
const previousDialog=dialog;dialog=function(t,b,s){$('#dialog').classList.remove('domain-dialog');previousDialog(t,b,s);const button=document.querySelector('#form>button.primary');if(button)button.textContent='Opslaan';};
let done=false;const observer=new MutationObserver(()=>{if(F.length&&!done){done=true;observer.disconnect();decorate();}});observer.observe($('#legend'),{childList:true});if(F.length){done=true;observer.disconnect();decorate();}
$('#demo').onclick=()=>{if(!canSwitch())return;const s={programme:'Demonstratie — fictief curriculum',edition:'2026',modules:['A','B','C','D'].map((x,i)=>({id:'demo'+x,name:'Module '+x,year:i<2?1:2,elective:false,courses:[]})),targets:{},mappings:{},notes:'Fictieve demonstratie, geen werkelijke opleiding.',sessionTitle:'Demonstratie'};FD.forEach((o,i)=>{const mi=Math.min(i%4,3);s.mappings[o.id+'|'+s.modules[mi].id]={phase:['introduced','practised','mastery','mastery'][mi],status:mi?'practised':'introduced',testing:mi===3?'summative':'unknown',review:'unreviewed',decision:'included',intended:'Voorbeeld: beoordeel bronnen op betrouwbaarheid.',evidence:'Vergelijk drie bronnen en bespreek de verschillen.',assessment:mi===3?'Bronnenanalyse met vooraf besproken criteria.':''};});install(s);};
$('#dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}});
})();

/* Atlas level colours: presentation only; framework data stays unchanged. */
(()=>{
  'use strict';
  function hex(value){
    let s=String(value||'').trim().toLowerCase();
    if(/^#[0-9a-f]{3}$/.test(s))s='#'+[...s.slice(1)].map(c=>c+c).join('');
    return /^#[0-9a-f]{6}$/.test(s)?s:'#64748b';
  }
  function rgb(value){const s=hex(value);return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));}
  function palette(value){
    const base=hex(value);
    if(base==='#f7cf59')return ['#fef5d1','#fde69a','#fbd161','#e2ac2a'];
    const channels=rgb(base);
    return [.86,.58,.25,0].map(t=>'#'+channels.map(c=>Math.round(c+(255-c)*t).toString(16).padStart(2,'0')).join(''));
  }
  function luminance(value){const c=rgb(value).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function ink(background){return contrast(background,'#14213a')>=4.5?'#14213a':contrast(background,'#ffffff')>=4.5?'#ffffff':'#000000';}
  function levelIndex(value,fallback=0){const m=String(value||'').trim().match(/^(IV|III|II|I)(?=[.\s—–-]|$)/);return m?['I','II','III','IV'].indexOf(m[1]):Math.max(0,Math.min(3,fallback));}
  const api={palette,luminance,contrast,ink,levelIndex};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const style=document.createElement('style');
  style.textContent='#dialog.atlas-level-dialog .atlas-level-card{background:var(--atlas-level-fill,#f5f6f8)!important;background-image:none!important;color:var(--atlas-level-ink,#14213a)!important;border-color:transparent!important}#dialog.atlas-level-dialog .atlas-level-card strong,#dialog.atlas-level-dialog .atlas-level-card p{color:inherit!important}#dialog.atlas-level-dialog .atlas-level-card input[type="radio"]{accent-color:var(--atlas-level-ink,#14213a)}#dialog.atlas-level-dialog .atlas-level-card:has(input:checked){border-color:var(--atlas-level-ink,#14213a)!important;box-shadow:inset 0 0 0 1px var(--atlas-level-ink,#14213a)!important}';
  document.head.append(style);
  function paint(){
    const host=document.getElementById('dialog');
    if(!host?.open||typeof F==='undefined'||!Array.isArray(F))return;
    host.querySelectorAll('.atlas-level-card').forEach((card,index)=>{
      const radio=card.querySelector('input[type="radio"]'),outcome=F.find(o=>o.id===radio?.value);
      if(!outcome)return;
      const shades=palette(outcome.color),background=shades[levelIndex(outcome.level,index)];
      card.style.setProperty('--atlas-level-fill',background);
      card.style.setProperty('--atlas-level-ink',ink(background));
    });
  }
  const previousDialog=dialog;
  dialog=function(...args){const result=previousDialog.apply(this,args);queueMicrotask(paint);return result;};
})();
