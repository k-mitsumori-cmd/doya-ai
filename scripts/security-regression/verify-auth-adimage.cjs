const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'../..')+'/';
const ts=require(root+'node_modules/typescript');
const results=[];
function moduleAt(file,mocks={},globals={}){
 const exports={};const ctx=vm.createContext({exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked import '+n)},URL,Error,Request,Headers,Uint8Array,TextDecoder,Buffer,Date,AbortController,setTimeout,clearTimeout,process:{env:{}},console:{error(){},warn(){}},...globals});
 vm.runInContext(ts.transpileModule(fs.readFileSync(root+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,ctx,{filename:file});return exports;
}
function pass(name){results.push(name)}
async function main(){
 const logs=[];const {authLogger}=moduleAt('src/lib/auth-logger.ts',{}, {console:{warn:(...a)=>logs.push(['warn',...a]),error:(...a)=>logs.push(['error',...a])}});
 authLogger.error('OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'google',error:new Error('access_denied')});assert.equal(logs.pop()[0],'warn');pass('Google access_denied stays in warning logs');
 for(const [code,metadata] of [
  ['OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'google',error:new Error('invalid_grant')}],
  ['OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'google',error:new Error('access_denied'),error_description:'policy failure'}],
  ['OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'other',error:new Error('access_denied')}],
  ['ADAPTER_ERROR',{error:new Error('access_denied')}],['OAUTH_CALLBACK_HANDLER_ERROR',null]
 ]){authLogger.error(code,metadata);assert.equal(logs.pop()[0],'error');}pass('Unexpected OAuth, policy, provider, adapter and unknown errors remain errors');

 // Exercise the installed NextAuth handler: it logs provider rejection twice.
 // The query.error path stops before any OAuth network request or DB access.
 const callback=require(root+'node_modules/next-auth/core/routes/callback.js').default;
 const runCallback=(error,providerId='google',error_description)=>callback({
  query:{error,...(error_description?{error_description}:{})},body:{},method:'GET',cookies:{},
  options:{provider:{type:'oauth',id:providerId},session:{strategy:'database'},url:'https://doya.test/api/auth',logger:{...authLogger,debug(){}}}
 });
 logs.length=0;
 const declined=await runCallback('access_denied');
 assert.equal(declined.redirect,'https://doya.test/api/auth/error?error=Callback');
 assert.equal(logs.filter(x=>x[0]==='error').length,0);assert.equal(logs.length,2);
 pass('Real NextAuth Google denial callback keeps both logs without error alerts');
 for(const args of [['invalid_grant'],['access_denied','other'],['access_denied','google','policy failure']]){
  logs.length=0;await runCallback(...args);assert.equal(logs.filter(x=>x[0]==='error').length,2);
 }
 pass('Real NextAuth unexpected provider and policy errors keep both alerts');
 authLogger.error('OAUTH_CALLBACK_ERROR',new Error('access_denied'));assert.equal(logs.pop()[0],'error');
 const sameError=new Error('access_denied');
 authLogger.error('OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'google',error:sameError});assert.equal(logs.pop()[0],'warn');
 authLogger.error('OAUTH_CALLBACK_ERROR',new Error('access_denied'));assert.equal(logs.pop()[0],'error');
 authLogger.error('OAUTH_CALLBACK_ERROR',sameError);assert.equal(logs.pop()[0],'warn');
 authLogger.error('OAUTH_CALLBACK_ERROR',sameError);assert.equal(logs.pop()[0],'error');
 pass('Only the previously classified error instance is suppressed once');

 let safeCalls=0,geminiCalls=0,fetchResult=null,failure={reason:'http',status:403};
 const brand=moduleAt('src/lib/adimage/brand.ts',{
  '@/lib/net/safe-fetch':{safeFetchText:async(_url,opts)=>{safeCalls++;if(!fetchResult)opts?.onFailure?.(failure);return fetchResult;},htmlToText:x=>x.replace(/<[^>]+>/g,' ')},
  '@seo/lib/gemini':{GEMINI_TEXT_MODEL_DEFAULT:'mock',geminiGenerateJson:async()=>{geminiCalls++;return{name:'Mock service',valueProps:['Useful']}}}
 });
 try{await brand.analyzeBrand('https://example.com')}catch(e){assert(e instanceof brand.BrandSourceError);assert.equal(e.status,422)}assert.equal(geminiCalls,0);pass('Blocked website does not invoke AI');
 failure={reason:'network'};await assert.rejects(()=>brand.analyzeBrand('https://example.com'),e=>e.status===503);pass('Network failures remain 503');
 const before=safeCalls;const p=await brand.analyzeBrand('https://example.com','Mock service description. '.repeat(6));assert.equal(safeCalls,before);assert.equal(p.name,'Mock service');assert.equal(geminiCalls,1);pass('Manual description completes analysis with no website request');
 fetchResult='<html>'+('Useful website information. '.repeat(20))+'</html>';await brand.analyzeBrand('https://example.com');assert.equal(geminiCalls,2);pass('Normal URL analysis remains functional');
 fetchResult='<html>short</html>';await assert.rejects(()=>brand.analyzeBrand('https://example.com'),e=>e.failure.reason==='insufficient_text'&&e.status===422);pass('Unreadable text offers recoverable input');


 // Shared PostgreSQL semantics are mocked; no real DB or paid API calls.
 let clock=Date.parse('2026-09-11T03:00:00Z');const states=new Map();let failClaim=false,failFinish=false;
 class Clock extends Date {static now(){return clock}}
 const day=()=>new Date(clock+9*3600_000).toISOString().slice(0,10);
 const budgetPrisma={
  $queryRaw:async(strings,...values)=>{
   if(failClaim)throw Error('db-private-canary');
   const sql=strings.join('?');assert(sql.includes('ON CONFLICT ("key") DO UPDATE'));assert(sql.includes("INTERVAL '330 seconds'"));assert(sql.includes("AT TIME ZONE 'Asia/Tokyo'"));
   const [_id,key,token,limit]=values;assert(/^adimage-analysis:v1:[a-f0-9]{64}$/.test(key));
   const prior=states.get(key);if(prior&&(prior.until>clock||(prior.day===day()&&prior.count>=limit)))return [];
   const state={day:day(),count:prior?.day===day()?prior.count+1:1,token,until:clock+330000};states.set(key,state);return [{value:JSON.stringify(state)}];
  },
  $executeRaw:async(strings,...values)=>{
   if(failFinish)throw Error('release-private-canary');assert(strings.join('?').includes(`"value"::jsonb->>'token' =`));
   const[refund,key,token]=values,state=states.get(key);if(!state||state.token!==token)return 0;
   states.set(key,{...state,token:null,until:0,count:Math.max(0,state.count-refund)});return 1;
  },
  systemSetting:{findUnique:async({where})=>states.has(where.key)?{value:JSON.stringify(states.get(where.key))}:null}
 };
 const makeBudget=()=>moduleAt('src/lib/adimage/analysis-budget.ts',{'node:crypto':require('node:crypto'),'@/lib/prisma':{prisma:budgetPrisma},'./access':{DAILY_CONCEPT_LIMIT:{FREE:5,PRO:40,GUEST:2}}},{Date:Clock});
 const budget=makeBudget(),free={userId:'test-free',guestId:null,plan:'FREE'};
 const simultaneous=await Promise.all(Array.from({length:30},()=>makeBudget().claimAnalysisBudget(free)));
 assert.equal(simultaneous.filter(x=>x.ok).length,1);assert(simultaneous.filter(x=>!x.ok).every(x=>x.reason==='busy'));
 pass('Thirty isolated instances allow only one concurrent analysis');
 await budget.finishAnalysisBudget(simultaneous.find(x=>x.ok).lease,true);
 assert.equal([...states.values()][0].count,0);pass('Pre-AI source failure refunds and releases immediately');
 for(let i=0;i<20;i++){const a=await budget.claimAnalysisBudget(free);assert(a.ok);await budget.finishAnalysisBudget(a.lease,false);}
 assert.equal((await budget.claimAnalysisBudget(free)).reason,'limit');pass('FREE daily analysis attempts stop at twenty');
 const pro={...free,userId:'test-pro',plan:'PRO'};
 for(let i=0;i<160;i++){const a=await budget.claimAnalysisBudget(pro);assert(a.ok);await budget.finishAnalysisBudget(a.lease,false);}
 assert.equal((await budget.claimAnalysisBudget(pro)).reason,'limit');pass('PRO daily analysis attempts stop at 160');
 clock=Date.parse('2026-09-11T15:00:01Z');const newDay=await budget.claimAnalysisBudget(free);assert(newDay.ok);assert.equal(states.get(newDay.lease.key).day,'2026-09-12');assert.equal(states.get(newDay.lease.key).count,1);pass('Daily budget resets at JST midnight');
 clock+=330001;const recovered=await budget.claimAnalysisBudget(free);assert(recovered.ok);
 await budget.finishAnalysisBudget(newDay.lease,true);assert.equal(states.get(recovered.lease.key).token,recovered.lease.token);assert.equal(states.get(recovered.lease.key).count,2);pass('Expired worker cannot release or refund newer lease');
 await budget.finishAnalysisBudget(recovered.lease,false);assert.equal(states.get(recovered.lease.key).count,2);pass('Post-AI failures retain paid attempt count');
 const recovery=await budget.claimAnalysisBudget(free);assert(recovery.ok);failFinish=true;await budget.finishAnalysisBudget(recovery.lease,true);assert.equal(states.get(recovery.lease.key).token,recovery.lease.token);failFinish=false;pass('Uncertain release keeps reservation until lease expiry');
 failClaim=true;assert.equal((await makeBudget().claimAnalysisBudget({...free,userId:'db-down'})).reason,'unavailable');failClaim=false;pass('Unavailable DB rejects analysis reservation');
 assert.equal((await budget.claimAnalysisBudget({...free,userId:null})).reason,'unavailable');pass('Analysis budget requires authenticated user identity');
 assert.equal(states.size,2);pass('Daily changes reuse one bounded row per user');

 class Resp {static json(body,opts){return{body,status:opts?.status??200,cookies:{set(){}}}}}
 let signedIn=true,forcedError=null,conceptCalls=0,dbWrites=0,receivedManual,brandCalls=0,conceptFailure=false,persistenceFailure=false;
 let admissionReason=null;const finishes=[];let budgetCalls=0;
 const operationalJson=moduleAt('src/lib/operational-json.ts');
 const apiLogs=[];
 const api=moduleAt('src/app/api/adimage/analyze/route.ts',{
  '@/lib/operational-json':operationalJson,
  '@/lib/adimage/analysis-budget':{claimAnalysisBudget:async()=>{budgetCalls++;return admissionReason?{ok:false,reason:admissionReason}:{ok:true,lease:{key:'test',token:'test'}}},finishAnalysisBudget:async(_lease,refund)=>finishes.push(refund)},
  'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma:{adImageBrand:{create:async()=>{if(persistenceFailure)throw Error('private-db-canary');dbWrites++;return{id:'mock-brand'}}}}},
  '@/lib/adimage/access':{getIdentity:async()=>({}),requireUser:()=>({ok:signedIn,reason:'login'}),ensureGuestId:()=>({identity:{userId:'test',plan:'FREE'}}),ownerWhere:()=>({userId:'test'})},
  '@/lib/adimage/brand':{...brand,analyzeBrand:async(_url,text)=>{brandCalls++;receivedManual=text;if(forcedError)throw forcedError;return{name:'Test',valueProps:[],colors:[]}}},
  '@/lib/adimage/copy':{generateConcepts:async()=>{conceptCalls++;if(conceptFailure)throw Error('private-concept-canary');return[{copy:{headline:'Mock'}}]},findRiskyExpressions:()=>[]}
 },{console:{warn:(...a)=>apiLogs.push(['warn',...a]),error:(...a)=>apiLogs.push(['error',...a])}});
 const req=body=>new Request('https://doya.test/api/adimage/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 signedIn=false;assert.equal((await api.POST(req({url:'https://example.com'}))).status,401);signedIn=true;pass('Unauthenticated request remains 401');
 for(const body of [null,[],{url:{toString:1}},{url:'https://example.com/'+ 'a'.repeat(8192)},{url:'https://example.com',appeal:{}},{url:'https://user:pass@example.com'},{url:'https://example.com',manualText:'short'},{url:'https://example.com',manualText:'a'.repeat(14001)},{url:'https://example.com',manualText:{}}]){assert.equal((await api.POST(req(body))).status,400);}assert.equal(dbWrites,0);assert.equal(budgetCalls,0);pass('Credentials, object URL, null, overlong URL and invalid manual input rejected before budget or AI');
 assert.equal((await api.POST(req({url:'https://example.com',unused:'x'.repeat(65536)}))).status,413);assert.equal(budgetCalls,0);pass('Whole JSON body rejected at 64 KiB before budget or AI');
 for(const reason of ['busy','limit','unavailable']){admissionReason=reason;assert.equal((await api.POST(req({url:'https://example.com'}))).status,reason==='unavailable'?503:429);}assert.equal(brandCalls,0);admissionReason=null;pass('Busy, daily limit and DB outage block AI');
 forcedError=new brand.BrandSourceError({reason:'http',status:404});let r=await api.POST(req({url:'https://example.com'}));assert.equal(r.status,422);assert(r.body.canUseManualInput);assert.equal(apiLogs.pop()[0],'warn');assert.equal(conceptCalls,0);assert.equal(finishes.pop(),true);pass('404 returns manual recovery without an operational alert');
 forcedError=new brand.BrandSourceError({reason:'timeout'});r=await api.POST(req({url:'https://example.com'}));assert.equal(r.status,503);assert(r.body.canUseManualInput);assert.equal(apiLogs.pop()[0],'error');assert.equal(finishes.pop(),true);pass('Timeout remains an error and permits manual recovery');
 forcedError=new Error('private-error-canary');r=await api.POST(req({url:'https://example.com'}));assert.equal(r.status,502);assert(!JSON.stringify(r.body).includes('private-error-canary'));const privateFailureLog=apiLogs.pop();assert.equal(privateFailureLog[0],'error');assert(!JSON.stringify(privateFailureLog).includes('private-error-canary'));assert.equal(finishes.pop(),false);pass('AI exceptions remain errors without leaking details to client');
 forcedError=null;r=await api.POST(req({url:'https://example.com',manualText:'Service description. '.repeat(5)}));assert.equal(r.status,200);assert.equal(dbWrites,1);assert.equal(conceptCalls,1);assert(receivedManual);assert.equal(finishes.pop(),false);pass('Manual recovery returns saved brand and concepts');

 conceptFailure=true;r=await api.POST(req({url:'https://example.com',manualText:'Service description. '.repeat(5)}));assert.equal(r.status,502);assert.equal(finishes.pop(),false);const conceptLog=apiLogs.pop();assert.equal(conceptLog[0],'error');assert(!JSON.stringify(conceptLog).includes('private-concept-canary'));conceptFailure=false;pass('Copy failure retains attempt and keeps raw details out of logs');
 persistenceFailure=true;await assert.rejects(()=>api.POST(req({url:'https://example.com',manualText:'Service description. '.repeat(5)})));assert.equal(finishes.pop(),false);persistenceFailure=false;pass('Persistence failure still releases lease without refund');

 console.log(JSON.stringify({passed:results.length,results},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
