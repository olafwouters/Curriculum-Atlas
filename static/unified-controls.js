/* Unified controls. Idempotent updates prevent translation feedback loops. */
(()=>{'use strict';
const attr=(e,k,v)=>{v=String(v);if(e.getAttribute(k)!==v)e.setAttribute(k,v)};
function init(){
const language=document.querySelector('.language-switch');
if(language){attr(language,'data-no-translate','');attr(language,'role','group');attr(language,'aria-label','Language / Taal');let lens=language.querySelector('.unified-lens');if(!lens){lens=document.createElement('span');lens.className='unified-lens';attr(lens,'aria-hidden','true');language.prepend(lens)}const en=language.querySelector('[data-language="en"]'),nl=language.querySelector('[data-language="nl"]');if(en&&nl){language.append(en,nl);en.textContent='EN';nl.textContent='NL';attr(en,'aria-label','English');attr(nl,'aria-label','Nederlands')}
 const syncLanguage=()=>{const buttons=[...language.querySelectorAll('button[data-language]')];let selected=buttons.findIndex(b=>b.getAttribute('aria-pressed')==='true');if(selected<0)selected=buttons.findIndex(b=>b.dataset.language===document.documentElement.lang.slice(0,2));const index=selected===1?1:0;language.classList.toggle('uc-second',index===1);if(language.style.getPropertyValue('--language-index')!==String(index))language.style.setProperty('--language-index',String(index))};
 new MutationObserver(syncLanguage).observe(language,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});syncLanguage();}
const native=document.getElementById('theme');if(!native)return;native.classList.add('uc-native-hidden');document.querySelector('label[for="theme"]')?.classList.add('uc-native-hidden');
const icons={light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/>',dark:'<path d="M20.6 13.2A8.7 8.7 0 0 1 10.8 3.4 8.8 8.8 0 1 0 20.6 13.2Z"/>',system:'<rect x="5" y="4" width="14" height="11" rx="1.5"/><path d="M5 15 2.5 19h19L19 15M9 19h6"/>'};
const modes=['light','dark','system'];const control=document.createElement('div');control.className='unified-theme unified-three';attr(control,'data-no-translate','');attr(control,'role','group');control.innerHTML='<span class="unified-lens" aria-hidden="true"></span>'+modes.map(mode=>'<button type="button" data-mode="'+mode+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+icons[mode]+'</svg></button>').join('');
const host=document.querySelector('.topbar-settings')||document.querySelector('.topbar');if(host)host.append(control);else native.after(control);
control.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{native.value=b.dataset.mode;native.dispatchEvent(new Event('change',{bubbles:true}));sync()}));
function sync(){const nl=document.documentElement.lang.startsWith('nl');const preference=modes.includes(native.value)?native.value:'system';control.style.setProperty('--uc-index',String(modes.indexOf(preference)));attr(control,'aria-label',nl?'Weergave':'Appearance');control.querySelectorAll('button').forEach(b=>{const label={light:nl?'Lichte weergave':'Light appearance',dark:nl?'Donkere weergave':'Dark appearance',system:nl?'Systeeminstelling volgen':'Follow system appearance'}[b.dataset.mode];attr(b,'aria-pressed',b.dataset.mode===preference);attr(b,'aria-label',label);attr(b,'title',label)})}
native.addEventListener('change',sync);new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-theme']});sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
