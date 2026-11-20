import {request, portable} from './transport.mjs?v=3';

const $=s=>document.querySelector(s), root=$('#root'), dialog=$('#modal');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',chart:'M3 3v17h18 M6 15l5-5 4 2 6-8',cycles:'M3 10a9 9 0 0 1 16-5l2 3 M21 3v5h-5 M21 14A9 9 0 0 1 5 19l-2-3 M3 21v-5h5',actions:'M6 5h13v16H5V5h3 M9 3h6v4H9z M8 13l2 2 5-5',report:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',method:'M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1z M12 6v14',audit:'M12 3a9 9 0 1 1-8 5 M3 3v5h5 M12 7v6l4 2',building:'M3 21h18 M5 21V9h14v12 M3 8l9-5 9 5z M8 12v6 M12 12v6 M16 12v6',download:'M12 3v12 M7 10l5 5 5-5 M4 16v4h16v-4',calendar:'M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16',chev:'m7 10 5 5 5-5',go:'m9 5 7 7-7 7',shield:'m12 3 8 3v6q0 5-8 9-8-4-8-9V6z M9 12l2 2 4-4',signal:'m12 3 10 17H2z M12 9v5 M12 17h.01',pulse:'M2 12h5l3-7 4 14 3-7h5',book:'M3 6q4-2 9 1 5-3 9-1v13q-5-2-9 1-5-3-9-1z M12 7v13',layers:'m12 3 10 5-10 5L2 8z M3 12l9 5 9-5 M3 16l9 5 9-5',people:'M8 11a4 4 0 1 0 0-8 4 4 0 1 0 0 8 M2 21v-3q0-4 6-4t6 4v3 M16 5q6 2 2 7 M17 15q5 0 5 6',lock:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 11v6 M12 7h.01',menu:'M3 6h18 M3 12h18 M3 18h18',close:'m5 5 14 14 M19 5 5 19',list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',check:'m4 12 5 5L20 6',target:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8',file:'M5 3h10l4 4v14H5z M8 13h8 M8 17h5',print:'M7 8V3h10v5 M7 17H3V9h18v8h-4 M7 14h10v7H7z',enter:'M4 12h13 M12 7l5 5-5 5 M17 3h4v18h-4',plus:'M12 4v16 M4 12h16',filter:'M3 7h18 M6 12h12 M9 17h6'};
const icon=(key,size=19)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[key]||icons.info}"/></svg>`;
const pages=[['overview','Огляд'],['chart','Аналітика'],['profile','Профіль практик'],['cycles','Оцінювання'],['actions','План заходів'],['report','Звіти'],['method','Методика'],['audit','Журнал дій']];
const roleNames={lead:'Керівник',officer:'Уповноважений',member:'Учасник'},gNames={cadets:'Курсанти',staff:'Викладачі'};
const ci=['book','layers','shield'],tones=['mint','blue','amber'];
let data, currentId, page='overview', menu=false, invite=null, groupView='cadets', working=false;
const num=(v,p=0)=>v==null?'—':Number(v).toLocaleString('uk-UA',{maximumFractionDigits:p,minimumFractionDigits:p});
const diff=v=>v==null?'—':(v>0?'+':'')+num(v,1);
const btn=(text,act,kind='secondary',ico='')=>`<button type="button" class="btn ${kind}" data-do="${act}">${ico?icon(ico,16):''}${text}</button>`;
const tag=(t,c='')=>`<span class="tag ${c}">${esc(t)}</span>`;
const nav=(p,t,i)=>`<button ${p===page?'aria-current="page"':''} class="nav ${p===page?'sel':''}" data-do="nav.${p}">${icon(i)}<span>${t}</span></button>`;
const source='https://nuou.org.ua/assets/documents/recommendations_transform_dobrochesnist.pdf';
const cycle=()=>data.cycles.find(c=>c.id===currentId)||data.cycles.filter(c=>c.closed).at(-1);
const alertCount=c=>c.rows.filter(r=>r.flag).length;
const previousCycle=c=>data.cycles.filter(x=>x.closed&&x.id<c.id).at(-1);
const openCycle=()=>data.cycles.find(c=>!c.closed);
function msg(s){const t=$('#toast');t.textContent=s;t.classList.add('on');clearTimeout(t.timer);t.timer=setTimeout(()=>t.classList.remove('on'),3400)}
async function api(path,body){const r=await request(path,body); const v=await r.json();if(!r.ok){const e=Error(v.error||'Не вдалося завантажити дані.');e.status=r.status;throw e}return v}
async function reload(){data=await api('state');if(!currentId||!data.cycles.some(c=>c.id===currentId&&c.closed))currentId=data.cycles.filter(c=>c.closed).at(-1)?.id;render()}
function show(title,html){dialog.innerHTML=`<header class="dialoghead"><h2 id="dialog-title">${title}</h2><button class="iconbtn" data-do="dismiss" aria-label="Закрити">${icon('close')}</button></header><div class="dialogbody">${html}</div>`;if(!dialog.open)dialog.showModal()}
function strip(s='Дані синтетичні'){return `<div class="notice">${icon('info',17)}<span>${s}</span></div>`}
function heading(title,sub,actions=''){return `<div class="pagehead"><div><h1>${title}</h1><p>${sub}</p></div>${actions?`<div class="headtools">${actions}</div>`:''}</div>`}
function period(){return `<label class="selectbox">${icon('calendar',16)}<select id="period" aria-label="Цикл оцінювання">${data.cycles.filter(c=>c.closed).slice().reverse().map(c=>`<option value="${c.id}" ${c.id===currentId?'selected':''}>${esc(c.name)}</option>`).join('')}</select>${icon('chev',15)}</label>`}
const bar=(n,color='')=>`<div class="bar"><i class="${color}" style="width:${Math.max(0,Math.min(100,n??0))}%"></i></div>`;
const mini=(n)=>n==null?'н/д':num(n,1);
function trend(c){
 const history=data.cycles.filter(x=>x.closed&&x.id<=c.id&&x.index!=null).slice(-5);
 if(!history.length)return `<p>Немає оприлюднених значень.</p>`;
 const width=450,height=120, left=10,right=414,top=12,bottom=92,min=Math.max(0,Math.floor((Math.min(...history.map(h=>h.index))-5)/10)*10),max=Math.min(100,Math.ceil((Math.max(...history.map(h=>h.index))+5)/10)*10);
 const xy=history.map((h,i)=>[history.length===1?right:left+(right-left)*i/(history.length-1),bottom-(h.index-min)/(max-min||1)*(bottom-top)]);
 const line=xy.map(p=>p.join(',')).join(' '),first=xy[0],last=xy.at(-1);
 const month=n=>esc(n.name.split(' ')[0].slice(0,3).toUpperCase());
 return `<svg class="trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="Динаміка індексу: ${history.map(h=>esc(h.name)+' '+num(h.index,1)).join(', ')}"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bef56b" stop-opacity=".3"/><stop offset="1" stop-color="#bef56b" stop-opacity=".015"/></linearGradient></defs>${[0,.5,1].map(fr=>{const y=bottom-fr*(bottom-top);return `<path d="M6 ${y}H418" stroke="#94aaa0" opacity=".26" stroke-dasharray="3 5"/><text x="428" y="${y+4}">${Math.round(min+fr*(max-min))}</text>`}).join('')}<polygon points="${first[0]},${bottom} ${line} ${last[0]},${bottom}" fill="url(#area)"/><polyline points="${line}" stroke="#c7fa79" stroke-width="3" fill="none" stroke-linejoin="round"/>${xy.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i===xy.length-1?5:3.4}" fill="#caf77d" stroke="#32483a" stroke-width="2"><title>${esc(history[i].name)} · ${num(history[i].index,1)}</title></circle><text x="${x}" y="115" text-anchor="${i===0?'start':i===xy.length-1?'end':'middle'}">${month(history[i])}</text>`).join('')}</svg>`;
}
function compPanel(c,previous=previousCycle(c)){
 const comparison=previous?'Зміна від циклу «'+esc(previous.name)+'», у балах.':'Перший опублікований цикл.';
 const entries=c.rows.map((row,i)=>{
  const prior=previous?.rows[i]?.score;
  const change=row.score==null||prior==null?null:row.score-prior;
  const note=change==null?'':`<small class="compChange ${change<0?'down':''}">${diff(change)} б.</small>`;
  return `<button class="component" data-do="detail.${i}"><span class="tile ${tones[i]}">${icon(ci[i])}</span><span class="compmain"><b>${esc(row.label)}</b>${bar(row.score,tones[i])}</span><span class="compValue"><strong>${num(row.score,1)}</strong>${note}</span>${icon('go',15)}</button>`;
 }).join('');
 return `<section class="panel"><div class="panelHead"><div><span class="kicker">СТРУКТУРА ІНДЕКСУ</span><h2>Компоненти доброчесності</h2></div><button class="iconbtn" data-do="nav.method" aria-label="Методика розрахунку">${icon('info')}</button></div><div class="componentList">${entries}</div><p class="chartNote">${comparison}</p></section>`;
}
function priorityCard(row,c){
 const hasSources=c.rows.every(r=>r.survey!=null&&r.fact!=null&&r.score!=null);
 let content;
 if(!row){
  content=`<h2>${hasSources?'Суттєвих розривів немає':'Бракує даних для порівняння'}</h2><p>${hasSources?'У цьому циклі жоден компонент не перетнув поріг рекомендації.':'Перегляньте, які джерела вже доступні за цей цикл.'}</p>${btn('До аналітики','nav.chart','secondary','chart')}`;
 }else{
  const gapRule=row.gap!=null&&row.gap>=20;
  const pairs=[['Опитування',row.survey,'survey'],['Перевірка',row.fact,'fact']].map(([name,v,tone])=>
   `<div class="evidenceLine"><span>${name}</span><span class="evidenceTrack" aria-hidden="true"><i class="${tone}" style="width:${v??0}%"></i></span><b>${mini(v)}</b></div>`).join('');
  content=`<h2>${esc(row.title)}</h2><div class="gapNum">${num(gapRule?row.gap:row.score,1)} <small>${gapRule?'б. розриву':'б. зі 100'}</small></div><div class="evidencePair">${pairs}</div><button class="textbtn" data-do="detail.${row.i}">Переглянути підстави ${icon('go',15)}</button>`;
 }
 return `<section class="priorityCard"><div class="priorityTop"><span class="kicker">ПРІОРИТЕТ ЦИКЛУ</span><span class="sig">${icon('signal',17)}</span></div>${content}</section>`;
}
function compare(c){return `<section class="panel"><div class="panelHead"><div><span class="kicker">ЗІСТАВЛЕННЯ ДАНИХ</span><h2>Порівняння джерел</h2></div></div><div class="legend"><span><i class="iSurvey"></i>Опитування</span><span><i class="iExpert"></i>Експерти</span><span><i class="iFact"></i>Перевірка</span></div><div class="barchart" aria-label="Зіставлення трьох джерел">${c.rows.map((r,i)=>`<button class="cluster" data-do="detail.${i}" aria-label="${r.label}: опитування ${mini(r.survey)}, експерти ${mini(r.expert)}, перевірка ${mini(r.fact)}"><span class="columns">${[r.survey,r.expert,r.fact].map((v,k)=>`<i class="${['iSurvey','iExpert','iFact'][k]}" style="height:${v??0}%" title="${mini(v)}"></i>`).join('')}</span><b>${r.label}</b></button>`).join('')}</div></section>`}
function overview(){
 const c=cycle(),prev=previousCycle(c),delta=c.index!=null&&prev?.index!=null?c.index-prev.index:null;
 const rows=c.rows.map((r,i)=>({...r,i})).filter(r=>r.flag).sort((a,b)=>b.gap-a.gap),alert=rows[0];
 const n=Object.values(c.counts).filter(x=>x!==null).reduce((x,y)=>x+y,0);
 return heading('Огляд доброчесності','Стан установи, динаміка оцінювання та пріоритети дій.',period()+(data.demoOwner&&openCycle()?btn(portable?'Пройти анкету':'Тестова анкета','issue.quick','primary','list'):''))+
 `<div class="heroGrid"><section class="hero"><div class="heroTop"><span class="heroLabel"><i></i> ЗВЕДЕНИЙ ПОКАЗНИК</span><button aria-label="Як обчислюється індекс" class="heroInfo" data-do="nav.method">${icon('info',18)}</button></div><div class="heroContent"><div class="heroMetric"><h2>Індекс доброчесності</h2><div class="indexNum">${num(c.index,1)}<small>/ 100</small></div><span class="heroLevel">${icon('layers',14)} ${c.level} рівень</span></div><div class="heroChart"><div class="chartLabel"><span>Динаміка індексу</span><strong>${diff(delta)} <small>б.</small></strong></div>${trend(c)}</div></div><div class="heroFoot">${icon('calendar',14)} ${esc(c.name)} <span>·</span> ${n} анкет у врахованих групах</div></section>
 ${priorityCard(alert,c)}</div>
 <div class="two">${compPanel(c,prev)}${compare(c)}</div>
 <div class="panel nextrow profilejump"><div><span class="kicker">АНАЛІЗ ОПИТУВАННЯ</span><h2>Як працюють окремі практики</h2><p>Навчання, консультації та процедури очима курсантів і викладачів.</p></div>${btn('Профіль практик','nav.profile','secondary','target')}</div>
 <div class="panel nextrow"><div><span class="kicker">УПРАВЛІНСЬКІ РІШЕННЯ</span><h2>Заходи за результатами циклу</h2><p>Сигнали для аналізу: ${alertCount(c)} · Прийняті заходи: ${data.measures.filter(m=>m.cycle===c.id).length}</p></div>${btn('Відкрити план','nav.actions','secondary','actions')}</div>`;
}
function details(i){
 const c=cycle(),r=c.rows[i]; const exists=data.measures.some(a=>a.cycle===c.id&&a.criterion===i&&!a.questionId);
 show(esc(r.title),`<div class="dialogmeta">${tag(r.label,'green')} ${esc(c.name)}</div><div class="detailScore"><strong>${num(r.score,1)}</strong><span>балів зі 100<br>${r.level} рівень</span></div>${[['Курсанти',r.groups.cadets],['Викладачі',r.groups.staff],['Опитування · 40%',r.survey],['Експертна оцінка · 30%',r.expert],['Документальний показник · 30%',r.fact]].map(([s,n])=>`<div class="factrow"><span>${s}</span><b>${mini(n)}</b></div>`).join('')}<p><b>Документальний показник.</b> ${esc(r.fact!==null?r.rawFact.a+' / '+r.rawFact.b:'—')} · ${esc(data.criteria[i].fact)}.</p><p class="small">Адаптовано за Рекомендаціями. ${esc(r.ref)}.</p>${r.flag?`<div class="callout"><b>Підстава рекомендації</b><p>${r.gap>=20?'Розбіжність джерел становить '+num(r.gap,1)+' б. Поріг правила — 20 б.':'Бал компонента нижчий за 60.'} Потрібна перевірка причин.</p></div>${exists?tag('Захід уже прийнято','green'):data.role==='lead'?btn('Розглянути захід','adopt.'+i,'primary','actions'):''}`:''}`);
}


function analytics(){const c=cycle();return heading('Порівняльна аналітика','Зіставте оцінки груп із незалежними джерелами за один цикл.',period())+`<div class="two">${compare(c)}${compPanel(c)}</div><section class="panel bottom"><span class="kicker">ДЕТАЛІ ОЦІНЮВАННЯ</span><h2>Відповіді за категоріями</h2><div class="tablewrap"><table><thead><tr><th>Компонент</th><th>Курсанти</th><th>Викладачі</th><th>Експерт</th><th>Перевірка</th></tr></thead><tbody>${c.rows.map((r,i)=>`<tr><td><button class="textbtn" data-do="detail.${i}">${r.label}</button></td>${[r.groups.cadets,r.groups.staff,r.expert,r.fact].map(n=>`<td>${mini(n)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small">«—» означає недостатню кількість оцінок або відсутнє джерело. Бали подано на шкалі 0–100.</p></section>`}
function adopt(i,practice=null){const r=cycle().rows[i],item=practice&&data.questions.find(q=>q.id===practice.id);show('Прийняти рекомендацію',`<form id="adoptform" data-i="${i}" data-question="${practice?.id||''}"><p>${practice?esc(practice.title)+' · '+esc(practice.label)+' · '+mini(practice.score)+' б.':esc(r.title)+' · '+mini(r.score)+' б. · розбіжність '+mini(r.gap)+' б.'}</p><label>Захід<textarea name="text" required minlength="2" maxlength="320">${esc(item?.action||r.action)}</textarea></label><label>Відповідальний підрозділ<select name="owner">${data.owners.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Строк виконання<input name="due" type="date" required></label><button class="btn primary">Прийняти до плану</button></form>`)}
function createMeasure(){
 const c=cycle(),available=c.practices.filter(q=>!data.measures.some(m=>m.cycle===c.id&&m.questionId===q.id));
 if(!available.length){msg('Усі практики цього циклу вже мають заходи.');return}
 const q=available[0];
 show('Новий захід',`<form id="manualmeasure"><p>Створіть управлінське рішення та вкажіть строк його перевірки.</p><label>Практика<select name="questionId" id="manualquestion">${available.map(item=>`<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('')}</select></label><label>Захід<textarea name="text" minlength="2" maxlength="320" required>${esc(q.action)}</textarea></label><label>Відповідальний підрозділ<select name="owner">${data.owners.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Строк виконання<input type="date" name="due" required></label><button class="btn primary">Додати до плану</button></form>`);
 const nextMonth=new Date();nextMonth.setDate(nextMonth.getDate()+30);
 const f=dialog.querySelector('#manualmeasure');if(f)f.elements.due.value=[nextMonth.getFullYear(),String(nextMonth.getMonth()+1).padStart(2,'0'),String(nextMonth.getDate()).padStart(2,'0')].join('-');
}
function actions(){
 const c=cycle();const flagged=c.rows.map((r,i)=>({...r,i})).filter(r=>r.flag&&!data.measures.some(m=>m.cycle===c.id&&m.criterion===r.i&&!m.questionId));
 return heading('План заходів','Рекомендації, відповідальні та перевірка результату в наступному циклі.',period()+(data.role==='lead'?btn('Додати захід','manualmeasure','primary','plus'):''))+
 `<section class="panel"><span class="kicker">НА РОЗГЛЯДІ</span><h2>Рекомендовані заходи</h2>${flagged.length?flagged.map(r=>`<div class="task"><span class="tile amber">${icon('signal')}</span><div><b>${esc(r.title)}</b><p>${esc(r.action)}</p><span class="small">Розбіжність джерел ${mini(r.gap)} б. · Оцінка ${mini(r.score)} б.</span></div>${btn(data.role==='lead'?'Розглянути':'Підстави',data.role==='lead'?'adopt.'+r.i:'detail.'+r.i)}</div>`).join(''):'<p>Усі рекомендації цього циклу опрацьовано або пороги правил не спрацювали.</p>'}</section>
 <section class="panel bottom"><span class="kicker">КОНТРОЛЬ ВИКОНАННЯ</span><h2>Прийняті заходи усіх циклів</h2>${data.measures.length?data.measures.slice().reverse().map(m=>`<div class="actionrow"><div>${m.questionId?tag(data.questions.find(q=>q.id===m.questionId)?.title,'green')+' ':''}${tag(m.status,m.status==='Виконано'?'green':'')}<h3>${esc(m.text)}</h3><p>${esc(m.owner)} · до ${esc(m.due)} · ${esc(data.cycles.find(c=>c.id===m.cycle)?.name)}</p><p class="small">${m.verification?`Повторна оцінка · ${esc(m.verification.cycle)} · ${mini(m.verification.score)} б. (${diff(m.verification.delta)} б. до базової оцінки).`:'Перевірка результату очікує наступного завершеного циклу.'}</p></div><label class="small">Статус<select aria-label="Статус заходу" data-status="${m.id}">${['Заплановано','У роботі','Виконано'].map(s=>`<option ${s===m.status?'selected':''}>${s}</option>`).join('')}</select></label></div>`).join(''):'<p>Прийміть рекомендацію, щоб призначити відповідального та строк.</p>'}</section>`;
}
function cyclesPage(){
 const c=openCycle(),off=data.role==='officer';return heading('Цикли оцінювання','Організація анонімного опитування та підтвердження інституційних показників.',off&&!c?btn('Створити цикл','newcycle','primary','plus'):'')+
 (c?`<section class="panel"><div class="panelHead"><div>${tag('Триває збір','green')}<h2>${esc(c.name)}</h2></div><span class="tile mint">${icon('cycles')}</span></div><div class="metrics">${Object.entries(c.counts).map(([g,n])=>`<div><b>${n??'менше '+c.k}</b><span>${gNames[g]} · анкет</span></div>`).join('')}<div><b>${c.k}</b><span>Поріг анонімності</span></div></div><p>Групові бали оприлюднюються один раз після завершення циклу. Експертні й документальні показники ${c.confirmed?'підтверджено':'очікують підтвердження'}.</p><div class="buttons">${off?btn('Внести показники','inputs','primary','list')+btn(portable?'Пройти анкету':'Видати запрошення','issue','secondary','people'):btn('Переглянути джерела','inputs')+(!c.confirmed?btn('Підтвердити джерела','confirm','primary','check'):'')+btn('Завершити цикл','closecycle','secondary','lock')}</div></section>`:strip('Збір анкет завершено. Уповноважений може створити новий цикл.'))+
 `<section class="panel bottom"><span class="kicker">АРХІВ</span><h2>Завершені оцінювання</h2>${data.cycles.filter(c=>c.closed).slice().reverse().map(c=>`<button class="archrow" data-do="select.${c.id}"><span class="tile soft">${icon('calendar')}</span><b>${esc(c.name)}</b><span>${mini(c.index)} б.</span>${icon('go',15)}</button>`).join('')}</section>`;
}
function inputs(){const c=openCycle(),v=data.inputs.find(x=>x.id===c.id),off=data.role==='officer';
 show(off?'Внесення показників':'Інституційні джерела',`<form id="inputsform"><p>${esc(c.name)} · ${v.confirmed?'Підтверджено керівником':'Очікує підтвердження'}</p>${data.criteria.map((cr,i)=>`<fieldset><legend>${esc(cr.title)}</legend><label>Експертна оцінка робочої групи<select name="e${i}" ${off?'':'disabled'} required><option value="">Оберіть рівень</option>${[0,25,50,75,100].map((n,j)=>`<option value="${n}" ${v.expert[i]===n?'selected':''}>${j+1} · ${esc(cr.options[j])}</option>`).join('')}</select></label><p class="small">${esc(cr.fact)}</p><div class="formgrid"><label>Виконано<input type="number" min="0" step="1" max="1000000" name="a${i}" value="${v.facts[i]?.a??''}" required ${off?'':'disabled'}></label><label>Заплановано<input type="number" min="1" step="1" max="1000000" name="b${i}" value="${v.facts[i]?.b??''}" required ${off?'':'disabled'}></label></div></fieldset>`).join('')}${off?'<button class="btn primary">Зберегти й передати на підтвердження</button>':''}</form>`)}
function issue(quick=false){
 if(portable)quick=true;
 if(surveySession && (quick||data.role==='member')){surveyScreen();return}
 const c=data.role==='member'?data.open.at(-1):openCycle();if(!c){msg('Немає відкритого циклу.');return}
 show('Анонімне опитування',`<form id="issueform" data-quick="${quick}" data-cycle="${c.id}"><p>${esc(c.name)} · 12 запитань у трьох розділах, орієнтовно 3–5 хвилин.</p><label>Категорія учасника<select name="group">${Object.entries(gNames).map(([g,n])=>`<option value="${g}">${n}</option>`).join('')}</select></label>${strip('Система зберігає лише сумарні бали групи. Запрошення одноразове.')}<button class="btn primary">${data.role==='member'||quick?'Розпочати анкету':'Створити запрошення'}</button></form>`);
}
function reportPage(){const c=cycle();return heading('Аналітичний звіт','Підсумки завершеного оцінювання для керівництва установи.',period())+
 `<section class="panel reportpaper"><span class="kicker">МОДЕЛЬНИЙ ВІЙСЬКОВИЙ ІНСТИТУТ</span><h2>Звіт про стан доброчесності</h2><p>${esc(c.name)} · синтетичні дані · поріг групи ${c.k} відповідей</p><div class="detailScore"><strong>${mini(c.index)}</strong><span>Integrity Index<br>${c.level} рівень</span></div><table><thead><tr><th>Компонент</th><th>Бал</th><th>Розбіжність джерел</th></tr></thead><tbody>${c.rows.map(r=>`<tr><td>${r.label}</td><td>${mini(r.score)}</td><td>${mini(r.gap)} б.</td></tr>`).join('')}</tbody></table><details class="practiceprint"><summary>Профіль практик за запитаннями</summary><table><thead><tr><th>Практика</th><th>Бал</th><th>Висновок</th></tr></thead><tbody>${c.practices.map(q=>`<tr><td>${esc(q.title)}</td><td>${mini(q.score)}</td><td>${esc(q.label)}</td></tr>`).join('')}</tbody></table></details><h3>Управлінський висновок</h3><p>${c.rows.filter(r=>r.flag).map(r=>esc(r.title)+'. '+esc(r.action)).join(' ')||'За поточними правилами немає сигналів для додаткової перевірки.'}</p><p class="small">Оцінка характеризує систему установи. Порівняння джерел допомагає обрати напрями перевірки.</p><div class="buttons noprint">${btn('Завантажити CSV','csv','primary','download')}${btn('Друк / PDF','print','secondary','print')}</div></section>`}
function method(){return heading('Методика індексу','Джерела, ваги та відкриті правила демонстраційної моделі.')+
 `<section class="panel"><span class="kicker">РОЗРАХУНОК</span><h2>Як формується Integrity Index</h2><div class="formula">I = (Культура + Система + Підзвітність) / 3</div><p>Кожен компонент охоплює один обраний критерій і має рівну вагу. Для анкети й експертної оцінки п’ять відповідей відповідають 0, 25, 50, 75 і 100 балам. Для документального джерела використовується відсоток виконання.</p><div class="metrics"><div><b>40%</b><span>Анонімне опитування</span></div><div><b>30%</b><span>Експертна оцінка</span></div><div><b>30%</b><span>Документальна перевірка</span></div></div><p>Ширше представництво персоналу дає його оцінці дещо більшу вагу. Групи, що досягли порога за конкретним питанням, мають рівний вплив. «Не можу оцінити» виключається із знаменника. За відсутності одного з трьох джерел компонент, а відтак і загальний індекс, залишаються невизначеними.</p><details><summary>Приклад, рівні та правила рекомендацій</summary><p>80 балів опитування, 75 експертної оцінки та 90 перевірки дають 0,4 × 80 + 0,3 × 75 + 0,3 × 90 = 81,5. Рівні починаються з 0, 20, 40, 60 і 80 балів. Якщо розрив між опитуванням і перевіркою ≥ 20 балів або компонент нижче 60, система пропонує розглянути захід. Обчислення використовують повну точність до виведення на екран.</p></details></section>
 <section class="panel bottom"><h2>Як читати профіль практик</h2><p>У кожному з трьох розділів анкети є опорне питання для індексу і три уточнювальні. Їхні результати допомагають обрати конкретний захід. Попередні цикли можна порівнювати за тими самими трьома опорними питаннями.</p><p>За різниці від 20 балів між двома доступними групами показуємо розбіжність досвіду. В інших випадках середній бал від 80 означає сильну практику, від 60 — стабільну, від 40 — практику, що формується, нижче 40 — пріоритет розвитку. Якщо жодна група не досягла порога, з’являється висновок «Недостатньо даних».</p></section><section class="panel bottom"><h2>Основа опитувальників</h2><p>Адаптація рекомендацій Міноборони та НУОУ, 2025. Шкала, ваги й пороги є демонстраційною моделлю прототипу.</p>${data.criteria.map(r=>`<div class="factrow"><b>${esc(r.title)}</b><span>${esc(r.ref)}</span></div>`).join('')}<p><a href="${source}" target="_blank" rel="noreferrer">Відкрити першоджерело (PDF)</a></p>${data.hosted?'<div class="buttons"><a class="btn secondary" href="/competition-kit.zip" download>Завантажити код і конкурсні матеріали</a><a class="btn secondary" href="/demo.mp4" target="_blank" rel="noreferrer">Відеодемонстрація</a></div>':''}</section>`}
function auditPage(){return heading('Журнал дій','Управлінські дії та інституційні підтвердження.')+`<section class="panel"><h2>Історія змін</h2>${data.audit.length?data.audit.map(a=>`<div class="factrow"><span><b>${esc(a.text)}</b><br><small>${roleNames[a.role]}</small></span><span>${esc(a.date)}</span></div>`).join(''):'<p>Зміни з’являться після першої управлінської дії в цьому просторі.</p>'}${strip('Відповіді учасників та час проходження анкет до журналу не потрапляють.')}</section>`}
function memberPage(){const c=cycle();return heading('Кабінет учасника','Анонімне оцінювання та оприлюднені підсумки вашої категорії.')+`<div class="panel"><span class="kicker">АНОНІМНА АНКЕТА</span><h2>${esc(data.open.at(-1)?.name||'Збір завершено')}</h2><p>12 запитань про практики установи. Відповідайте так, як бачите їх у повсякденній роботі або навчанні.</p>${data.open.length?btn('Пройти опитування','issue','primary','list'):''}</div><section class="panel bottom"><span class="kicker">ЗВОРОТНИЙ ЗВ’ЯЗОК</span><h2>Підсумки · ${esc(c.name)}</h2><label class="selectbox"><select id="memberGroup" aria-label="Категорія результатів">${Object.entries(gNames).map(([g,t])=>`<option value="${g}" ${groupView===g?'selected':''}>${t}</option>`).join('')}</select>${icon('chev',14)}</label>${c.rows.map(r=>`<div class="factrow"><span>${esc(r.title)}</span><b>${mini(r.groups?.[groupView])} б.</b></div>`).join('')}<p class="small">Бал групи оприлюднюється за наявності щонайменше ${c.k} змістовних відповідей на запитання.</p></section>`}


function logo(){return `<div class="brand"><img src="/mark.svg" width="40" height="40" alt=""><div><strong>Вектор</strong><span>ДОБРОЧЕСНОСТІ</span></div></div>`}
function render(){if(!data)return;const member=data.role==='member',chosen=pages.find(p=>p[0]===page)?.[1]||'Огляд',body=member?memberPage():({overview,chart:analytics,profile,cycles:cyclesPage,actions,report:reportPage,method,audit:auditPage}[page]||overview)();
 root.innerHTML=`<div class="app ${menu?'menuopen':''}"><button class="scrim" tabindex="-1" aria-hidden="true" data-do="menu" aria-label="Закрити меню"></button><aside id="navigation">${logo()}<button class="drawerClose iconbtn" data-do="menu" aria-label="Закрити меню">${icon('close')}</button><div class="navlabel">РОБОЧИЙ ПРОСТІР</div><nav>${member?nav('overview','Мій кабінет','people'):pages.slice(0,6).map(([p,t])=>nav(p,t,p==='profile'?'target':p)).join('')}</nav>${member?'':`<div class="navlabel second">ДОВІДКА</div><nav>${pages.slice(6).map(([p,t])=>nav(p,t,p==='profile'?'target':p)).join('')}</nav>`}${data.demoOwner?`<button class="examplenav" data-do="example">${icon('cycles',15)} ${data.inExample?'Повернутися у свій простір':'Відкрити новий демоприклад'}</button>`:''}<div class="sidefoot"><span class="demodot"></span><span>${portable?'Синтетичні дані · офлайн':'Синтетичні дані'}</span></div></aside><div class="mainwrap"><header class="topbar"><div class="institution"><button class="iconbtn menubtn" data-do="menu" aria-controls="navigation" aria-expanded="${menu}" aria-label="Навігація">${icon('menu')}</button><span class="orgIcon">${icon('building',18)}</span><span>Модельний військовий інститут</span></div><div class="account">${data.demoOwner?`<label class="roleSelect" title="Демонстраційне перемикання ролей"><span class="avatar">${data.role==='lead'?'КР':data.role==='officer'?'УП':'УЧ'}</span><select id="role" aria-label="Демонстраційна роль">${Object.entries(roleNames).map(([k,n])=>`<option value="${k}" ${k===data.role?'selected':''}>${n}</option>`).join('')}</select>${icon('chev',14)}</label>`:tag(roleNames[data.role])}</div></header><main id="main" tabindex="-1"><div class="crumb">Робочий простір ${icon('go',11)} <span>${member?'Мій кабінет':chosen}</span></div>${body}</main><footer>${data.hosted?'<a href="/survey">Спільна анкета учасників</a><a href="/manager">Кабінет керівника</a>':''}<span>Вектор доброчесності · Модельне оцінювання</span>${portable?'<span>Автономне демо · дані в цій вкладці</span>':data.demoOwner?'<a href="/vektor.html" download="vektor.html">Завантажити для роботи офлайн</a>':''}</footer></div></div>`;
}

const categoryLabels={strong:'Сильна практика',stable:'Стабільна практика',forming:'Практика формується',priority:'Пріоритет розвитку',split:'Розбіжність між групами',hidden:'Недостатньо даних'};
let componentFilter='all',outcomeFilter='all',surveySession=null;
function practiceRule(q){
 if(q.category==='hidden')return 'Для цього питання ще немає доступного групового бала. Поріг застосовується окремо до кожної групи.';
 if(q.category==='split')return 'Оцінки двох груп відрізняються на '+num(Math.abs(q.groups.cadets-q.groups.staff),1)+' бала. Окремо перевірте умови, доступні кожній групі.';
 if(q.category==='priority')return 'Середній бал нижчий за 40. Варто насамперед перевірити доступність цієї практики.';
 if(q.category==='forming')return 'Середній бал від 40 до менш ніж 60. Практика потребує послідовнішого впровадження.';
 if(q.category==='stable')return 'Середній бал від 60 до менш ніж 80. Підтримуйте практику та перевірте її в наступному циклі.';
 return 'Середній бал від 80. З’ясуйте, що саме працює, і запропонуйте цей досвід іншим підрозділам.';
}
function profile(){
 const c=cycle(),all=c.practices;
 const rows=all.filter(q=>(componentFilter==='all'||q.component===Number(componentFilter))&&(outcomeFilter==='all'||q.category===outcomeFilter));
 const options=(items,active)=>items.map(([key,label])=>`<option value="${key}" ${String(key)===active?'selected':''}>${esc(label)}</option>`).join('');
 return heading('Профіль практик','Оцінки за кожним запитанням, відмінності між групами та підстави для дій.',period())+
 `<section class="panel"><div class="profilefilters"><label>Напрям<select id="componentFilter">${options([['all','Усі напрями'],...data.criteria.map((r,i)=>[i,r.label])],componentFilter)}</select></label><label>Висновок<select id="outcomeFilter">${options([['all','Усі висновки'],...Object.entries(categoryLabels)],outcomeFilter)}</select></label><span class="small">Показано ${rows.length} із ${all.length}</span></div>
 ${rows.length?`<div class="tablewrap"><table class="profiletable"><thead><tr><th>Практика</th><th>Курсанти</th><th>Викладачі</th><th>Висновок</th></tr></thead><tbody>${rows.map(q=>`<tr><td><button class="textbtn" data-do="practice.${q.id}">${esc(q.title)}</button><small>${data.criteria[q.component].label}</small></td><td data-group="Курсанти">${mini(q.groups.cadets)}</td><td data-group="Викладачі">${mini(q.groups.staff)}</td><td><button data-do="practice.${q.id}" class="verdict ${q.category}">${esc(q.label)}</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="emptyfilter"><p>У цьому циклі немає практик із таким поєднанням ознак.</p>${btn('Скинути фільтри','clearfilters')}</div>`}
 <p class="small">Бали від 0 до 100. Натисніть назву практики, щоб побачити запитання і правило висновку. Оцінка групи доступна від ${c.k} змістовних відповідей.</p></section>`;
}
function practiceDetail(id){
 const c=cycle(),q=c.practices.find(x=>x.id===id),definition=data.questions.find(x=>x.id===id);
 if(!q||!definition)return;
 const exists=data.measures.some(m=>m.cycle===c.id&&m.questionId===id);
 const actionable=['forming','priority','split'].includes(q.category);
 show(esc(q.title),`<div class="dialogmeta">${tag(data.criteria[q.component].label,'green')} ${esc(c.name)}</div>
 <p>${esc(definition.question)}</p><div class="detailScore"><strong>${num(q.score,1)}</strong><span>середній бал<br>за оприлюдненими групами</span></div>
 ${Object.entries(gNames).map(([k,label])=>`<div class="factrow"><span>${label}</span><b>${mini(q.groups[k])}</b></div>`).join('')}
 <p><span class="verdict ${q.category}">${q.label}</span></p><p>${esc(practiceRule(q))}</p>
 ${actionable?`<div class="callout"><b>Пропозиція заходу</b><p>${esc(definition.action)}</p></div>${exists?tag('У плані заходів','green'):data.role==='lead'?btn('Додати до плану','practiceadopt.'+q.id,'primary','actions'):''}`:''}
 <p class="small">${q.anchor?'Це опорне запитання. Його груповий бал формує опитувальну частину відповідного компонента індексу.':'Це уточнювальне запитання. Воно визначає напрям заходу й дає окремий показник для повторної перевірки.'}</p>`);
}
function surveyScreen(){
 const {definition:v,step,answers}=surveySession;
 const q=v.questions[step],total=v.questions.length,component=v.criteria[q.component].label;
 const choices=[...q.options,'Не можу оцінити'];
 show('Анонімне оцінювання',`<form id="answers" class="wizard"><div class="surveyhead">${tag(component,'green')}<span>${esc(v.group)} · ${esc(v.cycle)}</span></div>
 <div class="qprogress"><b>Запитання ${step+1} із ${total}</b><progress value="${step+1}" max="${total}" aria-label="Позиція в анкеті"></progress></div>
 <fieldset class="qchoices"><legend tabindex="-1">${esc(q.question)}</legend>${choices.map((choice,j)=>`<label class="option"><input type="radio" required name="choice" value="${j}" ${answers[step]===j?'checked':''}><span>${esc(choice)}</span></label>`).join('')}</fieldset>
 <div class="wizardfoot">${step?btn('Назад','qback'):''}<button class="btn primary" type="submit">${step===total-1?'Надіслати анонімно':'Далі'}</button></div></form>`);
 dialog.scrollTop=0;
 dialog.querySelector('legend')?.focus({preventScroll:true});
}
async function openSurvey(code){
 invite=code;
 const definition=await api('invite-info',{invitation:code});
 if(!surveySession||surveySession.code!==code)surveySession={code,definition,step:0,answers:Array(definition.questions.length).fill(undefined)};
 surveyScreen();
}


function setPage(p){if(!pages.some(x=>x[0]===p))p='overview';page=p;menu=false;location.hash=p;render();$('#main')?.focus({preventScroll:true});window.scrollTo(0,0)}
function confirmBox(title,desc,action){show(title,`<p>${desc}</p><div class="buttons">${btn('Підтвердити',action,'primary','check')}${btn('Скасувати','dismiss')}</div>`)}
async function doAction(s){
 const [a,v]=s.split('.');
 if(a==='dismiss'){dialog.close();return} if(a==='menu'){menu=!menu;render();$(menu?'.drawerClose':'.menubtn')?.focus();return}
 if(a==='nav'){if(dialog.open)dialog.close();setPage(v);return}
 if(a==='example'){
  await api(data.inExample?'demo-return':'demo-example',{});page='overview';location.hash='overview';currentId=null;
  componentFilter=outcomeFilter='all';surveySession=null;await reload();msg(data.inExample?'Відкрито окремий приклад. Ваші попередні дані збережено.':'Ви у своєму просторі');return
 }
 if(a==='manualmeasure'){createMeasure();return}
  if(a==='practice'){practiceDetail(v);return}
 if(a==='practiceadopt'){const q=cycle().practices.find(x=>x.id===v);if(q)adopt(q.component,q);return}
 if(a==='clearfilters'){componentFilter=outcomeFilter='all';render();return}
 if(a==='resume'&&surveySession){surveyScreen();return}
 if(a==='qback'){surveySession.step--;surveyScreen();return}
 if(a==='select'){currentId=Number(v);setPage('overview');return}
 if(a==='detail'){details(Number(v));return}if(a==='adopt'){adopt(Number(v));return}
 if(a==='issue'){issue(v==='quick');return}if(a==='opensurvey'){await openSurvey(invite);return}
 if(a==='inputs'){inputs();return}
 if(a==='copy'){try{await navigator.clipboard.writeText($('#inviteurl').value);msg('Посилання скопійовано')}catch{$('#inviteurl').select();msg('Скопіюйте виділене посилання')}return}
 if(a==='csv'){
  const response=await request('report.csv?cycle='+cycle().id);
  if(!response.ok)throw Error('Не вдалося завантажити звіт.');
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
  link.href=url;link.download='vektor-'+cycle().id+'.csv';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);return
 }
 if(a==='print'){
  const details=document.querySelector('.practiceprint'),wasOpen=details?.open;
  if(details)details.open=true;
  window.addEventListener('afterprint',()=>{if(details)details.open=wasOpen},{once:true});
  window.print();return
 }
 if(a==='newcycle'){show('Новий цикл',`<form id="newcycle"><label>Назва циклу<input name="name" maxlength="45" required placeholder="Наприклад, березень 2027"></label><label>Мінімум відповідей у групі<input type="number" min="5" max="50" value="7" name="k" required></label><button class="btn primary">Відкрити збір анкет</button></form>`);return}
 if(a==='closecycle'){confirmBox('Завершити оцінювання','Система опублікує агреговані бали та закриє приймання анкет. Оприлюднені результати фіксуються.','closeyes');return}
 if(a==='confirm'){confirmBox('Підтвердити показники','Підтвердьте, що ви перевірили експертні оцінки й документальні показники цього циклу.','confirmyes');return}
 if(['closeyes','confirmyes'].includes(a)){const c=openCycle();await api(a==='closeyes'?'close':'confirm',{cycle:c.id});dialog.close();if(a==='closeyes')currentId=c.id;await reload();msg(a==='closeyes'?'Підсумки оприлюднено':'Показники підтверджено')}
}
async function perform(call){
 if(working)return;working=true;try{await call()}catch(e){msg(e.message);if(dialog.open){dialog.querySelector('.err')?.remove();const p=document.createElement('p');p.className='err';p.setAttribute('role','alert');p.textContent=e.message;dialog.querySelector('.dialoghead').after(p)}}finally{working=false}
}
document.addEventListener('keydown',e=>{
 if(!menu||dialog.open)return;
 if(e.key==='Escape'){menu=false;render();$('.menubtn')?.focus();return}
 if(e.key!=='Tab')return;
 const items=$('#navigation').querySelectorAll('button');
 const first=items[0],last=items[items.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(b){e.preventDefault();perform(()=>doAction(b.dataset.do))}});
document.addEventListener('change',e=>{const t=e.target;
 if(t.name==='choice'&&surveySession)surveySession.answers[surveySession.step]=Number(t.value);
 if(t.id==='componentFilter'){componentFilter=t.value;render();$('#componentFilter')?.focus()}
 if(t.id==='outcomeFilter'){outcomeFilter=t.value;render();$('#outcomeFilter')?.focus()}
 if(t.id==='manualquestion'){const q=cycle().practices.find(q=>q.id===t.value),f=t.closest('form');if(q&&f)f.elements.text.value=q.action}
  if(t.id==='period'){currentId=Number(t.value);render()}if(t.id==='memberGroup'){groupView=t.value;render()}
 if(t.id==='role')perform(async()=>{await api('role',{role:t.value});page='overview';location.hash='overview';await reload()});
 if(t.dataset.status)perform(async()=>{await api('status',{id:t.dataset.status,status:t.value});await reload();msg('Статус оновлено')})
});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target,fd=new FormData(f),value=k=>String(fd.get(k)||'');
 perform(async()=>{
 if(f.id==='loginform'){await api('login',{role:value('role'),code:value('code')});await reload();return}
 if(f.id==='issueform'){groupView=value('group');const v=await api('issue',{cycle:Number(f.dataset.cycle),group:groupView,version:2});invite=v.invitation;
  if(data.role==='member'||f.dataset.quick==='true'){await openSurvey(invite);return}
  const u=location.origin+'/#invite='+invite;show('Одноразове запрошення',`<p>Передайте посилання одному учаснику категорії «${gNames[groupView]}». Після надсилання відповідей воно втрачає чинність.</p><label>Посилання<input id="inviteurl" readonly value="${esc(u)}"></label><div class="buttons">${btn('Скопіювати','copy')}${btn('Відкрити анкету','opensurvey','primary')}</div>`);return
 }
 if(f.id==='answers'){
  const session=surveySession;if(!session||!fd.has('choice'))return;
  session.answers[session.step]=Number(value('choice'));
  if(session.step<session.definition.questions.length-1){session.step++;surveyScreen();return}
  const answers=session.answers.map(n=>n===5?null:n);const res=await api('answer',{answers,invitation:invite});invite=null;surveySession=null;
  show('Дякуємо за участь',`<div class="success">${icon('check',28)}</div><p>Ваші відповіді додано до групових сум. Підсумки поточного циклу з’являться після його завершення.</p>${res.latest?`<h3>Попередній цикл · ${esc(res.latest.name)}</h3>${res.latest.rows.map(r=>`<div class="factrow"><span>${r.label}</span><b>${mini(r.groups?.[res.group])} б.</b></div>`).join('')}`:''}${btn('Готово','dismiss','primary')}`);
  if(data)await reload();else root.innerHTML=`<main class="standalone">${logo()}<h1>Анкету прийнято</h1><p>Дякуємо за участь в оцінюванні.</p></main>`;return
 }
 if(f.id==='manualmeasure'){const q=cycle().practices.find(q=>q.id===value('questionId'));if(!q)throw Error('Оберіть практику.');await api('measure',{cycle:cycle().id,criterion:q.component,questionId:q.id,text:value('text'),due:value('due'),owner:value('owner')});dialog.close();page='actions';location.hash='actions';await reload();if(!data.measures.some(m=>m.cycle===q.cycle||m.questionId===q.id)){throw Error('Захід не з’явився в плані. Повторіть дію.')}msg('Захід додано до плану');return}
  if(f.id==='adoptform'){await api('measure',{cycle:cycle().id,criterion:Number(f.dataset.i),questionId:f.dataset.question||undefined,text:value('text'),due:value('due'),owner:value('owner')});dialog.close();page='actions';location.hash='actions';await reload();msg('Захід додано до плану');return}
 if(f.id==='inputsform'){await api('inputs',{cycle:openCycle().id,expert:[0,1,2].map(i=>Number(value('e'+i))),facts:[0,1,2].map(i=>({a:Number(value('a'+i)),b:Number(value('b'+i))}))});dialog.close();await reload();msg('Показники збережено');return}
 if(f.id==='newcycle'){await api('cycle',{name:value('name'),k:Number(value('k'))});dialog.close();await reload();msg('Цикл відкрито')}
 })});
window.addEventListener('hashchange',()=>{if(location.hash==='#survey'&&data?.demoOwner){issue(true);return}if(data&&pages.some(x=>x[0]===location.hash.slice(1))){page=location.hash.slice(1);render()}});
function login(){root.innerHTML=`<main class="standalone">${logo()}<h1>Вхід до установи</h1><form id="loginform"><label>Роль<select name="role"><option value="lead">Керівник</option><option value="officer">Уповноважений</option></select></label><label>Ключ доступу<input type="password" name="code" required></label><button class="btn primary">Увійти</button></form></main>`}
async function boot(){try{if(location.hash.startsWith('#invite=')){const code=location.hash.slice(8);history.replaceState(null,'',location.pathname);root.innerHTML=`<main class="standalone">${logo()}<h1>Анонімне оцінювання</h1><p>Модельний військовий інститут</p>${btn('Продовжити анкету','resume','primary')}</main>`;await openSurvey(code);return}
 page=pages.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview';
 try{await api('start',{})}catch(e){if(e.status===401){login();return}throw e}await reload();if(location.hash==='#survey'&&data.demoOwner)issue(true)
 }catch(e){root.innerHTML=`<main class="standalone">${logo()}<h1>Не вдалося відкрити оцінювання</h1><p>${esc(e.message)}</p><a class="btn secondary" href="${esc(location.pathname)}">На головну</a></main>`}}
boot();

