import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adviceCatalog,choosePracticeGuidance,contextualizeDashboard} from '../public/manager-advice.mjs';
import {adviceByPractice} from '../core/practice-copy.mjs';
import {liveQuestions,variants} from '../core/live-catalog.mjs';
import {renderSection,managerCsv} from '../public/manager.mjs';

const base=q=>({
  id:q.id,title:q.title,component:q.component,score:52,category:'forming',
  action:q.action,check:'Передбачена базова перевірка.',verify:'Підтвердження.',
  groups:{cadets:50,teachers:54},published:{cadets:7,teachers:7},votes:0,
  offered:[],label:'Практика формується',optional:!!q.optional,anchor:!!q.anchor,
});
const info={criteria:['Культура','Система','Підзвітність'],questions:liveQuestions};
function dashboard(override={}){
 const practices=liveQuestions.map(base);
 const components=info.criteria.map(label=>({label,score:50}));
 return {total:20,index:50,components,practices,proposals:[],history:[],minimum:7,...override};
}
test('All twelve primary practices and all three scenarios have unique, complete action-check-verification sets',()=>{
 assert.equal(liveQuestions.length,15);
 assert.deepEqual(Object.keys(adviceCatalog).sort(),liveQuestions.map(q=>q.id).sort());
 for(const q of liveQuestions){
   for(const mode of ['low','mid','split','high']){
     const x=adviceCatalog[q.id]?.[mode];
     assert.ok(x,q.id+' '+mode);
     for(const field of ['action','check','verify'])
       assert.ok(x[field]?.length>=50,q.id+' '+mode+' '+field+' should be specific');
     if(q.optional)assert.deepEqual(x,variants[q.id][mode],q.id+' '+mode+' scenario source differs');
     else assert.deepEqual(x,adviceByPractice[q.id][mode],q.id+' '+mode+' primary source differs');
   }
 }
});

test('Each of the four priority states selects its own three content-specific recommendations',()=>{
 const example=base(liveQuestions.find(q=>q.id==='system'));
 for(const [score,category,expected] of [[20,'priority','low'],[58,'forming','mid'],[91,'strong','high'],[65,'split','split']]){
   const p=choosePracticeGuidance({...example,score,category});
   for(const field of ['action','verify'])
     assert.equal(p[field],adviceCatalog.system[expected][field]);
   assert.ok(p.check.includes(adviceCatalog.system[expected].check));
 }
 const mid=choosePracticeGuidance(example);
 assert.match(mid.check,/плану уповноваженого/);
 assert.match(mid.action,/контроль виконання/);
 assert.match(mid.verify,/контрольну дату/);
 assert.doesNotMatch(mid.action,/На найближчій нараді розберіть один захід/);
});

test('Group differences are a question for verification, not a claim of proven corruption',()=>{
 const x=choosePracticeGuidance({...base(liveQuestions[0]),category:'split',score:61,groups:{cadets:30,teachers:75}});
 assert.match(x.check,/оцінки груп різняться/);
 assert.match(x.check,/перевірте/);
 assert.doesNotMatch(x.check,/встановлено порушення|доведено порушення/);
});

test('Missing evidence does not trigger an invented low-rating recommendation',()=>{
 const p=base(liveQuestions[0]);
 const unchanged=choosePracticeGuidance({...p,score:null,category:'hidden'});
 assert.equal(unchanged.check,p.check);
 const proposed=choosePracticeGuidance({...p,score:null,category:'hidden',offered:[{mode:'low',votes:1}]});
 assert.equal(proposed.action,adviceCatalog.culture.low.action);
});

test('The real management priorities, questions, report and CSV use the same relevant advice',()=>{
 const state=dashboard();
 const q=state.practices.find(p=>p.id==='system');
 q.category='forming';q.score=50;q.votes=1;
 const recommendation=adviceCatalog.system.mid;
 const p=renderSection(state,info,'priorities');
 for(const field of ['check','action','verify'])assert.ok(p.includes(recommendation[field]),field+' must show');
 const questionPage=renderSection(state,info,'questions');
 assert.ok(questionPage.includes(recommendation.check));
 const report=renderSection(state,info,'report');
 assert.ok(report.includes(recommendation.action));
 const csv=managerCsv(state,info);
 assert.ok(csv.includes(recommendation.verify));
 assert.equal(contextualizeDashboard(state).practices.find(p=>p.id==='system').action,recommendation.action);
 assert.equal(state.practices.find(p=>p.id==='system').action,q.action,'raw manager state must not be mutated');
});

test('The production build ships new independent manager advice without rewriting the demo',()=>{
 const build=readFileSync(new URL('../offline/build-pages.mjs',import.meta.url),'utf8');
 assert.match(build,/'manager-advice\.mjs'/);
 const manager=readFileSync(new URL('../public/manager.mjs',import.meta.url),'utf8');
 assert.match(manager,/from '\.\/manager-advice\.mjs\?v=20'/);
 const live=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
 assert.match(live,/choosePracticeGuidance\(available\.find/);
 assert.match(live,/choosePracticeGuidance\(lastState\.practices\.find/);
 const demo=readFileSync(new URL('../offline/build-html.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(demo,/manager-advice\.mjs/);
});
