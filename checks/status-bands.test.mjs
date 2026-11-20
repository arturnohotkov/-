import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describePracticeStatus,contextualizeDashboard} from '../public/manager-advice.mjs';
import {renderSection,managerCsv} from '../public/manager.mjs';

const sample=(score,category='forming',cadets=score,teachers=score)=>({
 id:'system',title:'Робота уповноваженого',component:1,score,category,
 label:'Практика формується',action:'Підтвердити дію',check:'Перевірити стан',verify:'Результат',
 groups:{cadets,teachers},published:{cadets:7,teachers:7},votes:0,offered:[],
 anchor:true,optional:false
});

test('Intermediate scores get distinct truthful labels without changing the actual numeric score or category',()=>{
 const cases=[
  [41,'Базові практики потребують розвитку'],
  [46.9,'Базові практики потребують розвитку'],
  [47,'Часткове впровадження'],
  [52.4,'Часткове впровадження'],
  [54,'Поступове зміцнення'],
  [59.9,'Поступове зміцнення'],
  [60,'Переважно стабільна практика'],
  [75,'Стабільна з резервом розвитку'],
  [83,'Високий рівень практики'],
  [97,'Сильна усталена практика']
 ];
 for(const [score,expected] of cases){
  const p=sample(score);
  assert.equal(describePracticeStatus(p),expected,score);
  const state={practices:[p]};
  const output=contextualizeDashboard(state).practices[0];
  assert.equal(output.label,expected);
  assert.equal(output.score,score);
  assert.equal(output.category,'forming');
  assert.equal(p.label,'Практика формується','Source state must not be mutated');
 }
});

test('Very low scores remain concerning, and the display never calls 50/100 a strong practice',()=>{
 for(const [value,text] of [[10,'Дуже низька оцінка'],[24,'Суттєві прогалини'],[38,'Потрібні першочергові зміни']]){
  assert.equal(describePracticeStatus(sample(value,'priority')),text);
 }
 for(let score=40;score<60;score++)assert.doesNotMatch(describePracticeStatus(sample(score)),/сильн|стабільн|висок/iu);
});

test('Group differences identify the lower scoring group instead of a generic recurring label',()=>{
 assert.equal(describePracticeStatus(sample(60,'split',32,88)),'Курсанти оцінюють нижче');
 assert.equal(describePracticeStatus(sample(60,'split',88,32)),'Викладачі оцінюють нижче');
 assert.equal(describePracticeStatus(sample(null,'hidden')),'Ще недостатньо оцінок');
});

test('Real manager cards, question list, report and CSV all show the same honest label',()=>{
 const p=sample(51,'forming',48,54);
 const info={criteria:['Культура','Система','Підзвітність'],questions:[{id:'system',question:'Який стан роботи уповноваженого?'}]};
 const state={total:20,index:51,components:[],history:[],proposals:[],practices:[p],minimum:7};
 const label='Часткове впровадження';
 for(const section of ['priorities','questions','report']){
  const html=renderSection(state,info,section);
  assert.match(html,/Часткове впровадження/,section);
  assert.doesNotMatch(html,/Практика формується/,section);
 }
 assert.match(managerCsv(state,info),/Часткове впровадження/);
 assert.equal(state.practices[0].score,51);
});

test('The wide intermediate classification gets three distinct badges, while demo remains untouched',()=>{
 const css=readFileSync(new URL('../public/live.css',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../public/manager.mjs',import.meta.url),'utf8');
 for(const suffix of ['forming-early','forming-mid','forming-late']){
  assert.ok(css.includes('.b-'+suffix),suffix);
  assert.ok(manager.includes(suffix),suffix);
 }
 const demoBuild=readFileSync(new URL('../offline/build-html.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(demoBuild,/manager-advice\.mjs/);
});

test('Every module in the live manager label display chain has a fresh version',()=>{
 const html=readFileSync(new URL('../core/live-shell.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../public/manager.mjs',import.meta.url),'utf8');
 assert.match(html,/\/live\.js\?v=23/);
 assert.match(client,/from '\.\/manager\.mjs\?v=20'/);
 assert.match(client,/from '\.\/manager-advice\.mjs\?v=20'/);
 assert.match(manager,/from '\.\/manager-advice\.mjs\?v=20'/);
 assert.doesNotMatch(manager,/from '\.\/manager-advice\.mjs'/);
 const display=renderSection({total:20,index:51,components:[],history:[],proposals:[],practices:[sample(51)],minimum:7},
   {criteria:['Культура','Система','Підзвітність'],questions:[{id:'system',question:'Який стан?'}]},'questions');
 assert.match(display,/Часткове впровадження/);
 assert.doesNotMatch(display,/Практика формується/);
});
