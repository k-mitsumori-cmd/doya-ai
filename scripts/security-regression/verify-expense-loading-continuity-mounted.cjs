'use strict';
process.env.NODE_ENV='test';
// Isolated audit harness. No environment loading, sockets, credentials, DB or provider calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..');
const sourceRoot=process.env.DOYA_TEST_BASELINE||repo;
const req=require('node:module').createRequire(path.join(repo,'package.json'));
const ts=req('typescript'),React=req('react'),{JSDOM}=req('jsdom');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.invalid'});
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=req('react-dom/client');
let now=0,timerId=0,timers=new Map(),requests=[],redirects=[],slug='synthetic',sourceHashes={};
const router={replace:p=>redirects.push({at:now,path:p})};
const noop=()=>null;
const Generic=({children})=>React.createElement('div',null,children);
const Button=({children,onClick,href})=>React.createElement(href?'a':'button',{href,onClick},children);
const Empty=({title,action})=>React.createElement('div',{'data-empty':true},title,action);
const Hero=()=>React.createElement('div',{'data-dashboard':true},'Synthetic dashboard');
const styles=new Proxy({},{get:(_,k)=>String(k)});
const fallback=new Proxy({__esModule:true},{get:(o,k)=>k in o?o[k]:noop});
function load(file,mocks={}){
 const source=fs.readFileSync(path.join(sourceRoot,file),'utf8');sourceHashes[file]=crypto.createHash('sha256').update(source).digest('hex');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};
 vm.runInNewContext(output,{exports,require:n=>{
  if(n in mocks)return mocks[n];
  if(n==='react')return React;if(n==='react/jsx-runtime')return req(n);
  if(n==='next/navigation')return {useParams:()=>({orgSlug:slug}),useRouter:()=>router};
  if(n==='next/link')return {__esModule:true,default:Button};
  if(n.endsWith('.module.css'))return {__esModule:true,default:styles};
  if(n==='lucide-react')return fallback;
  throw Error('Unmocked '+file+' -> '+n);
 },setTimeout:(fn,ms)=>{let id=++timerId;timers.set(id,{at:now+ms,fn});return id},clearTimeout:id=>timers.delete(id),
 fetch:(url,init)=>defer('usage',url,init),AbortController,Date:class extends Date { constructor(...a){super(...(a.length?a:[1793491200000+now]))} static now(){return 1793491200000+now} },console,Error,URL,URLSearchParams},{filename:file});
 return exports;
}
function defer(kind,url,init){let resolve;const promise=new Promise(r=>resolve=r);requests.push({kind,url,init,at:now,resolve,settled:false});return promise}
const ds=load('src/components/ds/index.tsx',{'@/components/shell/icons':fallback,'./motion':fallback,'./feedback':fallback,'./kun':fallback,'./dialog':fallback,'./next-step':fallback});
// Unrelated decorative components mocked; actual Card/Skeleton and Expense Loading are mounted unchanged.
const ui=load('src/components/expense/ui.tsx',{'@/components/ds':{...ds,Button,EmptyState:Empty},'@/components/ds/dialog':fallback,'@/lib/expense/constants':{ROLE_RANK:{member:1,manager:2,admin:3,owner:4},SCHEDULE_STATUS_LABEL:{}}});
const api=load('src/components/expense/api.ts',{'@/lib/org-client-response':{requestOrgJson:(_tool,url,_org,init)=>defer('query',url,init)}});
const Layout=load('src/app/(shell)/expense/[orgSlug]/layout.tsx',{'react-hot-toast':{Toaster:noop},'@/components/shell/ToolFrame':{__esModule:true,default:({children})=>React.createElement('main',null,children)},'@/lib/expense/nav':{expenseNav:()=>[]},'@/components/expense/ui':ui}).default;
const Dashboard=load('src/app/(shell)/expense/[orgSlug]/page.tsx',{'@/components/expense/api':api,'@/components/expense/CashBars':{__esModule:true,default:noop},'@/components/ds':{...ds,Button,StatTile:noop},'@/components/expense/next':{ExpenseHero:Hero,MonthDonut:noop,PaymentProgress:noop,YenCount:noop},'@/components/ds/infographic':{InfoPanel:Generic},'@/components/expense/ui':ui}).default;
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
async function act(fn){await React.act(async()=>{await fn();await flush()})}
async function advance(t){assert(t>=now);while(true){let next=[...timers].filter(([,v])=>v.at<=t).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);await act(()=>next[1].fn())}now=t;await act(()=>{})}
function current(kind){return requests.filter(x=>x.kind===kind&&!x.settled&&!x.init?.signal?.aborted)}
async function respond(kind,status,data,urlPart){const matches=current(kind).filter(x=>!urlPart||x.url.includes(urlPart));assert(matches.length,'No live request '+kind+' '+urlPart);await act(()=>{for(const r of matches){r.settled=true;const res={ok:status>=200&&status<300,status};r.resolve(kind==='usage'?{...res,json:async()=>data}:{res,data})}})}
function snapshot(div,label){return {at:now,label,skeletons:div.querySelectorAll('[aria-busy="true"]').length,cardCount:div.querySelectorAll('section.card').length,emptyCards:[...div.querySelectorAll('section.card')].filter(x=>!x.children.length).length,dashboard:!!div.querySelector('[data-dashboard]'),error:div.textContent.includes('読み込めませんでした'),denied:div.textContent.includes('権限がありません'),queryRequests:requests.filter(x=>x.kind==='query').length}}
async function mount(){now=0;timers.clear();requests=[];redirects=[];const div=document.createElement('div');document.body.append(div);const root=createRoot(div);await act(()=>root.render(process.env.DOYA_TEST_STRICT==='1'?React.createElement(React.StrictMode,null,React.createElement(Layout,null,React.createElement(Dashboard))):React.createElement(Layout,null,React.createElement(Dashboard))));return {div,root,close:async()=>{await act(()=>root.unmount());div.remove();assert.equal(timers.size,0)}}}
const summary={month:'2026-11',kpi:{thisMonthOut:0,thisMonthCount:0,paid:0,paidCount:0,fixedMonthly:0,saasMonthly:0,saasCount:0},actionItems:[],contractAlerts:[],cash:{},contractCount:0};
(async()=>{const cases=[];let item;
 try{
 item=await mount();const phases=[snapshot(item.div,'permission begins')];assert.equal(current('query').length,0);await advance(300);phases.push(snapshot(item.div,'permission skeleton visible'));assert.equal(phases.at(-1).skeletons,1);
 await advance(650);await respond('usage',200,{role:'owner'});phases.push(snapshot(item.div,'dashboard query begins'));assert.equal(phases.at(-1).skeletons,1,'permission skeleton must stay visible when dashboard mounts');assert.equal(phases.at(-1).emptyCards,0);assert.equal(current('query').length,3);
 await advance(949);phases.push(snapshot(item.div,'second timer 299ms'));assert.equal(phases.at(-1).skeletons,1);await advance(950);phases.push(snapshot(item.div,'second timer 300ms'));assert.equal(phases.at(-1).skeletons,1);
 await advance(1250);await respond('query',200,{schedules:[]},'/schedules');await respond('query',200,summary,'/summary');phases.push(snapshot(item.div,'data ready'));assert(phases.at(-1).dashboard);assert.equal(phases.at(-1).skeletons,0);
 cases.push({name:'slow permission to slow summary keeps visible skeleton',phases,passed:true});await item.close();item=null;
 item=await mount();await advance(50);await respond('usage',200,{role:'owner'});await advance(100);await respond('query',200,{schedules:[]},'/schedules');await respond('query',200,summary,'/summary');assert.equal(snapshot(item.div,'fast').skeletons,0);assert(snapshot(item.div,'fast').dashboard);cases.push({name:'fast permission and summary preserve no-flash behavior',passed:true});await item.close();item=null;
 for(const [name,status,data,expected] of [['missing role',200,{},'denied'],['permission HTTP500',500,{},'error'],['permission HTTP401',401,{},'redirect']]){item=await mount();await respond('usage',status,data);assert.equal(requests.filter(r=>r.kind==='query').length,0);assert.equal(snapshot(item.div,name).dashboard,false);if(expected==='redirect')assert.equal(redirects[0].path,'/expense');else assert(snapshot(item.div,name)[expected]);cases.push({name,passed:true,noDashboardQuery:true});await item.close();item=null}
 for(const status of [403,500]){item=await mount();await respond('usage',200,{role:'owner'});await respond('query',status,{error:'確認用エラー'},'/summary');const s=snapshot(item.div,'summary error');assert.equal(s.dashboard,false);assert(s[status===403?'denied':'error']);cases.push({name:'summary HTTP'+status,passed:true});await item.close();item=null}
 item=await mount();await respond('usage',500,{});const retry=[...item.div.querySelectorAll('button')].find(b=>b.textContent==='もう一度');assert(retry);await act(()=>retry.click());assert.equal(current('usage').length,1);assert.equal(current('query').length,0);await respond('usage',200,{role:'owner'});assert.equal(current('query').length,3);cases.push({name:'permission retry retains gate until successful reply',passed:true});await item.close();item=null;
 item=await mount();const old=current('usage')[0];await item.close();item=null;await act(()=>old.resolve({ok:true,status:200,json:async()=>({role:'owner'})}));assert.equal(requests.filter(r=>r.kind==='query').length,0);cases.push({name:'unmounted permission response cannot mount dashboard',passed:true});

 item=await mount();await advance(100);await respond('usage',200,{role:'owner'});await advance(299);assert.equal(snapshot(item.div,'initial299').skeletons,0);await advance(300);assert.equal(snapshot(item.div,'initial300').skeletons,1);cases.push({name:'fast permission shares remaining200ms budget with summary',passed:true});await item.close();item=null;
 item=await mount();await advance(650);await respond('usage',200,{role:'owner'});await respond('query',500,{error:'確認用エラー'},'/summary');const retrySummary=[...item.div.querySelectorAll('button')].find(b=>b.textContent==='もう一度');assert(retrySummary);await act(()=>retrySummary.click());assert.equal(snapshot(item.div,'retry0').skeletons,0);await advance(949);assert.equal(snapshot(item.div,'retry299').skeletons,0);await advance(950);assert.equal(snapshot(item.div,'retry300').skeletons,1);cases.push({name:'later summary retry starts a fresh300ms anti-flash budget',passed:true});await item.close();item=null;
 item=await mount();await advance(650);await respond('usage',500,{});const retryPermission=[...item.div.querySelectorAll('button')].find(b=>b.textContent==='もう一度');await act(()=>retryPermission.click());await advance(750);await respond('usage',200,{role:'owner'});assert.equal(snapshot(item.div,'permission retry summary').skeletons,0);await advance(949);assert.equal(snapshot(item.div,'permission retry299').skeletons,0);await advance(950);assert.equal(snapshot(item.div,'permission retry300').skeletons,1);cases.push({name:'permission retry starts a fresh shared300ms budget',passed:true});await item.close();item=null;

 item=await mount();const oldUnauthorized=current('usage');await item.close();item=null;await act(()=>{for(const r of oldUnauthorized)r.resolve({ok:false,status:401,json:async()=>({})})});assert.equal(redirects.length,0,'late401 after leaving expense must not redirect');cases.push({name:'unmounted permission401 cannot navigate back to expense',passed:true});
 assert.equal(cases.length,13);
 const report={checkedAt:new Date().toISOString(),strictMode:process.env.DOYA_TEST_STRICT==='1',expected:13,sourceHashes,cases,passed:cases.length,scope:'Actual current Layout, Dashboard, useExpenseQuery, expense Loading, ds Card and Skeleton mounted unchanged in React/JSDOM; controlled synthetic HTTP and virtual component timers. Visual peripherals mocked. No real network, credentials, provider, database, customer writes, CSS layout, native/browser timing or CLS measurement. This verifies initial-loading timer continuity and access/error guards only, not production CLS or all transitions.',finding:{confirmed:'Initial permission and summary share one300ms anti-flash delay; subsequent retries retain a new300ms delay.',fixImplemented:true,productionChanged:false},wholeAuditComplete:false};
 const reportPath=process.env.DOYA_TEST_REPORT||path.join(repo,'docs/audits/2026-10-06-all-services-recheck/expense-loading-continuity-results.json');fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cases:cases.map(x=>x.name),phases:cases[0].phases}));
 }finally{if(item)await item.close();dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
