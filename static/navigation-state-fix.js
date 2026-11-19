/* A single selected item drives classes, accessibility state and the glass marker. */
(()=>{'use strict';const nav=document.getElementById('navigation-items');if(!nav)return;
let demoSelected=false,frame=0,normalizing=false;const buttons=()=>[...nav.querySelectorAll('button')];
const demo=buttons().find(b=>!b.dataset.tab && /demo|demonstr/i.test((b.textContent||'')+' '+(b.title||'')));if(demo)demo.dataset.navAction='demonstration';
function current(){if(demoSelected&&demo)return demo;let currentTab=typeof tab==='string'?tab:document.body.dataset.view;return buttons().find(b=>b.dataset.tab===currentTab)||buttons().find(b=>b.classList.contains('active'))}
function sync(){frame=0;if(normalizing)return;normalizing=true;try{const selected=current();for(const b of buttons()){const active=b===selected;if(b.classList.contains('active')!==active)b.classList.toggle('active',active);if(active){if(b.getAttribute('aria-current')!=='page')b.setAttribute('aria-current','page')}else if(b.hasAttribute('aria-current'))b.removeAttribute('aria-current')}window.dispatchEvent(new Event('compass-navigation-sync'));}finally{normalizing=false}}
function schedule(){if(!frame)frame=requestAnimationFrame(sync)}
nav.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!nav.contains(b))return;demoSelected=b===demo;schedule()},{capture:true});
if(typeof render==='function'){const base=render;render=function(...args){const result=base.apply(this,args);sync();return result}}
new MutationObserver(schedule).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-current'],childList:true});
window.addEventListener('resize',schedule);sync();
})();

/* Keep the existing animation behind the centered, readable menu title. */
(()=>{'use strict';
const nav=document.getElementById('navigation-panel');if(!nav)return;
const style=document.createElement('style');style.textContent=`
html body .app-shell aside#navigation-panel.sidebar{position:relative!important;top:0!important;height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important}
html body #navigation-panel #navigation-items,html body #navigation-panel .sidebar-settings{height:auto!important;max-height:none!important;overflow:visible!important;flex:0 0 auto!important}
#navigation-panel .sidebar-brand.atlas-brand-globe{position:relative;isolation:isolate;box-sizing:border-box;height:164px;min-height:164px;padding:10px 0!important;display:flex;align-items:center;justify-content:center;text-align:center;min-width:0;max-width:100%;flex-shrink:0;text-shadow:0 1px 8px var(--atlas-brand-halo,#f8f7f3)}
html[data-theme="dark"] #navigation-panel .sidebar-brand{--atlas-brand-halo:#182b2f}
#navigation-panel .sidebar-brand>.atlas-menu-globe{display:block;position:absolute;z-index:-1;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;width:144px;height:144px;max-width:100%;pointer-events:none}
#navigation-panel .sidebar-brand>.atlas-menu-globe[hidden]{display:none!important}
#navigation-panel .atlas-menu-globe canvas{display:block;position:static;box-sizing:border-box;width:100%;height:100%;max-width:100%;max-height:none;opacity:.42;transform:none}
`;document.head.append(style);
function place(){
 const brand=nav.querySelector('.sidebar-brand');if(!brand)return;
 const canvas=nav.querySelector(':scope > .atlas-globe-clip > canvas')||brand.querySelector('.atlas-menu-globe canvas');if(!canvas)return;
 let globe=brand.querySelector('.atlas-menu-globe');let moved=false;
 if(!globe){globe=document.createElement('span');globe.className='atlas-menu-globe';globe.setAttribute('aria-hidden','true');brand.append(globe);}
 if(canvas.parentElement!==globe){const old=canvas.parentElement;globe.append(canvas);if(old?.classList.contains('atlas-globe-clip')&&!old.children.length)old.remove();moved=true;}
 const collapsed=nav.querySelector('#navigation-toggle')?.getAttribute('aria-expanded')==='false';
 globe.hidden=collapsed;brand.classList.toggle('atlas-brand-globe',!collapsed);
 if(moved)window.dispatchEvent(new Event('resize'));
}
new MutationObserver(place).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded']});
window.addEventListener('resize',place);place();
})();

/* Match account actions to the existing glass tracks, retaining their handlers. */
(()=>{'use strict';
const style=document.createElement('style');style.textContent=`
html body .app-shell main>.topbar #atlas-account{margin:0!important;gap:12px;min-width:0;flex-wrap:wrap}
html body .app-shell main>.topbar #atlas-account>.atlas-account-actions{box-sizing:border-box;display:inline-flex;align-items:center;flex-shrink:0;gap:0;height:48px;padding:4px;border-radius:16px;border:1px solid var(--uc-edge);background:var(--uc-track);box-shadow:inset 0 1px 3px rgba(45,37,29,.08),0 1px 0 rgba(255,255,255,.3);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%)}
html body .app-shell main>.topbar #atlas-account .atlas-account-actions>button{box-sizing:border-box;appearance:none;display:flex;align-items:center;justify-content:center;height:38px!important;min-height:38px!important;padding:0 12px!important;margin:0!important;border:0!important;border-radius:12px!important;background:transparent!important;box-shadow:none!important;color:var(--uc-ink)!important;font-size:12px!important;font-weight:600!important;line-height:1!important;white-space:nowrap;transform:none!important;cursor:pointer}
html body .app-shell main>.topbar #atlas-account .atlas-account-actions>button:hover,html body .app-shell main>.topbar #atlas-account .atlas-account-actions>button:active{background:var(--shared-orange)!important;box-shadow:var(--shared-orange-shadow)!important;color:#fff!important}
html body .app-shell main>.topbar #atlas-account .atlas-account-actions>button:focus-visible{outline:2px solid #e87500!important;outline-offset:3px}
`;
document.head.append(style);
function decorate(){
 const profile=document.querySelector('.topbar #profile');if(profile){profile.onclick=null;profile.remove();}
 const account=document.getElementById('atlas-account');if(!account)return;
 const buttons=[...account.children].filter(n=>n.tagName==='BUTTON');if(!buttons.length)return;
 let group=account.querySelector(':scope > .atlas-account-actions');
 if(!group){group=document.createElement('div');group.className='atlas-account-actions';group.setAttribute('role','group');account.append(group);}
 buttons.forEach(button=>group.append(button));
}
function start(){const topbar=document.querySelector('.topbar');if(!topbar)return;new MutationObserver(decorate).observe(topbar,{childList:true,subtree:true});decorate();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
