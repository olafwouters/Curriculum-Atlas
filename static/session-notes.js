
/* Saved session notes are readable without downloading the snapshot. */
(function(){
 const originalSessionView=sessionView;
 const detailRoute="/api/sessions/<ident>";
 function unpack(value){
  let x=value;
  for(let i=0;i<5;i++){
   if(typeof x==='string'){try{x=JSON.parse(x);}catch{return {notes:x};}}
   if(!x||typeof x!=='object')return {};
   const nested=x.state??x.snapshot??x.data;
   if(nested===undefined)return x;
   x=nested;
  }
  return x||{};
 }
 sessionView=function(v){
  originalSessionView(v);
  if(!sessions.length)return;
  const section=document.createElement('section');section.className='saved-session-notes';
  const heading=document.createElement('h3');heading.textContent='Opgeslagen sessieaantekeningen';section.append(heading);
  const intro=document.createElement('p');intro.className='hint';intro.textContent='Aantekeningen uit je opgeslagen sessies. De oorspronkelijke snapshots blijven beschikbaar.';section.append(intro);
  v.append(section);
  sessions.forEach((item)=>{
   const card=document.createElement('article');card.className='session-note-card';
   const title=document.createElement('h4');title.textContent=item.title||item.sessionTitle||'Opgeslagen sessie';card.append(title);
   const meta=document.createElement('p');meta.className='subtle';const date=item.created||item.created_at||item.date||item.timestamp;meta.textContent=date?new Date(date).toLocaleString('nl-NL'):'';card.append(meta);
   const notes=document.createElement('div');notes.className='session-note-text';notes.setAttribute('role','status');notes.textContent='Aantekeningen laden…';card.append(notes);section.append(card);
   const load=async()=>{
    notes.textContent='Aantekeningen laden…';card.querySelector('.session-note-retry')?.remove();
    try{
     let snapshot=item;
     if(item.notes===undefined&&item.state===undefined&&item.snapshot===undefined){
      const sid=item.id??item.session_id??item.snapshot_id;
      if(sid===undefined)throw Error('Sessie-ID ontbreekt.');
      const url=detailRoute.replace(/<(?:(?:int|string|path):)?[^>]+>/g,()=>encodeURIComponent(sid));
      snapshot=await api(url);
     }
     const saved=unpack(snapshot);
     title.textContent=saved.sessionTitle||item.title||item.sessionTitle||'Opgeslagen sessie';
     notes.textContent=typeof saved.notes==='string'&&saved.notes.trim()?saved.notes:'Geen aantekeningen vastgelegd voor deze sessie.';
    }catch(error){
     notes.textContent='De aantekeningen konden niet worden geladen. '+error.message;
     const retry=document.createElement('button');retry.type='button';retry.className='session-note-retry';retry.textContent='Opnieuw laden';retry.onclick=load;card.append(retry);
    }
   };load();
  });
 };
})();
