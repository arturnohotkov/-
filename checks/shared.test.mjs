import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleLive} from '../core/live.mjs';

function instance() {
  const entries=new Map();
  const db={
    get:id=>entries.get(id),
    add:(id,state)=>{if(!entries.has(id))entries.set(id,{revision:0,payload:JSON.stringify(state)})},
    put:(id,rev,state)=>{
      if(entries.get(id)?.revision!==rev)return false;
      entries.set(id,{revision:rev+1,payload:JSON.stringify(state)});return true
    }
  };
  const hash=createHash('sha256').update('test-manager-key').digest('hex');
  function client(origin='https://example.test'){
    let cookie='',bearer='';
    return async(name,body,overrides={})=>{
      const headers={cookie,origin,'content-type':'application/json'};
      if(bearer)headers.authorization='Bearer '+bearer;
      Object.assign(headers,overrides);
      const req=new Request('https://example.test/api/v1/live-'+name,{
        method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
      const response=await handleLive(req,db,hash);
      const set=response.headers.get('set-cookie');
      if(set)cookie=set.split(';')[0];
      const result=await response.json();
      if(result.credential)bearer=result.credential;
      return {status:response.status,body:result,headers:response.headers,cookie,bearer};
    };
  }
  return {client,entries};
}
const ballot=(score,group='cadets',proposal=null)=>({group,answers:Array(12).fill(score),proposal});

test('Independent visitors feed one manager dashboard; participation and voluntary proposals update immediately',async()=>{
  const {client,entries}=instance();
  const head=client(),first=client(),second=client();
  assert.equal((await head('state')).status,401);
  assert.equal((await head('login',{key:'wrong'})).status,403);
  assert.equal((await head('login',{key:'test-manager-key'})).status,200);
  assert.equal((await head('state')).body.total,0);
  await first('start',{});await second('start',{});
  const [a,b]=await Promise.all([first('answer',ballot(0,'cadets','contact')),second('answer',ballot(4,'teachers'))]);
  assert.equal(a.status,200);assert.equal(b.status,200);
  const state=(await head('state')).body;
  assert.equal(state.total,2);assert.equal(state.index,null);assert.equal(state.proposals.length,1);assert.equal(state.proposals[0].votes,1);
  const retry=await first('answer',ballot(1,'teachers','followup'));assert.equal(retry.body.existing,true);
  assert.equal((await first('state')).status,401);
  assert.equal((await second('plan',{id:'contact'})).status,401);
  await head('plan',{id:'contact',owner:'Робоча група',due:'2027-01-20'});
  assert.equal((await head('state')).body.proposals[0].plan.owner,'Робоча група');
  assert.ok(!entries.values().next().value.payload.includes('"answers"'));
  await head('logout',{});assert.equal((await head('state')).status,401);
});

test('Group scores release only in batches of seven valid answers to each question',async()=>{
  const {client}=instance(),head=client();await head('login',{key:'test-manager-key'});
  async function collect(n,score,group,missing){
    const submissions=Array.from({length:n},async()=>{
      const visitor=client();await visitor('start',{});
      const body=ballot(score,group);
      if(missing)body.answers[0]=null;
      assert.equal((await visitor('answer',body)).status,200);
    });
    await Promise.all(submissions);
  }
  await collect(6,1,'cadets');await collect(6,4,'teachers');
  assert.equal((await head('state')).body.index,null);
  await collect(1,1,'cadets',true);let d=(await head('state')).body;
  assert.equal(d.index,null);assert.equal(d.components[1].score,25);assert.equal(d.components[0].score,null);
  await collect(1,1,'cadets');d=(await head('state')).body;assert.equal(d.index,25);
  await collect(1,4,'teachers');d=(await head('state')).body;assert.equal(d.index,62.5);
  assert.deepEqual(d.history.at(-1).components,[62.5,62.5,62.5]);
  await collect(1,0,'cadets');assert.deepEqual((await head('state')).body.history,d.history);
});

test('GitHub Pages uses origin-scoped bearer tokens, without exposing ambient cookies',async()=>{
  const {client}=instance();
  const local=client(),pages=client('https://example.github.io'),other=client('https://unrelated.github.io');
  const admin=await local('login',{key:'test-manager-key'});
  assert.equal((await pages('state',undefined,{cookie:admin.cookie})).status,401);
  assert.equal((await client('https://example.github.io.evil.test')('info')).status,403);
  await pages('start',{});assert.equal((await pages('answer',ballot(4))).status,200);
  const p=await pages('login',{key:'test-manager-key'});
  assert.equal(p.headers.get('access-control-allow-origin'),'https://example.github.io');
  assert.equal(p.headers.get('access-control-allow-credentials'),null);
  assert.equal((await pages('state')).body.total,1);
  assert.equal((await other('state',undefined,{authorization:'Bearer '+p.bearer})).status,401);
});

test('Manager can inspect evidence for each released practice, adopt a measure and track it across releases',async()=>{
  const {client,entries}=instance();
  const head=client('https://example.github.io');
  await head('login',{key:'test-manager-key'});
  const info=(await head('info')).body;
  async function submit(group,score,proposal=null){
    const visitor=client();await visitor('start',{});
    const body=ballot(score,group,proposal);
    body.answers[0]=3;body.answers[1]=null;body.answers[5]=group==='cadets'?0:4;
    assert.equal((await visitor('answer',body)).status,200);
  }
  await submit('cadets',2,'contact');
  let state=(await head('state')).body;
  const {renderSection,managerCsv,sections}=await import('../public/manager.mjs');
  const p=state.practices.find(p=>p.id==='contact');
  assert.deepEqual(p.published,{cadets:null,teachers:null});
  assert.deepEqual(p.groups,{cadets:null,teachers:null});assert.equal(p.votes,1);
  assert.match(renderSection(state,info,'priorities'),/Ознака виконання/);
  for(let i=1;i<7;i++)await submit('cadets',2);
  state=(await head('state')).body;
  assert.deepEqual(state.practices[5].published,{cadets:7,teachers:null});
  const adopt={id:'practice',owner:'Навчальний відділ',due:'2027-02-18'};
  assert.equal((await head('plan',adopt)).status,200);
  assert.equal((await client()('status',{id:'practice',status:'done'})).status,401);
  assert.equal((await head('status',{id:'practice',status:'other'})).status,400);
  assert.equal((await head('status',{id:'practice',status:'active'})).status,200);
  await head('plan',adopt);
  for(let i=0;i<7;i++)await submit('teachers',3);
  state=(await head('state')).body;
  assert.equal(state.practices[5].gap,100);assert.equal(state.practices[5].category,'split');
  assert.equal(state.practices[1].category,'hidden');
  assert.equal(state.proposals.find(p=>p.id==='practice').plan.status,'active');
  assert.match(renderSection(state,info,'plan'),/\+12,5 б/);
  assert.equal(managerCsv(state,info).split('\r\n').length,16);
  for(const section of Object.keys(sections))assert.doesNotMatch(renderSection(state,info,section),/NaN|undefined|\[object Object\]/);
  assert.equal((renderSection(state,info,'questions','1').match(/<details /g)||[]).length,5);
  assert.match(renderSection(state,info,'history'),/<polyline/);
  const current=[...entries.values()][0],legacy=JSON.parse(current.payload);
  delete legacy.plans.practice.status;delete legacy.plans.practice.baseline;delete legacy.plans.practice.evidenceCount;delete legacy.history[0].at;
  current.payload=JSON.stringify(legacy);
  const restored=(await head('state')).body;
  assert.match(renderSection(restored,info,'plan'),/Початковий бал не зафіксовано/);
  assert.match(renderSection(restored,info,'history'),/<td>—<\/td>/);
});

test('Legacy staff scores stay archived. Scenarios have a separate threshold and decisions retain their accepted wording.',async()=>{
  const {client,entries}=instance(),head=client();await head('login',{key:'test-manager-key'});
  const info=(await head('info')).body;
  assert.deepEqual(info.groups,{cadets:'Курсанти',teachers:'Викладачі'});
  assert.equal(info.requiredCount,12);assert.equal(info.questions.length,15);
  assert.equal(new Set(info.questions.map(x=>x.id)).size,15);
  async function add(group,answers,proposal=null){
    const visitor=client();await visitor('start',{});
    assert.equal((await visitor('answer',{group,answers,proposal})).status,200);
  }
  for(let i=0;i<7;i++)await add('staff',Array(12).fill(4));
  const entry=[...entries.values()][0],old=JSON.parse(entry.payload);
  delete old.cells.teachers;
  for(const group of ['staff','cadets'])old.cells[group]=old.cells[group].slice(0,12);
  entry.payload=JSON.stringify(old);
  let state=(await head('state')).body;
  assert.equal(state.total,7);assert.deepEqual(state.practices[0].legacy,{score:100,n:7});
  assert.equal(state.practices[0].groups.teachers,null);
  const q=info.questions[12],answers=Array(15).fill(null);answers[12]=0;
  for(let i=0;i<7;i++)await add('cadets',answers,i===0?q.id:null);
  state=(await head('state')).body;
  assert.equal(state.total,14);assert.equal(state.index,null);assert.equal(state.practices[12].score,0);
  assert.equal(state.practices[12].action,q.tips[0]);assert.notEqual(q.tips[0],q.tips[2]);
  assert.equal(state.proposals.find(x=>x.id===q.id).action,q.action);
  assert.equal((await head('plan',{id:q.id,owner:'Навчальний відділ',due:'2027-02-18'})).status,200);
  answers[12]=4;
  for(let i=0;i<7;i++)await add('teachers',answers);
  state=(await head('state')).body;
  assert.equal(state.practices[12].category,'split');
  assert.equal(state.practices[12].published.teachers,7);
  assert.equal(state.proposals.find(x=>x.id===q.id).plan.action,q.tips[0]);
  assert.notEqual(state.practices[12].action,q.tips[0]);
});

test('Voluntary wording is selected by the participant and available immediately without a group score',async()=>{
  const {client}=instance(),head=client(),visitor=client();
  await head('login',{key:'test-manager-key'});await visitor('start',{});
  const info=(await visitor('info')).body;
  const q=info.questions.find(q=>q.id==='contact');
  assert.equal((await visitor('answer',{...ballot(4,'teachers',q.id),variant:'mid'})).status,200);
  const state=(await head('state')).body,item=state.practices.find(p=>p.id===q.id);
  assert.equal(item.score,null);
  assert.deepEqual(item.offered,[{mode:'mid',action:q.tips[2],votes:1}]);
  assert.equal(item.action,q.tips[2]);assert.equal(state.total,1);
});

test('Manually created management action is persisted with custom wording',async()=>{
  const {client}=instance();
  const manager=client('https://example.github.io');
  assert.equal((await manager('login',{key:'test-manager-key'})).status,200);
  const info=(await manager('info')).body;
  assert.equal(info.manualMeasures,true);
  const state=(await manager('state')).body;
  const practice=state.practices.find(p=>p.category==='hidden'&&!p.votes)??state.practices[0];
  const payload={
    id:practice.id,owner:'Навчальний відділ',due:'2027-03-01',
    action:'Провести позаплановий тренінг із доброчесності та задокументувати результати.',
    verify:'Протокол тренінгу та підтверджене ознайомлення учасників.'
  };
  const response=await manager('plan',payload);
  assert.equal(response.status,200,JSON.stringify(response.body));
  const saved=(await manager('state')).body.proposals.find(p=>p.id===practice.id)?.plan;
  assert.ok(saved,'New management action is visible in plan');
  assert.equal(saved.action,payload.action);
  assert.equal(saved.verify,payload.verify);
  assert.equal(saved.owner,payload.owner);
  assert.equal(saved.due,payload.due);
  assert.equal((await manager('plan',payload)).body.existing,true);
});
