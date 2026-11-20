// Допоміжна логіка лише для спільної публічної анкети, без впливу на демоверсію.
// Пропозиція доступна за будь-якої оцінки: позитивний досвід теж можна розвивати.
export function proposalCandidates(questions,answers){
  const listed=questions.map((q,i)=>({q,score:answers[i],order:i}));
  const rated=listed.filter(r=>Number.isInteger(r.score)&&r.score>=0&&r.score<=4);
  const selected=rated.length?rated:listed.filter(r=>!r.q.optional);
  return selected.sort((a,b)=>
    (rated.length?a.score-b.score:0)||
    Number(!!a.q.optional)-Number(!!b.q.optional)||a.order-b.order
  );
}
export function proposalVariant(score){
  return Number.isInteger(score)&&score<=1?'low':score===2?'mid':Number.isInteger(score)&&score>=3?'high':'mid';
}
export const variantLabels={
  original:'Базовий захід',
  low:'Усунути основну проблему',
  mid:'Уточнити й посилити практику',
  high:'Закріпити успіх і розвивати далі'
};
export function improvement(q,score){
  const tip=(i)=>q.tips?.[i]||q.action;
  const levels=[
    {heading:'З чого почати',assessment:'Зараз бракує базової процедури або зрозумілого доступу до неї.',action:tip(0),level:'needs-work'},
    {heading:'Що налагодити',assessment:'Відомі окремі елементи практики, але їх ще складно застосувати самостійно.',action:tip(1),level:'needs-work'},
    {heading:'Що вдосконалити',assessment:'Основа вже є, наступне завдання — зробити порядок дій передбачуваним і перевірюваним.',action:tip(2),level:'progress'},
    {heading:'Як закріпити результат',assessment:'Практика вже працює у звичних ситуаціях. Її варто перевірити на складнішому прикладі.',action:tip(3),level:'strong'},
    {heading:'Що покращити навіть за доброго результату',assessment:'Висока оцінка — це сильна сторона. Важливо не зупинятися, а перевірити стійкість практики й поширити корисний досвід.',action:tip(4),level:'strong'}
  ];
  return Number.isInteger(score)&&score>=0&&score<=4?levels[score]:{
    heading:'Що допоможе оцінити практику',
    assessment:'Відомостей поки недостатньо, тому висновок про якість практики робити зарано.',
    action:'Уточніть у відповідального підрозділу, де знайти чинний порядок, приклади застосування та контакт для запитань.',
    level:'unknown'
  };
}
export function surveySummary(questions,answers){
  const values=questions.map((q,i)=>({q,score:answers[i]})).filter(({score})=>Number.isInteger(score)&&score>=0&&score<=4);
  if(!values.length)return 'У вас не було достатньо відомостей для оцінювання. Ви все одно можете передати пропозицію щодо зрозумілості процедур.';
  const weak=values.filter(x=>x.score<=1).length,good=values.filter(x=>x.score>=3).length;
  if(weak&&good)return 'Ви позначили і сильні практики, і ті, що потребують першочергового поліпшення. Можна запропонувати рішення для будь-якої з них.';
  if(weak)return 'Ваші відповіді виявили практики, де потрібні конкретні зміни. Оберіть проблему й запропонуйте перший перевірюваний крок.';
  if(good===values.length)return 'За вашими відповідями практики працюють добре. Ви можете запропонувати, як закріпити успіх, випробувати складніший сценарій або поширити досвід.';
  return 'Частина практик уже налагоджена, інші можна посилити. Оберіть напрям, для якого ваша пропозиція буде найкориснішою.';
}
