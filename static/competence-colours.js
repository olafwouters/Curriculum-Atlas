/* One display colour per competence, shared by every framework-based view. */
(()=>{'use strict';
function hex(value){let c=String(value||'').trim().toLowerCase();if(/^#[0-9a-f]{3}$/.test(c))c='#'+[...c.slice(1)].map(x=>x+x).join('');return /^#[0-9a-f]{6}$/.test(c)?c:'';}
function generated(name,attempt=0){
 let hash=2166136261;for(const c of name)hash=Math.imul(hash^c.codePointAt(0),16777619)>>>0;
 const h=((hash%36000)/100+attempt*137.507764)%360,s=.62,l=.68,a=s*Math.min(l,1-l);
 const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};
 return '#'+f(0)+f(8)+f(4);
}
function uniqueOutcomes(outcomes){
 const groups=new Map();for(const o of outcomes){if(!groups.has(o.domain))groups.set(o.domain,[]);groups.get(o.domain).push(o);}
 const assigned=new Map(),used=new Set(),deferred=[];
 for(const domain of [...groups.keys()].sort()){const preferred=hex(groups.get(domain)[0].color);if(preferred&&!used.has(preferred)){assigned.set(domain,preferred);used.add(preferred);}else deferred.push(domain);}
 for(const domain of deferred){let attempt=0,c;do{c=generated(domain,attempt++);if(attempt>10000)throw Error('Competence colour space exhausted');}while(used.has(c));assigned.set(domain,c);used.add(c);}
 return outcomes.map(o=>({...o,color:assigned.get(o.domain)}));
}
if(typeof module==='object'&&module.exports)module.exports={hex,uniqueOutcomes};
if(typeof document==='undefined'||typeof fwActive!=='function')return;
const prior=fwActive;
fwActive=function(){const active=prior(),coloured=uniqueOutcomes(active);if(active===FD){FD=coloured;return FD;}return coloured;};
if(typeof state!=='undefined'&&state)render();
})();
