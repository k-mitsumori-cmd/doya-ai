// Offline endpoint regressions: unsafe source denial must precede Chromium/AI.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const repo=path.resolve(__dirname,'../..'),ts=require('typescript');
const source=fs.readFileSync(path.join(repo,'src/app/api/banner/from-url/route.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function harness(auth=true){const exports={},calls=[];let reads=0,model=0,browser=0;vm.runInNewContext(compiled,{exports,URL,Buffer,setTimeout,clearTimeout,process:{env:{}},console:{error(){},warn(){},log(){}},require(name){
 if(name==='next/server')return{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}};
 if(name==='next-auth')return{getServerSession:async()=>auth?{user:{id:'mock',plan:'FREE'}}:null};
 if(name==='@/lib/auth')return{authOptions:{}};
 if(name==='@/lib/net/safe-fetch')return{safeFetchText:async(url,opts)=>{calls.push({url,opts});return null;},safeFetchResource:async()=>{throw Error('unexpected resource');}};
 if(name==='@/lib/net/safe-browser')return{SAFE_BROWSER_ARGS:[],installSafeBrowserRequests:async()=>{browser++;throw Error('Browser must not run');}};
 if(name==='@/lib/nanobanner')return{isNanobannerConfigured:()=>true,generateBanners:async()=>{model++;throw Error('Model must not run');}};
 if(name==='@/lib/pricing')return{getCurrentMonthJST:()=> '2026-09',isWithinFreeHour:()=>true};
 if(name==='@/lib/banner/monthly-quota')return{reserveBannerMonthlyImages:async()=>{throw Error('Quota must not run before safe URL rejection')},releaseBannerMonthlyImages:async()=>{throw Error('No reservation to release')}};
 if(name==='@/lib/prisma')return{prisma:{userServiceSubscription:{findUnique:async()=>null},user:{findUnique:async()=>({plan:'FREE'})}}};
 if(name==='@/lib/service-usage')return{};
 if(name==='crypto')return{};
 if(name==='sharp')return()=>{throw Error('Unexpected image processing');};
 throw Error('Unexpected dependency '+name);
 },fetch(){throw Error('DIRECT FETCH');}});return{...exports,calls,get reads(){return reads},get model(){return model},get browser(){return browser},req(url){return{json:async()=>{reads++;return{targetUrl:url}}}}};}
(async()=>{
 await test('anonymous request rejected before body and network',async()=>{const x=harness(false);assert.equal((await x.POST(x.req('https://example.test'))).status,401);assert.equal(x.reads,0);assert.equal(x.calls.length,0);});
 for(const url of ['http://[::1]/','http://[::ffff:7f00:1]/','http://127.0.0.2/','http://localhost./','https://rebind.example.test/'])await test('shared transport denial stops generation '+url,async()=>{const x=harness();assert.equal((await x.POST(x.req(url))).status,422);assert.equal(x.calls.length,1);assert.equal(x.model,0);assert.equal(x.browser,0);});
 await test('unsafe browser continuations absent from route',()=>{assert.ok(!source.includes('req.continue()'));assert.equal((source.match(/installSafeBrowserRequests\(page\)/g)||[]).length,2);assert.equal((source.match(/disposeRequests\?\.\(\)/g)||[]).length,2);assert.ok(!/fetch\((?:targetUrl|url|u),/.test(source));});
 console.log(JSON.stringify({passed,failed:0,networkRequests:0,modelRequests:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
