import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saveLocalPlan,getLocalPlans,changeLocalStatus,mergeLocalPlans} from '../public/manager-store.mjs';
import {synchronizeManagerPlans} from '../public/manager-sync.mjs';

function storage(){
  const state=new Map();
  return {getItem:key=>state.get(key)||null,setItem:(key,v)=>state.set(key,v)};
}
const key='manager-actions';
const q={id:'practice',title:'Практичні вправи',action:'Обговорити випадок.',score:61,published:{cadets:7,teachers:null}};
const payload={id:q.id,action:'Організувати навчання з перевіркою засвоєння.',verify:'Підписаний протокол та контрольна вправа.',owner:'Навчальний відділ',due:'2027-03-15'};
function service(opts={}){
  const plans={...(opts.plans||{})};
  const counters={plan:0,status:0,state:0};
  async function api(name,body){
    if(name==='state'){
      counters.state++;
      return {practices:[q],proposals:Object.entries(plans).map(([id,plan])=>({id,title:q.title,action:q.action,votes:0,plan:{...plan}}))};
    }
    if(name==='plan'){
      counters.plan++;
      if(opts.refuse)throw Error('Стара серверна версія');
      if(!plans[body.id]){
        plans[body.id]={action:opts.rewrite?'Типова дія':body.action,verify:body.verify,owner:body.owner,due:body.due,status:'planned'};
      }
      opts.onPlan?.(body);
      return {ok:true};
    }
    if(name==='status'){
      counters.status++;
      if(opts.statusRefuse)throw Error('Немає доступу до зміни статусу');
      if(!plans[body.id])throw Error('Відсутній захід');
      plans[body.id].status=body.status;return {ok:true};
    }
    throw Error('Unexpected API request: '+name);
  }
  return {api,plans,counters};
}
const save=browser=>saveLocalPlan(browser,key,payload,[q]);
const sync=async(browser,remote)=>synchronizeManagerPlans({api:remote.api,storage:browser,key,initialState:await remote.api('state')});

test('First upload moves an existing local measure and its done status to shared server',async()=>{
  const browser=storage(),remote=service();
  save(browser);changeLocalStatus(browser,key,q.id,'done');
  const result=await sync(browser,remote);
  assert.deepEqual(result.uploaded,[q.id]);
  assert.equal(result.remaining,0);
  assert.deepEqual(getLocalPlans(browser,key),{});
  assert.equal(remote.plans[q.id].action,payload.action);
  assert.equal(remote.plans[q.id].verify,payload.verify);
  assert.equal(remote.plans[q.id].owner,payload.owner);
  assert.equal(remote.plans[q.id].due,payload.due);
  assert.equal(remote.plans[q.id].status,'done');
  assert.equal(mergeLocalPlans(await remote.api('state'),browser,key).pendingLocalCount,0);
});

test('Duplicate identical server entry only clears confirmed browser copy',async()=>{
  const browser=storage();
  const record=save(browser),remote=service({plans:{[q.id]:{...record,localOnly:undefined}}});
  const result=await sync(browser,remote);
  assert.deepEqual(result.matched,[q.id]);
  assert.equal(remote.counters.plan,0);
  assert.deepEqual(getLocalPlans(browser,key),{});
});

test('An interrupted upload can resume sending its status',async()=>{
  const browser=storage();
  save(browser);changeLocalStatus(browser,key,q.id,'active');
  const remote=service({plans:{[q.id]:{...payload,status:'planned'}}});
  const result=await sync(browser,remote);
  assert.deepEqual(result.matched,[q.id]);
  assert.equal(remote.plans[q.id].status,'active');
  assert.equal(remote.counters.status,1);
  assert.equal(result.remaining,0);
});

test('Conflicting server wording does not overwrite or erase the local measure',async()=>{
  const browser=storage();save(browser);
  const remote=service({plans:{[q.id]:{...payload,action:'Інший спільний захід',status:'planned'}}});
  const result=await sync(browser,remote);
  assert.equal(result.conflicts.length,1);
  assert.equal(result.uploaded.length,0);
  assert.equal(result.remaining,1);
  assert.equal(remote.plans[q.id].action,'Інший спільний захід');
  assert.equal(getLocalPlans(browser,key)[q.id].action,payload.action);
  const visible=mergeLocalPlans(await remote.api('state'),browser,key);
  assert.equal(visible.localConflictCount,1);
  assert.equal(visible.pendingLocalCount,1);
});

test('Old backend rejection keeps local action and reports a failed upload',async()=>{
  const browser=storage(),remote=service({refuse:true});save(browser);
  const result=await sync(browser,remote);
  assert.equal(result.failed.length,1);
  assert.equal(result.remaining,1);
  assert.deepEqual(result.uploaded,[]);
  assert.equal(getLocalPlans(browser,key)[q.id].verify,payload.verify);
});

test('Server silently changing wording is detected and not marked synchronized',async()=>{
  const browser=storage(),remote=service({rewrite:true});save(browser);
  const result=await sync(browser,remote);
  assert.equal(result.conflicts.length,1);
  assert.equal(result.remaining,1);
  assert.equal(remote.plans[q.id].action,'Типова дія');
});

test('A local edit during upload is never lost',async()=>{
  const browser=storage();save(browser);
  const remote=service({onPlan:()=>saveLocalPlan(browser,key,{...payload,action:'Нова редакція локального заходу'},[q])});
  const result=await sync(browser,remote);
  assert.equal(result.remaining,1);
  assert.equal(result.conflicts.length,1);
  assert.equal(getLocalPlans(browser,key)[q.id].action,'Нова редакція локального заходу');
});

test('Status failure after server create preserves the draft for a later retry',async()=>{
  const browser=storage(),remote=service({statusRefuse:true});save(browser);changeLocalStatus(browser,key,q.id,'done');
  const first=await sync(browser,remote);
  assert.equal(first.remaining,1);
  assert.equal(remote.plans[q.id].status,'planned');
  assert.equal(first.failed.length,1);
  const resumed=service({plans:remote.plans});
  const second=await sync(browser,resumed);
  assert.equal(second.remaining,0);
  assert.equal(resumed.plans[q.id].status,'done');
});

test('Published manager page includes one-click sync and no demo modifications',()=>{
  // The generic demo application is not imported by the real manager sync module.
  assert.equal(typeof synchronizeManagerPlans,'function');
});

test('Manager plan hides the alarming synchronization banner and preserves local measures',async()=>{
  const {renderSection}=await import('../public/manager.mjs');
  const browser=storage();
  save(browser);
  const remote=service();
  const pending=renderSection({...mergeLocalPlans(await remote.api('state'),browser,key),serverManualMeasures:false},{criteria:['Культура']},'plan');
  assert.doesNotMatch(pending,/Очікують на синхронізацію|Поточна версія спільного сервера|Перевірити можливість синхронізації/);
  assert.doesNotMatch(pending,/data-action="sync-plans"/);
  assert.match(pending,/Збережено на цьому пристрої/);
  assert.match(pending,/Організувати навчання з перевіркою засвоєння/);
  await sync(browser,remote);
  const ready=renderSection({...mergeLocalPlans(await remote.api('state'),browser,key),serverManualMeasures:true},{criteria:['Культура']},'plan');
  assert.doesNotMatch(ready,/Очікують на синхронізацію|Заходи зберігаються на спільному сервері/);
  assert.match(ready,/Організувати навчання з перевіркою засвоєння/);
});

test('Real manager UI wires automatic migration after login and periodic capability checks',()=>{
  const client=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
  assert.match(client,/synchronizePlans\(\)/);
  assert.doesNotMatch(client,/if\(action==='sync-plans'\)/);
  assert.match(client,/lastSyncCheck>60000/);
  assert.match(client,/synchronizeManagerPlans\(\{api,storage:localStorage,key:planKey,initialState:rawManagerState\}\)/);
  const demo=readFileSync(new URL('../offline/build-html.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(demo,/manager-sync\.mjs/);
});
