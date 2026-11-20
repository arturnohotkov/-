import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
test('Autonomous HTTP service, persisted workspace and CSV with no external dependencies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vector-qa-'));let child=null;
 async function start(){
  child=spawn(process.execPath,['offline/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',VECTOR_DATA:dir,VECTOR_MODE:'demo'},stdio:['ignore','pipe','pipe']});
  const line=createInterface({input:child.stdout});const [msg]=await once(line,'line');line.close();return msg.split(' · ')[1];
 }
 async function stop(){const end=once(child,'exit');child.kill();await end;child=null}
 try{
  let url=await start();
  assert.match(await (await fetch(url)).text(),/Платформа доброчесності/);
  assert.equal((await fetch(url+'/vector.js')).status,200);
  const login=await fetch(url+'/api/v1/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const get=async path=>(await fetch(url+path,{headers:{cookie}}));
  assert.equal((await (await get('/api/v1/state')).json()).cycles[4].index.toFixed(1),'76.2');
  await stop();url=await start();const csv=await get('/api/v1/report.csv?cycle=5');assert.match(await csv.text(),/Підзвітність/);
 }finally{if(child)await stop();await rm(dir,{recursive:true,force:true})}
});

