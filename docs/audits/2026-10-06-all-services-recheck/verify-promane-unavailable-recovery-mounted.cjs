process.env.NODE_ENV='test';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),React=require('react'),{JSDOM}=require('jsdom');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const dom=new JSDOM('<body/>',{url:'https://example.invalid'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client');
const baseline=process.env.DOYA_UNAVAILABLE_BASELINE==='1',base='docs/audits/2026-10-06-all-services-recheck/';
let result,latest,lock=Promise.resolve(),calls=0;
const globals={window:dom.window,navigator:{locks:{request(_key,work){const next=lock.then(work);lock=next.catch(()=>{});return next}}},crypto:crypto.webcrypto,setTimeout,clearTimeout,URLSearchParams,fetch:async()=>{calls++;return Response.json(result)}};
const common={'./pending-scope-migration':{initializePromanePendingScope:async()=>false},react:React,'next-auth/react':{useSession:()=>({data:{user:{id:'staff'}},status:'authenticated'})}};
const clientInput=load('src/lib/promane/client-input.ts'),taskInput=load('src/lib/promane/task-input.ts',{'./time-input':load('src/lib/promane/time-input.ts')});
const modules={
 client:load('src/lib/promane/use-client-creation.ts',{'./pending-scope-migration':{initializePromanePendingScope:async()=>false},'next-auth/react':{useSession:()=>({data:{user:{id:'legacy-fixture-user'}},status:'authenticated'})},...common,'./client-input':clientInput},globals),
 expense:load('src/lib/promane/use-expense-creation.ts',common,globals),
 task:load('src/lib/promane/use-task-creation.ts',{'./pending-scope-migration':{initializePromanePendingScope:async()=>false},'next-auth/react':{useSession:()=>({data:{user:{id:'legacy-fixture-user'}},status:'authenticated'})},...common,'./task-input':taskInput,'./actions-tasks':{createTask(){throw Error('Unexpected create')},recoverTaskCreation:async()=>{calls++;return result}}},globals),
 time:load('src/lib/promane/use-time-entry-creation.ts',{'./pending-scope-migration':{initializePromanePendingScope:async()=>false},'next-auth/react':{useSession:()=>({data:{user:{id:'legacy-fixture-user'}},status:'authenticated'})},...common,'@/lib/promane/actions-time-entries':{createTimeEntry(){throw Error('Unexpected create')},recoverTimeEntry:async()=>{calls++;return result}}},globals),
};
const specs=[['client','useClientCreation',['synthetic'],'promane-client-pending:v1:synthetic:staff'],['expense','useExpenseCreation',['synthetic','project'],'promane-expense-pending:v1:synthetic:project:staff'],['task','useTaskCreation',['synthetic','project'],'promane-task-pending:v1:synthetic:project:staff'],['time','useTimeEntryCreation',['synthetic','member'],'promane-time-pending:v1:synthetic:member']];
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<5;i++)await new Promise(setImmediate)});
(async()=>{const cases=[];try{for(const[kind,name,args,key]of specs){for(const scenario of baseline?['terminal']:['terminal','invalid-entry','missing']){
 window.localStorage.clear();window.localStorage.setItem(key,JSON.stringify({version:1,operationId:'10000000-0000-4000-8000-000000000001'}));calls=0;lock=Promise.resolve();
 result=scenario==='terminal'?{state:'unavailable',entry:null}:scenario==='invalid-entry'?{state:'unavailable',entry:{id:'malformed'}}:{state:'missing',entry:null};
 const div=document.createElement('div');document.body.append(div);const root=createRoot(div);
 function Probe(){latest=modules[kind][name](...args);return null}
 try{await act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Probe))));assert.equal(latest.status,'unknown');let outcome;await act(async()=>outcome=await latest.recover());assert.equal(calls,1);
 if(scenario==='terminal'&&!baseline){assert.equal(outcome,'unavailable');assert.equal(latest.status,'ready');assert.equal(window.localStorage.getItem(key),null);assert.match(latest.message,/完了済み/)}
 else{assert.equal(outcome,null);assert.equal(latest.status,'unknown');assert(window.localStorage.getItem(key))}
 cases.push({kind,scenario,status:latest.status,metadataRetained:window.localStorage.getItem(key)!==null});
 }finally{await act(()=>root.unmount());div.remove()}
 }}
 const files=['src/lib/promane/use-client-creation.ts','src/lib/promane/use-expense-creation.ts','src/lib/promane/use-task-creation.ts','src/lib/promane/use-time-entry-creation.ts'];
 const report={checkedAt:new Date().toISOString(),expected:baseline?4:12,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Four actual creation React hooks with real localStorage in StrictMode; synthetic session/transport and serialized lock adapter. Existing separate PostgreSQL suites prove committed-deleted receipt is unavailable and replay never recreates it. No production/customer writes or actual authenticated Next transport.'};
 fs.writeFileSync(base+(baseline?'promane-unavailable-recovery-baseline.json':'promane-unavailable-recovery-mounted-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
