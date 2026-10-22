process.env.NODE_ENV='test';
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),Module=require('module'),path=require('path'),{spawnSync}=require('child_process');
const repo=path.resolve(__dirname,'../..');
if (!process.argv[2]) {
 for (const scenario of ['guest','authenticated']) {
  const result=spawnSync(process.execPath,[__filename,scenario],{stdio:'inherit',timeout:30000});
  if (result.error || result.status!==0) throw result.error || Error(`${scenario} failed: ${result.status}`);
 }
 console.log(JSON.stringify({passed:2,scope:'Installed NextAuth SessionProvider/update/getSession with actual mounted Trial provider and reader; synthetic fetch only. No real browser BFCache, customer account, DB, Stripe, or network.'}));
 process.exit(0);
}
const req=Module.createRequire(path.join(repo,'package.json')),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom');
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/pricing'});global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
const scenario=process.argv[2];assert(['guest','authenticated'].includes(scenario));const actor={user:{id:'actor-a',email:'actor-a@example.invalid',plan:'FREE'},expires:'2099-12-31T23:59:59Z'};let serverSession=scenario==='guest'?null:actor;const calls=[],hashes={},warnings=[],priorError=console.error,priorFetch=global.fetch;console.error=(...args)=>warnings.push(args.map(String).join(' '));
const respond=async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,'https://example.invalid');calls.push({path:url.pathname,query:url.search,method:init?.method||'GET'});
 if(url.pathname==='/api/auth/csrf')return Response.json({csrfToken:'synthetic'});
 if(url.pathname==='/api/auth/session')return Response.json(serverSession||{});
 if(url.pathname==='/api/stripe/trial-eligibility'){const kind=serverSession?'authenticated':'guest',id=serverSession?.user.id;
  if(url.searchParams.get('expectedKind')!==kind||(kind==='authenticated'&&url.searchParams.get('expectedActor')!==id))return Response.json({code:'PRINCIPAL_CHANGED'},{status:409});
  return Response.json({version:1,principal:kind==='guest'?{kind}:{kind,actorId:id},eligible:id!=='actor-b'});
 }
 throw Error('External/unexpected network forbidden: '+url.pathname);
};global.fetch=respond;
const auth=req('next-auth/react'),{createRoot}=req('react-dom/client'),tick=()=>new Promise(r=>setImmediate(r));
function load(rel,mocks){const code=fs.readFileSync(repo+'/'+rel,'utf8');hashes[rel]=crypto.createHash('sha256').update(code).digest('hex');const exports={};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(Object.hasOwn(mocks,n))return mocks[n];throw Error('Unexpected dependency '+n)},window,document,URLSearchParams,AbortController,TextDecoder,Uint8Array,fetch:respond,setTimeout,clearTimeout,Date,console});return exports}
const helper=load('src/lib/trial-eligibility-client.ts',{}),provider=load('src/components/TrialEligibilityProvider.tsx',{'react':React,'react/jsx-runtime':req('react/jsx-runtime'),'react-dom':req('react-dom'),'next-auth/react':auth,'@/lib/trial-eligibility-client':helper});
const container=document.getElementById('root'),root=createRoot(container),Hook=()=>React.createElement('span',null,provider.useTrialEligibilitySnapshot()?'ELIGIBLE':'HIDDEN');
const flush=async()=>{for(let n=0;n<12;n++)await tick()},act=fn=>React.act(async()=>{await fn();await flush()}),count=p=>calls.filter(c=>c.path===p).length;
(async()=>{await act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(auth.SessionProvider,{session:serverSession},React.createElement(provider.TrialEligibilityProvider,null,React.createElement(Hook))))));assert.equal(container.textContent,'ELIGIBLE');const before=count('/api/stripe/trial-eligibility');
 await act(()=>window.dispatchEvent(new dom.window.Event('pagehide')));assert.equal(container.textContent,'HIDDEN');
 await act(()=>window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true})));assert.equal(container.textContent,'ELIGIBLE');assert.equal(count('/api/stripe/trial-eligibility'),before+1);
 const afterResume=count('/api/stripe/trial-eligibility');
 if(scenario==='authenticated'){
  serverSession={...actor,user:{id:'actor-b',email:'actor-b@example.invalid',plan:'FREE'}};
  await act(()=>window.dispatchEvent(new dom.window.Event('pagehide')));assert.equal(container.textContent,'HIDDEN');
  await act(()=>window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true})));assert.equal(container.textContent,'HIDDEN');
  assert(calls.filter(c=>c.path==='/api/stripe/trial-eligibility').at(-1).query.includes('actor-b'));
 }
 await act(()=>root.unmount());assert.equal(warnings.length,0,JSON.stringify(warnings));
 const result={accepted:true,scenario,firstAndResumeTrialReads:afterResume,sessionReads:count('/api/auth/session'),csrfReads:count('/api/auth/csrf'),calls,sourceHashes:hashes,scope:'Actual installed NextAuth SessionProvider/useSession/update/getSession plus actual frozen Trial provider/reader under React18 StrictMode/jsdom. Synthetic fetch endpoints only; no real network, account, DB, Stripe or browser BFCache proof.'};console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error=priorError;console.error(e);console.error(warnings);process.exitCode=1}).finally(()=>{console.error=priorError;global.fetch=priorFetch;dom.window.close()});
