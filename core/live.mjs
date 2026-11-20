import {CRITERIA, key} from './model.mjs';

import {practiceResult} from './questionnaire.mjs';
import {guidance as legacyGuidance} from './practice-guidance.mjs';
import {liveQuestions as QUESTIONS,liveGroups as GROUPS,requiredCount,recommendation,variants} from './live-catalog.mjs';

const ROOM = 'shared-survey-v1';
const MINIMUM = 7;
const DAY = 86400000;
const encoder = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2,'0')).join('');
const digest = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
const problem = (message,status) => { throw Object.assign(new Error(message),{status}); };
const equal = (a,b) => {
  if (!a || !b || a.length !== b.length) return false;
  let different=0;
  for(let i=0;i<a.length;i++) different |= a.charCodeAt(i)^b.charCodeAt(i);
  return different===0;
};
async function sign(secret, text) {
  const signingKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',signingKey,encoder.encode(text)));
}
async function ticket(secret, role, age) {
  const value=key()+'.'+(Date.now()+age);
  return value+'.'+await sign(secret,role+':'+value);
}
async function validTicket(secret, role, value) {
  if(typeof value!=='string'||!/^\w{48}\.\d{13}\.[0-9a-f]{64}$/.test(value))return false;
  const [id,expiry,signature]=value.split('.');
  return Number(expiry)>Date.now() && equal(signature,await sign(secret,role+':'+id+'.'+expiry));
}
const emptyCell=()=>({pending:0,subtotal:0,n:0,sum:0});
function initial() {
  return {secret:key(),total:0,used:{},cells:{},votes:{},plans:{},history:[]};
}
async function read(db){
  let entry=await db.get(ROOM);
  if(!entry){await db.add(ROOM,initial());entry=await db.get(ROOM)}
  const state=JSON.parse(entry.payload);
  for(const group of [...Object.keys(GROUPS),'staff']){
    const cells=state.cells[group]??=[];
    while(cells.length<QUESTIONS.length)cells.push(emptyCell());
  }
  return {revision:entry.revision,state};
}
async function change(db,update){
  for(let i=0;i<16;i++){
    const {state,revision}=await read(db);
    const result=update(state);
    if(result.existing||await db.put(ROOM,revision,state))return result;
  }
  problem('Зараз одночасно надходять анкети. Натисніть «Надіслати» ще раз.',409);
}
function practices(s){
  return QUESTIONS.map((q,i)=>{
    const groups={},published={};
    for(const name of Object.keys(GROUPS)){
      const cell=s.cells[name][i];
      groups[name]=cell.n>=MINIMUM?25*cell.sum/cell.n:null;
      published[name]=groups[name]===null?null:cell.n;
    }
    const result=practiceResult(groups);
    const gap=Object.values(groups).every(Number.isFinite)?Math.abs(groups.cadets-groups.teachers):null;
    const votes=s.votes[q.id]||0;
    const choices=s.choices?.[q.id]||{};
    const offered=Object.entries(choices).map(([mode,votes])=>({mode,action:variants[q.id][mode].action,votes}));
    const originalVotes=votes-offered.reduce((sum,row)=>sum+row.votes,0);
    if(originalVotes>0)offered.push({mode:'original',action:q.action,votes:originalVotes});
    offered.sort((a,b)=>b.votes-a.votes);
    let advice=recommendation(q,result);
    if(result.score==null&&offered[0]&&offered[0].mode!=='original')advice=variants[q.id][offered[0].mode];
    const old=s.cells.staff[i];
    const legacy=old.n>=MINIMUM?{n:old.n,score:25*old.sum/old.n}:null;
    return {id:q.id,title:q.title,component:q.component,anchor:q.anchor,optional:!!q.optional,proposal:q.action,legacy,
      ...result,groups,published,gap,votes,offered,...advice};
  });
}
function figures(s,items=practices(s)){
  const components=items.filter(q=>q.anchor).map(q=>({label:CRITERIA[q.component].label,score:q.score}));
  const index=components.every(c=>c.score!==null)?components.reduce((sum,c)=>sum+c.score,0)/components.length:null;
  const weakest=items.filter(q=>q.score!==null).sort((a,b)=>a.score-b.score)[0];
  return {components,index,weakest:weakest||null};
}
function record(s,group,answers,proposal,fingerprint,variant){
  if(s.used[fingerprint])return {existing:true,ok:true};
  let released=false;
  answers.forEach((v,i)=>{
    if(v===null)return;
    const cell=s.cells[group][i];
    cell.pending++;cell.subtotal+=v;
    if(cell.pending===MINIMUM){
      cell.n+=cell.pending;cell.sum+=cell.subtotal;
      cell.pending=0;cell.subtotal=0;released=true;
    }
  });
  s.total++;
  if(proposal){
    s.votes[proposal]=(s.votes[proposal]||0)+1;
    if(variant&&variant!=='original'){
      s.choices??={};const bucket=s.choices[proposal]??={};
      bucket[variant]=(bucket[variant]||0)+1;
    }
  }
  s.used[fingerprint]=true;
  if(released){
    const {components,index}=figures(s);
    s.history.push({cohortVersion:2,total:s.total,components:components.map(c=>c.score),index,at:new Date().toISOString().slice(0,10)});
    if(s.history.length>24)s.history.shift();
  }
  return {ok:true};
}
function dashboard(s){
  const items=practices(s);
  const stats=figures(s,items);
  const proposals=QUESTIONS.filter(q=>s.votes[q.id]||s.plans[q.id]).map(q=>({
    id:q.id,title:q.title,action:q.action,votes:s.votes[q.id]||0,plan:s.plans[q.id]?{action:q.action,verify:legacyGuidance[q.id]?.verify,...s.plans[q.id]}:null
  })).sort((a,b)=>b.votes-a.votes);
  return {total:s.total,minimum:MINIMUM,...stats,practices:items,proposals,history:s.history};
}
const validAnswers=a=>Array.isArray(a)&&[requiredCount,QUESTIONS.length].includes(a.length)&&a.every(n=>n===null||(Number.isInteger(n)&&n>=0&&n<=4));
export async function handleLive(req,db,managerHash){
  const url=new URL(req.url),route=url.pathname.split('/').at(-1);
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'});
  const origin=req.headers.get('origin');
  const external=!!origin&&origin!==url.origin;
  const pages=external&&/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.github\.io$/.test(origin);
  if(pages){
    headers.set('Access-Control-Allow-Origin',origin);
    headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
    headers.set('Vary','Origin');
  }
  const scope=pages?'@'+origin:'';
  const authorization=req.headers.get('authorization')||'';
  const bearer=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
  const cookies=Object.fromEntries((req.headers.get('cookie')||'').split(';').map(v=>v.trim().split('=')));
  const setCookie=(name,value,age)=>headers.set('Set-Cookie',name+'='+value+'; Path=/; Max-Age='+age+'; HttpOnly; SameSite=Lax'+(url.protocol==='https:'?'; Secure':''));
  try{
    if(external&&!pages)problem('Цей сайт не підключений.',403);
    if(pages&&req.method==='OPTIONS')return new Response(null,{status:204,headers});
    const write=!['live-info','live-state'].includes(route);
    if(req.method!==(write?'POST':'GET'))problem('Метод недоступний.',405);
    let body={};
    if(write){
      if(!req.headers.get('content-type')?.startsWith('application/json'))problem('Очікується JSON.',415);
      const text=await req.text();if(text.length>3500)problem('Завеликий запит.',413);
      try{body=JSON.parse(text)}catch{problem('Невірний запит.',400)}
      if(!body||Array.isArray(body)||typeof body!=='object')problem('Невірний запит.',400);
    }
    if(route==='live-info')return reply({questions:QUESTIONS,requiredCount,criteria:CRITERIA.map(c=>c.label),groups:GROUPS,minimum:MINIMUM,managerConfigured:!!managerHash});
    if(route==='live-logout'){if(!pages)setCookie('vector_manager','',0);return reply({ok:true})}
    if(route==='live-login'){
      if(!managerHash)problem('Вхід керівника ще не налаштовано.',503);
      if(typeof body.key!=='string'||!equal(await digest(body.key.trim()),managerHash))problem('Ключ не підійшов. Перевірте скопійований текст.',403);
      const credential=await ticket(managerHash,'manager'+scope,DAY);
      if(pages)return reply({ok:true,credential});
      setCookie('vector_manager',credential,86400);
      return reply({ok:true});
    }
    if(['live-state','live-plan','live-status'].includes(route)){
      if(!managerHash||!await validTicket(managerHash,'manager'+scope,pages?bearer:cookies.vector_manager))problem('Введіть ключ керівника.',401);
      if(route==='live-state')return reply(dashboard((await read(db)).state));
      const q=QUESTIONS.find(q=>q.id===body.id);
      if(route==='live-status'){
        if(!q||!['planned','active','done'].includes(body.status))problem('Перевірте статус заходу.',400);
        return reply(await change(db,s=>{
          const plan=s.plans[q.id];if(!plan)problem('Захід відсутній у плані.',404);
          if((plan.status||'planned')===body.status)return {existing:true,ok:true};
          plan.status=body.status;return {ok:true};
        }));
      }
      if(!q||!['Уповноважений з доброчесності','Навчальний відділ','Робоча група'].includes(body.owner)||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.due)||!Number.isFinite(Date.parse(body.due))||new Date(body.due).toISOString().slice(0,10)!==body.due)problem('Оберіть відповідального й дійсну дату.',400);
      return reply(await change(db,s=>{
        if(s.plans[q.id])return {existing:true,ok:true};
        const item=practices(s).find(practice=>practice.id===q.id);
        if(!item.votes&&!['priority','forming','split'].includes(item.category)&&figures(s).weakest?.id!==q.id)problem('Для практики ще немає підстави додати захід.',400);
        s.plans[q.id]={owner:body.owner,due:body.due,status:'planned',action:item.action,verify:item.verify,cohortVersion:2,baseline:item.score,evidenceCount:Object.values(item.published).reduce((n,v)=>n+(v||0),0)};return {ok:true};
      }));
    }
    if(!['live-start','live-answer'].includes(route))problem('Сторінку не знайдено.',404);
    const {state}=await read(db);
    let token=pages?bearer:cookies.vector_ballot;
    const valid=await validTicket(state.secret,'ballot'+scope,token);
    if(route==='live-start'){
      if(!valid){token=await ticket(state.secret,'ballot'+scope,90*DAY);if(!pages)setCookie('vector_ballot',token,90*86400)}
      return reply({submitted:!!state.used[await digest(token)],...(pages?{credential:token}:{})});
    }
    if(!valid)problem('Дозвольте cookie цього сайту й відкрийте анкету ще раз.',401);
    if((!Object.hasOwn(GROUPS,body.group)&&!(body.group==='staff'&&body.answers?.length===requiredCount))||!validAnswers(body.answers)||
       (body.proposal!=null&&!QUESTIONS.some(q=>q.id===body.proposal)))problem('Перевірте відповіді анкети.',400);
    if(body.variant!=null&&(!body.proposal||!['original','low','mid','high'].includes(body.variant)))problem('Перевірте обрану пропозицію.',400);
    const fingerprint=await digest(token);
    return reply(await change(db,s=>record(s,body.group,body.answers,body.proposal,fingerprint,body.variant)));
  }catch(e){return reply({error:e.status?e.message:'Сервіс тимчасово недоступний. Спробуйте ще раз.'},e.status||500)}
}
