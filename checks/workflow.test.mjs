import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../core/api.mjs';
import {seed,report,emptyCycle,submit} from '../core/model.mjs';
function fixture(mode='demo'){
 const rows=new Map();
 const db={get:id=>rows.get(id),add:(id,s)=>{if(!rows.has(id))rows.set(id,{revision:0,payload:JSON.stringify(s)})},
 put:(id,r,s)=>{if(rows.get(id)?.revision!==r)return false;rows.set(id,{revision:r+1,payload:JSON.stringify(s)});return true}};
 let cookie='';
 const call=async(path,body,session=cookie)=>{
 const req=new Request('http://localhost/api/v1/'+path,{method:body===undefined?'GET':'POST',headers:{cookie:session,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const res=await handle(req,db,{mode,keys:{lead:'lead-test',officer:'officer-test'}});
 if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
 const data=res.headers.get('content-type').includes('json')?await res.json():await res.text();return {status:res.status,data};
 };return {call,rows};
}
test('Published example and deterministic weighted index',()=>{
 const c=seed().cycles[4],r=report(c);assert.equal(r.index.toFixed(1),'76.2');assert.equal(r.rows[2].gap.toFixed(1),'44.5');
 assert.deepEqual(report(c),r);assert.equal(report(seed().cycles.at(-1)).index,null);
});
test('Minimum size applies per criterion, with missing observations omitted',()=>{
 const c=emptyCycle(1,'Тест',5);c.confirmed=c.closed=true;c.expert=[75,75,75];c.facts=[{a:9,b:10},{a:9,b:10},{a:9,b:10}];
 for(let i=0;i<5;i++)submit(c,'cadets',[3,3,i?3:null]);submit(c,'staff',[0,0,0]);
 const r=report(c);assert.equal(r.rows[0].survey,75);assert.equal(r.rows[0].groups.staff,null);
 assert.equal(r.rows[2].groups.cadets,null);assert.equal(r.index,null);assert.equal(r.counts.staff,null);
});
test('One-use anonymous survey, role restrictions, tracker and next cycle',async()=>{
 const {call,rows}=fixture();await call('start',{});let d=(await call('state')).data;
 await call('measure',{cycle:5,criterion:2,text:d.criteria[2].action,owner:d.owners[0],due:'2026-12-01'});
 await call('role',{role:'officer'});assert.equal((await call('close',{cycle:6})).status,403);
 const i=(await call('issue',{cycle:6,group:'cadets'})).data.invitation;
 const before=(await call('state')).data;
 assert.equal((await call('answer',{invitation:i,answers:[3,2,1]},'')).status,200);
 assert.equal((await call('answer',{invitation:i,answers:[3,2,1]},'')).status,410);
 const after=(await call('state')).data;assert.deepEqual(after.audit,before.audit);
 assert.equal(after.cycles.at(-1).index,null);assert.equal(after.cycles.at(-1).counts.cadets,before.cycles.at(-1).counts.cadets+1);
 assert.equal(Object.keys(JSON.parse([...rows.values()][0].payload).invites).length,0);
 await call('inputs',{cycle:6,expert:[75,75,75],facts:[{a:93,b:100},{a:84,b:100},{a:90,b:100}]});
 await call('role',{role:'lead'});assert.equal((await call('close',{cycle:6})).status,400);
 await call('confirm',{cycle:6});assert.equal((await call('close',{cycle:6})).status,200);
 d=(await call('state')).data;assert.equal(d.cycles.at(-1).index.toFixed(1),'78.3');assert.equal(d.measures.at(-1).verification.cycle,'Грудень 2026');
 assert.match((await call('report.csv?cycle=6')).data,/Підзвітність/);
 await call('role',{role:'member'});assert.equal((await call('report.csv?cycle=6')).status,403);assert.equal((await call('state')).data.measures,undefined);
});
test('Institutional mode disables demo roles and enforces independent review',async()=>{
 const {call}=fixture('team');assert.equal((await call('start',{})).status,401);
 assert.equal((await call('login',{role:'officer',code:'officer-test'})).status,200);
 assert.equal((await call('role',{role:'lead'})).status,403);
 assert.equal((await call('confirm',{cycle:6})).status,403);
 assert.equal((await call('state',undefined,'vector=institution')).status,401);
});
test('Simultaneous redemptions add only one response',async()=>{
 const {call}=fixture();await call('start',{});const i=(await call('issue',{cycle:6,group:'cadets'})).data.invitation;
 const answers={invitation:i,answers:[4,3,2]};const pair=await Promise.all([call('answer',answers,''),call('answer',answers,'')]);
 assert.equal(pair.filter(x=>x.status===200).length,1);assert.equal((await call('state')).data.cycles.at(-1).counts.cadets,18);
});

test('12-answer version, mixed history and suppression per diagnostic question',async()=>{
 const c=emptyCycle(1,'Новий цикл',5);
 c.closed=true;c.confirmed=true;c.expert=[75,75,75];c.facts=Array.from({length:3},()=>({a:8,b:10}));
 for(let i=0;i<5;i++)submit(c,'cadets',[2,2,2]);
 for(let i=0;i<5;i++)submit(c,'staff',Array.from({length:12},(_,j)=>j===1&&i===0?null:3),2);
 let r=report(c);assert.equal(r.practices.length,12);assert.equal(r.practices[1].category,'hidden');
 assert.equal(r.practices[2].groups.cadets,null);assert.equal(r.practices[2].score,75);
 assert.equal(r.practices[0].category,'split');
 assert.throws(()=>submit(c,'cadets',[4,4,4],2));assert.equal(c.groups.cadets.n,5);
 c.closed=false;r=report(c);assert.equal(r.practices.length,0);
});
test('Practice-specific action uses the matching next-cycle question and public CSV',async()=>{
 const {call}=fixture();await call('start',{});let state=(await call('state')).data;
 const c=state.cycles[4],q=c.practices.find(q=>q.id==='confidential');
 const payload={cycle:c.id,criterion:2,questionId:q.id,text:'Пояснити умови конфіденційності.',owner:state.owners[0],due:'2026-12-05'};
 assert.equal((await call('measure',payload)).status,200);assert.equal((await call('measure',payload)).status,409);
 assert.equal((await call('measure',{...payload,questionId:'expectations'})).status,400);
 const inv=(await call('issue',{cycle:6,group:'staff',version:2})).data.invitation;
 assert.equal((await call('invite-info',{invitation:inv},'')).data.questions.length,12);
 assert.equal((await call('answer',{invitation:inv,answers:[1,1,1]},'')).status,400);
 assert.equal((await call('answer',{invitation:inv,answers:Array(12).fill(2)},'')).status,200);
 assert.equal((await call('close',{cycle:6})).status,200);state=(await call('state')).data;
 const next=state.cycles[5].practices.find(x=>x.id===q.id);
 assert.equal(state.measures.at(-1).verification.score,next.score);assert.equal(state.measures.at(-1).baseline,q.score);
 const csv=await call('report.csv?cycle=5');assert.match(csv.data,/Умови конфіденційності/);assert.match(csv.data,/Пріоритет розвитку/);
});
test('Any visitor gets a separate demo, and can return after exploring an example',async()=>{
 const {call}=fixture();await call('start',{});let s=(await call('state')).data;
 await call('measure',{cycle:5,criterion:2,text:'Додати інструкцію до порталу.',owner:s.owners[0],due:'2026-12-05'});
 await call('demo-example',{});s=(await call('state')).data;assert.ok(s.inExample);assert.equal(s.measures.length,1);
 assert.equal((await call('demo-return',{})).status,200);s=(await call('state')).data;assert.equal(s.measures.length,2);
 await call('start',{},'');s=(await call('state')).data;assert.equal(s.measures.length,1);
});

test('Manual preventative measure for a practice that is not automatically flagged',async()=>{
 const {call}=fixture();await call('start',{});const state=(await call('state')).data;
 const c=state.cycles.find(c=>c.closed),q=c.practices.find(q=>['strong','stable'].includes(q.category))||c.practices[0];
 const payload={cycle:c.id,criterion:q.component,questionId:q.id,text:'Провести практичну зустріч із доброчесності.',owner:state.owners[0],due:'2027-03-15'};
 assert.equal((await call('measure',payload)).status,200);
 assert.ok((await call('state')).data.measures.some(m=>m.questionId===q.id&&m.text===payload.text));
 assert.equal((await call('measure',payload)).status,409);
});
