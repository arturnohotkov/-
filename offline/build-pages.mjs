import {writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {liveShell} from '../core/live-shell.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.argv[2]||'pages');
const repo=process.env.GITHUB_REPOSITORY?.split('/')[1]||'vektor';
if(!/^[\w.-]+$/.test(repo))throw Error('Invalid repository name');
const base=repo.toLowerCase().endsWith('.github.io')?'':'/'+repo;
// Keep the existing production endpoint unless an administrator explicitly opts into a migrated backend.
const previousApi='https://vektor-integrity-lab.clayblade5.chatgpt.site';
const configuredApi=(process.env.VECTOR_API_URL||'').trim();
const parsedApi=new URL(configuredApi||previousApi);
if(parsedApi.protocol!=='https:'||parsedApi.username||parsedApi.password||parsedApi.search||
   parsedApi.hash||parsedApi.pathname!=='/'||parsedApi.port){
  throw new Error('VECTOR_API_URL must be a HTTPS origin, with no path, credentials or query.');
}
const api=parsedApi.origin;
const page=liveShell.replace('<head>',`<head><meta name="vektor-base" content="${base}"><meta name="vektor-api" content="${api}">`)
  .replace(/(href|src)="(\/[^"]*)"/g,(_,attr,path)=>attr+'="'+base+path+(['/demo','/manager','/survey'].includes(path)?'/':'')+'"');
await mkdir(output,{recursive:true});
for(const section of ['','manager','survey']){
  const directory=join(output,section);
  await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'index.html'),page);
}
for(const asset of ['live.js','live.css','mark.svg','manager.mjs','manager-advice.mjs','manager-store.mjs','manager-sync.mjs','survey-wording.mjs','survey-advice.mjs','vorobtsi-qr.png','demo.mp4','demo-poster.jpg','presentation.html'])await copyFile(join(root,'public',asset),join(output,asset));
if(process.env.GITHUB_REPOSITORY?.toLowerCase()==='arturnohotkov/-'){
  await copyFile(join(root,'public','vorobtsi-pages-qr.png'),join(output,'vorobtsi-qr.png'));
}
execFileSync(process.execPath,[join(root,'offline/build-html.mjs'),join(output,'demo','index.html')]);
await writeFile(join(output,'.nojekyll'),'');
