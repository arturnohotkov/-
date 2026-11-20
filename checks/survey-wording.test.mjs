import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveQuestions} from '../core/live-catalog.mjs';
import {detailedAnswers,optionsFor} from '../public/survey-wording.mjs';

test('All 15 live survey items have five distinct, detailed answer choices for cadets and teachers',()=>{
  assert.equal(liveQuestions.length,15);
  assert.deepEqual(Object.keys(detailedAnswers).sort(),liveQuestions.map(q=>q.id).sort());
  for(const q of liveQuestions){
    for(const group of ['cadets','teachers']){
      const choices=optionsFor(q,group);
      assert.equal(choices.length,5,`${group}: ${q.id}`);
      assert.equal(new Set(choices).size,5,`${group}: ${q.id} has duplicate levels`);
      for(const [i,choice] of choices.entries()){
        assert.ok(choice.trim().length>=55,`${group}: ${q.id} level ${i} is too terse`);
        assert.ok(choice.length<=270,`${group}: ${q.id} level ${i} too long for questionnaire`);
      }
    }
    assert.notDeepEqual(optionsFor(q,'cadets'),optionsFor(q,'teachers'),
      `Cadet and teacher answers must reflect different experience: ${q.id}`);
    assert.deepEqual(optionsFor(q,'unsupported'),q.options,'Fallback retains official option order');
    assert.deepEqual(q.options.length,5,'Original survey scale is intact');
  }
});

test('Live survey presents role-specific choices while keeping the same 0–4 score values',()=>{
  const source=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
  assert.match(source,/optionsFor\(q,group\)/);
  assert.match(source,/optionsFor\(lowest\.item,group\)\[lowest\.score\]/);
  assert.ok(source.includes('value="${i}"'),'Radio answers preserve numeric 0–4 values');
  assert.match(source,/Не можу оцінити \/ бракує інформації/);
  assert.match(source,/answers\.map\(v=>v===5\?null:v\)/);
  assert.match(source,/survey-wording\.mjs\?v=1/);
});

test('Only public live survey bundles the new wording; offline demo remains independent',()=>{
  const pageBuild=readFileSync(new URL('../offline/build-pages.mjs',import.meta.url),'utf8');
  assert.match(pageBuild,/'survey-wording\.mjs'/);
  const demoBuild=readFileSync(new URL('../offline/build-html.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(demoBuild,/survey-wording\.mjs/);
  const liveShell=readFileSync(new URL('../core/live-shell.mjs',import.meta.url),'utf8');
  assert.match(liveShell,/\/live\.js\?v=12/);
});
