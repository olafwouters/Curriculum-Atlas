/* Inline completion controls for the existing Voortgang step list. */
(()=>{'use strict';
 const view=document.getElementById('view');if(!view)return;
 const tx=p=>p[localStorage.getItem('compass-language')==='en'?1:0];
 function sync(){
  const list=view.querySelector('.atlas-scan-list'),model=window.AtlasScanProcess;
  if(!list||!model||typeof state==='undefined'||!state)return;
  let data,valid=true;try{data=model.readScan(state.scanProcess);}catch(e){valid=false;data={statuses:{}};}
  const buttons=[...list.querySelectorAll('button[data-atlas-step]')];
  if(buttons.length!==model.steps.length)return;
  for(const button of buttons){
   const step=button.dataset.atlasStep;
   let row=button.parentElement,check;
   if(!row.classList.contains('atlas-step-row')){
    row=document.createElement('div');row.className='atlas-step-row';
    button.before(row);row.append(button);
    check=document.createElement('input');check.type='checkbox';check.dataset.atlasCheck=step;check.dataset.noTranslate='';row.prepend(check);
    const captured=state;
    check.addEventListener('change',()=>{
     if(state!==captured||button.disabled){sync();return;}
     try{
      state.scanProcess=window.AtlasScanProcess.updateScan(state.scanProcess,'statuses',step,check.checked?'complete':'in-progress');
      changed();render();
      queueMicrotask(()=>{sync();view.querySelector('input[data-atlas-check="'+step+'"]')?.focus();});
     }catch(e){sync();say(tx(['Procesgegevens konden niet worden aangepast. Controleer de opslagmelding; bestaande voortgang blijft behouden.','Process data could not be updated. Check the save status; existing progress is preserved.']));}
    });
   }else check=row.querySelector('input[data-atlas-check]');
   const done=data.statuses[step]==='complete',disabled=!valid||button.disabled;
   check.checked=done;if(check.disabled!==disabled)check.disabled=disabled;
   const name=button.querySelector('span:last-child')?.textContent||step;
   const label=tx(done?['Markeer als niet afgerond: ','Mark incomplete: ']:['Markeer als afgerond: ','Mark complete: '])+name;
   if(check.getAttribute('aria-label')!==label)check.setAttribute('aria-label',label);
   if(check.title!==label)check.title=label;
  }
  const root=list.closest('.atlas-scan');if(root&&!root.classList.contains('atlas-inline-progress'))root.classList.add('atlas-inline-progress');
 }
 const style=document.createElement('style');style.textContent=`
 .atlas-inline-progress .atlas-step-row{display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:12px;margin:5px 0;padding:0 10px;border:1px solid transparent;border-radius:12px}
 .atlas-inline-progress .atlas-step-row:has(button[aria-current="step"]){border-color:#e87500;background:color-mix(in srgb,#e87500 10%,transparent)}
 .atlas-inline-progress .atlas-step-row>button{min-width:0;margin:0;border:0!important;background:transparent!important;padding:10px 0;box-shadow:none}
 .atlas-inline-progress .atlas-step-row .atlas-step-number{display:none}
 .atlas-inline-progress .atlas-step-row>input[type=checkbox]{width:22px;height:22px;margin:0;cursor:pointer;accent-color:#e87500}
 .atlas-inline-progress .atlas-step-row>input:disabled{cursor:not-allowed}
 .atlas-inline-progress .atlas-step-row>input:focus-visible{outline:3px solid #e87500;outline-offset:4px}
 .atlas-inline-progress .atlas-scan-actions>label:has(#atlas-scan-complete){display:none!important}
 .atlas-inline-progress .atlas-scan-actions{justify-content:flex-end}
 `;document.head.append(style);
 new MutationObserver(sync).observe(view,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','data-complete','aria-current']});sync();
})();
