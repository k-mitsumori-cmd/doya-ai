const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const {load,check}=require('./load-typescript.cjs');
const {recordingAllowance}=load('src/lib/cunning/allowance-client.ts');
const source=fs.readFileSync('src/app/cunning/live/[sessionId]/page.tsx','utf8');
const effect=source.slice(source.indexOf('  // 確認失敗や旧レスポンス'),source.indexOf('  // アンマウント時'));
const tick=source.slice(source.indexOf('  // 経過秒カウント'),source.indexOf('  const transcriptionFailed'));
function evaluate(code,env){vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{recordingVersionRef:{current:1},recordingClientRef:{current:null},mountedRef:{current:true},pendingTranscriptIdsRef:{current:[]},requestAnswer:()=>{},...env})}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
let serverUsage={tier:'FREE',limits:{tier:'FREE',maxMinutesPerMonth:60,maxKnowledgeBases:1},usedSeconds:3540,reservedSeconds:60,remainingSeconds:0,resetAt:new Date()};
const integrated=load('src/lib/cunning/limits.ts',{'@/lib/prisma':{prisma:{cunningKnowledgeBase:{count:async()=>0}}},'@/lib/plan-utils':load('src/lib/plan-utils.ts'),'./limit-config':load('src/lib/cunning/limit-config.ts'),'./recording-ledger':{readCunningRecordingUsage:async()=>serverUsage}});
await check('server reservations deny new start without calling old aggregate',async()=>{assert.equal((await integrated.getCunningUsage('u')).reservedSeconds,60);assert.equal((await integrated.canStartSession('u')).code,'RECORDING_RESERVED');assert.equal((await integrated.canStartSession('u')).ok,false)});
await check('one second remains usable and minute display cannot turn it into zero',async()=>{serverUsage={...serverUsage,reservedSeconds:0,remainingSeconds:1};assert.equal((await integrated.getCunningUsage('u')).remainingMinutes,1);assert.equal((await integrated.canStartSession('u')).ok,true)});
await check('missing account cannot start',async()=>{serverUsage=null;assert.equal((await integrated.canStartSession('u')).ok,false)});
for(const seconds of [0,1,59,60,3600,-1])await check('exact seconds '+seconds,()=>assert.equal(recordingAllowance({remainingSeconds:seconds,limits:{maxMinutesPerMonth:seconds===-1?-1:60}}),seconds));
for(const value of [null,{}, {plan:'GUEST'}, {remainingMinutes:1}, ...[-2,0.5,Infinity,NaN,3601,'1'].map(remainingSeconds=>({remainingSeconds,limits:{maxMinutesPerMonth:60}})),{remainingSeconds:-1,limits:{maxMinutesPerMonth:60}}])await check('invalid allowance rejected '+JSON.stringify(value),()=>assert.throws(()=>recordingAllowance(value)));
for(const kind of ['success','limit','unlimited','http','network','guest','invalid','stale'])await check('usage load '+kind,async()=>{
 let cleanup,resolve,phase='loading',ref={current:null};const pending=new Promise(r=>resolve=r);
 evaluate(effect,{useEffect:f=>cleanup=f(),sessionId:'test',allowanceRetry:0,remainingSecRef:ref,setAllowanceState:v=>phase=v,AbortController,setTimeout,clearTimeout,recordingAllowance,fetch:()=>kind==='network'?Promise.reject(Error('offline')):pending});
 if(kind==='stale')cleanup();
 resolve({ok:kind!=='http',json:async()=>kind==='guest'?{plan:'GUEST'}:kind==='invalid'?{}:{remainingSeconds:kind==='limit'?0:kind==='unlimited'?-1:1,limits:{maxMinutesPerMonth:kind==='unlimited'?-1:60}}});await flush();await flush();
 assert.equal(phase,['success','unlimited'].includes(kind)?'ready':kind==='limit'?'limit':kind==='stale'?'loading':'error');
 assert.equal(ref.current,['success'].includes(kind)?1:kind==='limit'?0:kind==='unlimited'?-1:null);cleanup();
});
for(const seconds of [1,-1])await check('timer stop with remaining '+seconds,()=>{
 let callback,ended=0;const elapsedRef={current:0};evaluate(tick,{useEffect:f=>f(),running:true,sessionId:'test',stopAll:()=>{},finishSession:()=>ended++,elapsedRef,remainingSecRef:{current:seconds},setInterval:f=>{callback=f;return 1},clearInterval:()=>{},setElapsed:()=>{},showServiceLimit:()=>{},fetch:()=>Promise.resolve({})});callback();assert.equal(ended,seconds===1?1:0);assert.equal(elapsedRef.current,1);
});
await check('both recording controls and handler block unverified usage',()=>{assert.equal((source.match(/disabled=\{allowanceState !== 'ready' \|\| sessionState !== 'ready' \|\| \(interruptedRecording && recordingVersionRef\.current === 2\)\}/g)||[]).length,2);assert(source.includes("if (allowanceState !== 'ready' || remainingSecRef.current === null || remainingSecRef.current === 0) return"))});
})().catch(e=>{console.error(e);process.exitCode=1});
