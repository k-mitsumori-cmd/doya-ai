process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),out=__dirname,dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const file=path.join(repo,'src/components/support-chat/SupportChat.tsx'),source=fs.readFileSync(file,'utf8');
async function scenario(strict,kind){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://synthetic.invalid/home'}),prior=new Map(),calls=[],held={};
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 const A='DY-261102-AAAA',B='DY-261102-BBBB',ticket=no=>({ticketNo:no,category:'other',status:'open',createdAt:'2026-11-02T00:00:00Z',summary:'Synthetic '+no,messages:[{role:'user',body:'Synthetic body '+no,createdAt:'2026-11-02T00:00:00Z'}]});let root;
 try{
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return dep(n);
 if(n==='next/navigation')return {usePathname:()=>'/home'};
 if(n.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
 if(n==='@/components/icons')return {UiIcon:()=>null};
 if(n==='@/lib/support-chat/knowledge')return {suggestedQuestions:()=>[],toolIdForPath:()=>null,toolNameOf:()=>null,SUPPORT_HOURS_LABEL:'Synthetic'};
 if(n==='@/lib/support-chat/rules')return {SUPPORT_CATEGORY_CHOICES:['other'],SUPPORT_CATEGORY_LABEL:{other:'Synthetic'}};
 throw Error('Unexpected import '+n);
 },console,window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,URLSearchParams,fetch:async(url,options)=>{
 const method=options?.method||'GET';calls.push({url,method});
 const respond=(no,status=200)=>new Response(JSON.stringify(status===200?{ticket:ticket(no)}:{error:'Synthetic failure'}),{status});
 if(method==='POST'){assert.equal(kind,'follow-up-completion');assert.equal(url,'/api/support-chat/tickets/'+A);return new Promise(resolve=>held.post=()=>resolve(respond(A)))}
 assert.equal(method,'GET');
 if(url==='/api/support-chat/tickets')return new Response(JSON.stringify({tickets:[ticket(A),ticket(B)],unread:0}),{status:200});
 if(url==='/api/support-chat/tickets/'+A){if(['selected-draft','follow-up-completion'].includes(kind))return respond(A);return new Promise((resolve,reject)=>held.A=()=>kind==='stale-network'?reject(new Error('Synthetic offline')):resolve(respond(A,kind==='stale-error'?404:200)))}
 if(url==='/api/support-chat/tickets/'+B){if(kind==='pending-B')return new Promise(resolve=>held.B=()=>resolve(respond(B)));return respond(B)}
 throw Error('Unexpected URL '+url);
 }});
 const {createRoot}=dep('react-dom/client');root=createRoot(document.getElementById('root'));const element=React.createElement(exports.default,{actorKey:'synthetic-owner'});await React.act(async()=>root.render(strict?React.createElement(React.StrictMode,{},element):element));
 const click=async selector=>{const el=document.querySelector(selector);assert(el,selector);await React.act(async()=>el.click())};
 await click('button[aria-label="質問・お問い合わせのチャットを開く"]');
 const history=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('お問い合わせの履歴'));assert(history);await React.act(async()=>history.click());
 const rows=()=>Array.from(document.querySelectorAll('button')).filter(x=>x.textContent.includes('Synthetic DY-'));
 assert.equal(rows().length,2);await React.act(async()=>rows()[0].click());
 const title=()=>document.querySelector('#support-chat-title').textContent,reply=()=>document.querySelector('textarea[aria-label="運営への返信"]'),{Simulate}=dep('react-dom/test-utils');const type=async text=>{assert(reply());await React.act(async()=>Simulate.change(reply(),{target:{value:text}}))};
 if(['selected-draft','follow-up-completion'].includes(kind)){
  assert.equal(title(),A);await type('SYNTHETIC REPLY INTENDED FOR A');
  if(kind==='follow-up-completion'){const form=reply().closest('form');await React.act(async()=>Simulate.submit(form));assert(held.post)}
 }else assert(held.A);
 await click('button[aria-label="戻る"]');assert.equal(title(),'お問い合わせの履歴');
 if(kind==='back'){await React.act(async()=>held.A());assert.equal(title(),'お問い合わせの履歴');assert(!reply())}
 await React.act(async()=>rows()[1].click());
 if(kind==='pending-B'){
  assert(held.B);assert(!reply());assert.equal(title(),'お問い合わせ');await React.act(async()=>held.A());assert(!reply());assert.equal(title(),'お問い合わせ');assert(document.querySelector('[aria-label="読み込んでいます"]'));await React.act(async()=>held.B());
 }
 assert.equal(title(),B);assert.equal(reply().value,'');await type('SYNTHETIC REPLY INTENDED FOR B');
 if(['out-of-order','stale-error','stale-network'].includes(kind))await React.act(async()=>held.A());
 if(kind==='follow-up-completion')await React.act(async()=>held.post());
 assert.equal(title(),B);assert.equal(reply().value,'SYNTHETIC REPLY INTENDED FOR B');assert(!document.querySelector('[role="alert"]'));
 return {strict,kind,observed:true,selectedTicketAndOwnReplyRetained:true,noPreviousTicketOrReplyWhileLoading:true,requests:calls.length,syntheticPostRequests:calls.filter(x=>x.method==='POST').length,actualMessageSent:false};

 }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(global,k,d);else delete global[k]}
}
(async()=>{const cases=[];for(const strict of [false,true])for(const kind of ['out-of-order','back','stale-error','stale-network','pending-B','selected-draft','follow-up-completion']){cases.push(await scenario(strict,kind));console.log('PASS Support ticket order: '+kind+' '+(strict?'StrictMode':'normal'))}const result={checkedAt:new Date().toISOString(),sourceFile:file,sourceHash:crypto.createHash('sha256').update(source).digest('hex'),cases,observed:cases.length,failed:0,productionRequests:0,providerCalls:0,actualMessageSends:0,scope:'Actual SupportChat mounted in JSDOM, synthetic list/detail responses and follow-up POST response only. Out-of-order success/404/network, back navigation, pending next ticket busy, draft reset and stale follow-up completion. Not actual OAuth/native browser/server or production successful notification proof.'};if(process.env.DOYA_SUPPORT_TICKET_ORDER_RESULT)fs.writeFileSync(process.env.DOYA_SUPPORT_TICKET_ORDER_RESULT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({observed:cases.length,failed:0,sourceHash:result.sourceHash}));})().catch(e=>{console.error(e.stack);process.exitCode=1});
