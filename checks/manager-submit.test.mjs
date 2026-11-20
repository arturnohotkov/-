import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Manager Save uses form HTML id attribute, not a named field that shadows form.id',()=>{
 const source=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
 assert.match(source,/<select name="id" id="plan-practice"/);
 // In actual browsers <select name="id"> shadows HTMLFormElement.id.
 assert.doesNotMatch(source,/\bform\.id\b/);
 assert.match(source,/if\(form\.getAttribute\('id'\)==='plan'\)/);
 assert.match(source,/type="submit" data-action="save-plan"/);
 assert.match(source,/root\.addEventListener\('invalid'/);
 assert.match(source,/saveLocalPlan\(localStorage,planKey,payload,lastState\.practices\)/);
});

test('Published HTML loads a fresh manager JS version',()=>{
 const shell=readFileSync(new URL('../core/live-shell.mjs',import.meta.url),'utf8');
 assert.match(shell,/\/live\.js\?v=11/);
});
