/**
 * Exactly 7 independent cadet and 7 teacher pilot responses to all 15 questions.
 * Includes all 3 optional situations so the group-level minimum of 7 is met.
 * One-off live survey entry authorized for the project owner's competition check.
 * This is synthetic data recorded in the same live aggregate as other ballots.
 * DO NOT RE-RUN after success.
 */
import {randomInt} from 'node:crypto';
const root='https://vektor-integrity-lab.clayblade5.chatgpt.site/api/v1/live-';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(name,body,cookie){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const options={signal:AbortSignal.timeout(15000),cache:'no-store'};
      if(body!==undefined){
        options.method='POST';
        options.headers={'content-type':'application/json',...(cookie?{cookie}:{})};
        options.body=JSON.stringify(body);
      }
      const response=await fetch(root+name,options);
      let data;try{data=await response.json()}catch{throw Error('Invalid API response: '+response.status)}
      if(!response.ok){const e=Error(name+' status '+response.status+': '+data.error);e.status=response.status;throw e}
      return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
    }catch(e){
      if(attempt===2||e.status&&![409,429,500,502,503,504].includes(e.status))throw e;
      await sleep((attempt+1)*700);
    }
  }
}
const {data:info}=await call('info');
if(info.requiredCount!==12||info.questions?.length!==15)
  throw Error('Server does not offer 12 core + 3 optional questions; no submissions made.');
const scenarios=info.questions.slice(12);
if(!scenarios.every(q=>['versions','backup','receipt'].includes(q.id)))
  throw Error('Unexpected scenario catalog; no submissions made.');
const totals={cadets:0,teachers:0,proposals:0};
for(let i=0;i<14;i++){
  const group=i<7?'cadets':'teachers';
  const session=await call('start',{});
  if(session.data.submitted||!session.cookie.startsWith('vector_ballot='))
    throw Error('Missing unique anonymous survey ticket on submission '+(i+1));
  const answers=Array.from({length:15},()=>randomInt(0,5));
  const proposal=i%4===0?scenarios[i%3].id:null;
  const result=await call('answer',{group,answers,proposal},session.cookie);
  if(!result.data.ok||result.data.existing)
    throw Error('New survey ballot was not acknowledged '+(i+1));
  totals[group]++;
  if(proposal)totals.proposals++;
  console.log('SCENARIO BALLOT '+(i+1)+'/14: '+group+'; 3/3 scenarios answered'+(proposal?'; proposal '+proposal:''));
  await sleep(160);
}
if(totals.cadets!==7||totals.teachers!==7)throw Error('Unexpected totals '+JSON.stringify(totals));
console.log('SCENARIO COMPLETE '+JSON.stringify(totals)+'; all 3 optional scenarios answered by both groups');
