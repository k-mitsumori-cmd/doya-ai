const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {check,results}=require('./load-typescript.cjs');
const files=['src/app/banner/dashboard/create/page.tsx','src/app/banner/dashboard/chat/page.tsx'];
function fixture(file,response){
 const source=fs.readFileSync(path.join(process.env.DOYA_TEST_BASELINE||process.cwd(),file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),parts={};
 function visit(n){if(ts.isClassDeclaration(n)&&n.name?.text==='BannerApiError')parts.error=n.getText(ast);if(ts.isFunctionDeclaration(n)&&['safeReadJson','normalizeNonJsonApiError'].includes(n.name?.text))parts[n.name.text]=n.getText(ast);if(ts.isVariableDeclaration(n)&&['safeReadJson','normalizeNonJsonApiError','handleGenerate'].includes(n.name.getText(ast)))parts[n.name.getText(ast)]='const '+n.getText(ast)+';';ts.forEachChild(n,visit)}visit(ast);assert.ok(parts.handleGenerate);
 const old=['data:image/png;base64,old'],state={generatedBanners:old},timers=new Map(),messages=[],toasts=[],requests=[];let refreshed=0,usageWrites=0;
 const context={React:{createElement:()=>null},UiIcon:()=>null,AbortController,refineDraftRevision:{current:0},canGenerate:true,isThinking:false,isRefining:false,isGenerating:false,proposedSpec:{category:'synthetic',purpose:'synthetic',size:'1080x1080',keyword:'synthetic'},generateCount:1,category:'synthetic',purpose:'synthetic',keyword:'synthetic',effectiveSize:'1080x1080',imageDescription:'',logoImage:null,personImages:[],useCustomColors:false,shareToGallery:false,shareProfile:false,isGuest:false,guestUsageCount:0,
  quota:{check:async()=>true,acceptLimit:()=>{},refresh:()=>{refreshed++}},pushAssistant:s=>messages.push(s),toast:{error:s=>toasts.push(s),success:s=>toasts.push(s)},readGenStats:()=>({}),DEFAULT_PREDICT_MS:10000,safeNumber:(v,f)=>Number(v)||f,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),clampMs:(v,a,b)=>Math.min(b,Math.max(a,v)),updateEma:(v,ms)=>({emaMs:ms}),writeGenStats:()=>{},incrementUserUsage:()=>{usageWrites++;return 1},setGuestUsage:()=>{usageWrites++},
  setTimeout:fn=>{fn();return 1},window:{setTimeout:(fn,ms)=>{assert.ok(ms>=90000&&ms<=290000);timers.set(1,fn);return 1},clearTimeout:id=>timers.delete(id)},fetch:async(url,init)=>{requests.push({url,init});if(response instanceof Error)throw response;return typeof response==='function'?response(init.signal):response}};
 context.operations={begin:()=>{const controller=new AbortController(),id=context.window.setTimeout(()=>controller.abort(),290000);return {signal:controller.signal,current:()=>true,finish:()=>{context.window.clearTimeout(id);controller.abort()}}}};
 for(const name of new Set(source.match(/\bset[A-Z]\w*/g)||[]))if(!context[name])context[name]=v=>{const key=name[3].toLowerCase()+name.slice(4);state[key]=typeof v==='function'?v(state[key]):v};
 vm.runInNewContext(ts.transpileModule(Object.values(parts).join('\n')+'\nglobalThis.run=handleGenerate;',{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,context);
 return{run:context.run,state,old,timers,messages,toasts,requests,refreshed:()=>refreshed,usageWrites:()=>usageWrites,fire:()=>{const callbacks=[...timers.values()];timers.clear();for(const fn of callbacks)fn()}};
}
(async()=>{
 for(const file of files){
 await check(file+' rejects invalid results, transport failures and quota refusal without losing images',async()=>{
  for(const response of [Response.json({}),Response.json({banners:[]}),Response.json({banners:['not-image']}),new Response('SYNTHETIC_PRIVATE_DIAGNOSTIC',{status:500}),new Error('SYNTHETIC_PRIVATE_DIAGNOSTIC'),{ok:true,status:200,text:async()=>{throw new DOMException('SYNTHETIC_PRIVATE_DIAGNOSTIC','AbortError')}},Response.json({code:'MONTHLY_LIMIT_REACHED',usage:{monthlyLimit:15}},{status:429})]){
   const f=fixture(file,response);await f.run();assert.equal(f.state.generatedBanners,f.old);assert.equal(f.state.isGenerating,false);assert.equal(f.timers.size,0);assert.equal(f.refreshed(),0);assert.equal(f.usageWrites(),0);assert.ok(!f.messages.some(s=>s.includes('生成できました')));assert.doesNotMatch(JSON.stringify([f.state.error,f.toasts]),/SYNTHETIC_PRIVATE/);
  }
 });
 await check(file+' keeps the body deadline active and preserves prior images on timeout',async()=>{
  const f=fixture(file,signal=>({ok:true,status:200,text:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('synthetic timeout','AbortError')),{once:true}))}));let settled=false;const pending=f.run().then(()=>settled=true);await new Promise(r=>setImmediate(r));assert.equal(settled,false);assert.equal(f.timers.size,1);assert.equal(f.state.isGenerating,true);assert.ok(f.requests[0].init.signal);f.fire();await pending;assert.equal(f.state.generatedBanners,f.old);assert.equal(f.state.isGenerating,false);assert.equal(f.timers.size,0);assert.equal(f.refreshed(),0);
 });
 await check(file+' accepts verified images and exposes partial success warnings',async()=>{
  for(const warning of [undefined,'生成枚数の反映を確認できませんでした。残り枚数を再読み込みしてください。']){
   const f=fixture(file,Response.json({banners:['data:image/png;base64,new'],warning}));await f.run();assert.deepEqual(Array.from(f.state.generatedBanners),['data:image/png;base64,new']);assert.equal(f.state.isGenerating,false);assert.equal(f.timers.size,0);assert.equal(f.refreshed(),1);if(warning)assert.ok([...f.messages,...f.toasts,f.state.error||''].some(s=>s.includes(warning)));
  }
 });
 }
 console.log(JSON.stringify({passed:results.length,scope:'Actual AST-extracted page handlers, synthetic quota/fetch/clock/setters, no DB/provider/payment requests',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
