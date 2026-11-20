import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Standalone HTML contains the interface and runs a full survey and CSV without a network', async () => {
  const html = readFileSync(new URL('../public/vektor.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=|<link rel="stylesheet"/);
  const embedded = html.match(/import \{request, portable\} from "(data:text\/javascript;base64,[^"]+)"/);
  assert.ok(embedded);
  const storage = new Map();
  globalThis.location = {pathname: '/vektor.html'};
  globalThis.sessionStorage = {getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v)};
  const {request, portable} = await import(embedded[1]);
  assert.equal(portable, true);
  assert.equal((await request('start', {})).status, 200);
  const state = await (await request('state')).json();
  assert.equal(state.demoOwner, true);
  const cycle = state.cycles.find(c => !c.closed).id;
  const {invitation} = await (await request('issue', {cycle, group: 'staff', version: 2})).json();
  const info = await (await request('invite-info', {invitation})).json();
  assert.equal(info.questions.length, 12);
  const answers = info.questions.map(() => 2);
  assert.equal((await request('answer', {invitation, answers})).status, 200);
  assert.equal((await request('answer', {invitation, answers})).status, 410);
  assert.match(await (await request('report.csv?cycle=5')).text(), /Профіль практик/);
  await request('role', {role: 'officer'});
  const reopened = await import(embedded[1] + '#reopen');
  assert.equal((await (await reopened.request('state')).json()).role, 'officer');
});
