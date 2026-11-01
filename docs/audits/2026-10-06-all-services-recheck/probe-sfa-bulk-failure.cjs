process.env.NODE_ENV = 'test';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const root=process.cwd(),req=n=>require(path.join(root,'node_modules',n)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom');
const dom=new JSDOM('<body></body>',{url:'https://example.invalid'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=req('react-dom/client'),notices=[],writes=[];
const stage={id:'stage',name:'提案',order:1,probability:50,color:'#123456',isWon:false,isLost:false};
const deal={id:'deal',name:'Synthetic Deal',amount:100,stageId:'stage',probability:50,accountId:null,accountName:null,contactName:null,note:null,status:'open',startDate:null,expectedCloseDate:null,wonAt:null,lostAt:null,lastActivityAt:null,openTaskCount:0};
const summary={totalCount:1,openCount:1,staleCount:0,openTaskCount:0,openTotal:'100',weighted:'50',wonTotal:'0'};
const fetch=async(url,init={})=>{
 if(url==='/api/sfa/ai/next-action')return Response.json({nextAction:'Synthetic next action',tasks:[{title:'Synthetic candidate',dueDate:null}]});
 if(init.method==='POST'&&url==='/api/sfa/tasks'){writes.push(JSON.parse(init.body));return Response.json({error:'synthetic rejected'}, {status:400})}
 if(url.startsWith('/api/sfa/summary'))return Response.json({summary});
 if(url.startsWith('/api/sfa/deals'))return Response.json({stages:[stage],deals:[deal],nextCursor:null,totalCount:1,stageSummary:[{stageId:'stage',count:1,total:'100'}]});
 if(url.startsWith('/api/sfa/accounts'))return Response.json({accounts:[],nextCursor:null});
 if(url.startsWith('/api/sfa/tasks'))return Response.json({tasks:[],page:1,hasMore:false});
 if(url.startsWith('/api/sfa/activities'))return Response.json({activities:[],nextCursor:null,totalCount:0});
 throw Error('Unexpected synthetic URL '+url);
};
const helpers={};for(const file of ['client','task-date','summary','constants'])helpers['@/lib/sfa/'+file]=load('src/lib/sfa/'+file+'.ts',{}, {fetch});
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/sfa/[orgSlug]/deals/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:out,require:n=>{if(n==='react'||n==='react/jsx-runtime')return req(n);if(n==='next/navigation')return{useParams:()=>({orgSlug:'alpha'})};if(n==='react-hot-toast')return{__esModule:true,default:{success:t=>notices.push({kind:'success',text:t}),error:t=>notices.push({kind:'error',text:t})}};if(n in helpers)return helpers[n];throw Error(n)},fetch,AbortController,Date,Set,Map,Error,console,window:dom.window,document:dom.window.document});
const c=document.createElement('div');document.body.append(c);const r=createRoot(c),act=fn=>React.act(async()=>{await fn();for(let i=0;i<12;i++)await new Promise(setImmediate)}),props=e=>e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))];
(async()=>{
 await act(()=>r.render(React.createElement(out.default)));
 const ai=[...c.querySelectorAll('button')].find(b=>b.textContent.includes('auto_awesome'));
 assert.ok(ai,'AI button rendered');await act(()=>props(ai).onClick());
 const add=[...c.querySelectorAll('button')].find(b=>b.textContent.includes('チェックしたタスクを追加'));
 assert.ok(add);assert.match(c.textContent,/Synthetic candidate/);await act(()=>props(add).onClick());
 assert.equal(writes.length,1);assert.ok(!c.textContent.includes('Synthetic candidate'));assert.ok(notices.some(n=>n.kind==='success'&&n.text==='タスクを0件追加しました'));
 console.log(JSON.stringify({status:'confirmed-open',writes:writes.length,httpStatus:400,candidateLost:true,notices,scope:'Actual mounted SFA deals page and actual client/date/summary helpers. Synthetic GET, AI suggestion and failed task POST only; no paid AI, database, customer operation or production write.'},null,2));
 await act(()=>r.unmount());
})().catch(e=>{console.error(e);process.exitCode=1});
