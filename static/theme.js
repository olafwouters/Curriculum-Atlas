(()=>{const key='nextgen-compass-theme',mq=matchMedia('(prefers-color-scheme: dark)');let p='system';try{p=localStorage.getItem(key)||p}catch{}function apply(){document.documentElement.dataset.theme=p==='system'?(mq.matches?'dark':'light'):p}apply();mq.addEventListener('change',apply);document.addEventListener('DOMContentLoaded',()=>{const s=document.getElementById('theme');s.value=p;s.onchange=()=>{p=s.value;try{localStorage.setItem(key,p)}catch{}apply()}})})();
/* Load shared workspace presentation after the existing app initializes. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/workspace-bar.js?v=20261119-compact';document.head.append(s);},{once:true});

/* Use the uploaded framework asset without changing page layout or image contents. */
document.addEventListener('DOMContentLoaded',()=>{
 const view=document.getElementById('view');if(!view)return;
 const previous='/static/DigComp-3.0-figure.jpeg',next='/static/DigCompFramework.png';
 function swap(){view.querySelectorAll('img[src],img[srcset],source[srcset],a[href]').forEach(element=>{
  for(const attribute of ['src','srcset','href']){
   const value=element.getAttribute(attribute);
   if(value&&value.includes(previous))element.setAttribute(attribute,value.split(previous).join(next));
  }
 });}
 new MutationObserver(swap).observe(view,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','href']});swap();
},{once:true});

/* Load inline progress completion controls after app initialization. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/progress-step-checks.js?v=20261119-inline';document.head.append(s);},{once:true});

/* Load chart filters first, then tag graph ownership for report isolation. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/curriculum-chart-filters.js?v=20261120';s.onload=()=>{const fix=document.createElement('script');fix.src='/static/graph-domain-isolation.js?v=20261120';document.head.append(fix);};document.head.append(s);},{once:true});

/* Add the module overview to PDF team reports. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/report-module-overview.js?v=20261120';document.head.append(s);},{once:true});

/* Add cluster-filtered workspace switching and catalogue import checks. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/workspace-index.js?v=20261120-catalogue';document.head.append(s);},{once:true});

/* Share collision-free competence display colours across chart and scan. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/competence-colours.js?v=20261120-unique';document.head.append(s);},{once:true});

/* Limit desktop enlargement of short live charts without changing exported SVGs. */
document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('link');style.rel='stylesheet';style.href='/static/compact-curriculum-chart.css';document.head.append(style);},{once:true});

/* Replace only the DigComp demonstration after the original chooser initializes. */
document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='/static/demo-digcomp-four-year.js?v=20261120-four-years';document.head.append(s);},{once:true});
