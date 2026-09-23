const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict'),{check}=require('./load-typescript.cjs');
const source=fs.readFileSync('src/app/cunning/live/[sessionId]/page.tsx','utf8'),ast=ts.createSourceFile('live.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function decl(name){let out;function walk(n){if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)===name))out=n.getText(ast);ts.forEachChild(n,walk)}walk(ast);assert(out);return out}
function run(code,env){vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{setTranscriptionIssue:()=>{},finishingRef:{current:false},refreshAudioRetry:()=>{},windowClientRef:{current:null},startWindowCycle:()=>{},finalAudioRetryRef:{current:{hasPending:()=>false}},recordingVersionRef:{current:1},recordingClientRef:{current:null},mountedRef:{current:true},pendingTranscriptIdsRef:{current:[]},requestAnswer:()=>{},...env})}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
for(const kind of ['ok','http','network'])await check('finish '+kind+' preserves cumulative retry',async()=>{
 let fail=kind!=='ok',issue=false,stops=0,reports=0,ended={current:false},calls=[];const exports={};
 const env={workRef:{current:{drain:async()=>true,hasFailures:()=>false}},flushRef:{current:()=>{}},setIncompleteAudio:()=>{},exports,useCallback:f=>f,sessionId:'s',stopAll:()=>stops++,endedRef:ended,elapsedRef:{current:37},durationBaseRef:{current:60},setFocusMode:()=>{},setStatusMsg:()=>{},setSessionState:()=>{},setSavingIssue:v=>issue=v,hasContentRef:{current:true},setReport:()=>{},setReportOpen:()=>{},setReportLoading:()=>{},langRef:{current:'ja'},fetch:async(url,options)=>{if(url.endsWith('/report')){reports++;return{ok:true,json:async()=>({report:{}})}}calls.push(JSON.parse(options.body));if(fail&&kind==='network')throw Error('offline');return{ok:!fail}}};
 run(decl('finishSession')+';exports.finish=finishSession;',env);await exports.finish();assert.equal(issue,fail);assert.equal(reports,fail?0:1);assert.equal(ended.current,!fail);assert.equal(calls[0].totalSeconds,97);assert.equal(calls[0].end,true);assert.equal('addSeconds' in calls[0],false);
 fail=false;await exports.finish();assert.equal(reports,1);assert.equal(issue,false);assert.equal(calls.length,kind==='ok'?1:2);assert(calls.every(c=>c.totalSeconds===97));
});
await check('finish stays exclusive even if an external retry resets ended flag while draining',async()=>{
 let release,stops=0,reports=0;const wait=new Promise(r=>release=r),ended={current:false},exports={};
 run(decl('finishSession')+';exports.finish=finishSession;', {exports,useCallback:f=>f,sessionId:'s',endedRef:ended,stopAll:()=>stops++,setFocusMode:()=>{},setStatusMsg:()=>{},setSessionState:()=>{},setSavingIssue:()=>{},workRef:{current:{drain:async()=>{await wait;return true},hasFailures:()=>false}},flushRef:{current:()=>{}},setIncompleteAudio:()=>{},durationBaseRef:{current:0},elapsedRef:{current:0},hasContentRef:{current:true},setReport:()=>{},setReportOpen:()=>{},setReportLoading:()=>{},langRef:{current:'ja'},fetch:async url=>{if(url.endsWith('/report'))reports++;return{ok:true,json:async()=>({report:{}})}}});
 const first=exports.finish();ended.current=false;await exports.finish();assert.equal(stops,1);release();await first;assert.equal(reports,1);
});
for(const late of [false,true])await check('heartbeat failure '+(late?'after finalization':'during recording'),async()=>{
 let timer,stopped=0,issue=false,body;const code=source.slice(source.indexOf('  // 経過秒カウント'),source.indexOf('  const transcriptionFailed'));
 run(code,{useEffect:f=>f(),running:true,sessionId:'s',elapsedRef:{current:29},durationBaseRef:{current:60},remainingSecRef:{current:-1},endedRef:{current:late},stopAll:()=>stopped++,setSessionState:()=>{},setSavingIssue:v=>issue=v,setElapsed:()=>{},setInterval:f=>{timer=f;return 1},clearInterval:()=>{},finishSession:()=>{},showServiceLimit:()=>{},fetch:async(_,o)=>{body=JSON.parse(o.body);return{ok:false}}});timer();await flush();await flush();assert.equal(body.totalSeconds,90);assert.equal(stopped,late?0:1);assert.equal(issue,!late);
});
for(const started of [false,true])await check('unmount '+(started?'records remainder':'does not end unused session'),()=>{
 let cleanup,body;const code=source.slice(source.indexOf('  // アンマウント時'),source.indexOf('  // 経過秒カウント'));
 run(code,{useEffect:f=>cleanup=f(),stopAll:()=>{},pipWindowRef:{current:null},startedRef:{current:started},sessionId:'s',durationBaseRef:{current:60},elapsedRef:{current:7},fetch:(_,o)=>{body=JSON.parse(o.body);assert.equal(o.keepalive,true);return Promise.resolve({})}});cleanup();if(started)assert.equal(body.totalSeconds,67);else assert.equal(body,undefined);
});
for(const kind of ['active','ended','http','invalid','stale'])await check('session baseline '+kind,async()=>{
 let cleanup,resolve,state='loading';const baseline={current:0};const pending=new Promise(r=>resolve=r);
 const code=source.slice(source.indexOf('  // Load the saved cumulative baseline'),source.indexOf('  // 確認失敗や旧レスポンス'));
 run(code,{useEffect:f=>cleanup=f(),sessionId:'s',setSessionState:v=>state=v,durationBaseRef:baseline,setMode:()=>{},modeRef:{current:'sales'},fetch:()=>pending});if(kind==='stale')cleanup();
 resolve({ok:kind!=='http',json:async()=>({session:{durationSec:kind==='invalid'?-1:60,status:kind==='ended'?'ended':'active'}})});await flush();await flush();
 assert.equal(state,kind==='stale'?'loading':['http','invalid'].includes(kind)?'error':kind==='ended'?'ended':'ready');assert.equal(baseline.current,['http','invalid','stale'].includes(kind)?0:60);cleanup();
});
await check('ended/loading session and duplicate start are gated',()=>{const text=decl('start');assert(text.includes("sessionState !== 'ready' || startedRef.current || startingRef.current"));assert(text.indexOf('startingRef.current = true')<text.indexOf('navigator.mediaDevices.getUserMedia'));assert(text.includes('finally'));assert(text.includes('startingRef.current = false'));assert(text.includes('if (!runningRef.current) { mic.getTracks().forEach((t) => t.stop()); return }'))});
})().catch(e=>{console.error(e);process.exitCode=1});
