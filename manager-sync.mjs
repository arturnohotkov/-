import {getLocalPlans} from './manager-store.mjs';

/**
 * Safely migrate the real manager's browser-only actions to the shared API.
 * Requires the current authenticated manager token and server manualMeasures capability.
 * Never deletes a local record until the remote text, owner, due date and status are verified.
 */
const fields=['action','verify','owner','due'];
const sameDetails=(a,b)=>fields.every(field=>String(a?.[field]??'').trim()===String(b?.[field]??'').trim());
const sameStatus=(a,b)=>(a?.status||'planned')===(b?.status||'planned');

function eraseConfirmed(storage,key,id,expected){
  const latest=getLocalPlans(storage,key);
  if(!latest[id]||!sameDetails(latest[id],expected)||!sameStatus(latest[id],expected))return false;
  delete latest[id];
  storage.setItem(key,JSON.stringify(latest));
  return true;
}

export async function synchronizeManagerPlans({api,storage,key,initialState}){
  if(typeof api!=='function')throw Error('Немає доступу до спільного сервера.');
  let remote=initialState||await api('state');
  const local=getLocalPlans(storage,key);
  const result={uploaded:[],matched:[],conflicts:[],failed:[],remaining:0,remote};

  for(const [id,draft] of Object.entries(local)){
    const target=remote.proposals?.find(p=>p.id===id)?.plan;
    if(target){
      if(!sameDetails(target,draft)||!sameStatus(target,draft)){
        result.conflicts.push({id,reason:'На сервері вже є інший зміст, строк або статус цього заходу.'});
        continue;
      }
      try{
        if(eraseConfirmed(storage,key,id,draft))result.matched.push(id);
        else result.conflicts.push({id,reason:'Локальний запис змінився під час перенесення.'});
      }catch(err){result.failed.push({id,error:'Не вдалося прибрати підтверджену локальну копію: '+err.message})}
      continue;
    }
    try{
      await api('plan',{id,action:draft.action,verify:draft.verify,owner:draft.owner,due:draft.due});
      remote=await api('state');
      let saved=remote.proposals?.find(p=>p.id===id)?.plan;
      if(!saved||!sameDetails(saved,draft)){
        result.conflicts.push({id,reason:'Сервер не підтвердив збереження точного тексту заходу.'});
        continue;
      }
      if(draft.status!=='planned'&&saved.status!==draft.status){
        await api('status',{id,status:draft.status});
        remote=await api('state');
        saved=remote.proposals?.find(p=>p.id===id)?.plan;
      }
      if(!saved||!sameDetails(saved,draft)||!sameStatus(saved,draft)){
        result.conflicts.push({id,reason:'Сервер не підтвердив перенесення статусу.'});
        continue;
      }
      if(eraseConfirmed(storage,key,id,draft))result.uploaded.push(id);
      else result.conflicts.push({id,reason:'Запис змінено у браузері під час синхронізації.'});
    }catch(err){
      result.failed.push({id,error:err?.message||'Помилка мережі.'});
      // Re-read the server on the next attempt, without assuming this call was rejected.
      try{remote=await api('state')}catch{}
    }
  }
  result.remote=remote;
  result.remaining=Object.keys(getLocalPlans(storage,key)).length;
  return result;
}
