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
