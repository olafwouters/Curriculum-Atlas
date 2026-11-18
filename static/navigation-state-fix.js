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

/* Keep the existing animated menu canvas whole, beside the brand title. */
(()=>{'use strict';
const nav=document.getElementById('navigation-panel');if(!nav)return;
const style=document.createElement('style');style.textContent=`
#navigation-panel .sidebar-brand.atlas-brand-globe{position:relative;box-sizing:border-box;min-height:52px;padding-right:60px;display:flex;align-items:center}
#navigation-panel .sidebar-brand>.atlas-menu-globe{position:absolute;right:0;top:50%;transform:translateY(-50%);width:48px;height:48px;pointer-events:none}
#navigation-panel .sidebar-brand>.atlas-menu-globe[hidden]{display:none!important}
#navigation-panel .atlas-menu-globe canvas{display:block;position:static;width:48px;height:48px;max-width:none;max-height:none;opacity:1;transform:none}
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
