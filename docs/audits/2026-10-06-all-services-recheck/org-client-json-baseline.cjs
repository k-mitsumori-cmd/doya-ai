const assert=require('node:assert/strict'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
(async()=>{const results=[];for(const service of ['shodan','aio']){
const module=load('src/lib/'+service+'/client.ts',{}, {fetch:async()=>new Response('{not-json',{status:200}),AbortSignal:{timeout:()=>new AbortController().signal},Error,JSON});
const data=await module[service+'Get']('/api/'+service+'/synthetic','synthetic-org');assert.equal(Object.keys(data).length,0);
results.push({service,observed:'HTTP 200 malformed JSON resolves as an empty success object rather than rejecting.',source:'src/lib/'+service+'/client.ts'});
}
console.log(JSON.stringify({status:'confirmed-invalid-json-success-in-helpers',results,scope:'Actual production GET helpers with synthetic responses only. No external API, organization/customer data, provider or DB call. Each caller needs review to determine user impact; this is not evidence that a production incident occurred.'},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
