// Локальний резервний план основного кабінету керівника, коли спільний API ще не оновлено.
// Ці записи зберігаються лише у цьому браузері, а не на спільному сервері.
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const statuses=['planned','active','done'];
export function getLocalPlans(storage,key){
  try {
    const data=JSON.parse(storage.getItem(key)||'{}');
    if(!data||typeof data!=='object'||Array.isArray(data))return {};
    return Object.fromEntries(Object.entries(data).filter(([id,p])=>
      typeof id==='string'&&p&&typeof p==='object'&&!Array.isArray(p)&&
      typeof p.action==='string'&&typeof p.verify==='string'&&validDate(p.due)&&statuses.includes(p.status)
    ));
  }catch{return {}}
}
export function saveLocalPlan(storage,key,payload,practices){
  const q=practices.find(q=>q.id===payload.id);
  if(!q)throw Error('Оберіть практику для заходу.');
  const action=String(payload.action??'').trim(),verify=String(payload.verify??'').trim();
  if(action.length<2||action.length>320||verify.length<2||verify.length>320||
     !['Уповноважений з доброчесності','Навчальний відділ','Робоча група'].includes(payload.owner)||!validDate(payload.due)){
    throw Error('Заповніть зміст заходу, ознаку виконання, підрозділ та дійсну дату.');
  }
  const plans=getLocalPlans(storage,key);
  plans[payload.id]={action,verify,owner:payload.owner,due:payload.due,status:'planned',
    baseline:q.score,evidenceCount:Object.values(q.published||{}).reduce((n,v)=>n+(v||0),0),cohortVersion:2,localOnly:true};
  try{storage.setItem(key,JSON.stringify(plans))}
  catch{throw Error('Браузер заборонив локальне збереження. Дозвольте зберігання даних для цього сайту.')}
  return plans[payload.id];
}
export function changeLocalStatus(storage,key,id,status){
  if(!statuses.includes(status))throw Error('Невірний статус заходу.');
  const plans=getLocalPlans(storage,key);
  if(!plans[id])throw Error('Локальний захід не знайдено.');
  plans[id].status=status;
  try{storage.setItem(key,JSON.stringify(plans))}
  catch{throw Error('Не вдалося зберегти статус у браузері.')}
  return plans[id];
}
export function mergeLocalPlans(state,storage,key){
  const local=getLocalPlans(storage,key),proposals=state.proposals.map(p=>({...p}));
  let count=0;
  for(const q of state.practices){
    const draft=local[q.id];
    if(!draft)continue;
    const existing=proposals.find(p=>p.id===q.id);
    // Спільні записи завжди мають пріоритет над локальними.
    if(existing?.plan)continue;
    const plan={...draft,localOnly:true};
    if(existing)existing.plan=plan;
    else proposals.push({id:q.id,title:q.title,action:q.action,votes:q.votes||0,plan});
    count++;
  }
  return {...state,proposals,localPlanCount:count};
}
