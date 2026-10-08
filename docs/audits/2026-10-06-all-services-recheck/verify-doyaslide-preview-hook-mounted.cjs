process.env.NODE_ENV='test';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),React=require('react'),{JSDOM}=require('jsdom');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const dom=new JSDOM('<body></body>');global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),base='docs/audits/2026-10-06-all-services-recheck/',cases=[];
async function fixture(reply){let now=1000,seq=0,identity='alpha',view,closed=false;const timers=new Map(),calls=[],styles=['corporate'];
 const clock={Date:class extends Date{static now(){return now}},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq},clearTimeout:id=>timers.delete(id)};
 const fetch=(url,init)=>{calls.push({url,init});return reply(url,init)};
 const reader=load('src/lib/doyaslide/style-preview-client.ts',{}, {fetch,AbortController,TextDecoder,Uint8Array,URL,...clock});
 const hook=load('src/lib/doyaslide/use-style-previews.ts',{react:React,'./style-preview-client':reader},{AbortController,...clock});
 function Probe(){view=hook.useStylePreviews(identity,styles);return null}
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 const act=fn=>React.act(async()=>{await fn();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))});
 const render=()=>act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Probe))));await render();
 return{calls,timers,act,render,get view(){return view},reply:fn=>reply=fn,advance:ms=>now+=ms,actor:s=>identity=s,
 poll:()=>act(()=>{const poll=[...timers].find(([,t])=>t.ms===10000);assert(poll,JSON.stringify({message:'Expected polling timer',calls:calls.length,now,view:view.entries,timers:[...timers.values()].map(t=>t.ms)}));timers.delete(poll[0]);now+=10000;poll[1].fn()}),
 close:()=>act(()=>{if(!closed){closed=true;root.unmount();c.remove()}})};
}
const pending=async()=>Response.json({urls:[],pending:true},{status:202});
async function check(name,reply,run){const f=await fixture(reply);try{await run(f);cases.push(name)}finally{await f.close();assert.equal(f.timers.size,0)}}
(async()=>{
 await check('Pending previews stop after exactly 36 requests without a remaining timer',pending,async f=>{assert.equal(f.calls.length,1);for(let i=1;i<36;i++)await f.poll();assert.equal(f.calls.length,36);assert.equal(f.view.entries.corporate.status,'error');assert.equal(f.timers.size,0)});
 await check('Elapsed seven-minute deadline stops a delayed poll without another HTTP request',pending,async f=>{f.advance(420000);await f.poll();assert.equal(f.calls.length,1);assert.equal(f.view.entries.corporate.status,'error');assert.equal(f.timers.size,0)});
 await check('Explicit retry resets elapsed deadline and attempt count, and coalesces double clicks',pending,async f=>{for(let i=1;i<36;i++)await f.poll();f.advance(420000);await f.act(()=>{void f.view.retry('corporate');void f.view.retry('corporate')});assert.equal(f.calls.length,37);assert.equal(f.view.entries.corporate.status,'loading');await f.poll();assert.equal(f.calls.length,38)});
 await check('Failed explicit retry retains a previously confirmed preview',async()=>Response.json({urls:['/sample.png'],pending:false}),async f=>{f.reply(async()=>Response.json({error:'synthetic'},{status:500}));await f.act(()=>f.view.retry('corporate'));assert.equal(f.view.entries.corporate.status,'error');assert.deepEqual(Array.from(f.view.entries.corporate.urls),['/sample.png'])});
 await check('Concurrent ensure and retry calls share one registered transport',()=>new Promise(()=>{}),async f=>{const count=f.calls.length;await f.act(()=>{void f.view.ensure('corporate');void f.view.retry('corporate');void f.view.ensure('corporate')});assert.equal(f.calls.length,count)});
 const stale=[];await check('Actor ABA ignores old responses and retained callbacks',()=>new Promise(r=>stale.push(r)),async f=>{const old=f.view,first=f.calls[0];f.reply(async()=>Response.json({urls:['/current.png'],pending:false}));f.actor('beta');await f.render();f.actor('alpha');await f.render();assert(first.init.signal.aborted);const count=f.calls.length;await f.act(()=>{void old.ensure('corporate');void old.retry('corporate');stale.forEach(resolve=>resolve(Response.json({urls:[],pending:true},{status:202})))});assert.equal(f.calls.length,count);assert.deepEqual(Array.from(f.view.entries.corporate.urls),['/current.png'])});
 await check('Unmount aborts transport and retained timer callbacks cannot fetch',pending,async f=>{const retained=[...f.timers.values()],count=f.calls.length;await f.close();await f.act(()=>retained.forEach(t=>t.fn()));assert.equal(f.calls.length,count);assert.equal(f.timers.size,0)});
 assert.equal(cases.length,7);const files=['src/lib/doyaslide/use-style-previews.ts','src/lib/doyaslide/style-preview-client.ts',base+'verify-doyaslide-preview-hook-mounted.cjs'];const report={checkedAt:new Date().toISOString(),expected:7,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual React hook and transport reader mounted under StrictMode. Synthetic HTTP and deterministic clock. No provider, customer DB or production writes.'};fs.writeFileSync(base+'doyaslide-preview-hook-mounted-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});
