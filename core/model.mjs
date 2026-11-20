import {fullSurvey,practiceResult} from './questionnaire.mjs';
export const GROUPS = {cadets:'Курсанти', staff:'Викладачі'};
export const ROLES = {lead:'Керівник', officer:'Уповноважений', member:'Учасник'};
export const CRITERIA = [
 {id:'culture',label:'Культура',title:'Навчання доброчесності',question:'Як у закладі навчають діяти в ситуаціях корупційного ризику?',options:['Навчання відсутнє','Поодинокі заняття','Є план і регулярні заняття','Практичні заняття та перевірка знань','Програму оновлюють за результатами оцінювання'],fact:'Проведені заняття / заплановані заняття',ref:'Б, п. 2.6, с. 27–28 · В, розд. 1, с. 54, 60–61',action:'Перевірити доступність практичних занять і скоригувати план навчання.'},
 {id:'system',label:'Система',title:'Робота уповноваженого',question:'Наскільки системно працює антикорупційна функція закладу?',options:['Функцію не визначено','Є призначена особа','Є план і визначені повноваження','Виконання плану регулярно перевіряють','План коригують за результатами перевірок'],fact:'Виконані заходи / передбачені планом',ref:'Б, пп. 2.1, 2.4–2.5, с. 26–27 · В, розд. 2, с. 55–56, 61–62',action:'Переглянути виконання плану роботи уповноваженого та повідомити персоналу результати.'},
 {id:'account',label:'Підзвітність',title:'Канали повідомлення',question:'Як у закладі працюють канали повідомлення про корупцію?',options:['Канали мені невідомі','Знаю, що канал існує','Знаю, куди і як звернутися','Знаю також порядок розгляду та захисту','Практику перевіряють і вдосконалюють'],fact:'Успішні тестові перевірки каналів / усі заплановані перевірки',ref:'Б, п. 2.7, с. 28–29 · В, розд. 3, с. 57–58, 63–64',action:'Показати персоналу, як скористатися каналом повідомлення, і перевірити обізнаність у наступному циклі.'}
];
export const QUESTIONS=fullSurvey(CRITERIA);
export const SRC='https://nuou.org.ua/assets/documents/recommendations_transform_dobrochesnist.pdf';
export const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
export const level = n => n==null?'Недостатньо даних':n<20?'Початковий':n<40?'Базовий':n<60?'Становлення':n<80?'Визначений':'Розвинений';
const unique = () => crypto.randomUUID().replaceAll('-','');
export const key = () => unique()+unique().slice(0,16);
export const emptyGroup=()=>({n:0,valid:[0,0,0],sum:[0,0,0]});
export function emptyCycle(id,name,k){
 return {id,name,k,closed:false,groups:{cadets:emptyGroup(),staff:emptyGroup()}, expert:[null,null,null], facts:[null,null,null], confirmed:false};
}
function mockCycle(i,name,cadets,staff,experts,docs,n,k=7){
 const c=emptyCycle(i,name,k);
 for (const [g,means] of Object.entries({cadets,staff})){
  const size=g==='cadets'?n:Math.round(n*.62);
  c.groups[g]={n:size,valid:[size,size,size],sum:means.map(v=>Math.round(v*size/25))};
 }
 // Синтетичні групові оцінки додаткових питань є частиною нового демонабору.
 const offsets=[[5,-13,-5],[4,-8,3],[-17,8,-4]];
 for(const [group,means] of Object.entries({cadets,staff})){
  const b=c.groups[group]; b.extra={};
  let slot=0;
  for(const q of QUESTIONS.filter(q=>!q.anchor)){
   const offset=offsets[q.component][slot++%3];
   const groupOffset=q.id==='practice'&&group==='staff'?22:0;
   const score=Math.min(100,Math.max(0,means[q.component]+offset+groupOffset));
   b.extra[q.id]={valid:b.n,sum:Math.round(score*b.n/25)};
  }
 }
 c.expert=experts;c.facts=docs.map(v=>({a:v,b:100}));c.confirmed=true;c.closed=true;
 return c;
}
export function seed(){
 const cycles=[
 mockCycle(1,'Листопад 2025',[48,44,31],[51,50,40],[50,50,50],[56,53,65],52),
 mockCycle(2,'Лютий 2026',[60,54,42],[59,52,45],[50,75,50],[68,69,70],60),
 mockCycle(3,'Травень 2026',[65,58,44],[69,66,46],[75,75,50],[90,72,75],65),
 mockCycle(4,'Серпень 2026',[72,66,50],[77,70,53],[75,75,75],[82,77,80],70),
 mockCycle(5,'Листопад 2026',[81,76,41],[85,79,50],[75,75,75],[90,82,90],84),
 mockCycle(6,'Грудень 2026',[82,77,56],[85,80,62],[75,75,75],[93,84,90],17)];
 cycles.at(-1).closed=false;
 const baseline=report(cycles[2]).rows[0].score;
 const actions=[{id:'demo-training-may',cycle:3,criterion:0,baseline,text:'Додати практичний розбір ситуацій до занять із доброчесності.',owner:'Навчальний відділ',due:'2026-07-31',status:'Виконано'}];
 const audit=[{date:'2026-05-28',role:'lead',text:'Прийнято захід щодо практичних занять · Травень 2026'},{date:'2026-07-30',role:'officer',text:'Оновлено статус навчального заходу · Виконано'}];
 return {tokens:{lead:key(),officer:key(),member:key()},owner:key(),cycles,invites:{},actions,audit};
}
export function submit(c,g,answers,version=1){
 const questions=version===2?QUESTIONS:QUESTIONS.filter(q=>q.anchor);
 if(!Object.hasOwn(GROUPS,g)||!Array.isArray(answers)||answers.length!==questions.length||
    answers.some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>4)))throw Error('Перевірте відповіді анкети.');
 const bucket=c.groups[g];bucket.n++;
 answers.forEach((v,i)=>{
  if(v===null)return;
  const question=questions[i];
  if(question.anchor){
   bucket.valid[question.component]++;bucket.sum[question.component]+=v;
  }else{
   bucket.extra??={};
   const counts=bucket.extra[question.id]??={valid:0,sum:0};
   counts.valid++;counts.sum+=v;
  }
 });
}
function questionReport(c,q){
 const groups=Object.fromEntries(Object.entries(c.groups).map(([group,b])=>{
  const counts=q.anchor?{valid:b.valid[q.component],sum:b.sum[q.component]}:b.extra?.[q.id];
  return [group,c.closed&&counts&&counts.valid>=c.k?25*counts.sum/counts.valid:null];
 }));
 return {id:q.id,component:q.component,title:q.title,anchor:q.anchor,groups,...practiceResult(groups)};
}
export function report(c){
 const rows=CRITERIA.map((item,i)=>{
  const groups=Object.fromEntries(Object.entries(c.groups).map(([g,b])=>[g,c.closed&&b.valid[i]>=c.k?b.sum[i]*25/b.valid[i]:null]));
  const survey=avg(Object.values(groups).filter(x=>x!==null));
  const expert=c.closed&&c.confirmed?c.expert[i]:null, f=c.closed&&c.confirmed?c.facts[i]:null;
  const fact=f&&f.b>0?f.a*100/f.b:null;
  const score=[survey,expert,fact].every(x=>x!==null)?survey*.4+expert*.3+fact*.3:null;
  const gap=survey!==null&&fact!==null?Math.abs(fact-survey):null;
  return {...item,groups,survey,expert,fact,rawFact:f,score,gap,level:level(score),flag:score!==null&&(gap>=20||score<60)};
 });
 const scores=rows.map(r=>r.score);
 const index=scores.every(n=>n!==null)?avg(scores):null;
 return {id:c.id,name:c.name,k:c.k,closed:c.closed,confirmed:c.confirmed,index,level:level(index),rows,practices:c.closed?QUESTIONS.map(q=>questionReport(c,q)):[],
  counts:Object.fromEntries(Object.entries(c.groups).map(([g,b])=>[g,b.n>=c.k?b.n:null]))};
}
export function summary(s,role){
 const cycles=s.cycles.map(report);
 const measures=s.actions.map(a=>{
  const measureScore=c=>a.questionId?c.practices.find(q=>q.id===a.questionId)?.score:c.rows[a.criterion].score;
  const next=cycles.find(c=>c.id>(a.afterCycle??a.cycle)&&c.closed&&Number.isFinite(measureScore(c)));
  return {...a,verification:next?{cycle:next.name,score:measureScore(next),delta:measureScore(next)-a.baseline}:null};
 });
 if(role==='member')return {role,cycles:cycles.filter(c=>c.closed).map(c=>({...c,rows:c.rows.map(({label,title,score,level,groups})=>({label,title,score,level,groups})),counts:undefined})),open:s.cycles.filter(c=>!c.closed).map(({id,name,k})=>({id,name,k}))};
 return {role,cycles,measures,audit:s.audit.slice(-100).reverse(),inputs:s.cycles.filter(c=>!c.closed).map(({id,expert,facts,confirmed})=>({id,expert,facts,confirmed}))};
}
export function audit(s,role,text){s.audit.push({date:new Date().toISOString().slice(0,10),role,text})}

