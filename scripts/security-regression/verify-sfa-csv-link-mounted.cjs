process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {load}=require('./load-typescript.cjs');
const React=require('react'),{JSDOM}=require('jsdom'),ts=require('typescript');
const dom=new JSDOM('<body><main id="host"></main></body>',{url:'https://synthetic.invalid'});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),host=document.getElementById('host'),root=createRoot(host),{act}=React;
let session={status:'authenticated',data:{user:{id:'actor-a'}}},pending=[];
const guard=load('src/lib/use-org-settings-guard.ts',{'react':React,'next-auth/react':{useSession:()=>session}},{AbortController});
const policy=load('src/lib/sfa/export-policy.ts'),client=load('src/lib/sfa/client.ts');
const file='src/components/sfa/SfaCsvExportLink.tsx';
const compiled=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exported={};vm.runInNewContext(compiled,{exports:exported,require:name=>{
 if(name==='react'||name==='react/jsx-runtime')return require(name);
 if(name==='@/lib/use-org-settings-guard')return guard;
 if(name==='@/lib/sfa/export-policy')return policy;
 if(name==='@/lib/sfa/client')return client;
 if(name==='@/lib/sfa/client-response')return {sfaJson:(url,slug,init)=>{
   assert.equal(url,'/api/sfa/usage');return new Promise((resolve,reject)=>pending.push({slug,signal:init.signal,resolve,reject}));
 }};
 throw Error('Unexpected import '+name);
},console,decodeURIComponent});
const Link=exported.SfaCsvExportLink,cases=[];
async function render(slug='org-a',type='accounts'){await act(async()=>root.render(React.createElement(Link,{orgSlug:slug,type,className:'retained-style'},'CSVを書き出す')))}
async function answer(request,role,slug=request.slug,more={}){await act(async()=>request.resolve({onboarded:true,organization:{slug},role,...more}))}
function hidden(){assert.equal(host.querySelector('a'),null)}
function visible(slug,type='accounts'){const a=host.querySelector('a');assert(a);assert.equal(a.getAttribute('href'),'/api/sfa/export?type='+type+'&org='+encodeURIComponent(slug));assert.equal(a.className,'retained-style');assert.equal(a.textContent,'CSVを書き出す')}
(async()=>{
 for(const role of ['admin','owner','member','manager','unknown',null,{},'ADMIN']){
  session={status:'authenticated',data:{user:{id:'actor-'+cases.length}}};await render();hidden();const request=pending.at(-1);await answer(request,role);
  if(['admin','owner'].includes(role))visible('org-a');else hidden();cases.push('role '+String(role));
 }
 session={status:'authenticated',data:{user:{id:'old-actor'}}};await render();const old=pending.at(-1);
 session={status:'authenticated',data:{user:{id:'new-actor'}}};await render();const current=pending.at(-1);assert(old.signal.aborted);await answer(old,'owner');hidden();await answer(current,'admin');visible('org-a');cases.push('stale actor response ignored');
 await render('org-b','deals');hidden();const b=pending.at(-1);await answer(b,'owner','org-a');hidden();cases.push('wrong organization response denied');
 await render('org-c','deals');const c=pending.at(-1);await render('org-d','deals');const d=pending.at(-1);assert(c.signal.aborted);await answer(c,'admin');hidden();await answer(d,'owner');visible('org-d','deals');cases.push('stale organization response ignored');
 session={status:'loading',data:{user:{id:'new-actor'}}};await render('org-d','deals');hidden();
 session={status:'authenticated',data:{user:{id:'new-actor'}}};await render('org-d','deals');hidden();await answer(pending.at(-1),'member');hidden();cases.push('reauthentication requires fresh role');
 session={status:'unauthenticated',data:null};const before=pending.length;await render();hidden();assert.equal(pending.length,before);cases.push('guest makes no request');
 session={status:'authenticated',data:{user:{id:'failure-actor'}}};await render();await act(async()=>pending.at(-1).reject(new Error('synthetic failure')));hidden();cases.push('failed role lookup denied');
 await render('org-e');await answer(pending.at(-1),'admin','org-e',{onboarded:false});hidden();cases.push('unonboarded response denied');
 await render('%E5%96%B6%E6%A5%AD');await answer(pending.at(-1),'admin','営業');visible('営業');cases.push('Japanese encoded organization uses scoped URL');
 await render('pending-unmount');const last=pending.at(-1);await act(async()=>root.unmount());assert(last.signal.aborted);await answer(last,'owner');cases.push('unmount cancels pending role request');
 for(const name of cases)console.log('PASS SFA CSV link: '+name);console.log(JSON.stringify({passed:cases.length,failed:0,scope:'Real React/jsdom component and real actor guard, synthetic read responses; no browser, provider, production writes or native download'}));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>dom.window.close());
