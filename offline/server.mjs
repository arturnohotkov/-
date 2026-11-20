import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {handle} from '../core/api.mjs';
import {shell} from '../core/shell.mjs';
import {liveShell} from '../core/live-shell.mjs';
import {handleLive} from '../core/live.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=process.env.VECTOR_DATA||root+'.local-data';mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(dir+'/vector.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)');
const storage={
 get:id=>db.prepare('SELECT * FROM workspaces WHERE id=?').get(id),
 add:(id,s)=>db.prepare('INSERT OR IGNORE INTO workspaces VALUES (?,0,?)').run(id,JSON.stringify(s)),
 put:(id,r,s)=>db.prepare('UPDATE workspaces SET revision=revision+1,payload=? WHERE id=? AND revision=?').run(JSON.stringify(s),id,r).changes===1};
const externalOrigin=process.env.VECTOR_ORIGIN?new URL(process.env.VECTOR_ORIGIN).origin:null;
const mode=process.env.VECTOR_MODE||'demo',keys={lead:process.env.VECTOR_LEAD_KEY,officer:process.env.VECTOR_OFFICER_KEY};
if(!['demo','team'].includes(mode)||mode==='team'&&(!keys.lead||!keys.officer||keys.lead===keys.officer))throw Error('Потрібні окремі VECTOR_LEAD_KEY та VECTOR_OFFICER_KEY.');
const assets={'/demo.mp4':'video/mp4','/demo-poster.jpg':'image/jpeg','/manager.mjs':'text/javascript','/survey-wording.mjs':'text/javascript','/vorobtsi-qr.png':'image/png','/live.js':'text/javascript','/live.css':'text/css','/vector.js':'text/javascript','/transport.mjs':'text/javascript','/vektor.html':'text/html; charset=utf-8','/vector.css':'text/css','/mark.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,externalOrigin||('http://'+req.headers.host));
 if(url.pathname.startsWith('/api/v1/')){
 const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>16000){res.writeHead(413).end();return}chunks.push(part)}
 const request=new Request(url,{headers:req.headers,method:req.method,body:req.method==='POST'?Buffer.concat(chunks):undefined});
 const reply=url.pathname.startsWith('/api/v1/live-')?await handleLive(request,storage,process.env.VECTOR_MANAGER_HASH):await handle(request,storage,{mode,keys});
 res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
 }
 if(['/','/demo','/survey','/manager'].includes(url.pathname)){
   const live=url.pathname==='/survey'||url.pathname==='/manager'||url.pathname==='/'&&process.env.VECTOR_MANAGER_HASH;
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(live?liveShell:shell);return
 }
 if(Object.hasOwn(assets,url.pathname)){res.writeHead(200,{'Content-Type':assets[url.pathname]});res.end(readFileSync(root+'public'+url.pathname));return}
 res.writeHead(404).end();
 }catch{res.writeHead(500).end()}
}).listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Вектор · http://'+(process.env.HOST||'127.0.0.1')+':'+server.address().port));
