import {seed,key,report,summary,emptyCycle,submit,CRITERIA,QUESTIONS,GROUPS,ROLES,audit} from './model.mjs';
export function storeD1(db){
 return {
 get:id=>db.prepare('SELECT revision,payload FROM workspaces WHERE id=?').bind(id).first(),
 add:async(id,s)=>{await db.prepare('INSERT OR IGNORE INTO workspaces(id,revision,payload) VALUES (?,0,?)').bind(id,JSON.stringify(s)).run()},
 put:async(id,v,s)=>(await db.prepare('UPDATE workspaces SET revision=revision+1,payload=? WHERE id=? AND revision=?').bind(JSON.stringify(s),id,v).run()).meta.changes===1
 };
}
const OWNERS=['Уповноважений з доброчесності','Навчальний відділ','Робоча група','Служба внутрішнього контролю'];
export {OWNERS};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const validText=(v,max)=>typeof v==='string'&&v.trim().length>1&&v.trim().length<=max;
const sha=async val=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(val))),b=>b.toString(16).padStart(2,'0')).join('');
export async function handle(req,db,config={mode:'demo'}){
 const url=new URL(req.url), name=url.pathname.split('/api/v1/')[1], post=req.method==='POST';
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 const output=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 try{
  if(!['GET','POST'].includes(req.method))fail('Метод недоступний.',405);
  if(post&&req.headers.get('origin')&&req.headers.get('origin')!==url.origin)fail('Дія доступна лише з цього сайту.',403);
  if(post&&!req.headers.get('content-type')?.startsWith('application/json'))fail('Очікується JSON.',415);
  const txt=post?await req.text():'';
  if(txt.length>12000)fail('Завеликий запит.',413);
  let b={};try{b=txt?JSON.parse(txt):{}}catch{fail('Невірний формат JSON.')}
  if(!b||typeof b!=='object'||Array.isArray(b))fail('Очікується об’єкт.');
  const cookies=Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=')));
  let [wid,token]=(config.localSession?.value??cookies.vector??'').split('.');
  const setSession=(id,t)=>{
   if(config.localSession){config.localSession.value=id+'.'+t;return}
   headers['Set-Cookie']='vector='+id+'.'+t+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000'+(url.protocol==='https:'?'; Secure':'')};
  if(name==='invite-info'||name==='answer'){
   if(!post)fail('Потрібен POST.',405);
   [wid,token]=String(b.invitation||'').split('.');
   if(!wid||!token)fail('Запрошення недійсне.',404);
  }
  if(name==='login'&&post&&config.mode==='team'){
   if(!Object.hasOwn(ROLES,b.role)||b.role==='member'||!config.keys?.[b.role]||b.code!==config.keys[b.role])fail('Доступ не підтверджено.',403);
   wid='institution';await db.add(wid,seed());const s=JSON.parse((await db.get(wid)).payload);setSession(wid,s.tokens[b.role]);return output({ok:true});
  }
  if(name==='start'&&post&&config.mode==='demo'&&!wid){
   wid=key();const s=seed();await db.add(wid,s);setSession(wid,s.owner);return output({ok:true});
  }
  const entry=wid?await db.get(wid):null;
  if(!entry)fail('Потрібно відкрити робочий простір.',401);
  const s=JSON.parse(entry.payload);
  const demoOwner=config.mode==='demo'&&(token===s.owner||Object.values(s.demoTokens||{}).includes(token));
  const role=!token?null:token===s.owner?'lead':Object.keys(ROLES).find(r=>token===s.tokens[r]||token===s.demoTokens?.[r]);
  const invitationRoute=['answer','invite-info'].includes(name);
  if(!invitationRoute&&!role)fail('Сеанс недоступний.',401);
  const can=(...roles)=>{if(!roles.includes(role))fail('Ця дія недоступна для поточної ролі.',403)};
  const save=async()=>{if(!await db.put(wid,entry.revision,s))fail('Дані змінилися в іншій вкладці. Повторіть дію.',409)};
  if(name==='demo-example'&&post){
   if(!demoOwner||s.returnTo)fail('Окремий приклад уже відкрито або недоступний.',403);
   const fresh=seed(),id=key();fresh.returnTo={id:wid,credential:token};
   await db.add(id,fresh);setSession(id,fresh.owner);return output({ok:true});
  }
  if(name==='demo-return'&&post){
   if(!demoOwner||!s.returnTo)fail('Основний простір недоступний.',403);
   setSession(s.returnTo.id,s.returnTo.credential);return output({ok:true});
  }
  if(name==='start'&&post)return output({ok:true});
  if(name==='state'&&!post)return output({...summary(s,role),mode:config.mode,hosted:!!config.hosted,demoOwner,inExample:demoOwner&&!!s.returnTo,criteria:CRITERIA,questions:QUESTIONS,owners:OWNERS});
  if(name==='role'&&post){
   if(!demoOwner||!Object.hasOwn(ROLES,b.role))fail('Перемикання доступне у демонстрації.',403);
   s.demoTokens??={lead:key(),officer:key(),member:key()};await save();setSession(wid,s.demoTokens[b.role]);return output({ok:true});
  }
  if(name==='report.csv'&&!post){
   can('officer','lead');
   const c=s.cycles.find(x=>x.id===Number(url.searchParams.get('cycle'))&&x.closed);if(!c)fail('Немає оприлюдненого звіту.',404);
   const r=report(c),v=x=>x==null?'н/д':x.toFixed(1).replace('.',',');
   const rows=[['Цикл',c.name],['Індекс',v(r.index)],['Компонент','Курсанти','Викладачі','Опитування','Експерт','Перевірка','Бал'],...r.rows.map(x=>[x.label,v(x.groups.cadets),v(x.groups.staff),v(x.survey),v(x.expert),v(x.fact),v(x.score)])];
   rows.push([],['Профіль практик','Курсанти','Викладачі','Середній бал','Висновок']);
   for(const q of r.practices)rows.push([q.title,v(q.groups.cadets),v(q.groups.staff),v(q.score),q.label]);
   const cell=x=>'"'+String(/^[=+@-]/.test(String(x))?"'"+x:x).replaceAll('"','""')+'"';
   return new Response('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="integrity-report.csv"'}});
  }
  if(!post)fail('Невідомий маршрут.',404);
  if(invitationRoute){
   const hash=await sha(token), inv=s.invites[hash], c=inv&&s.cycles.find(x=>x.id===inv.cycle);
   if(!c||c.closed)fail('Запрошення використано або цикл завершено.',410);
   if(name==='invite-info')return output({cycle:c.name,group:GROUPS[inv.group],k:c.k,criteria:CRITERIA,
    questions:inv.version===2?QUESTIONS:QUESTIONS.filter(q=>q.anchor)});
   submit(c,inv.group,b.answers,inv.version??1);delete s.invites[hash];await save();
   return output({ok:true,latest:summary(s,'member').cycles.at(-1),group:inv.group});
  }
  if(name==='cycle'){
   can('officer');if(s.cycles.some(c=>!c.closed))fail('Спочатку завершіть відкритий цикл.');
   if(!validText(b.name,45)||!Number.isInteger(b.k)||b.k<5||b.k>50)fail('Вкажіть назву та поріг від 5 до 50.');
   s.cycles.push(emptyCycle(s.cycles.at(-1).id+1,b.name.trim(),b.k));audit(s,role,'Відкрито цикл «'+b.name.trim()+'»');
  }else if(['issue','inputs','confirm','close'].includes(name)){
   const c=s.cycles.find(x=>x.id===b.cycle&&!x.closed);if(!c)fail('Відкритий цикл не знайдено.',404);
   if(name==='issue'){
    if(!demoOwner)can('officer');
    if(!Object.hasOwn(GROUPS,b.group))fail('Невідома категорія.');
    const fresh=key();s.invites[await sha(fresh)]={group:b.group,cycle:c.id,version:b.version===2?2:1};await save();return output({invitation:wid+'.'+fresh});
   }
   if(name==='inputs'){
    can('officer');if(!Array.isArray(b.expert)||b.expert.length!==3||!b.expert.every(v=>[0,25,50,75,100].includes(v))||!Array.isArray(b.facts)||b.facts.length!==3||!b.facts.every(f=>f&&Number.isSafeInteger(f.a)&&Number.isSafeInteger(f.b)&&f.b>0&&f.a>=0&&f.a<=f.b&&f.b<=1000000))fail('Перевірте оцінки та чисельники/знаменники.');
    c.expert=b.expert;c.facts=b.facts.map(({a,b})=>({a,b}));c.confirmed=false;audit(s,role,'Внесено експертні й документальні показники · '+c.name);
   }
   if(name==='confirm'){can('lead');if(c.expert.some(x=>x===null)||c.facts.some(x=>!x))fail('Спочатку внесіть усі показники.');c.confirmed=true;audit(s,role,'Підтверджено джерела · '+c.name)}
   if(name==='close'){
    can('lead');if(!c.confirmed)fail('Спочатку підтвердьте джерела.');
    if(!Object.values(c.groups).some(g=>g.n>=c.k))fail('Жодна група не досягла порога анонімності.');
    c.closed=true;for(const [t,inv] of Object.entries(s.invites))if(inv.cycle===c.id)delete s.invites[t];
    audit(s,role,'Опубліковано підсумки · '+c.name);
   }
  }else if(name==='measure'){
   can('lead');const c=s.cycles.find(x=>x.id===b.cycle&&x.closed),r=c&&report(c).rows[b.criterion];
   const practice=b.questionId&&c?report(c).practices.find(q=>q.id===b.questionId&&q.component===b.criterion):null;
   if(b.questionId?!practice:!r)fail('Оберіть практику або показник для заходу.');
   if(s.actions.some(a=>a.cycle===c.id&&a.criterion===b.criterion&&(a.questionId??null)===(b.questionId??null)))fail('Захід уже прийнято.',409);
   if(!validText(b.text,320)||!OWNERS.includes(b.owner)||!/^\d{4}-\d{2}-\d{2}$/.test(b.due)||!Number.isFinite(Date.parse(b.due))||new Date(b.due).toISOString().slice(0,10)!==b.due)fail('Заповніть захід, відповідального та строк.');
   s.actions.push({id:key(),cycle:c.id,criterion:b.criterion,questionId:practice?.id,afterCycle:s.cycles.filter(x=>x.closed).at(-1).id,baseline:practice?.score??r.score,text:b.text.trim(),owner:b.owner,due:b.due,status:'Заплановано'});audit(s,role,'Прийнято захід · '+(practice?.title??r.title));
  }else if(name==='status'){
   can('lead','officer');const a=s.actions.find(x=>x.id===b.id);if(!a||!['Заплановано','У роботі','Виконано'].includes(b.status))fail('Невідомий захід або статус.');
   a.status=b.status;audit(s,role,'Змінено статус заходу · '+b.status);
  }else fail('Невідомий маршрут.',404);
  await save();return output({ok:true});
 }catch(e){return output({error:e.status||e.message==='Перевірте відповіді анкети.'?e.message:'Сервіс тимчасово недоступний.'},e.status||(e.message==='Перевірте відповіді анкети.'?400:500))}
}

