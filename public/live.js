import {sections,renderSection,managerCsv} from './manager.mjs?v=10';
import {saveLocalPlan,mergeLocalPlans,changeLocalStatus} from './manager-store.mjs?v=1';
const root=document.querySelector('#room');
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=new URL(location.href);
const base=document.querySelector('meta[name="vektor-base"]')?.content||'';
const backend=document.querySelector('meta[name="vektor-api"]')?.content||'';
const link=path=>base+path+(base&&path!=='/'?'/':'');
let managerToken='',ballotToken='';
const ballotKey='vektor-ballot:'+base+':'+backend;
const planKey='vektor-manager-actions-v1:'+base+':'+backend;
if(backend){try{ballotToken=localStorage.getItem(ballotKey)||''}catch{}}
const route=url.pathname.slice(base.length).replace(/\/index\.html$/,'').replace(/\/$/,'');
let info,step=0,reviewBack=0,selectedProposal='',variant='original',answers=[],group='',sending=false,shared=false,lastDashboard='',lastState=null,rawManagerState=null,refreshing=false,started=false;
async function api(name,body){
  const options=body===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)};
  if(backend){
    options.credentials='omit';options.headers??={};
    const token=['state','plan','status','logout'].includes(name)?managerToken:['start','answer'].includes(name)?ballotToken:'';
    if(token&&name!=='login')options.headers.Authorization='Bearer '+token;
  }
  const response=await fetch(backend+'/api/v1/live-'+name,options);
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error||'Помилка зв’язку.'),{status:response.status});
  if(backend&&data.credential){
    if(name==='login')managerToken=data.credential;
    if(name==='start'){ballotToken=data.credential;try{localStorage.setItem(ballotKey,ballotToken)}catch{}}
  }
  if(name==='logout')managerToken='';
  return data;
}
function errorText(e){
  let target=document.querySelector('#notice');
  if(!target){target=document.createElement('p');target.id='notice';target.setAttribute('role','alert');root.append(target)}
  target.textContent=e.status?e.message:'Не вдалося з’єднатися. Перевірте інтернет і повторіть дію.';
}
function landing(){
  root.innerHTML=`<div class="front"><section class="intro"><span class="overline">Спільне оцінювання</span><h1>Доброчесність<br>на практиці</h1><p>Як працюють правила, консультації та канали повідомлення? Оцініть модельну установу на прикладі навчальної або робочої ситуації.</p><a class="btn lime" href="${link('/survey')}">Пройти анкету</a><small>12 основних запитань і 3 ситуації за бажанням · без реєстрації</small></section><section class="guide"><span class="overline">Анкета охоплює</span><h2>Три складові доброчесності</h2>${[['Культура','Навчання та практичні вправи'],['Система','Консультації та розподіл відповідальності'],['Підзвітність','Канали повідомлення та зворотний зв’язок']].map(([t,v],i)=>`<div class="topic"><i class="t${i}"></i><div><b>${t}</b><p>${v}</p></div></div>`).join('')}</section></div><section class="lower"><div><h2>Перегляд результатів</h2><p>Керівник бачить, скільки анкет надійшло, які пропозиції передали учасники та як змінюються групові бали.</p></div><a class="btn" href="${link('/manager')}">Кабінет керівника</a></section><section class="lower videoDemo"><div><h2>Як працюють «Воробці»</h2><p>Від відповіді учасника до плану керівника. Конкурсна презентація з анімованими сценами та українським голосовим супроводом.</p><a class="btn dark" href="${base}/presentation.html" style="margin-top:12px">▶ Дивитися конкурсну презентацію</a></div><video controls playsinline preload="none" poster="${base}/demo-poster.jpg" aria-label="Демонстрація сайту Воробці"><source src="${base}/demo.mp4" type="video/mp4"></video><a class="btn" href="${base}/demo.mp4" download="vorobtsi.mp4">Завантажити відео</a></section>`;
}
function surveyIntro(){
  root.innerHTML=`<section class="card narrow"><span class="overline">Спільна анкета</span><h1>Анонімне оцінювання</h1><p>Спочатку дайте відповідь на 12 основних запитань. Потім, за бажанням, розберіть три короткі ситуації. Не вводьте персональних або службових відомостей. Усі учасники за цим посиланням долучаються до одного збору.</p><form id="start"><label>Категорія учасника<select name="group" required><option value="">Оберіть категорію</option>${Object.entries(info.groups).map(([id,n])=>`<option value="${id}">${safe(n)}</option>`).join('')}</select></label><p class="note">Керівник бачить кількість анкет. Групові бали відкриваються порціями по ${info.minimum} змістовних відповідей на запитання. Наприкінці можна окремо передати пропозицію.</p><button class="btn dark">Розпочати анкету</button><p id="notice" role="alert"></p></form></section>`;
}
function question(){
  const q=info.questions[step];
  root.innerHTML=`<section class="card narrow"><span class="overline">${safe(info.criteria[q.component])}</span><div class="progress"><span>${q.optional?'Ситуація '+(step-info.requiredCount+1)+' із '+(info.questions.length-info.requiredCount)+' · за бажанням':'Запитання '+(step+1)+' із '+info.requiredCount}</span><progress value="${step+1}" max="${q.optional?info.questions.length:info.requiredCount}"></progress></div><form id="question"><fieldset><legend tabindex="-1">${safe(q.question)}</legend>${[...q.options,'Не можу оцінити'].map((v,i)=>`<label class="option"><input type="radio" name="choice" value="${i}" required ${answers[step]===i?'checked':''}>${safe(v)}</label>`).join('')}</fieldset><div class="tools">${step?'<button type="button" class="btn" data-action="back">Назад</button>':''}<button class="btn dark">${step+1===info.questions.length?'Переглянути висновок':step+1===info.requiredCount?'Перейти до ситуацій':'Далі'}</button>${q.optional?'<button type="button" class="btn" data-action="skip">Пропустити цю й наступні ситуації</button>':''}</div></form></section>`;
  root.querySelector('legend').focus({preventScroll:true});
}
function candidates(){
  return info.questions.map((q,i)=>({q,score:answers[i]})).filter(row=>Number.isInteger(row.score)&&row.score<3)
    .sort((a,b)=>a.score-b.score||Number(!!b.q.optional)-Number(!!a.q.optional));
}
function suggested(){
  const list=candidates();
  return (list.find(row=>row.q.id===selectedProposal)||list[0])?.q;
}
function choices(q){
  return {original:q.action,low:q.tips[0],mid:q.tips[2],high:q.tips[4]};
}
function personalDetails(){
  return info.criteria.map((title,component)=>{
    const relevant=info.questions.map((item,i)=>({item,score:answers[i]})).filter(x=>x.item.component===component&&Number.isInteger(x.score)&&x.score<5);
    relevant.sort((a,b)=>a.score-b.score);
    const lowest=relevant[0];
    return `<article><h3>${safe(title)}</h3><p>${lowest?`${safe(lowest.item.title)} · ${safe(lowest.item.options[lowest.score])}.`:'Ви пропустили оцінку всіх практик цієї складової.'}</p>${lowest?`<p><b>Що допоможе.</b> ${safe(lowest.item.tips[lowest.score])}</p>`:''}</article>`;
  }).join('');
}
function review(){
  const options=candidates(),q=suggested(),valid=answers.filter(n=>n<5).length;
  const details=personalDetails();
  root.innerHTML=`<section class="card narrow"><span class="overline">Перед надсиланням</span><h1>Підсумок анкети</h1><p>${q?'За відповідями можна запропонувати таке поліпшення.':valid?'У практиках, які ви змогли оцінити, ви відзначили високий рівень.':'Ви обрали «Не можу оцінити» для всіх запитань. Анкету буде враховано в лічильнику участі.'}</p>${q?`<div class="insight">${options.length>1?`<label>Яку практику хочете поліпшити?<select id="proposal-choice">${options.map(({q:item})=>`<option value="${safe(item.id)}" ${q.id===item.id?'selected':''}>${safe(item.title)}</option>`).join('')}</select></label>`:`<h2>${safe(q.title)}</h2>`}<label class="proposalChoice">Яку дію запропонувати керівникові?<select id="proposal-variant">${Object.entries(choices(q)).map(([id,action])=>`<option value="${id}" ${id===variant?'selected':''}>${safe(action)}</option>`).join('')}</select></label><p>${safe(choices(q)[variant])}</p></div>`:''}<details class="personal"><summary>Мій результат за трьома складовими</summary>${details}</details><form id="send">${q?`<label class="optin"><input type="checkbox" name="share" ${shared?'checked':''}>Передати керівникові цю пропозицію без мого імені</label><p class="hint">У кабінеті з’являться текст пропозиції й кількість учасників, які її підтримали. Ваші окремі відповіді та бали залишаються прихованими.</p>`:''}<div class="tools"><button type="button" class="btn" data-action="back">Назад</button><button class="btn dark">Надіслати анкету</button></div><p id="notice" role="alert"></p></form></section>`;
}
function receipt(repeat=false){
  root.innerHTML=`<section class="card narrow receipt"><span class="tick" aria-hidden="true">✓</span><h1>${repeat?'Анкету вже враховано':'Анкету враховано'}</h1><p>${repeat?'З цього браузера вже надіслано анкету до спільного збору.':'Лічильник у кабінеті керівника оновлено.'} ${!repeat&&shared?'Вашу пропозицію також передано керівникові.':''}</p>${!repeat&&answers.length?'<details class="personal"><summary>Мій результат за трьома складовими</summary>'+personalDetails()+'</details>':''}<a class="btn" href="${link('/')}">На головну</a></section>`;
}
function login(){
  started=false;lastDashboard='';lastState=null;
  root.innerHTML=`<section class="card narrow"><span class="overline">Спільне оцінювання</span><h1>Кабінет керівника</h1><p>Введіть приватний ключ для перегляду відповідей і роботи з пропозиціями.</p><form id="login"><label>Ключ керівника<input name="key" type="password" autocomplete="current-password" required></label><button class="btn dark">Відкрити кабінет</button><p id="notice" role="alert"></p></form></section>`;
}
function manager(){
  started=true;lastDashboard='';
  root.innerHTML=`<div class="managerHead"><div><span class="overline">Спільне оцінювання</span><h1>Кабінет керівника</h1></div><button class="btn" data-action="logout">Вийти</button></div><div class="share"><div><b>Посилання для всіх учасників</b><a id="survey-link" href="${link('/survey')}">Воробці — пройти анкету</a></div><div class="shareActions"><button class="btn" data-action="copy">Скопіювати посилання</button><a class="btn" download="vorobtsi-qr.png" href="${base}/vorobtsi-qr.png">Завантажити QR</a></div></div><p id="sync" role="status">Завантаження результатів…</p><nav id="manager-nav" class="managerNav" aria-label="Розділи кабінету"></nav><div id="figures"></div><p id="notice" role="alert"></p><dialog aria-labelledby="plan-title"><form id="plan"><h2 id="plan-title">Новий захід у плані</h2><p class="hint">Оберіть практику та сформулюйте рішення, яке можна перевірити.</p><label>Практика<select name="id" id="plan-practice" required></select></label><label>Захід<textarea name="action" id="plan-action" minlength="2" maxlength="320" rows="3" required></textarea></label><label>Ознака виконання<textarea name="verify" id="plan-verify" minlength="2" maxlength="320" rows="2" required></textarea></label><label>Відповідальний підрозділ<select name="owner"><option>Уповноважений з доброчесності</option><option>Навчальний відділ</option><option>Робоча група</option></select></label><label>Строк виконання<input type="date" name="due" required></label><div class="tools"><button class="btn" data-action="cancel" type="button">Скасувати</button><button class="btn dark" type="submit" data-action="save-plan">Зберегти захід</button></div><p class="planError" role="alert"></p></form></dialog>`;
}
let practiceFilter='all';
function results(s){
  const route=location.hash.slice(1);
  const section=Object.hasOwn(sections,route)?route:'overview';
  const figures=root.querySelector('#figures');
  const expanded=[...figures.querySelectorAll('details[open]')].map(el=>el.dataset.question);
  root.querySelector('#manager-nav').innerHTML=Object.entries(sections).map(([id,name])=>`<a href="#${id}" ${id===section?'aria-current="page"':''}>${name}</a>`).join('');
  figures.innerHTML=renderSection(s,info,section,practiceFilter);
  for(const item of figures.querySelectorAll('details'))item.open=expanded.includes(item.dataset.question);
}
window.addEventListener('hashchange',()=>{if(started&&lastState)results(lastState)});
function downloadCsv(){
  const objectUrl=URL.createObjectURL(new Blob([managerCsv(lastState,info)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=objectUrl;a.download='vorobtsi-results.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
async function refresh(){
  if(refreshing||!started||document.hidden)return;
  refreshing=true;
  try{
    rawManagerState=await api('state');if(!started)return;
    const s=mergeLocalPlans(rawManagerState,localStorage,planKey);
    const serialized=JSON.stringify(s);
    if(serialized!==lastDashboard){lastState=s;lastDashboard=serialized;results(s)}
    document.querySelector('#sync').textContent='Оновлено о '+new Date().toLocaleTimeString('uk-UA')+' · автоматично кожні 5 с';
  }catch(e){if(!started)return;if(e.status===401)login();else document.querySelector('#sync').textContent='Зв’язок перервано. Наступна спроба через 5 с.'}
  finally{refreshing=false}
}
root.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  const action=button.dataset.action;
  if(action==='print')window.print();
  if(action==='csv'&&lastState)downloadCsv();
  if(action==='back'){
    if(sending)return;
    step=step===info.questions.length?reviewBack:step-1;
    shared=false;question();
  }
  if(action==='skip'&&!sending&&info.questions[step]?.optional){
    reviewBack=step;answers.fill(5,step);selectedProposal='';variant='original';shared=false;step=info.questions.length;review();
  }
  if(action==='cancel')root.querySelector('dialog')?.close();
  if(action==='logout'){try{await api('logout',{});login()}catch(err){errorText(err)}}
  if(action==='copy'){
    const link=document.querySelector('#survey-link');
    try{
      const item=new ClipboardItem({'text/html':new Blob([link.outerHTML],{type:'text/html'}),'text/plain':new Blob([link.href],{type:'text/plain'})});
      await navigator.clipboard.write([item]);button.textContent='Скопійовано';
    }catch{
      try{await navigator.clipboard.writeText(link.href);button.textContent='Скопійовано'}
      catch{
        let field=document.querySelector('#manual-copy');
        if(!field){field=document.createElement('input');field.id='manual-copy';field.readOnly=true;field.setAttribute('aria-label','Адреса для копіювання');link.after(field)}
        field.value=link.href;field.select();button.textContent='Скопіюйте виділену адресу';
      }
    }
  }
  if((button.hasAttribute('data-plan')||button.hasAttribute('data-plan-new'))&&lastState){
    const form=root.querySelector('#plan');
    const available=lastState.practices.filter(q=>!lastState.proposals.some(p=>p.id===q.id&&p.plan));
    if(!available.length){errorText(new Error('Усі практики вже мають заходи у плані.'));return}
    form.reset();form.querySelector('.planError').textContent='';
    const select=form.elements.id;
    select.innerHTML=available.map(q=>`<option value="${safe(q.id)}">${safe(q.title)}</option>`).join('');
    select.value=available.some(q=>q.id===button.dataset.plan)?button.dataset.plan:available[0].id;
    const item=available.find(q=>q.id===select.value);
    form.elements.action.value=item.action;form.elements.verify.value=item.verify;
    const due=new Date();due.setDate(due.getDate()+30);form.elements.due.value=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
    if(!info.manualMeasures){const note=form.querySelector('.planError');note.textContent='Поки сервер не оновлено, цей захід збережеться у вашому браузері. Інші пристрої його не бачитимуть.';note.setAttribute('role','status')}
    root.querySelector('dialog').showModal();
  }
});
// Показуємо причину блокування відправлення, якщо браузер виявив незаповнене поле.
root.addEventListener('invalid',e=>{
  const control=e.target;
  if(!control.closest?.('form#plan'))return;
  const msg=root.querySelector('#plan .planError');
  if(msg){
    const label=control.closest('label')?.childNodes[0]?.textContent?.trim()||'потрібне поле';
    msg.textContent='Перевірте поле «'+label+'»: заповніть його коректно, щоб зберегти захід.';
    msg.setAttribute('role','alert');
  }
},true);
root.addEventListener('submit',async e=>{
  e.preventDefault();if(sending)return;
  const form=e.target,fields=new FormData(form),button=e.submitter;
  sending=true;if(button)button.disabled=true;
  try{
    if(form.getAttribute('id')==='start'){group=fields.get('group');const r=await api('start',{});if(r.submitted)receipt(true);else{step=0;answers=Array(info.questions.length).fill(null);shared=false;selectedProposal='';variant='original';question()}}
    if(form.getAttribute('id')==='question'){answers[step]=Number(fields.get('choice'));reviewBack=step;step++;shared=false;selectedProposal='';variant='original';if(step===info.questions.length)review();else question()}
    if(form.getAttribute('id')==='send'){
      shared=fields.has('share');const q=suggested();
      const result=await api('answer',{answers:answers.map(v=>v===5?null:v),group,proposal:shared&&q?q.id:null,variant:shared&&q?variant:null});
      receipt(!!result.existing);answers=[];
    }
    if(form.getAttribute('id')==='login'){await api('login',{key:fields.get('key')});form.reset();manager();await refresh()}
    if(form.getAttribute('id')==='plan'){
      const payload=Object.fromEntries(fields);
      let resultText='';
      if(info.manualMeasures){
        const response=await api('plan',payload);
        rawManagerState=await api('state');
        const saved=rawManagerState.proposals.find(p=>p.id===payload.id)?.plan;
        if(!saved)throw Error('Сервер не підтвердив збереження заходу.');
        if(saved.action!==payload.action.trim()||saved.verify!==payload.verify.trim())throw Error('Сервер зберіг інше формулювання. Перевірте запис у плані.');
        resultText=response.existing?'Цей захід уже був у спільному плані.':'Захід збережено на сервері ✓';
      }else{
        saveLocalPlan(localStorage,planKey,payload,lastState.practices);
        resultText='Захід збережено в цьому браузері ✓ · для спільного збереження необхідне оновлення сервера.';
      }
      lastState=mergeLocalPlans(rawManagerState||await api('state'),localStorage,planKey);
      lastDashboard=JSON.stringify(lastState);
      root.querySelector('dialog').close();
      location.hash='plan';
      results(lastState);
      const notice=root.querySelector('#notice');if(notice){notice.textContent=resultText;notice.setAttribute('role','status')}
    }
  }catch(err){if(form.getAttribute('id')==='plan'){const error=form.querySelector('.planError');error.textContent=err.message;error.setAttribute('role','alert')}else errorText(err)}
  finally{sending=false;if(button)button.disabled=false}
});
root.addEventListener('change',async e=>{
  const el=e.target;
  if(el.id==='plan-practice'&&lastState){const item=lastState.practices.find(q=>q.id===el.value),form=root.querySelector('#plan');if(item){form.elements.action.value=item.action;form.elements.verify.value=item.verify}}
  if(el.name==='choice')answers[step]=Number(el.value);
  if(el.id==='proposal-choice'){selectedProposal=el.value;variant='original';shared=false;review();root.querySelector('#proposal-choice')?.focus()}
  if(el.id==='proposal-variant'){variant=el.value;shared=false;review();root.querySelector('#proposal-variant')?.focus()}
  if(el.id==='practice-filter'&&lastState){practiceFilter=el.value;results(lastState);root.querySelector('#practice-filter')?.focus()}
  if(el.dataset.status){
    el.disabled=true;
    try{
      const local=lastState?.proposals.find(p=>p.id===el.dataset.status)?.plan?.localOnly;
      if(local){
        changeLocalStatus(localStorage,planKey,el.dataset.status,el.value);
        lastState=mergeLocalPlans(rawManagerState,localStorage,planKey);
        lastDashboard=JSON.stringify(lastState);results(lastState);
        const notice=root.querySelector('#notice');if(notice){notice.textContent='Статус локального заходу збережено в браузері ✓';notice.setAttribute('role','status')}
      }else{
        await api('status',{id:el.dataset.status,status:el.value});
        await refresh();
      }
    }
    catch(err){if(lastState)results(lastState);errorText(err)}
    finally{el.disabled=false}
  }
});
async function boot(){
  if(!route&&location.hash){
    if(location.hash==='#survey'||location.hash==='#manager'){location.replace(link('/'+location.hash.slice(1)));return}
    if(/^#(invite=|overview$|chart$|profile$|cycles$|actions$|report$|method$|audit$)/.test(location.hash)){location.replace(link('/demo')+location.hash);return}
  }
  if(!route){landing();return}
  info=await api('info');
  if(route==='/survey'){surveyIntro();return}
  if(route==='/manager'){
    try{rawManagerState=await api('state');manager();const state=mergeLocalPlans(rawManagerState,localStorage,planKey);results(state);lastState=state;lastDashboard=JSON.stringify(state);document.querySelector('#sync').textContent='Поточні дані · автоматичне оновлення кожні 5 с'}
    catch(e){if(e.status===401)login();else throw e}
    setInterval(refresh,5000);document.addEventListener('visibilitychange',refresh);return
  }
  landing();
}
boot().catch(errorText);
