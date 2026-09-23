const assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');const {publicSeoJob}=load('seo/lib/job-response.ts');
(async()=>{
await check('job response removes execution credential fields but preserves UX fields',()=>{const input={id:'j',executionToken:'PRIVATE',executionExpiresAt:new Date(),supersededAt:'date',status:'running',article:{title:'Article'},meta:{progress:3}};const out=publicSeoJob(input);assert.equal('executionToken' in out,false);assert.equal('executionExpiresAt' in out,false);assert.equal(out.supersededAt,'date');assert.equal(out.id,'j');assert.equal(out.article,input.article);assert.equal(input.executionToken,'PRIVATE')});
await check('legacy job without execution fields retains shape',()=>assert.equal(JSON.stringify(publicSeoJob({id:'old',status:'done'})),JSON.stringify({id:'old',status:'done'})));
console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
