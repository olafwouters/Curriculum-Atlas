/* Load before app.js. Uses user tokens, never an administrator key. */
(()=>{'use strict';
const native=window.fetch.bind(window),wr=new Map(),sr=new Map(),shell=document.querySelector('.app-shell');
let sdk,uid,resolveReady,started=false,needsPassword=['invite','recovery'].includes(new URLSearchParams(location.hash.slice(1)).get('type'));
const ready=new Promise(r=>{resolveReady=r;}),gate=document.createElement('section');gate.id='atlas-auth';gate.dataset.noTranslate='';
gate.innerHTML='<h1>Curriculum Atlas</h1><p>Voor uitgenodigde facilitators van Hanze.</p><form id="atlas-signin"><label>E-mailadres<input name="email" type="email" autocomplete="username" required></label><label>Wachtwoord<input name="password" type="password" autocomplete="current-password" required></label><button>Inloggen</button><button type="button" id="atlas-link">Stuur een inloglink</button></form><form id="atlas-password" hidden><label>Nieuw wachtwoord<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><button>Wachtwoord instellen</button></form><p id="atlas-auth-status" role="status" aria-live="polite">Verbinding maken…</p><button id="atlas-retry" type="button">Opnieuw laden</button>';
const style=document.createElement('style');style.textContent='#atlas-auth{max-width:460px;margin:8vh auto;padding:28px;border:1px solid #ddd;border-radius:20px;background:var(--panel,#fff);color:var(--ink,#222)}#atlas-auth label{display:grid;gap:8px;margin:16px 0}#atlas-auth input{padding:12px;font:inherit}#atlas-auth button{padding:12px;margin:6px;font:inherit}body.atlas-locked .app-shell{display:none!important}#atlas-auth[hidden]{display:none!important}#atlas-account{display:flex;gap:10px;align-items:center;margin:8px}';document.head.append(style);document.body.prepend(gate);
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
  gate.querySelector('#atlas-link').onclick=async()=>{const email=gate.querySelector('[name=email]').value.trim();if(!email){message('Vul eerst je e-mailadres in.');return;}const {error}=await sdk.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+'/'}});message(error?error.message:'Als dit account is uitgenodigd, ontvang je een inloglink.');};
  gate.querySelector('#atlas-password').onsubmit=async e=>{e.preventDefault();const {error}=await sdk.auth.updateUser({password:new FormData(e.target).get('password')});if(error){message(error.message);return;}needsPassword=false;e.target.hidden=true;const {data}=await sdk.auth.getSession();await activate(data.session);};
  const {data,error}=await sdk.auth.getSession();if(error)throw error;await activate(data.session);
 }catch(e){lock(e.message);}
}
start();
})();
