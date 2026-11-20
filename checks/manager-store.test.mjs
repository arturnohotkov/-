import test from 'node:test';
import assert from 'node:assert/strict';
import {getLocalPlans,saveLocalPlan,changeLocalStatus,mergeLocalPlans} from '../public/manager-store.mjs';

function storage(){
 const map=new Map();
 return {getItem:key=>map.get(key)||null,setItem:(key,val)=>map.set(key,val)};
}
const practice={id:'contact',title:'Консультації',action:'Перевірити порядок консультацій.',score:65,
 published:{cadets:7,teachers:null}};
const payload={id:'contact',action:'Провести додаткове навчання.',verify:'Підтверджений протокол заняття.',
 owner:'Навчальний відділ',due:'2027-03-15'};
const state=()=>({practices:[practice],proposals:[],total:5,history:[]});

test('Real manager retains own action across refresh and can update its status',()=>{
 const browser=storage(),key='shared-manager';
 saveLocalPlan(browser,key,payload,[practice]);
 let visible=mergeLocalPlans(state(),browser,key);
 assert.equal(visible.proposals[0].plan.action,payload.action);
 assert.equal(visible.proposals[0].plan.localOnly,true);
 assert.equal(visible.localPlanCount,1);
 // Simulate a new page load.
 visible=mergeLocalPlans(state(),browser,key);
 assert.equal(visible.proposals[0].plan.owner,'Навчальний відділ');
 changeLocalStatus(browser,key,'contact','active');
 visible=mergeLocalPlans(state(),browser,key);
 assert.equal(visible.proposals[0].plan.status,'active');
 assert.equal(getLocalPlans(browser,key).contact.verify,payload.verify);
});

test('Server plan takes priority and does not duplicate local entry',()=>{
 const browser=storage(),key='shared-manager';
 saveLocalPlan(browser,key,payload,[practice]);
 const remote={...state(),proposals:[{id:'contact',title:practice.title,
    votes:1,action:practice.action,plan:{...payload,action:'Серверна дія',status:'done'}}]};
 const visible=mergeLocalPlans(remote,browser,key);
 assert.equal(visible.proposals.length,1);
 assert.equal(visible.proposals[0].plan.action,'Серверна дія');
 assert.equal(visible.localPlanCount,0);
});

test('Browser blocked local storage does not report successful save',()=>{
 const blocked={getItem:()=>null,setItem:()=>{throw Error('blocked')}};
 assert.throws(()=>saveLocalPlan(blocked,'key',payload,[practice]),/заборонив/);
});

test('Reject malformed or incomplete management actions',()=>{
 const browser=storage(),key='manager';
 assert.throws(()=>saveLocalPlan(browser,key,{...payload,action:' '},[practice]),/Заповніть/);
 assert.throws(()=>saveLocalPlan(browser,key,{...payload,due:'2027-02-30'},[practice]),/Заповніть/);
 assert.throws(()=>changeLocalStatus(browser,key,'contact','unknown'),/Невірний/);
});
