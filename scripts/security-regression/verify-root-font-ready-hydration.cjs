// Actual RootLayout and proposed readiness component, synthetic surrounding components and font/load clock.
// No browser, network, provider, credentials or DB. Actual Next browser comparison is separate.
process.env.NODE_ENV='development'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process')
const repo=path.resolve(__dirname,'../..'),req=name=>require(path.join(repo,'node_modules',name))
const layout=process.env.DOYA_FONT_LAYOUT||path.join(repo,'src/app/layout.tsx'),component=process.env.DOYA_FONT_COMPONENT||path.join(repo,'src/components/MaterialSymbolsReady.tsx')
assert(layout&&path.isAbsolute(layout));assert(component&&path.isAbsolute(component))
const scenarios=['ready-before-hydration','without-font-api','await-window-load','await-font-ready','unmount-pending-frame','unmount-before-load']
async function worker(scenario,strict){
 const React=req('react'),{renderToString}=req('react-dom/server'),ts=req('typescript'),{JSDOM}=req('jsdom'),noop=()=>null
 const transform=(file,resolve)=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:resolve,console,URL,document:global.document,window:global.window},{filename:file});return exports}
 let readyComponent
 const fontRequire=name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return req(name);throw Error('Unexpected font import')}
 const stub={__esModule:true,default:noop,GoogleTagManager:noop,GoogleTagManagerNoScript:noop,UserStateSignal:noop,GoogleAnalytics:noop,Toaster:noop}
 let dom,mounted,errors=[],recoverable=[],result={scenario,strict,passed:false,reactVersion:React.version}
 const originalError=console.error,priorFetch=global.fetch
 const oldGlobals=new Map(['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event'].map(n=>[n,Object.getOwnPropertyDescriptor(global,n)]))
 global.fetch=async()=>{throw Error('Font regression forbids network')}
 try{
  // Component module only captures useEffect, and resolves document/window at effect time in the VM.
  dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://synthetic.invalid',pretendToBeVisual:true,runScripts:'outside-only'})
  for(const name of oldGlobals.keys())Object.defineProperty(global,name,{configurable:true,writable:true,value:name==='window'?dom.window:dom.window[name]})
  let fontReady=!['await-font-ready','unmount-pending-frame'].includes(scenario)
  const callbacks=new Map(),loads=new Map();let nextFrame=0
  Object.defineProperty(dom.window.document,'readyState',{configurable:true,value:['await-window-load','unmount-before-load'].includes(scenario)?'loading':'complete'})
  Object.defineProperty(dom.window.document,'fonts',{configurable:true,value:scenario==='without-font-api'?undefined:{check:()=>fontReady}})
  dom.window.requestAnimationFrame=callback=>{const id=++nextFrame;callbacks.set(id,callback);return id}
  dom.window.cancelAnimationFrame=id=>callbacks.delete(id)
  const actualAdd=dom.window.addEventListener.bind(dom.window),actualRemove=dom.window.removeEventListener.bind(dom.window)
  dom.window.addEventListener=(type,listener,options)=>{if(type==='load'){loads.set(listener,Boolean(options&&options.once));return}return actualAdd(type,listener,options)}
  dom.window.removeEventListener=(type,listener,options)=>{if(type==='load'){loads.delete(listener);return}return actualRemove(type,listener,options)}
  readyComponent=transform(component,fontRequire).default
  function resolve(name){
   if(name==='react/jsx-runtime')return req(name)
   if(name==='./globals.css')return {}
   if(name==='@/components/MaterialSymbolsReady')return{__esModule:true,default:readyComponent}
   if(name==='@/components/Providers')return{Providers:({children})=>children}
   if(name==='@/lib/seo')return{SITE_CONFIG:{name:'Synthetic',url:'https://synthetic.invalid'},SERVICE_SEO:{portal:{title:'Synthetic',description:'Synthetic',keywords:[]}},generateOrganizationSchema:()=>({}),generateWebSiteSchema:()=>({})}
   if(name==='@/lib/services')return{getRunningServices:()=>[]}
   if(name==='@/lib/brand')return{isBrandRenamed:()=>false}
   if(name==='react-hot-toast'||name.startsWith('@/components/'))return stub
   throw Error('Unexpected layout import '+name)
  }
  const C=transform(layout,resolve).default
  const element=()=>{const value=React.createElement(C,null,React.createElement('main',null,'Synthetic child'));return strict?React.createElement(React.StrictMode,null,value):value}
  const server=renderToString(element())
  // Parse SSR output into the same document, preserving the synthetic font/load APIs.
  dom.window.document.documentElement.innerHTML=server.replace(/^<html[^>]*>/,'').replace(/<\/html>$/,'')
  dom.window.document.documentElement.lang='ja';dom.window.document.documentElement.setAttribute('data-scroll-behavior','smooth')
  const body=dom.window.document.body
  assert(!body.classList.contains('fonts-loaded'),'SSR body is initially clean')
  const scripts=[...dom.window.document.scripts].filter(x=>x.textContent.includes("document.body.classList.add('fonts-loaded')"))
  for(const script of scripts)vm.runInNewContext(script.textContent,{document:dom.window.document,window:dom.window,requestAnimationFrame:dom.window.requestAnimationFrame},{filename:'actual-root-font-inline.js'})
  result.beforeHydrationClass=body.classList.contains('fonts-loaded');result.actualInlineInitializers=scripts.length
  console.error=(...args)=>errors.push(args.map(String).join(' '))
  global.IS_REACT_ACT_ENVIRONMENT=true
  const {hydrateRoot}=req('react-dom/client')
  await React.act(async()=>{mounted=hydrateRoot(dom.window.document,element(),{onRecoverableError:e=>recoverable.push(e.name)});await new Promise(setImmediate)})
  result.afterHydrationClass=body.classList.contains('fonts-loaded')
  if(scenario==='await-window-load'){
   assert(!result.afterHydrationClass);for(const [fn,once]of [...loads]){if(once)loads.delete(fn);fn(new dom.window.Event('load'))}
   assert(body.classList.contains('fonts-loaded'))
  }else if(scenario==='await-font-ready'){
   assert(!result.afterHydrationClass);fontReady=true;const pending=[...callbacks];callbacks.clear();for(const [,fn]of pending)fn(0)
   assert(body.classList.contains('fonts-loaded'))
  }else if(scenario==='unmount-pending-frame'||scenario==='unmount-before-load'){
   assert(!result.afterHydrationClass);result.pendingFramesBeforeUnmount=callbacks.size;result.pendingLoadListenersBeforeUnmount=loads.size
   const capturedFrames=[...callbacks.values()]
   await React.act(async()=>{mounted.unmount();mounted=null})
   result.pendingFramesAfterUnmount=callbacks.size;result.pendingLoadListenersAfterUnmount=loads.size
   fontReady=true;let lateExceptions=0
   for(const fn of capturedFrames)try{fn(0)}catch{lateExceptions++}
   for(const fn of [...loads.keys()])try{fn(new dom.window.Event('load'))}catch{lateExceptions++}
   result.lateExceptions=lateExceptions
   assert.equal(callbacks.size,0,'Unmount must cancel owned frame');assert.equal(loads.size,0,'Unmount must remove load listener');assert.equal(lateExceptions,0);assert(!body.classList.contains('fonts-loaded'))
  }else assert(result.afterHydrationClass,'Ready or unsupported API must reveal icons after hydration')
  result.hydrationWarnings=errors.filter(x=>/hydrati|did not match|extra attributes/i.test(x)).length;result.recoverableErrors=recoverable.length
  assert.equal(result.beforeHydrationClass,false,'Actual initializer must not change body before hydration')
  assert.equal(result.hydrationWarnings,0,'SSR/first-client attributes must match');assert.equal(result.recoverableErrors,0)
  result.passed=true
 }catch(e){result.error=e.message;result.hydrationWarnings=errors.filter(x=>/hydrati|did not match|extra attributes/i.test(x)).length;result.recoverableErrors=recoverable.length}
 finally{
  if(mounted)try{await req('react').act(async()=>mounted.unmount())}catch{}
  console.error=originalError;global.fetch=priorFetch;delete global.IS_REACT_ACT_ENVIRONMENT
  for(const [name,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(global,name,descriptor);else delete global[name]}
  dom?.window.close()
 }
 return result
}
;(async()=>{
 if(process.argv[2]==='--worker'){console.log(JSON.stringify(await worker(process.argv[3],process.argv[4]==='strict')));return}
 const rows=[]
 for(const strict of [false,true])for(const scenario of scenarios){
  const env=Object.fromEntries(['PATH','HOME','LANG','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));Object.assign(env,{DOYA_FONT_LAYOUT:layout,DOYA_FONT_COMPONENT:component,NODE_ENV:'development'})
  const run=cp.spawnSync(process.execPath,[__filename,'--worker',scenario,strict?'strict':'normal'],{env,encoding:'utf8',timeout:30000});assert.equal(run.status,0,'Worker process must complete');const item=JSON.parse(run.stdout.trim());rows.push(item);console.log((item.passed?'PASS Root font readiness: ':'FAIL Root font readiness: ')+scenario+' '+(strict?'StrictMode':'normal'))
 }
 const report={kind:'root-font-ready-hydration',checkedAt:new Date().toISOString(),layout,component,fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),sourceHashes:{layout:crypto.createHash('sha256').update(fs.readFileSync(layout)).digest('hex'),component:crypto.createHash('sha256').update(fs.readFileSync(component)).digest('hex')},passed:rows.filter(x=>x.passed).length,failed:rows.filter(x=>!x.passed).length,expectedCases:12,results:rows,scope:'Actual root layout and readiness component through React18.3.1 SSR/document hydrateRoot. Surrounding service/auth/analytics UI mocked; font/load/frame clock synthetic. No network/DB/providers. Installed React18 probe differs from actual Next App Router browser runtime; real local Next positive comparison remains separate.'}
 const output=process.env.DOYA_FONT_OUTPUT||path.join(repo,'docs/audits/2026-10-06-all-services-recheck/root-font-ready-hydration-results.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,expectedCases:12}));process.exitCode=report.failed?1:0
})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1})
