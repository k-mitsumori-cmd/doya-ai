process.env.NODE_ENV = 'test';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{JSDOM}=require('jsdom'),{load}=require('./load-typescript.cjs');
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/interview'});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),ReactDOM=require('react-dom'),tick=()=>new Promise(r=>setImmediate(r));
const warnings=[],originalError=console.error;console.error=(...args)=>warnings.push(args.map(String).join(' '));
const motionCache={},motion=new Proxy({}, {get:(_,tag)=>motionCache[tag]||(motionCache[tag]=React.forwardRef(function MotionFixture(props,ref){const clean={...props,ref};for(const key of ['initial','animate','exit','transition','whileHover','whileTap','variants','layout','viewport'])delete clean[key];return React.createElement(tag,clean)}))});
const files=['src/app/interview/Tool.tsx','src/app/interview/projects/[id]/materials/page.tsx'];
const nativeFile=bytes=>new File([bytes],'same.pdf',{type:'application/pdf',lastModified:1});
(async()=>{
 const results=[];
 for(const file of files){
  const timers=new Map(),intervals=new Map(),requests=[],creations=[];let timer=0,status='loading',data=null,deferredSign=false;
  const clock={setTimeout:(fn,ms)=>{timers.set(++timer,{fn,ms});return timer},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>{intervals.set(++timer,{fn,ms});return timer},clearInterval:id=>intervals.delete(id)};
  const helper=load('src/lib/interview/upload-attempt.ts',{}, {AbortController,...clock});
  class PublicError extends Error {}
  const readers={InterviewCreationResponseError:PublicError,createInterviewProjectRequest:async(input,attempt)=>{creations.push({input,key:attempt.key});return{id:'project'+creations.length}},readInterviewCreationResponse:async(url,init)=>{
   requests.push({url,body:init?.body?JSON.parse(init.body):null});
   if(url.includes('/upload-url') && requests.at(-1).body.requestKey && deferredSign)return new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new PublicError('synthetic aborted signing')),{once:true})});
   if(url.includes('/upload-url'))return {res:{ok:!!requests.at(-1).body.preflight},data:requests.at(-1).body.preflight?{success:true}:{success:false}};
   return{res:{ok:true},data:{success:true,projects:[],project:{id:'project',title:'synthetic',materials:[],transcriptions:[]}}};
  }};
  const mocks={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'react-dom':ReactDOM,'next/navigation':{useParams:()=>({id:'project'}),useRouter:()=>({push(){}})},'next-auth/react':{useSession:()=>({data,status})},'next/link':({children,...props})=>React.createElement('a',props,children),'framer-motion':{motion,AnimatePresence:({children})=>React.createElement(React.Fragment,null,children)},'@/components/interview/InterviewUpsellModal':()=>null,'@/lib/pricing':{SUPPORT_CONTACT_URL:'https://example.invalid/contact'},'@/lib/interview/creation-response':readers,'@/lib/interview/upload-attempt':helper};
  const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsObject,require:name=>{assert.ok(name in mocks,'Unmocked '+name);return mocks[name]},window:dom.window,document:dom.window.document,crypto:require('node:crypto'),AbortController,URL,Date,Map,Set,Error,Number,console,FormData,XMLHttpRequest:class{constructor(){throw Error('Unexpected storage request')}},...clock});
  const container=document.getElementById('root'),root=createRoot(container),render=()=>React.act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(exportsObject.default)));await tick()}),select=async fileInput=>{
   await React.act(async()=>{const input=container.querySelector('input[type="file"]');Object.defineProperty(input,'files',{configurable:true,value:[fileInput]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await tick();await tick()});
  };
  await render();assert.equal(container.querySelector('input[type="file"]').disabled,true);assert.ok(container.textContent.includes('利用情報を確認しています'));await select(nativeFile('AAAA'));assert.equal(requests.length,0);assert.equal(creations.length,0);
  status='authenticated';data={user:{id:'owner',name:'synthetic'}};await render();assert.equal(container.querySelector('input[type="file"]').disabled,false);
  const original=nativeFile('AAAA');await select(original);const sign=()=>requests.filter(r=>r.body?.requestKey);assert.equal(sign().length,1);const firstKey=sign()[0].body.requestKey;
  status='loading';await render();assert.equal(container.querySelector('input[type="file"]').disabled,true);status='authenticated';await render();
  await select(nativeFile('AAAA'));assert.equal(sign().length,2);assert.equal(sign()[1].body.requestKey,firstKey);if(file.includes('Tool'))assert.equal(creations.length,1);
  await select(nativeFile('BBBB'));assert.equal(sign().length,3);assert.notEqual(sign()[2].body.requestKey,firstKey);if(file.includes('Tool'))assert.equal(creations.length,2);
  deferredSign=true;await select(nativeFile('CCCC'));assert.equal(sign().length,4);const interruptedKey=sign()[3].body.requestKey,createdBefore=creations.length;
  status='loading';await render();assert.ok(document.body.textContent.includes('利用情報を再確認しています'));status='authenticated';deferredSign=false;await render();await select(nativeFile('CCCC'));assert.equal(sign().length,5);assert.equal(sign()[4].body.requestKey,interruptedKey);assert.equal(creations.length,createdBefore);
  const blocked={name:'same.pdf',size:4,type:'application/pdf',lastModified:1,slice(){return{arrayBuffer:()=>new Promise(()=>{})}}};await select(blocked);assert.ok(container.textContent.includes('同じ名前のファイルの内容を確認しています'));assert.ok(timers.size);
  const count=requests.length;status='loading';data=null;await render();assert.equal(container.querySelector('input[type="file"]').disabled,true);assert.equal(requests.length,count);assert.ok(!container.textContent.includes('ファイルの内容を確認できませんでした'));assert.ok(!container.textContent.includes('同じ名前のファイルの内容を確認しています'));
  status='authenticated';data={user:{id:'owner'}};await render();assert.ok(!container.textContent.includes('ファイルの内容を確認できませんでした'));
  const priorCreates=creations.length;data={user:{id:'other-owner'}};await render();await select(nativeFile('AAAA'));assert.notEqual(sign().at(-1).body.requestKey,firstKey);if(file.includes('Tool'))assert.equal(creations.length,priorCreates+1);
  await select(blocked);assert.ok(container.textContent.includes('同じ名前のファイルの内容を確認しています'));assert.ok(timers.size);
  await React.act(async()=>root.unmount());assert.equal(timers.size,0);assert.equal(intervals.size,0);
  results.push({file,passed:['Auth-loading file input is disabled and synthetic change issues no request','Resolving auth enables selection','Same-user session refresh retains failed attempt key and project, including content reselection','Different bytes with identical metadata use a different request key and project','Same-user refresh aborts an outstanding signing request and retry keeps its key/project','Pending comparison has a visible status','Auth change aborts comparison without stale error/status, including returning to same actor','A resolved different actor has a new attempt namespace and never reuses prior keys/projects','Unmount aborts a pending comparison on the refreshed lifecycle and clears all timers/intervals']});
 }
 assert.equal(warnings.length,0,JSON.stringify(warnings));console.log(JSON.stringify({status:'passed',results,scope:'Actual full dashboard/materials TSX mounted in React18 StrictMode/jsdom with actual byte-comparison helper and native File inputs; synthetic auth/navigation/API/clock/motion. Signing reply intentionally fails, no storage/provider/DB access. No browser pixels or real NextAuth proof.'}));
})().catch(e=>{console.error=originalError;console.error(e);process.exitCode=1}).finally(()=>{console.error=originalError;dom.window.close()});
