// Offline regression checks: all DB, Slack and app transports are mocked.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..') + path.sep;
const results = [];
function load(path, mocks = {}, env = {}, globals = {}) {
  const exports = {};
  const ctx = vm.createContext({exports, require: name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('node:')) return require(name);
    throw Error('Unmocked dependency: '+name);
  }, process:{env}, console:{error(){},warn(){}}, Error, Date, URL, Request, Headers, Uint8Array, TextDecoder, AbortSignal, ...globals});
  vm.runInContext(ts.transpileModule(fs.readFileSync(root+path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);
  return {exports,ctx};
}
function pass(name){results.push({name,pass:true});}
const responseMock={NextResponse:{json:(body,options)=>({body,status:options?.status??200,headers:options?.headers})}};
const json=load('src/lib/operational-json.ts').exports;
function req(body,headers={}){const r=new Request('https://doya.test/api/operational-error',{method:'POST',headers,body});r.nextUrl=new URL(r.url);return r;}
async function main(){
  for(const [name,raw,status] of [['null','null',400],['array','[]',400],['primitive','1',400],['invalid','{',400],['ascii-limit','x'.repeat(1025),413],['byte-limit',JSON.stringify({x:'あ'.repeat(400)}),413]]){
    await assert.rejects(json.readOperationalJson(req(raw),1024),e=>e.status===status);pass(name);
  }
  assert.equal((await json.readOperationalJson(req('{"kind":"render"}'),1024)).kind,'render');pass('valid JSON');
  await assert.rejects(json.readOperationalJson(req('{}',{'content-length':'999999999'}),1024),e=>e.status===413);pass('declared oversize');
  let cancelled=false,pulls=0;
  const streamed=new Request('https://doya.test',{method:'POST',duplex:'half',body:new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(600));},cancel(){cancelled=true;}})});
  await assert.rejects(json.readOperationalJson(streamed,1024),e=>e.status===413);assert(cancelled);assert(pulls<=3);pass('chunked body cancelled at byte limit');
  const dbRows=new Map();let dbCalls=0;let clock=Date.now();
  class Clock extends Date{static now(){return clock;}}
  const prisma={$queryRaw:async (sql,...params)=>{
    dbCalls++;
    assert(sql.join('?').includes('ON CONFLICT ("key") DO UPDATE'));
    assert(sql.join('?').includes('"SystemSetting"."value"::timestamptz <= CURRENT_TIMESTAMP'));
    assert.equal(params.length,2);const key=params[1];
    assert(/^client-error:v1:(browser|native|heisha):(javascript|render|promise)$/.test(key));
    if((dbRows.get(key)||0)>clock)return [];
    dbRows.set(key,clock+600000);return [{key}];
  }};
  const makeLimiter=()=>load('src/lib/operational-error-limit.ts',{'./prisma':{prisma}}, {},{Date:Clock}).exports;
  const instances=Array.from({length:30},makeLimiter);
  const claims=await Promise.all(instances.map(m=>m.claimClientErrorReport('browser','javascript')));
  assert.equal(claims.filter(x=>x==='allowed').length,1);pass('30 isolated instances share one atomic claim (mock DB)');
  const calls=dbCalls;await instances[0].claimClientErrorReport('browser','javascript');assert.equal(dbCalls,calls);pass('local throttle avoids repeated DB access');
  assert.equal(await makeLimiter().claimClientErrorReport('native','javascript'),'allowed');pass('native budget isolated');
  assert.equal(await makeLimiter().claimClientErrorReport('browser','render'),'allowed');pass('error kinds isolated');
  assert.equal(await makeLimiter().claimClientErrorReport('attacker','random'),'limited');pass('dynamic DB keys rejected');
  clock+=600001;assert.equal(await makeLimiter().claimClientErrorReport('browser','javascript'),'allowed');pass('expiry permits next claim');
  let failCalls=0;
  const broken=load('src/lib/operational-error-limit.ts',{'./prisma':{prisma:{$queryRaw:async()=>{failCalls++;throw Error('private-canary');}}}}).exports;
  assert.equal(await broken.claimClientErrorReport('browser','javascript'),'unavailable');assert.equal(await broken.claimClientErrorReport('browser','render'),'unavailable');assert.equal(failCalls,1);pass('DB outage fails closed with local backoff');
  const preview=load('src/app/api/operational-error/route.ts',{'next/server':responseMock,'@/lib/operational-json':json,'@/lib/operational-error-limit':{claimClientErrorReport:async()=>{throw Error('preview DB write');}},'@/lib/runtime-alert':{reportRuntimeFailure:async()=>{throw Error('preview send');}}},{VERCEL_ENV:'preview'}).exports;
  assert.equal((await preview.POST(req('{"kind":"render"}',{origin:'https://doya.test'}))).status,200);pass('preview neither sends nor consumes production DB budget');
  const sent=[];let admission='allowed',intakeCalls=0;
  const route=load('src/app/api/operational-error/route.ts',{
    'next/server':responseMock,'@/lib/operational-json':json,
    '@/lib/operational-error-limit':{claimClientErrorReport:async(p,k)=>{intakeCalls++;sent.push({budget:p,kind:k});return admission;}},
    '@/lib/runtime-alert':{reportRuntimeFailure:async(...x)=>sent.push({report:x})},
    '@/lib/heisha-runtime-alert':{reportHeishaFailure:async(...x)=>sent.push({heisha:x})}
  },{VERCEL_ENV:'production',CLIENT_ERROR_TOKEN:'test-native',HEISHA_CLIENT_ERROR_TOKEN:'test-heisha'}).exports;
  for(const[name,headers,body,status]of[
    ['missing auth',{},'{"kind":"render"}',401],['foreign origin',{origin:'https://evil.test'},'{"kind":"render"}',401],
    ['cross-site metadata',{origin:'https://doya.test','sec-fetch-site':'cross-site'},'{"kind":"render"}',401],
    ['invalid input',{origin:'https://doya.test'},'null',400],['object kind',{origin:'https://doya.test'},'{"kind":{}}',400],
    ['valid anonymous',{origin:'https://doya.test'},'{"kind":"render","private":"canary"}',200],
    ['valid native',{'x-client-error-token':'test-native'},'{"kind":"javascript"}',200],
    ['valid heisha',{'x-client-error-token':'test-heisha'},'{"kind":"promise"}',200]]){
    assert.equal((await route.POST(req(body,headers))).status,status);pass(name);
  }
  assert.equal(intakeCalls,3);assert(!JSON.stringify(sent).includes('canary'));assert(sent.some(x=>x.report?.[1]?.clientReported));pass('only validated fixed labels reach low-trust reporting');
  admission='limited';assert.equal((await route.POST(req('{"kind":"render"}',{origin:'https://doya.test'}))).status,429);pass('shared limit returns 429');
  admission='unavailable';assert.equal((await route.POST(req('{"kind":"render"}',{origin:'https://doya.test'}))).status,503);pass('unavailable limiter returns 503');
  for(const[name,args,count]of[
    ['node deprecation',['(node:4) [DEP0169] DeprecationWarning: url.parse()'],0],['plain deprecation',['DeprecationWarning: old API'],0],
    ['error deprecation',[Object.assign(new Error('old API'),{name:'DeprecationWarning'})],0],['real error',[new Error('private-canary')],1],
    ['zero arguments',[],0],['empty values',[null,undefined,' \n'],0],['empty Error is still an error',[new Error('')],1],['object is still reported',[{private:'private-canary'}],1],['custom Error name redacted',[Object.assign(new Error('private-canary'),{name:'private-canary'})],1],
    ['warning with separate error',['DeprecationWarning: old API',new Error('real failure')],1],['mention within error',['Failure reading DeprecationWarning: example'],1]]){
    const logs=[],diagnostics=[],notifications=[],tasks=[];
    const runtime=load('src/lib/runtime-alert.ts',{'./slack-voice':{voicePayload:x=>x},'@vercel/functions':{waitUntil:p=>tasks.push(p)},'./alert':{getAlertWebhook:async()=>'https://mock.invalid'},'./runtime-alert-limit':{claimRuntimeAlert:async()=>({state:'allowed'}),releaseRuntimeAlertClaim:async()=>{}}},{VERCEL_ENV:'production'},{console:{error:(...a)=>logs.push(a),warn:(...a)=>diagnostics.push(a)},fetch:async(u,o)=>{notifications.push(o.body);return {ok:true};}});
    runtime.exports.installRuntimeAlerts();runtime.ctx.console.error(...args);await Promise.all(tasks);
    assert.equal(logs.length,1);assert.equal(notifications.length,count);assert.equal(diagnostics.length,count);assert(!JSON.stringify(notifications).includes('private-canary'));assert(!JSON.stringify(diagnostics).includes('private-canary'));if(count){const d=diagnostics[0][1];assert.match(d.incidentId,/^[0-9a-f-]{36}$/);assert.equal(d.argumentCount,args.length);assert(notifications[0].includes(d.incidentId));assert.equal(d.errorTypes.length,args.filter(x=>x instanceof Error).length);}pass(name);
  }

  function tracedRuntime(env={},hook='https://mock.invalid',ok=true,DateImpl=Date,onHook=()=>{}) {
    const diagnostics=[],sends=[],logs=[],tasks=[];
    const mod=load('src/lib/runtime-alert.ts',{'./slack-voice':{voicePayload:x=>x},'@vercel/functions':{waitUntil:p=>tasks.push(p)},'./alert':{getAlertWebhook:async()=>{onHook();return hook}},'./runtime-alert-limit':{claimRuntimeAlert:async()=>({state:'allowed'}),releaseRuntimeAlertClaim:async()=>{}}},{VERCEL_ENV:'production',...env},{Date:DateImpl,console:{error:(...a)=>logs.push(a),warn:(...a)=>diagnostics.push(a)},fetch:async(u,o)=>{sends.push(JSON.parse(o.body));return {ok,status:ok?200:503}}});
    return {...mod,diagnostics,sends,logs,tasks};
  }
  const trace=tracedRuntime({VERCEL_URL:'doya-synthetic.vercel.app',VERCEL_DEPLOYMENT_ID:'dpl_Synthetic123'});
  await trace.exports.reportRuntimeFailure('fixed-source',{clientReported:true});await trace.exports.reportRuntimeFailure('fixed-source',{clientReported:true});
  assert.equal(trace.sends.length,1);assert.equal(trace.diagnostics.length,1);assert.equal(trace.diagnostics[0][1].source,'fixed-source');assert(trace.sends[0].text.includes(trace.diagnostics[0][1].incidentId));assert(trace.sends[0].text.includes('doya-synthetic.vercel.app'));assert(trace.sends[0].text.includes('dpl_Synthetic123'));assert(trace.sends[0].text.includes('未検証'));pass('Deduped client report includes matching incident ID and validated deployment');
  const malformed=tracedRuntime({VERCEL_URL:'doya.vercel.app?private-canary',VERCEL_DEPLOYMENT_ID:'dpl_abc\nprivate-canary'});
  await malformed.exports.reportRuntimeFailure('fixed-source');assert(!JSON.stringify([...malformed.sends,...malformed.diagnostics]).includes('private-canary'));assert.equal(malformed.diagnostics[0][1].deploymentHost,undefined);assert.equal(malformed.diagnostics[0][1].deploymentId,undefined);pass('Malformed deployment metadata never enters diagnostics or Slack');
  const missing=tracedRuntime({},null);await missing.exports.reportRuntimeFailure('fixed-source');assert.equal(missing.sends.length,0);assert.equal(missing.diagnostics.length,0);pass('Missing webhook does not produce delivery diagnostics');
  const retry=tracedRuntime({},'https://mock.invalid',false);await retry.exports.reportRuntimeFailure('fixed-source');await retry.exports.reportRuntimeFailure('fixed-source');assert.equal(retry.sends.length,2);assert.equal(retry.diagnostics.length,2);assert.notEqual(retry.diagnostics[0][1].incidentId,retry.diagnostics[1][1].incidentId);pass('Delivery failure permits retry with a distinct incident ID');
  let warningClock=Date.parse('2026-09-11T09:17:07Z');const occurredAt=warningClock;
  class WarningClock extends Date {constructor(...args){super(...(args.length?args:[warningClock]));}static now(){return warningClock}}
  const delayed=tracedRuntime({},'https://mock.invalid',true,WarningClock,()=>{warningClock+=120000});await delayed.exports.reportRuntimeFailure('fixed-source');assert.equal(delayed.diagnostics[0][1].occurredAt,new Date(occurredAt).toISOString());assert(delayed.sends[0].text.includes(new Date(occurredAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})));pass('Occurrence time stays fixed while webhook discovery is delayed');
  const emptyInternal=tracedRuntime();emptyInternal.exports.installRuntimeAlerts();await new Promise(resolve=>{process.nextTick(emptyInternal.ctx.console.error);process.nextTick(resolve)});await Promise.all(emptyInternal.tasks);assert.equal(emptyInternal.logs.length,1);assert.equal(emptyInternal.sends.length,0);assert.equal(emptyInternal.diagnostics.length,0);pass('Empty internal callback preserves original log without sending an unknown-source alert');

  // Server alerts need the same atomic budget across isolated Vercel instances.
  const serverRows=new Map();let serverClock=Date.parse('2026-09-23T11:08:45Z');
  class ServerClock extends Date {static now(){return serverClock}}
  const serverPrisma={
    $queryRaw:async(sql,...params)=>{
      const statement=sql.join('?');assert(statement.includes('ON CONFLICT ("key") DO UPDATE'));assert(statement.includes('WHEN "SystemSetting"."value" ~'));
      const [,key,value,now]=params;assert(/^server-error:v1:[a-f0-9]{24}$/.test(key));
      if(Number(serverRows.get(key))>now)return [];
      serverRows.set(key,value);return [{key}];
    },
    $executeRaw:async(sql,...params)=>{assert(sql.join('?').includes('DELETE FROM "SystemSetting"'));const [key,value]=params;if(serverRows.get(key)===value){serverRows.delete(key);return 1}return 0}
  };
  const makeServerLimiter=()=>load('src/lib/runtime-alert-limit.ts',{'./prisma':{prisma:serverPrisma}},{},{Date:ServerClock}).exports;
  const serverSignature='a'.repeat(24);
  const serverClaims=await Promise.all(Array.from({length:30},()=>makeServerLimiter().claimRuntimeAlert(serverSignature)));
  assert.equal(serverClaims.filter(x=>x.state==='allowed').length,1);assert.equal(serverClaims.filter(x=>x.state==='limited').length,29);pass('30 server instances share one atomic alert claim');
  assert.equal((await makeServerLimiter().claimRuntimeAlert('bad')).state,'unavailable');pass('malformed server fingerprint rejected');
  serverClock+=600001;
  const renewed=await makeServerLimiter().claimRuntimeAlert(serverSignature);assert.equal(renewed.state,'allowed');
  await makeServerLimiter().releaseRuntimeAlertClaim(serverClaims.find(x=>x.state==='allowed'));
  assert.equal((await makeServerLimiter().claimRuntimeAlert(serverSignature)).state,'limited');
  await makeServerLimiter().releaseRuntimeAlertClaim(renewed);
  assert.equal((await makeServerLimiter().claimRuntimeAlert(serverSignature)).state,'allowed');pass('expiry and exact-claim release protect a newer alert');
  const serverWarnings=[];
  const unavailableServer=load('src/lib/runtime-alert-limit.ts',{'./prisma':{prisma:{$queryRaw:async()=>{throw Error('private-canary')}}}},{},{console:{warn:(...args)=>serverWarnings.push(args)}}).exports;
  assert.equal((await unavailableServer.claimRuntimeAlert('b'.repeat(24))).state,'unavailable');assert(!JSON.stringify(serverWarnings).includes('private-canary'));pass('server throttle outage does not leak DB error');
  const sharedServerNotifications=[],sharedServerClaims=new Set();
  const runServerInstance=async message=>{
    const tasks=[];
    const runtime=load('src/lib/runtime-alert.ts',{
      './slack-voice':{voicePayload:x=>x},'@vercel/functions':{waitUntil:p=>tasks.push(p)},'./alert':{getAlertWebhook:async()=>'https://mock.invalid'},
      './runtime-alert-limit':{claimRuntimeAlert:async signature=>{if(sharedServerClaims.has(signature))return {state:'limited'};sharedServerClaims.add(signature);return {state:'allowed'}},releaseRuntimeAlertClaim:async()=>{}}
    },{VERCEL_ENV:'production',NEXTAUTH_SECRET:'test-secret'},{console:{error(){},warn(){}},fetch:async(u,o)=>{sharedServerNotifications.push(o.body);return {ok:true}}});
    runtime.exports.installRuntimeAlerts();runtime.ctx.console.error(message);await Promise.all(tasks);
  };
  await Promise.all(Array.from({length:11},(_,i)=>runServerInstance(`private-canary ${i}`)));
  assert.equal(sharedServerNotifications.length,1);assert.equal(sharedServerClaims.size,1);assert(!JSON.stringify(sharedServerNotifications).includes('private-canary'));pass('generic source burst is one private-safe alert and one DB key across 11 instances');

  let writes=0;
  const ops=load('src/app/api/operations/configure/route.ts',{'next/server':responseMock,'@/lib/operational-json':json,'@/lib/service-operations-data':{OPS_SERVICES:[{key:'doya'}]},'@/lib/service-operations-state':{readOps:async()=>null,writeOps:async()=>writes++,sendOps:async()=>{throw Error('Unexpected send');}},'@/lib/service-operations-links':{safeLandingUrl:()=>true}},{SLACK_OPS_SECRET:'test-ops'}).exports;
  for(const raw of ['null','[]','{"service":"doya","kind":"links","links":[null]}']){assert.equal((await ops.POST(req(raw,{authorization:'Bearer test-ops'}))).status,400);}assert.equal(writes,0);pass('operations null and null link reject without writes');
  assert.equal((await ops.POST(req('{"service":"doya","kind":"budget","monthlyJpy":100}',{authorization:'Bearer test-ops'}))).status,200);assert.equal(writes,1);pass('authorized valid configuration retained');
  const report = {offline:true,db:'mock only; conditional SQL asserted, no production DB writes',slack:'mock only',passed:results.length,results};
  if (process.env.SECURITY_REGRESSION_OUTPUT) fs.writeFileSync(process.env.SECURITY_REGRESSION_OUTPUT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
