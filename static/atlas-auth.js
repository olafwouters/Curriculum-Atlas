/* Load before app.js. Uses user tokens, never an administrator key. */
(()=>{'use strict';
const native=window.fetch.bind(window),wr=new Map(),sr=new Map(),shell=document.querySelector('.app-shell');
let sdk,uid,resolveReady,started=false,needsPassword=['invite','recovery'].includes(new URLSearchParams(location.hash.slice(1)).get('type'));
const ready=new Promise(r=>{resolveReady=r;}),gate=document.createElement('section');gate.id='atlas-auth';gate.dataset.noTranslate='';
gate.innerHTML="<div class=\"atlas-login-backdrop\" aria-hidden=\"true\"></div><div class=\"atlas-login-brand\"><canvas id=\"atlas-globe\" aria-hidden=\"true\"></canvas><h1>Curriculum<span>Atlas</span></h1></div><div class=\"atlas-login-card\"><h2>Welkom terug</h2><p class=\"atlas-login-intro\">Log in bij Curriculum Atlas.</p><form id=\"atlas-signin\"><label>E-mailadres<input name=\"email\" type=\"email\" autocomplete=\"username\" required></label><label>Wachtwoord<input name=\"password\" type=\"password\" autocomplete=\"current-password\" required></label><button class=\"primary\" type=\"submit\">Inloggen</button></form><form id=\"atlas-password\" hidden><label>Nieuw wachtwoord<input name=\"password\" type=\"password\" autocomplete=\"new-password\" minlength=\"12\" required></label><button class=\"primary\" type=\"submit\">Wachtwoord instellen</button></form><p id=\"atlas-auth-status\" role=\"status\" aria-live=\"polite\">Verbinding maken\u2026</p><button id=\"atlas-retry\" type=\"button\">Opnieuw laden</button></div><button id=\"atlas-globe-motion\" type=\"button\" aria-pressed=\"false\">Globe pauzeren</button>";
const style=document.createElement('style');style.textContent="#atlas-auth{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,1fr);align-items:center;gap:5vw;min-height:100svh;box-sizing:border-box;margin:0;padding:9vh 9vw 12vh 5vw;overflow:hidden;color:#253033;background:radial-gradient(ellipse at 0% 5%,#647b7c55,transparent 68%),radial-gradient(ellipse at 40% 110%,#b77b4940,transparent 65%),#f8f7f3}#atlas-auth *{box-sizing:border-box}#atlas-auth[hidden],#atlas-auth [hidden]{display:none!important}body.atlas-locked .app-shell{display:none!important}body.atlas-locked{margin:0!important}#atlas-auth .atlas-login-backdrop{position:absolute;z-index:-2;inset:4vh 3vw;border-radius:38px;border:1px solid #ffffffb0;background:linear-gradient(125deg,#203f4312,#ffffff38 65%,#b97c3610);box-shadow:0 20px 70px #37403d09;pointer-events:none}#atlas-auth .atlas-login-brand{display:grid;place-items:center;min-width:0;min-height:360px}#atlas-auth #atlas-globe{position:absolute;z-index:-1;width:min(88vw,115vh);height:min(88vw,115vh);left:-10vw;top:-18vh;opacity:.65;pointer-events:none}#atlas-auth h1{margin:0;text-align:center;font-size:clamp(42px,5.3vw,84px);line-height:1.07;letter-spacing:-.045em;font-weight:650;color:#253033;text-shadow:0 2px 28px #f7f5f1,0 0 65px #f7f5f1}#atlas-auth h1 span{display:block}#atlas-auth .atlas-login-card{justify-self:center;width:100%;max-width:400px;padding:38px 34px 28px;border-radius:26px;background:#ffffffc9;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid #fff;box-shadow:0 22px 65px #293b3920,inset 0 1px 0 #fff}#atlas-auth h2{margin:0 0 10px;font-size:29px;line-height:1.2;letter-spacing:-1px;color:#253033}#atlas-auth .atlas-login-intro{font-size:14px;color:#596566;margin:0 0 28px}#atlas-auth label{display:grid;gap:9px;font-size:14px;font-weight:600;margin:20px 0}#atlas-auth input{width:100%;min-width:0;height:48px;border-radius:10px;border:1px solid #c4cecb;background:#ffffffc9;padding:0 14px;color:#263033;font:inherit}#atlas-auth button{font:inherit;cursor:pointer}#atlas-auth button.primary{position:relative;width:100%;min-height:49px;margin:7px 0 0;padding:12px 16px;border-radius:12px;border:1px solid var(--shared-orange-rim,#ffbb70)!important;background:var(--shared-orange,linear-gradient(155deg,#ff9b31,#e87500 63%,#cf5d00))!important;box-shadow:var(--shared-orange-shadow,inset 0 1px 0 #ffffff88,0 5px 16px #ba5b0020)!important;color:#fff!important;font-weight:700;text-shadow:0 1px 1px #90401266}#atlas-auth button.primary:before{content:\"\";position:absolute;inset:2px 3px 50%;border-radius:9px 9px 16px 16px;background:linear-gradient(#ffffff35,#ffffff00);pointer-events:none}#atlas-auth button.primary:hover{filter:brightness(1.04)}#atlas-auth #atlas-auth-status{font-size:13px;line-height:1.6;color:#455658;overflow-wrap:anywhere;margin:20px 0 10px}#atlas-auth #atlas-retry,#atlas-auth #atlas-globe-motion{padding:9px 13px;border:1px solid #bcc7c3;border-radius:18px;background:#ffffffb8;color:#3e5052;font-size:12px;margin:0}#atlas-auth #atlas-globe-motion{position:absolute;bottom:6vh;left:7vw}#atlas-auth :focus-visible{outline:3px solid #ad5400;outline-offset:4px}#atlas-account{display:flex;gap:10px;align-items:center;margin:8px}@media(max-width:760px){#atlas-auth{grid-template-columns:minmax(0,1fr);gap:24px;padding:60px 7vw 100px;min-height:100svh}#atlas-auth .atlas-login-brand{min-height:210px}#atlas-auth #atlas-globe{width:110vw;height:110vw;left:-25vw;top:-16vw}#atlas-auth h1{font-size:clamp(40px,10vw,60px);justify-self:start;width:75%}#atlas-auth .atlas-login-card{padding:30px 24px}#atlas-auth #atlas-globe-motion{bottom:28px}#atlas-auth .atlas-login-backdrop{inset:16px;border-radius:28px}}@media(prefers-reduced-transparency:reduce){#atlas-auth .atlas-login-card{background:#fff;backdrop-filter:none;-webkit-backdrop-filter:none}}";document.head.append(style);document.body.prepend(gate);
const message=t=>{gate.querySelector('#atlas-auth-status').textContent=t;};
function lock(t){gate.hidden=false;if(shell)shell.inert=true;document.body.classList.add('atlas-locked');if(t)message(t);}
lock();gate.querySelector('#atlas-retry').onclick=()=>location.reload();
async function activate(session){
 if(!session){lock('Log in met je uitgenodigde account.');return;}
 if(needsPassword){gate.querySelector('#atlas-password').hidden=false;lock('Stel eerst je wachtwoord in.');return;}
 if(uid&&uid!==session.user.id){location.reload();return;}
 try{
  const r=await native('/api/auth/me',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'}),u=await r.json();
  if(!r.ok)throw Error(u.error||'Dit account is niet goedgekeurd.');if(u.id!==session.user.id)throw Error('Onverwacht account; laad opnieuw.');
  uid=u.id;gate.hidden=true;if(shell)shell.inert=false;document.body.classList.remove('atlas-locked');
  let bar=document.querySelector('#atlas-account');
  if(!bar){bar=document.createElement('div');bar.id='atlas-account';const label=document.createElement('span'),bin=document.createElement('button'),out=document.createElement('button');bin.textContent='Prullenbak';out.textContent='Uitloggen';bar.append(label,bin,out);(document.querySelector('.topbar')||shell).append(bar);bin.onclick=recovery;out.onclick=async()=>{if((typeof dirty!=='undefined'&&dirty||typeof busy!=='undefined'&&busy)&&!confirm('Exporteer eerst niet-opgeslagen wijzigingen als JSON. Toch uitloggen?'))return;const {error}=await sdk.auth.signOut();if(error){lock(error.message);return;}location.reload();};}
  bar.querySelector('span').textContent=u.email;if(!started){started=true;resolveReady();}
 }catch(e){lock(e.message);}
}
function remember(path,d){
 if(path==='/api/workspaces'&&Array.isArray(d))d.forEach(x=>wr.set(x.id,x.revision));
 if((path==='/api/save'||path.startsWith('/api/workspaces/'))&&d?.id)wr.set(d.id,d.revision);
 const k=path==='/api/competence-sets'?'competence_set':path==='/api/library'?'library':null;
 if(k&&Array.isArray(d))d.forEach(x=>sr.set(k+':'+x.id,x.revision??null));
}
window.fetch=async function(input,init){
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||url.pathname==='/api/auth/config')return native(input,init);
 await ready;const {data,error}=await sdk.auth.getSession();
 if(error||!data.session||data.session.user.id!==uid){lock('Je sessie is verlopen. Log opnieuw in; wijzigingen zijn niet opgeslagen.');throw Error('Inloggen vereist; wijzigingen zijn niet opgeslagen.');}
 const opts={...init},headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('Authorization','Bearer '+data.session.access_token);opts.headers=headers;
 if(typeof opts.body==='string'){
  let d;try{d=JSON.parse(opts.body);}catch(e){}
  if(d&&typeof d==='object'){
   if(url.pathname==='/api/workspaces/archive')d.workspaces=(d.ids||[]).map(id=>({id,revision:wr.get(id)}));
   if(url.pathname==='/api/year-copy/commit')d.revision=wr.get(d.workspace);
   const k=url.pathname.startsWith('/api/competence-sets')?'competence_set':url.pathname.startsWith('/api/library')?'library':null;
   if(k&&d.id)d.revision=sr.get(k+':'+d.id)??null;opts.body=JSON.stringify(d);
  }
 }
 const r=await native(input,opts);if(r.status===401||r.status===403)lock('Je sessie is verlopen of toegang is ingetrokken. Log opnieuw in of neem contact op met de beheerder.');
 if(r.ok){try{remember(url.pathname,await r.clone().json());}catch(e){}}return r;
};
async function recovery(){
 try{
  if(typeof canSwitch==='function'&&!canSwitch())return;
  const items=await api('/api/workspaces?deleted=1&all=1');dialog('Prullenbak','<p>Werkruimtes en sessies zijn 30 dagen herstelbaar.</p><div id="atlas-recovery-list"></div>');const list=document.querySelector('#atlas-recovery-list');if(!items.length)list.textContent='Geen herstelbare werkruimtes.';
  for(const x of items){const row=document.createElement('p'),label=document.createElement('span'),b=document.createElement('button');label.textContent=x.name+' · herstelbaar tot '+new Date(x.purge_after).toLocaleString()+' ';b.textContent='Herstellen';b.onclick=async()=>{b.disabled=true;try{await api('/api/workspaces/restore',{workspaces:[{id:x.id,revision:x.revision}]});await listing();row.remove();}catch(e){say(e.message);b.disabled=false;}};row.append(label,b);list.append(row);}
 }catch(e){if(typeof say==='function')say(e.message);}
}
async function start(){
 try{
  if(!window.supabase?.createClient)throw Error('Authenticatiebibliotheek kon niet laden. Controleer de verbinding en laad opnieuw.');
  const r=await native('/api/auth/config',{cache:'no-store'}),c=await r.json();if(!r.ok)throw Error(c.error||'Supabase is nog niet ingesteld.');
  sdk=window.supabase.createClient(c.url,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  sdk.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(event==='PASSWORD_RECOVERY')needsPassword=true;activate(session);},0);});
  gate.querySelector('#atlas-signin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);message('Inloggen…');const {data,error}=await sdk.auth.signInWithPassword({email:f.get('email').trim(),password:f.get('password')});if(error)message(error.message);else await activate(data.session);};
  gate.querySelector('#atlas-password').onsubmit=async e=>{e.preventDefault();const {error}=await sdk.auth.updateUser({password:new FormData(e.target).get('password')});if(error){message(error.message);return;}needsPassword=false;e.target.hidden=true;const {data}=await sdk.auth.getSession();await activate(data.session);};
  const {data,error}=await sdk.auth.getSession();if(error)throw error;await activate(data.session);
 }catch(e){lock(e.message);}
}

// Decorative wireframe only: no geography, network requests or external dependencies.
function installGlobe(){
 const canvas=gate.querySelector('#atlas-globe'),ctx=canvas.getContext('2d'),toggle=gate.querySelector('#atlas-globe-motion');
 if(!ctx){toggle.hidden=true;return;}
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let running=!reduced.matches,angle=0,frame=0,last=0;
 function label(){toggle.textContent=running?'Globe pauzeren':'Globe draaien';toggle.setAttribute('aria-pressed',String(!running));}
 function draw(){
  const size=canvas.clientWidth;if(!size)return;
  const pixels=Math.round(size*Math.min(window.devicePixelRatio||1,2));
  if(canvas.width!==pixels){canvas.width=canvas.height=pixels;}
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,pixels,pixels);
  const r=pixels*.48;ctx.translate(pixels/2,pixels/2);ctx.scale(r,r);ctx.lineWidth=1/r;
  function point(lon,lat){const a=lon*Math.PI/180+angle,b=lat*Math.PI/180,x=Math.cos(b)*Math.sin(a),y=Math.sin(b),z=Math.cos(b)*Math.cos(a),t=.20;return [x*Math.cos(t)-y*Math.sin(t),-x*Math.sin(t)-y*Math.cos(t),z];}
  function line(points,front){ctx.beginPath();let pen=false;for(const p of points){const [x,y,z]=point(...p);if((z>=0)!==front){pen=false;continue;}if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;}ctx.stroke();}
  const lines=[];
  for(let lat=-75;lat<=75;lat+=15){const ps=[];for(let lon=-180;lon<=180;lon+=3)ps.push([lon,lat]);lines.push(ps);}
  for(let lon=-180;lon<180;lon+=15){const ps=[];for(let lat=-90;lat<=90;lat+=3)ps.push([lon,lat]);lines.push(ps);}
  ctx.strokeStyle='rgba(83,107,109,.10)';lines.forEach(ps=>line(ps,false));
  ctx.strokeStyle='rgba(83,107,109,.37)';lines.forEach(ps=>line(ps,true));
  ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.strokeStyle='rgba(83,107,109,.25)';ctx.stroke();
 }
 function visible(){return !gate.hidden&&!document.hidden;}
 function tick(now){frame=0;if(!running||!visible()){last=0;return;}if(last)angle+=(Math.min(now-last,50)/1000)*(Math.PI*2/100);last=now;draw();frame=requestAnimationFrame(tick);}
 function sync(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;label();if(visible()){draw();if(running)frame=requestAnimationFrame(tick);}}
 toggle.onclick=()=>{running=!running;sync();};
 reduced.addEventListener('change',e=>{running=!e.matches;sync();});
 document.addEventListener('visibilitychange',sync);
 new MutationObserver(sync).observe(gate,{attributes:true,attributeFilter:['hidden']});
 if(window.ResizeObserver)new ResizeObserver(()=>{if(visible())draw();}).observe(canvas);
 else window.addEventListener('resize',()=>{if(visible())draw();});
 sync();
}
installGlobe();
start();
})();

