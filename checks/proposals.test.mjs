import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveQuestions} from '../core/live-catalog.mjs';
import {proposalCandidates,proposalVariant,improvement,surveySummary,variantLabels} from '../public/survey-advice.mjs';

test('Teachers can recommend an improvement even when all their ratings are high',()=>{
  const answers=Array(liveQuestions.length).fill(4);
  const ranked=proposalCandidates(liveQuestions,answers);
  assert.equal(ranked.length,liveQuestions.length);
  assert.equal(ranked[0].q.id,liveQuestions[0].id);
  assert.equal(proposalVariant(ranked[0].score),'high');
  assert.match(surveySummary(liveQuestions,answers),/добре/);
  assert.equal(ranked.every(row=>row.score===4),true);
  const advice=improvement(liveQuestions[0],4);
  assert.match(advice.heading,/покращити/);
  assert.equal(advice.action,liveQuestions[0].tips[4]);
  assert.equal(advice.level,'strong');
});

test('Low and mixed responses create concrete improvement suggestions',()=>{
  const zero=Array(liveQuestions.length).fill(0);
  const ranked=proposalCandidates(liveQuestions,zero);
  assert.equal(proposalVariant(ranked[0].score),'low');
  assert.match(surveySummary(liveQuestions,zero),/зміни/);
  const advice=improvement(liveQuestions[0],0);
  assert.equal(advice.action,liveQuestions[0].tips[0]);
  assert.equal(advice.level,'needs-work');

  const mixed=Array(liveQuestions.length).fill(4);
  mixed[5]=1;
  assert.equal(proposalCandidates(liveQuestions,mixed)[0].q.id,liveQuestions[5].id);
  assert.match(surveySummary(liveQuestions,mixed),/сильні практики/);
  assert.equal(proposalVariant(2),'mid');
  assert.equal(proposalVariant(3),'high');
  assert.equal(proposalVariant(1),'low');
});

test('Even without sufficient knowledge a participant can select a topic to clarify',()=>{
  const unknown=Array(liveQuestions.length).fill(5);
  const ranked=proposalCandidates(liveQuestions,unknown);
  assert.equal(ranked.length,12);
  assert.ok(ranked.every(row=>!row.q.optional));
  assert.equal(proposalVariant(ranked[0].score),'mid');
  assert.match(improvement(ranked[0].q,5).heading,/оцінити/);
  assert.match(surveySummary(liveQuestions,unknown),/не було достатньо/);
});

test('Survey opt-in is presented in both teacher and cadet flows, independently of score',()=>{
  const source=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
  assert.match(source,/return proposalCandidates\(info.questions,answers\)/);
  assert.match(source,/Так, передати цю пропозицію керівникові/);
  assert.match(source,/shared=fields.has\('share'\)/);
  assert.match(source,/proposal:shared&&q\?q.id:null/);
  assert.match(source,/variant:shared&&q\?submittedVariant:null/);
  assert.match(source,/recommendations|рекомендації за всіма відповідями/i);
  assert.ok(variantLabels.high.includes('Закріпити'));
});
