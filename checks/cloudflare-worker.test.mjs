import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare/worker.mjs';

const managerHash='b'.repeat(64);

test('Same-repository Worker fails closed until manager auth and D1 are configured',async()=>{
 const url='https://vorobtsi-integrity-api.example.workers.dev/api/v1/live-info';
 const noHash=await worker.fetch(new Request(url),{DB:{}});
 assert.equal(noHash.status,503);
 assert.equal((await noHash.json()).error.includes('не налаштовано'),true);
 const noDatabase=await worker.fetch(new Request(url),{VECTOR_MANAGER_HASH:managerHash});
 assert.equal(noDatabase.status,503);
});

test('Worker publishes the current shared action API with the exact same question set',async()=>{
 const url='https://vorobtsi-integrity-api.example.workers.dev/api/v1/live-info';
 const response=await worker.fetch(new Request(url),{DB:{},VECTOR_MANAGER_HASH:managerHash});
 assert.equal(response.status,200);
 const info=await response.json();
 assert.equal(info.manualMeasures,true);
 assert.equal(info.managerConfigured,true);
 assert.equal(info.questions.length,15);
});

test('Worker permits GitHub Pages CORS preflight but not an unrelated host',async()=>{
 const url='https://vorobtsi-integrity-api.example.workers.dev/api/v1/live-plan';
 const response=await worker.fetch(new Request(url,{
   method:'OPTIONS',headers:{origin:'https://arturnohotkov.github.io'}
 }),{DB:{},VECTOR_MANAGER_HASH:managerHash});
 assert.equal(response.status,204);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://arturnohotkov.github.io');
 const denied=await worker.fetch(new Request(url,{
   method:'OPTIONS',headers:{origin:'https://untrusted.example'}
 }),{DB:{},VECTOR_MANAGER_HASH:managerHash});
 assert.equal(denied.status,403);
});

test('Cloudflare Worker deployment is defined within this GitHub repository',()=>{
 const configuration=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(configuration.main,'cloudflare/worker.mjs');
 assert.equal(configuration.d1_databases[0].binding,'DB');
 const migration=readFileSync(new URL('../cloudflare/migrations/0001_workspaces.sql',import.meta.url),'utf8');
 assert.match(migration,/CREATE TABLE IF NOT EXISTS workspaces/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM/i);
 const workflow=readFileSync(new URL('../.github/workflows/backend-cloudflare.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_dispatch/);
 assert.match(workflow,/secrets.CLOUDFLARE_API_TOKEN/);
 assert.match(workflow,/secrets.VECTOR_MANAGER_HASH/);
});
