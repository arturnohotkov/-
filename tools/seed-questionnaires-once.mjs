/**
 * One-off participant-flow check against the live shared questionnaire.
 * Exactly 12 cadet and 12 teacher submissions, with independently randomized
 * valid answers. Intended for one user-requested pilot run only.
 *
 * CAUTION: these submissions enter the normal shared counts. Do not rerun.
 */
import {randomInt} from 'node:crypto';

const origin='https://vektor-integrity-lab.clayblade5.chatgpt.site';
const prefix=origin+'/api/v1/live-';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(name,payload,cookie){
  let failure;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const options={signal:AbortSignal.timeout(15000),cache:'no-store'};
      if(payload!==undefined){
        options.method='POST';
        options.headers={'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})};
        options.body=JSON.stringify(payload);
      }
      const response=await fetch(prefix+name,options);
      const raw=await response.text();
      let data;
      try{data=JSON.parse(raw)}catch{throw Error('API returned invalid JSON (HTTP '+response.status+')')}
      if(!response.ok){
        const error=Error('HTTP '+response.status+': '+(data.error||'Server rejected request'));
        error.status=response.status;
        throw error;
      }
      return {data,setCookie:response.headers.get('set-cookie')||''};
    }catch(err){
      failure=err;
      if(attempt===2||err.status&&![409,429,500,502,503,504].includes(err.status))throw err;
      await pause(800*(attempt+1));
    }
  }
  throw failure;
}

const {data:info}=await request('info');
if(!Array.isArray(info.questions)||!Number.isInteger(info.requiredCount)||info.requiredCount<1||
  info.questions.length<info.requiredCount)throw Error('Unexpected questionnaire API schema');
if(!info.groups?.cadets||!info.groups?.teachers)throw Error('The configured survey roles are not present');

const schedule=[
  ...Array(7).fill('cadets'),...Array(7).fill('teachers'),
  ...Array(5).fill('cadets'),...Array(5).fill('teachers')
];
const submitted={cadets:0,teachers:0},votes={cadets:0,teachers:0};
for(let index=0;index<schedule.length;index++){
  const group=schedule[index];
  const started=await request('start',{});
  if(started.data.submitted)throw Error('Fresh anonymous session unexpectedly marked as submitted: '+index);
  const cookie=started.setCookie.split(';')[0];
  if(!cookie.startsWith('vector_ballot='))throw Error('API did not issue a new anonymous ticket for submission '+index);

  const answers=Array.from({length:info.requiredCount},()=>randomInt(0,5));
  const withProposal=index%3===0;
  const proposal=withProposal?info.questions[(index*7+1)%info.requiredCount].id:null;
  const payload={group,answers,proposal};
  const response=await request('answer',payload,cookie);
  if(!response.data.ok||response.data.existing)throw Error('Submission not accepted as new: '+index);
  submitted[group]++;
  if(proposal)votes[group]++;
  console.log('Accepted '+(index+1)+'/'+schedule.length+' · '+group+
    (proposal?' · voluntary proposal':''));
  await pause(200);
}
if(submitted.cadets!==12||submitted.teachers!==12)throw Error('Invalid totals: '+JSON.stringify(submitted));
console.log('COMPLETE '+JSON.stringify({accepted:24,byGroup:submitted,proposals:votes}));
