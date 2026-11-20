export const sections = {
  overview:'Огляд', priorities:'Пріоритети', questions:'Запитання',
  history:'Динаміка', plan:'План заходів', report:'Звіт'
};
const stages={planned:'Заплановано',active:'У роботі',done:'Виконано'};
const groups={cadets:'Курсанти',teachers:'Викладачі'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)?value.toLocaleString('uk-UA',{maximumFractionDigits:1}):'—';
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('.'):'—';
const votes=s=>s.proposals.reduce((sum,p)=>sum+p.votes,0);
const count=p=>Object.values(p.published).reduce((sum,n)=>sum+(n??0),0);
const concern=p=>['split','priority','forming'].includes(p.category);
const inPlan=(s,id)=>s.proposals.find(p=>p.id===id)?.plan;
const delta=(a,b)=>a==null||b==null?'—':(a>b?'+':'')+number(a-b);
function priorities(s){
  return s.practices.filter(p=>p.votes||concern(p)).sort((a,b)=>
    Number(concern(b))-Number(concern(a))||(a.score??101)-(b.score??101)||(b.gap??0)-(a.gap??0)||b.votes-a.votes);
}
function badge(p){
  return `<span class="badge b-${p.category}">${esc(p.label)}</span>`;
}
function why(p){
  if(p.score===null)return p.votes?'Учасники запропонували цей захід. Груповий бал з’явиться після досягнення порога.':'Для цього запитання ще триває збір групових відповідей.';
  if(p.category==='split'){
    const lower=p.groups.cadets<p.groups.teachers?'курсанти':'викладачі';
    return `Оцінки груп різняться на ${number(p.gap)} б. Нижчу оцінку дали ${lower}. Перевірте, чи обидві групи мають однаковий доступ до цієї практики.`;
  }
  const released=Object.entries(p.groups).filter(([,value])=>value!=null);
  const basis=released.length===1?'Оцінку оприлюднено для однієї групи.':'Враховано обидві групові оцінки.';
  return `${p.label} · ${number(p.score)} зі 100. ${basis}`;

}
function evidence(p){
  return `<div class="evidence">${Object.entries(groups).map(([id,name])=>`<div><span>${name}</span><strong>${number(p.groups[id])}</strong><small>${p.published[id]==null?'Триває збір':'Враховано відповідей · '+p.published[id]}</small></div>`).join('')}</div>`;
}
function advice(p){
  return `<dl class="advice"><dt>Що перевірити</dt><dd>${esc(p.check)}</dd><dt>Рекомендована дія</dt><dd>${esc(p.action)}</dd><dt>Ознака виконання</dt><dd>${esc(p.verify)}</dd></dl>`;
}
function planButton(s,p){
  if(inPlan(s,p.id))return '<a class="btn" href="#plan">Відкрити захід у плані</a>';
  return `<button type="button" class="btn dark" data-plan="${esc(p.id)}">Додати до плану</button>`;
}
function recommendation(s,p,info){
  return `<article class="card practice"><div class="practiceHead"><span class="overline">${esc(info.criteria[p.component])}</span>${badge(p)}</div><h3>${esc(p.title)}</h3><p>${why(p)}</p>${evidence(p)}${advice(p)}<div class="tools">${planButton(s,p)}${p.votes?`<p><b>Пропозиція учасників · ${p.votes}</b><br>${(p.offered||[]).map(row=>esc(row.action)+' · '+row.votes).join('<br>')}</p>`:''}</div></article>`;
}
function empty(title,msg){
  return `<div class="quiet"><h3>${esc(title)}</h3><p>${esc(msg)}</p></div>`;
}
function heading(title,description){
  return `<div class="sectionTitle"><h2>${title}</h2><p>${description}</p></div>`;
}
function metrics(s){
  return `<div class="metrics">${[
    ['Прийнято анкет',s.total,'Оновлюється після надсилання'],
    ['Середній бал опитування',number(s.index),'За трьома опорними запитаннями · зі 100'],
    ['Передано пропозицій',votes(s),'За згодою учасників']
  ].map(([name,value,hint],i)=>`<div class="metric ${i===0?'primaryMetric':''}"><span>${name}</span><strong>${value}</strong><small>${hint}</small></div>`).join('')}</div>`;
}
function structure(s){
  const last=s.history.at(-1),prev=last?.cohortVersion===2&&s.history.at(-2)?.cohortVersion===2?s.history.at(-2):null;
  return `<section class="card"><h2>Структура оцінки</h2><div class="components">${s.components.map((c,i)=>`<div class="component"><i class="t${i}"></i><h3>${esc(c.label)}</h3><strong>${number(c.score)}</strong><div class="track"><span style="width:${c.score??0}%"></span></div><small>${c.score==null?'Триває збір':prev?.components[i]==null?'Перша оцінка':delta(c.score,prev.components[i])+' б. до попереднього зрізу'}</small></div>`).join('')}</div><p class="hint">Кожну складову представляє одне опорне запитання. Середній бал опитування з’явиться, коли доступні всі три.</p></section>`;
}
function overview(s){
  const first=priorities(s)[0],available=s.practices.filter(p=>p.score!==null);
  return metrics(s)+`<section class="spotlight"><div><span class="overline">На що звернути увагу</span><h2>${first?esc(first.title):available.length?'Практики з оприлюдненими оцінками':s.total?'Перші анкети вже враховано':'Збір відкрито'}</h2><p>${first?why(first):available.length?'Перегляньте групові бали та підтримуйте практики з високими оцінками.':`Груповий бал відкриється після ${s.minimum} змістовних відповідей на одне запитання в одній категорії. Передані пропозиції видно одразу.`}</p>${first?`<p><b>Перший крок.</b> ${esc(first.check)}</p>`:''}<a href="#${first?'priorities':'questions'}">${first?'Переглянути підстави та дії':'Переглянути запитання'}</a></div><aside><strong>${available.length} <small>/ ${s.practices.length}</small></strong><span>запитань із груповим балом</span></aside></section>`+structure(s);
}
function priorityView(s,info){
  const rows=priorities(s);
  return heading('Пріоритети','Спочатку показано практики з нижчими балами або розбіжністю між групами. Добровільно передані пропозиції також потрапляють до цього списку.')+
    (rows.length?`<div class="practiceGrid">${rows.map(p=>recommendation(s,p,info)).join('')}</div>`:empty('Поки що немає пріоритетів','Тут з’явиться пропозиція учасника або практика, яка потребує уваги за груповими оцінками.'));
}
function questionView(s,info,filter){
  const rows=s.practices.filter(p=>filter==='all'||String(p.component)===filter);
  return heading('Розбір запитань','Розгорніть потрібну тему, щоб побачити формулювання запитання, бали кожної групи та спосіб перевірки.')+
    `<label class="filter">Складова<select id="practice-filter">${[['all','Усі складові'],...info.criteria.map((c,i)=>[String(i),c])].map(([value,label])=>`<option value="${value}" ${filter===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label><div class="questionList">${rows.map(p=>`<details data-question="${esc(p.id)}"><summary><span><small>${esc(info.criteria[p.component])}${p.optional?' · Ситуація':p.anchor?' · Опорне запитання':''}</small><b>${esc(p.title)}</b></span>${badge(p)}<strong>${number(p.score)}</strong></summary><div class="detailBody"><p class="wording">${esc(info.questions.find(q=>q.id===p.id)?.question)}</p><p>${why(p)}</p>${evidence(p)}${advice(p)}${planButton(s,p)}</div></details>`).join('')}</div><p class="hint">Бали наведено зі 100. Коли доступні обидві групи, підсумковий бал є середнім їхніх двох оцінок. «Не можу оцінити» не входить у бал.</p>`;
}
function historyView(s){
  const h=s.history,version=h.at(-1)?.cohortVersion;
  const series=h.flatMap((r,i)=>r.cohortVersion===version&&Number.isFinite(r.index)?[[i,r.index]]:[]);
  let chart='';
  if(series.length>=2){
    const x=i=>18+i*524/Math.max(1,h.length-1),y=v=>124-v;
    chart=`<figure class="trend"><figcaption>Середній бал опитування <small>Шкала 0–100 · зрізи від першого до останнього</small></figcaption><svg viewBox="0 0 560 145" role="img" aria-label="Зміна середнього бала. Точні значення наведено в таблиці."><path d="M18 24H542 M18 74H542 M18 124H542" fill="none" stroke="#c3d5c6"/><polyline points="${series.map(([i,v])=>x(i)+','+y(v)).join(' ')}" fill="none" stroke="#27704f" stroke-width="3"/>${series.map(([i,v])=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#21513a"/>`).join('')}</svg></figure>`;
  }
  return heading('Динаміка оцінювання','Зріз створюється, коли відкривається чергова порція групових відповідей. Зберігаються останні 24 зрізи. ')+
    (!h.length?empty('Перший зріз ще формується',`Він з’явиться після ${s.minimum} змістовних відповідей однієї групи на те саме запитання.`):
    `<section class="card">${chart||'<p class="hint">Графік з’явиться після двох зрізів із середнім балом.</p>'}<div class="scroll"><table><caption>Зрізи від найновішого</caption><thead><tr><th>Дата (UTC)</th><th>Анкет</th>${s.components.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th>Середній бал</th></tr></thead><tbody>${[...h].reverse().map(r=>`<tr><td>${date(r.at)}${r.cohortVersion===2?'':' · архів'}</td><td>${r.total}</td>${[...r.components,r.index].map(n=>`<td>${number(n)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`);
}
function planView(s){
  const rows=s.proposals.filter(p=>p.plan).sort((a,b)=>a.plan.due.localeCompare(b.plan.due));
  return heading('План заходів','Створюйте управлінські заходи, призначайте відповідальних і контролюйте результат.')+
    '<div class="tools planTools"><button class="btn dark" type="button" data-plan-new>+ Додати новий захід</button></div>'+
    (s.pendingLocalCount?'<div class="localInfo"><p><b>Очікують на синхронізацію: '+s.pendingLocalCount+'.</b> '+(s.serverManualMeasures?'Спільний сервер доступний для перенесення.':'Поточна версія спільного сервера ще не підтримує збереження власних заходів. До його оновлення записи зберігаються лише у цьому браузері.')+'</p><button type="button" class="btn" data-action="sync-plans">'+(s.serverManualMeasures?'Синхронізувати зараз':'Перевірити можливість синхронізації')+'</button></div>':(s.serverManualMeasures?'<p class="hint syncReady">Заходи зберігаються на спільному сервері та доступні після входу з інших пристроїв.</p>':''))+ 
    ((s.localConflicts||[]).length?'<div class="localConflict"><h3>Потрібна перевірка розбіжностей</h3><p>На сервері вже є захід для тієї самої практики. Локальну версію збережено, але вона не замінює спільну автоматично.</p>'+(s.localConflicts||[]).map(r=>'<details><summary>'+esc(r.title)+'</summary><p><b>Локальний захід:</b> '+esc(r.local.action)+'</p><p><b>Ознака виконання:</b> '+esc(r.local.verify)+'</p><p>Відповідальний: '+esc(r.local.owner)+' · Строк: '+date(r.local.due)+'</p></details>').join('')+'</div>':'')+
    (rows.length?rows.map(row=>{
      const p=s.practices.find(p=>p.id===row.id),plan=row.plan;
      const change=plan.cohortVersion===2&&plan.baseline!=null&&p.score!=null&&count(p)>plan.evidenceCount
        ?`Бал під час прийняття · ${number(plan.baseline)}. Поточний бал · ${number(p.score)}. Зміна · ${delta(p.score,plan.baseline)} б.`
        :plan.baseline!=null?'Бал під час прийняття · '+number(plan.baseline)+'. Очікуємо наступних групових даних.':'Початковий бал не зафіксовано.';
      return `<article class="card"><div class="planRow"><div><span class="overline">До ${date(plan.due)}</span><h3>${esc(p.title)}</h3><p>${esc(plan.owner)}</p>${plan.localOnly?'<span class="localLabel">Збережено на цьому пристрої</span>':''}</div><label>Статус заходу<select data-status="${esc(p.id)}">${Object.entries(stages).map(([k,v])=>`<option value="${k}" ${k===(plan.status||'planned')?'selected':''}>${v}</option>`).join('')}</select></label></div><p>${esc(plan.action||p.action)}</p><dl class="advice"><dt>Ознака виконання</dt><dd>${esc(plan.verify||p.verify)}</dd></dl><p class="hint">${change}</p></article>`;
    }).join(''):empty('План поки порожній','Натисніть «Додати новий захід», оберіть практику, відповідального та строк.'));
}
function report(s){
  const rows=priorities(s),plans=s.proposals.filter(p=>p.plan);
  return heading('Звіт керівника','Поточний стан спільного оцінювання. Збережіть звіт у PDF через друк або завантажте таблицю результатів.')+
    '<div class="tools reportButtons"><button class="btn dark" data-action="print">Друк / PDF</button><button class="btn" data-action="csv">Завантажити CSV</button></div>'+
    `<article class="card report"><h2>Воробці · Результати опитування</h2><p>${new Date().toLocaleDateString('uk-UA')} · Анкет · ${s.total} · Середній бал · ${number(s.index)} зі 100 · Передано пропозицій · ${votes(s)}</p><h3>Пріоритетні рішення</h3>${rows.length?`<ol>${rows.map(p=>`<li><b>${esc(p.title)}.</b> ${why(p)} ${esc(p.action)} <em>Ознака виконання.</em> ${esc(p.verify)}</li>`).join('')}</ol>`:'<p>Підстав для пріоритетних рішень поки не зафіксовано.</p>'}<h3>Результати за запитаннями</h3><div class="scroll"><table><thead><tr><th>Практика</th><th>Курсанти</th><th>Викладачі</th><th>Середній бал</th><th>Висновок</th></tr></thead><tbody>${s.practices.map(p=>`<tr><th>${esc(p.title)}</th><td>${number(p.groups.cadets)}</td><td>${number(p.groups.teachers)}</td><td>${number(p.score)}</td><td>${esc(p.label)}</td></tr>`).join('')}</tbody></table></div><p class="hint">Прочерк означає, що для публікації бала бракує групових даних.</p><h3>Прийняті заходи</h3>${plans.length?`<ul>${plans.map(p=>`<li><b>${esc(p.title)}.</b> ${esc(p.plan.owner)} · до ${date(p.plan.due)} · ${stages[p.plan.status||'planned']}${p.plan.localOnly?' · збережено лише в цьому браузері':''}</li>`).join('')}</ul>`:'<p>Заходів ще не додано.</p>'}</article>`;
}
const views={overview,priorities:priorityView,questions:questionView,history:historyView,plan:planView,report};
export function renderSection(s,info,section,filter='all'){
  return (views[section]??overview)(s,info,filter);
}
export function managerCsv(s,info){
  const rows=[['Складова','Практика','Бал курсантів','Кількість відповідей курсантів у балі','Бал викладачів','Кількість відповідей викладачів у балі','Середній бал','Висновок','Підтримали пропозицію','Що перевірити','Рекомендована дія','Ознака виконання','Відповідальний','Строк','Статус','Бал архівної категорії «Працівники»','Кількість врахованих архівних відповідей','Прийнята дія','Місце збереження']];
  for(const p of s.practices){
    const plan=inPlan(s,p.id);
    rows.push([info.criteria[p.component],p.title,p.groups.cadets,p.published.cadets,p.groups.teachers,p.published.teachers,p.score,p.label,p.votes,p.check,p.action,p.verify,plan?.owner,plan?.due,plan?stages[plan.status||'planned']:'',p.legacy?.score,p.legacy?.n,plan?.action,plan?(plan.localOnly?'Локально у браузері':'Спільний сервер'):'']);
  }
  return '\uFEFF'+rows.map(row=>row.map(value=>'"'+String(typeof value==='number'?number(value):value??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
}

