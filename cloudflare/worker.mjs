import {handleLive} from '../core/live.mjs';

/**
 * Shared API for the existing GitHub repository.
 * Requires a Cloudflare D1 binding and a privately configured manager hash.
 * Does not modify the separate offline demonstration.
 */
const storageFromD1=db=>({
  async get(id){
    return db.prepare('SELECT id, revision, payload FROM workspaces WHERE id = ?').bind(id).first();
  },
  async add(id,value){
    await db.prepare('INSERT OR IGNORE INTO workspaces(id, revision, payload) VALUES (?, 0, ?)').bind(id,JSON.stringify(value)).run();
  },
  async put(id,revision,value){
    const result=await db.prepare('UPDATE workspaces SET revision = revision + 1, payload = ? WHERE id = ? AND revision = ?')
      .bind(JSON.stringify(value),id,revision).run();
    return result.meta?.changes===1;
  }
});
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    if(url.pathname==='/healthz'){
      return Response.json({ok:true,configured:!!env.VECTOR_MANAGER_HASH,storage:!!env.DB},
        {headers:{'Cache-Control':'no-store'}});
    }
    if(!url.pathname.startsWith('/api/v1/live-'))return new Response('Not found',{status:404});
    if(!env.DB||!env.VECTOR_MANAGER_HASH||!/^[a-f0-9]{64}$/i.test(env.VECTOR_MANAGER_HASH)){
      return Response.json({error:'Спільний сервер ще не налаштовано. Перевірте D1 та секрет керівника.'},
        {status:503,headers:{'Cache-Control':'no-store'}});
    }
    return handleLive(req,storageFromD1(env.DB),env.VECTOR_MANAGER_HASH);
  }
};
