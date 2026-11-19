/* Shared workspace chrome; original action nodes, handlers and saved data are retained. */
(()=>{'use strict';
function saveStatus({workspace,workspaceId,dirty,busy,raw='',en=false}){
 const t=(nl,english)=>en?english:nl;
 if(/mislukt|failed|fout|error|niet bereikbaar|unreachable/i.test(raw))return {text:t('Opslaan niet bevestigd. Controleer de melding en exporteer JSON.','Saving not confirmed. Check the message and export JSON.'),detail:raw,error:true};
 if(!workspace)return {text:t('Geen werkruimte geopend','No workspace open'),detail:'',error:false};
 if(busy)return {text:t('Opslaan…','Saving…'),detail:'',error:false};
 if(dirty)return {text:t('Niet-opgeslagen wijzigingen','Unsaved changes'),detail:'',error:false};
 return {text:workspaceId?t('Opgeslagen','Saved'):t('Nog niet opgeslagen','Not saved yet'),detail:'',error:false};
}
if(typeof module==='object'&&module.exports)module.exports={saveStatus};
if(typeof document==='undefined')return;
function start(){
 if(document.getElementById('atlas-workspace-bar'))return;
 const q=s=>document.querySelector(s),controls=q('#workspace-controls');if(!controls)return;
 const t=(nl,en)=>localStorage.getItem('compass-language')==='en'?en:nl;
 const node=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
 const text=(e,value)=>{if(e.textContent!==String(value))e.textContent=String(value);};
 const move=(e,parent)=>{if(e&&e.parentElement!==parent)parent.append(e);};
 const bar=node('section');bar.id='atlas-workspace-bar';bar.dataset.noTranslate='';bar.dataset.userContent='';bar.setAttribute('aria-label',t('Werkruimte','Workspace'));
 const identity=node('div','atlas-workspace-identity'),name=node('strong'),info=node('div','atlas-workspace-info'),edition=node('span'),status=node('span'),badge=node('span','demo-badge'),error=node('p','atlas-workspace-error');
 name.dataset.userContent='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');error.setAttribute('role','alert');error.hidden=true;
 info.append(edition,status,badge);identity.append(name,info,error);
 const actions=node('div','atlas-workspace-actions');
 function menu(id){const d=node('details','atlas-workspace-menu'),summary=node('summary'),panel=node('div','atlas-workspace-panel');summary.id=id+'-label';panel.setAttribute('role','group');panel.setAttribute('aria-labelledby',summary.id);d.append(summary,panel);actions.append(d);d.addEventListener('toggle',()=>{if(d.open)for(const other of menus)if(other!==d)other.open=false;});return {d,summary,panel};}
 const menus=[],switcher=menu('atlas-workspace-switch');menus.push(switcher.d);const tools=menu('atlas-workspace-actions');menus.push(tools.d);
 const selectLabel=node('label'),selectCaption=node('span');selectLabel.htmlFor='saved';selectLabel.append(selectCaption);switcher.panel.append(selectLabel);
 const metaButton=node('button');metaButton.type='button';metaButton.onclick=()=>{if(typeof state!=='undefined'&&state&&typeof meta==='function')meta();};
 const progress=node('button','primary');progress.type='button';progress.onclick=()=>{const b=q('#navigation-items [data-tab="facilitator"]');if(b)b.click();};
 actions.append(progress);bar.append(identity,actions);controls.prepend(bar);
 const style=node('style');style.textContent=`
html body .app-shell main #workspace-controls,html body .app-shell main #workspace-controls[hidden]{display:block!important}
html body .app-shell #workspace-controls>.workspace-tools,html body .app-shell #workspace-controls>#identity,html body .app-shell #ux-context,html body .app-shell #ux-workflow,html body .app-shell #ux-workflow.scan-workflow,html body .app-shell #scan-workspace-progress,html body .app-shell #scan-context,html body .app-shell #atlas-scan-return,html body .app-shell #status{display:none!important}
html body .app-shell .cc-banner-actions>button:not(.primary){display:none!important}
html body .app-shell #atlas-workspace-bar{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;width:100%;margin:0 0 20px;padding:16px 20px;border:1px solid var(--line,#dce1e8);border-radius:20px;background:var(--panel,rgba(255,255,255,.5));box-shadow:inset 0 1px 0 #ffffff66,0 8px 24px #46321a0a;color:var(--ink,inherit)}
#atlas-workspace-bar .atlas-workspace-identity{flex:1 1 260px;min-width:0}#atlas-workspace-bar .atlas-workspace-identity>strong{display:block;font-size:15px;line-height:1.4;overflow-wrap:anywhere}#atlas-workspace-bar .atlas-workspace-info{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:4px;font-size:12px;color:var(--muted,#626a78)}
#atlas-workspace-bar .atlas-workspace-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#atlas-workspace-bar .atlas-workspace-menu{position:relative;margin:0;padding:0;border:0;background:none;min-width:0}#atlas-workspace-bar summary{box-sizing:border-box;list-style:none;cursor:pointer;padding:10px 14px;border:1px solid var(--line,#dce1e8);border-radius:12px;min-height:44px;display:flex;align-items:center;gap:10px;font-size:13px;background:var(--panel,rgba(255,255,255,.5))}#atlas-workspace-bar summary::-webkit-details-marker{display:none}#atlas-workspace-bar summary::after{content:'⌄'}#atlas-workspace-bar details[open]>summary::after{content:'⌃'}
#atlas-workspace-bar .atlas-workspace-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:80;box-sizing:border-box;width:320px;max-width:calc(100vw - 48px);max-height:60vh;overflow:auto;display:grid;gap:8px;padding:12px;border:1px solid var(--line,#dce1e8);border-radius:16px;background:#fff;box-shadow:0 12px 32px #14213a24;color:var(--ink,#14213a)}html[data-theme="dark"] #atlas-workspace-bar .atlas-workspace-panel{background:#1b212c}
#atlas-workspace-bar details:not([open])>.atlas-workspace-panel{display:none}#atlas-workspace-bar .atlas-workspace-panel>label:has(select){display:grid;gap:6px;font-size:12px}#atlas-workspace-bar #saved{display:block!important;box-sizing:border-box;width:100%!important;max-width:100%;min-height:44px}#atlas-workspace-bar .atlas-workspace-panel>button,#atlas-workspace-bar .atlas-workspace-panel>label.button{box-sizing:border-box;width:100%;min-height:44px;margin:0;text-align:left;white-space:normal}html body .app-shell #atlas-workspace-bar #save,html body .app-shell #atlas-workspace-bar #undo-change{display:inline-flex!important}
#atlas-workspace-bar .atlas-workspace-error{font-size:12px;color:#b42318;margin:6px 0 0;overflow-wrap:anywhere}html[data-theme="dark"] #atlas-workspace-bar .atlas-workspace-error{color:#ffb4ab}#atlas-workspace-bar [hidden]{display:none!important}#atlas-workspace-bar summary:focus-visible{outline:3px solid #e87500;outline-offset:3px}
@media(max-width:700px){html body .app-shell #atlas-workspace-bar{padding:14px;gap:12px}#atlas-workspace-bar .atlas-workspace-actions{width:100%}#atlas-workspace-bar .atlas-workspace-menu{flex:1 1 140px}#atlas-workspace-bar .atlas-workspace-panel{position:static;width:100%;max-width:none;margin-top:8px;max-height:none;overflow:visible}#atlas-workspace-bar .atlas-workspace-actions>.primary{min-height:44px}}
`;document.head.append(style);
 let scheduled=false;
 function sync(){
  scheduled=false;
  const current=typeof state==='undefined'?null:state,has=!!current,en=localStorage.getItem('compass-language')==='en';
  text(name,has?(current.programme||t('Naamloze werkruimte','Untitled workspace')):t('Geen werkruimte geopend','No workspace open'));
  text(edition,has&&current.edition?t('Editie ','Edition ')+current.edition:'');edition.hidden=!has||!current.edition;
  text(badge,t('Demonstratiegegevens','Demonstration data'));badge.hidden=!has||!/demonstr/i.test(current.programme||'');
  const save=saveStatus({workspace:has,workspaceId:typeof id==='undefined'?null:id,dirty:typeof dirty==='undefined'?false:dirty,busy:typeof busy==='undefined'?false:busy,raw:q('#status')?.textContent||'',en});
  text(status,save.text);text(error,save.detail);error.hidden=!save.error;
  text(switcher.summary,t('Werkruimte wisselen','Switch workspace'));text(selectCaption,t('Opgeslagen werkruimte','Saved workspace'));text(tools.summary,t('Werkruimteacties','Workspace actions'));text(progress,t('Voortgang bekijken →','View progress →'));text(metaButton,t('Opleidingsgegevens','Programme details'));metaButton.disabled=!has;
  bar.setAttribute('aria-label',t('Werkruimte','Workspace'));
  const saved=q('#saved'),old=saved?.closest('#view > section.card');move(saved,selectLabel);if(saved)saved.setAttribute('aria-label',t('Opgeslagen werkruimte','Saved workspace'));
  move(q('#manageWorkspaces'),switcher.panel);
  for(const [key,nl,english] of [['new','Nieuwe opleiding','New programme'],['save','Nu opslaan','Save now'],['yearCopy','Kopieer naar nieuw studiejaar','Copy to new academic year'],['export','JSON export','JSON export'],['csv','Curriculumscan CSV','Curriculum scan CSV'],['print-report','PDF-teamrapport','PDF team report'],['demo','Bekijk demonstratie','View demo'],['undo-change','Laatste wijziging ongedaan maken','Undo last change']]){
   const button=q('#'+key);if(!button)continue;move(button,tools.panel);text(button,en?english:nl);
   if(['save','export','csv','print-report'].includes(key))button.disabled=!has||(key==='save'&&typeof busy!=='undefined'&&busy);
  }
  const input=q('#import'),importLabel=input?.closest('label');if(importLabel){move(importLabel,tools.panel);const caption=[...importLabel.childNodes].find(n=>n.nodeType===3&&n.nodeValue.trim());if(caption&&caption.nodeValue!=='JSON import')caption.nodeValue='JSON import';}
  move(metaButton,tools.panel);
  if(old&&/^(Opleiding & werkruimte|Programme & workspace)$/.test(old.querySelector('h2')?.textContent.trim()||''))old.remove();
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(sync);}}
 const previous=render;render=function(...args){const result=previous.apply(this,args);sync();return result;};
 new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true});
 document.addEventListener('change',schedule);document.addEventListener('input',schedule);
 document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',schedule));
 document.addEventListener('pointerdown',event=>{for(const d of menus)if(d.open&&!d.contains(event.target))d.open=false;});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const d=menus.find(d=>d.open);if(d){event.preventDefault();event.stopImmediatePropagation();d.open=false;d.querySelector('summary').focus();}},true);
 document.addEventListener('focusin',event=>{for(const d of menus)if(d.open&&!d.contains(event.target))d.open=false;});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
