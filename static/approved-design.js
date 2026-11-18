
(()=>{'use strict';
function banner(){if(typeof tab==='undefined'||tab!=='overview')return;const view=document.querySelector('#view');if(!view||view.querySelector('.cc-full-banner'))return;const en=localStorage.getItem('compass-language')==='en',pick=(a,b)=>en?b:a;const section=document.createElement('section');section.className='cc-full-banner';section.dataset.noTranslate='';section.setAttribute('aria-label',pick('Welkom bij Curriculum Compass','Welcome to Curriculum Compass'));
const content=document.createElement('div');const tag=document.createElement('span');tag.className='cc-tag';tag.textContent='Curriculum design · DigComp 3.0';const title=document.createElement('h2');title.textContent=pick('Geef digitale & AI-geletterdheid een plek in je curriculum.','Make digital & AI literacy part of your curriculum.');const p=document.createElement('p');p.textContent=pick('Begin bij wat je opleiding al aanbiedt. Breng leeractiviteiten in kaart, bepaal samen de ambitie en vertaal hiaten naar concrete besluiten.','Start with what your programme already offers. Map learning activities, agree ambitions and turn gaps into shared decisions.');const actions=document.createElement('div');actions.className='cc-banner-actions';const map=document.createElement('button');map.type='button';map.className='primary';map.textContent=pick('Verder met koppelen →','Continue mapping →');map.onclick=()=>{tab=state?'matrix':'catalogue';render();};const guide=document.createElement('button');guide.type='button';guide.textContent=pick('Instructies voor de facilitator','Facilitator instructions');guide.onclick=()=>{tab='facilitator';render();};actions.append(map,guide);content.append(tag,title,p,actions);
const panel=document.createElement('div');panel.className='cc-banner-workspace';const label=document.createElement('small');label.textContent=pick('JOUW WERKRUIMTE','YOUR WORKSPACE');const name=document.createElement('strong');name.textContent=state?.programme||pick('Jouw opleiding','Your programme');const note=document.createElement('p');note.textContent=state?pick('Overzicht van de actieve werkruimte.','Overview of your active workspace.'):pick('Kies een opleiding of open een bestaande werkruimte om te beginnen.','Choose a programme or open an existing workspace to get started.');const chips=document.createElement('div');chips.className='cc-banner-chips';const modules=state?.modules||[];for(const text of [modules.length+' '+pick('modules','modules'),new Set(modules.map(m=>m.year).filter(Boolean)).size+' '+pick('studiejaren','study years'),new Set(F.map(o=>o.domain)).size+' '+pick('domeinen','domains')]){const chip=document.createElement('span');chip.textContent=text;chips.append(chip);}panel.append(label,name,note,chips);section.append(content,panel);view.prepend(section);}
const prior=render;render=function(...args){const result=prior.apply(this,args);banner();return result;};document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',()=>{if(tab==='overview'){document.querySelector('.cc-full-banner')?.remove();banner();}}));setTimeout(banner,550);
})();


(()=>{const nav=document.getElementById('navigation-items');if(!nav)return;const original=new WeakMap();function sync(){nav.querySelectorAll('button').forEach(button=>{const selected=button.classList.contains('active')||button.getAttribute('aria-current')==='page';[button,...button.querySelectorAll('*')].forEach(el=>{if(selected){if(!original.has(el))original.set(el,['color','-webkit-text-fill-color'].map(k=>[k,el.style.getPropertyValue(k),el.style.getPropertyPriority(k)]));el.style.setProperty('color','#ffffff','important');el.style.setProperty('-webkit-text-fill-color','#ffffff','important');}else if(original.has(el)){original.get(el).forEach(([k,v,p])=>{if(v)el.style.setProperty(k,v,p);else el.style.removeProperty(k)});original.delete(el);}});});}new MutationObserver(sync).observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current']});sync();})();

/* Process labels now come from the shared model in facilitator.js. */

/* Load the scan presentation after the shared process model; legacy guide remains the fallback. */
(()=>{if(document.getElementById('atlas-scan-script'))return;const script=document.createElement('script');script.id='atlas-scan-script';script.src='/static/scan-workspace.js?v=20261117-visible-completion';document.head.append(script);})();

/* Visible terminology only. Routes, saved state, user content and export schemas stay unchanged. */
(()=>{'use strict';
const terms=/\b(curriculumscan|curriculum scan|competentiematrix|competence matrix|course catalogue|catalogus[\p{L}]*|catalogue|doelniveau[\p{L}]*|target levels?|matrix)\b/giu;
function rename(value){return String(value).replace(terms,word=>{const lower=word.toLowerCase();let next;
 if(lower==='curriculumscan')next='voortgang';else if(lower==='curriculum scan')next='progress';
 else if(lower==='competentiematrix')next='curriculumscan';else if(lower==='competence matrix')next='curriculum scan';
 else if(lower==='course catalogue')return word;else if(lower.startsWith('catalogus'))next='onderwijscatalogus'+lower.slice(9);
 else if(lower==='catalogue')next='course catalogue';else if(lower.startsWith('doelniveau'))next='eindniveau'+lower.slice(10);
 else if(lower.startsWith('target level'))next=lower.replace('target','exit');
 else next=localStorage.getItem('compass-language')==='en'?'curriculum scan':'curriculumscan';
 return /^[A-Z]/.test(word)?next[0].toUpperCase()+next.slice(1):next;
 });}
const textCache=new WeakMap(),attributeCache=new WeakMap();
const skip='script,style,textarea,input,pre,code,.source,.outcome,.session-note-text,[contenteditable],[data-user-content]';
let scheduled=false;
function protectedStrings(){const values=new Set(),seen=new WeakSet();function visit(value){if(typeof value==='string'){terms.lastIndex=0;if(value&&terms.test(value))values.add(value);terms.lastIndex=0;}else if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);Object.values(value).forEach(visit);}}if(typeof state!=='undefined')visit(state);return [...values].sort((a,b)=>b.length-a.length);}
function safeRename(value,protectedValues){let text=value;const tokens=[];for(const v of protectedValues){if(text.includes(v)){const marker='\uE000'+tokens.length+'\uE001';tokens.push(v);text=text.split(v).join(marker);}}text=rename(text);return text.replace(/\uE000(\d+)\uE001/g,(_,i)=>tokens[+i]);}
function forceAttribute(node,key,value){if(node.getAttribute(key)!==value)node.setAttribute(key,value);let map=attributeCache.get(node);if(!map){map=new Map();attributeCache.set(node,map);}map.set(key,value);}
function sync(){scheduled=false;const protect=protectedStrings();const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){if(!node.parentElement||node.parentElement.closest(skip))continue;const current=node.nodeValue;if(textCache.get(node)===current)continue;const next=safeRename(current,protect);if(next!==current)node.nodeValue=next;textCache.set(node,next);}
 for(const node of document.querySelectorAll('[aria-label],[title],[placeholder]')){if(node.closest('script,style,pre,code,.source,.session-note-text,[contenteditable],[data-user-content]'))continue;let map=attributeCache.get(node);if(!map){map=new Map();attributeCache.set(node,map);}for(const key of ['aria-label','title','placeholder']){const value=node.getAttribute(key);if(value===null||map.get(key)===value)continue;const next=safeRename(value,protect);if(next!==value)node.setAttribute(key,next);map.set(key,next);}}
 const en=localStorage.getItem('compass-language')==='en';for(const [route,nl,english] of [['facilitator','Voortgang','Progress'],['matrix','Curriculumscan','Curriculum scan'],['catalogue','Onderwijscatalogus','Course catalogue'],['targets','Eindniveau','Exit level']]){const button=document.querySelector('#navigation-items [data-tab="'+route+'"]');if(!button)continue;const label=button.querySelector('.nav-label'),value=en?english:nl;if(label){if(label.textContent!==value)label.textContent=value;if(label.firstChild)textCache.set(label.firstChild,value);}forceAttribute(button,'aria-label',value);forceAttribute(button,'title',value);}
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync);}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
document.addEventListener('change',schedule);document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',schedule));sync();
})();

/* Surface-only atmosphere: existing controls, routes and storage are untouched. */
(()=>{'use strict';
if(document.getElementById('atlas-atmosphere'))return;
const style=document.createElement('style');style.textContent=`
#atlas-atmosphere{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:radial-gradient(ellipse at 0% 5%,#647b7c55,transparent 68%),radial-gradient(ellipse at 40% 110%,#b77b4940,transparent 65%),#f8f7f3}
body.atlas-locked #atlas-atmosphere{display:none}
body:not(.atlas-locked)>.app-shell{position:relative;z-index:1}
#atlas-atmosphere canvas{position:absolute;width:min(88vw,115vh);height:min(88vw,115vh);left:-10vw;top:-18vh;opacity:.48}
html:not([data-theme="dark"]) body:not(.atlas-locked) .app-shell aside#navigation-panel.sidebar{isolation:isolate;background:linear-gradient(135deg,#ffffffb8,#ffffffa3)!important;border-color:#ffffffdf!important;box-shadow:inset 0 1px 0 #fffffff2,inset 1px 0 0 #ffffffa6,0 8px 18px #3f312512,0 24px 48px #3f312519!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important}
html[data-theme="dark"] body:not(.atlas-locked) .app-shell aside#navigation-panel.sidebar{isolation:isolate;border-color:#ffffff38!important}
.atlas-globe-clip{position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none}
#navigation-panel>.atlas-globe-clip canvas{position:absolute;width:150px;height:150px;left:-75px;top:-10px}
.cc-full-banner>.atlas-globe-clip canvas{position:absolute;width:360px;height:360px;right:-80px;top:10px}
html[data-theme="dark"] #atlas-atmosphere{background:radial-gradient(ellipse at 0% 5%,#42636355,transparent 68%),radial-gradient(ellipse at 40% 110%,#87532933,transparent 65%),#182b2f}
@media(prefers-reduced-transparency:reduce){html:not([data-theme="dark"]) body:not(.atlas-locked) .app-shell aside#navigation-panel.sidebar{background:#f8f8f5!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
`;
document.head.append(style);
const root=document.createElement('div');root.id='atlas-atmosphere';root.setAttribute('aria-hidden','true');document.body.prepend(root);
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),dark=()=>document.documentElement.dataset.theme==='dark';
let paused=reduced.matches,angle=0,frame=0,last=0;const globes=new Map();
function attach(parent,kind){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
 let host=parent;if(kind!=='page'){host=document.createElement('div');host.className='atlas-globe-clip';host.setAttribute('aria-hidden','true');parent.append(host);}
 host.append(canvas);const ctx=canvas.getContext('2d');if(ctx)globes.set(canvas,{ctx,kind});
}
attach(root,'page');const nav=document.getElementById('navigation-panel');if(nav)attach(nav,'menu');
const settings=nav?.querySelector('.sidebar-settings');let pause;
if(settings){pause=document.createElement('button');pause.type='button';pause.dataset.noTranslate='';pause.onclick=()=>{paused=!paused;sync();};settings.append(pause);}
const paths=[];
for(let lat=-75;lat<=75;lat+=15){const p=[];for(let lon=-180;lon<=180;lon+=3)p.push([lon*Math.PI/180,lat*Math.PI/180]);paths.push(p);}
for(let lon=-180;lon<180;lon+=15){const p=[];for(let lat=-90;lat<=90;lat+=3)p.push([lon*Math.PI/180,lat*Math.PI/180]);paths.push(p);}
function draw(){for(const [canvas,{ctx,kind}] of globes){
 if(!canvas.isConnected){globes.delete(canvas);continue;}
 const width=canvas.getBoundingClientRect().width;if(!width)continue;const size=Math.round(width*Math.min(devicePixelRatio||1,2));if(canvas.width!==size)canvas.width=canvas.height=size;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,size,size);const r=size*.48;ctx.translate(size/2,size/2);ctx.scale(r,r);ctx.lineWidth=1/r;
 const light=kind==='banner'||dark(),rgb=light?'231,242,239':'70,94,95',alpha=kind==='menu'?.49:kind==='banner'?.14:.30;
 for(const front of [false,true]){ctx.strokeStyle='rgba('+rgb+','+(front?alpha:alpha*.23)+')';for(const path of paths){ctx.beginPath();let pen=false;for(const [lon,lat] of path){const a=lon+angle,x=Math.cos(lat)*Math.sin(a),y=Math.sin(lat),z=Math.cos(lat)*Math.cos(a);if((z>=0)!==front){pen=false;continue;}const px=x*Math.cos(.20)-y*Math.sin(.20),py=-x*Math.sin(.20)-y*Math.cos(.20);if(pen)ctx.lineTo(px,py);else ctx.moveTo(px,py);pen=true;}ctx.stroke();}}
 ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.strokeStyle='rgba('+rgb+','+alpha*.7+')';ctx.stroke();
}}
function visible(){return !document.hidden&&!document.body.classList.contains('atlas-locked');}
function tick(now){frame=0;if(paused||!visible()){last=0;return;}if(last)angle+=Math.min(now-last,50)*Math.PI*2/100000;last=now;draw();frame=requestAnimationFrame(tick);}
function sync(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;if(pause){const en=localStorage.getItem('compass-language')==='en',text=paused?(en?'Resume globe':'Globe hervatten'):(en?'Pause globe':'Globe pauzeren');if(pause.textContent!==text)pause.textContent=text;pause.setAttribute('aria-pressed',String(paused));}if(visible()){draw();if(!paused)frame=requestAnimationFrame(tick);}}
function discover(){let added=false;document.querySelectorAll('.cc-full-banner').forEach(b=>{if(!b.querySelector(':scope > .atlas-globe-clip')){attach(b,'banner');added=true;}});if(added)sync();}
new MutationObserver(discover).observe(document.getElementById('view')||document.body,{childList:true,subtree:true});
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','lang']});
document.addEventListener('visibilitychange',sync);window.addEventListener('resize',()=>{if(visible())draw();});
document.addEventListener('click',e=>{if(e.target.closest('[data-language]'))setTimeout(sync,0);});
reduced.addEventListener('change',e=>{paused=e.matches;sync();});discover();sync();
})();
