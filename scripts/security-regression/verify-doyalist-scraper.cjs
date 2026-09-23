// Offline security regression: no DNS, HTTP, production or paid API requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const { resolve } = require('node:path');
const repo = resolve(__dirname, '../..');
const ts = createRequire(repo+'/package.json')('typescript');
const source = fs.readFileSync(repo+'/src/lib/doyalist/collect/web-scraper.ts','utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
let passed = 0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function harness(result='<html>Company</html>', throws=false){
 const exports={}, safeCalls=[], aiCalls=[], logs=[];
 const safe={async safeFetchText(url,opts){safeCalls.push({url,opts});if(throws)throw Error('https://secret:password@host/?token=hidden');return result;},htmlToText:html=>html.replace(/<[^>]*>/g,'')};
 vm.runInNewContext(compiled,{exports,require(name){if(name==='@/lib/net/safe-fetch')return safe;throw Error('unexpected import');},process:{env:{GEMINI_API_KEY:'mock-only-not-a-secret'}},console:{error(...args){logs.push(args);}},fetch:async(url,opts)=>{aiCalls.push({url,opts});assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"companyName":"Example"}'}]}}]})};}});
 return {...exports,safeCalls,aiCalls,logs};
}
(async()=>{
 await test('website fetch delegated to safeFetchText',async()=>{const x=harness();assert.equal((await x.scrapeCompanyWebsite('https://example.test')).companyName,'Example');assert.equal(x.safeCalls.length,1);assert.equal(x.safeCalls[0].opts.timeoutMs,10000);assert.equal(x.aiCalls.length,1);});
 await test('fetch failure stops before AI call',async()=>{const x=harness(null);assert.equal(await x.scrapeCompanyWebsite('http://127.0.0.1'),null);assert.equal(x.aiCalls.length,0);});
 await test('prefetched HTML skips website network path',async()=>{const x=harness(null);assert.equal((await x.scrapeCompanyWebsite('https://example.test','<html>prefetched</html>')).companyName,'Example');assert.equal(x.safeCalls.length,0);assert.ok(x.aiCalls[0].opts.body.includes('prefetched'));});
 await test('error log contains fixed label only',async()=>{const x=harness(null,true);assert.equal(await x.scrapeCompanyWebsite('https://secret:password@host/?token=hidden'),null);assert.equal(JSON.stringify(x.logs),'[["[doyalist] Website extraction failed"]]');assert.equal(x.aiCalls.length,0);});
 await test('multiple companies retain successful map and progress',async()=>{const x=harness();let progress=[];const result=await x.scrapeMultipleCompanies([{companyId:'1',url:'https://one.test'},{companyId:'2',url:'https://two.test'}],(a,b)=>progress.push([a,b]));assert.equal(result.size,2);assert.deepEqual(progress,[[1,2],[2,2]]);assert.equal(x.safeCalls.length,2);});
 console.log(JSON.stringify({passed,failed:0,networkRequests:0,paidApiRequests:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
