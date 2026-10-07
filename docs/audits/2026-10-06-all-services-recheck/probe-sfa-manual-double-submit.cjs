const {withSfaAuthority}=require('../../../scripts/security-regression/sfa-authority-fixture.cjs');
process.env.NODE_ENV = 'test';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const root=process.cwd(),req=n=>require(path.join(root,'node_modules',n)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom');
const dom=new JSDOM('<body></body>',{url:'https://example.invalid'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=req('react-dom/client'),notices=[],writes=[];let releaseWrite,writeHold;
const stage={id:'stage',name:'提案',order:1,probability:50,color:'#123456',isWon:false,isLost:false};
const deal={id:'deal',name:'Synthetic Deal',amount:100,stageId:'stage',probability:50,accountId:null,accountName:null,contactName:null,note:null,status:'open',startDate:null,expectedCloseDate:null,wonAt:null,lostAt:null,lastActivityAt:null,openTaskCount:0};
const summary={totalCount:1,openCount:1,staleCount:0,openTaskCount:0,openTotal:'100',weighted:'50',wonTotal:'0'};
const routeMocks=withSfaAuthority({'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{}},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',memberId:'member'}),orgSlugFrom:()=> 'alpha'}});
const routes={task:load('src/app/api/sfa/tasks/route.ts',routeMocks),activity:load('src/app/api/sfa/activities/route.ts',routeMocks)};
const fetch=async(url,init={})=>{
 if(url==='/api/sfa/ai/next-action')return Response.json({nextAction:'Synthetic next action',tasks:[{title:'Synthetic candidate',dueDate:null}]});
 if(init.method==='POST'&&(url==='/api/sfa/tasks'||url==='/api/sfa/activities')){const data=JSON.parse(init.body);writes.push(data);await writeHold;return Response.json(url.includes('activities')?{activity:{id:'new-activity',type:'note',body:null,occurredAt:'2026-10-07T00:00:00.000Z',...data}}:{task:{id:'new-task',status:'open',dueDate:null,dealId:null,createdAt:'2026-10-07T00:00:00.000Z',...data}})}
 if(url.startsWith('/api/sfa/summary'))return Response.json({summary});
 if(url.startsWith('/api/sfa/deals'))return Response.json({stages:[stage],deals:[deal],nextCursor:null,totalCount:1,stageSummary:[{stageId:'stage',count:1,total:'100'}]});
 if(url.startsWith('/api/sfa/accounts'))return Response.json({accounts:[],nextCursor:null});
 if(url.startsWith('/api/sfa/tasks'))return Response.json({tasks:[],page:1,hasMore:false});
 if(url.startsWith('/api/sfa/activities'))return Response.json({activities:[],nextCursor:null,totalCount:0});
 throw Error('Unexpected synthetic URL '+url);
};
const helpers={};for(const file of ['client','task-date','summary','constants'])helpers['@/lib/sfa/'+file]=load('src/lib/sfa/'+file+'.ts',{}, {fetch});
const props=e=>e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))];
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<12;i++)await new Promise(setImmediate)});
const cases=[
 {page:'tasks',selector:'input[placeholder^="やること"]',button:'追加',size:201},
 {page:'tasks',selector:'input[placeholder^="活動内容"]',button:'記録',size:201},
 {page:'activities',selector:'input[placeholder^="件名"]',button:'記録する',size:201},
 {page:'activities',selector:'textarea',button:'記録する',size:4001},
 {page:'',selector:'input[placeholder^="例: A社"]',button:'追加',size:201},
 {page:'deals',selector:'input[placeholder^="やること"]',button:'追加',size:201},
 {page:'deals',selector:'input[placeholder^="活動内容"]',button:'追加',size:201},
];
(async()=>{const results=[];
 for(const test of cases){writeHold=new Promise(resolve=>releaseWrite=resolve);
 const out={};const file='src/app/sfa/[orgSlug]/'+(test.page?test.page+'/':'')+'page.tsx';
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:out,require:n=>{if(n==='react'||n==='react/jsx-runtime')return req(n);if(n==='next/navigation')return{useParams:()=>({orgSlug:'alpha'})};if(n==='next/link')return{__esModule:true,default:({children,href})=>React.createElement('a',{href},children)};if(n==='@/components/promane/character')return{Character:()=>React.createElement('span')};if(n==='react-hot-toast')return{__esModule:true,default:{success:t=>notices.push({kind:'success',text:t}),error:t=>notices.push({kind:'error',text:t})}};if(n in helpers)return helpers[n];throw Error(n)},fetch,AbortController,Date,Set,Map,Error,console,window:dom.window,document:dom.window.document,setTimeout,clearTimeout});
 const c=document.createElement('div');document.body.append(c);const r=createRoot(c);
 await act(()=>r.render(React.createElement(out.default)));
 if(test.page==='deals'){const card=c.querySelector('[role="button"]');assert.ok(card);await act(()=>props(card).onClick());}
 const input=c.querySelector(test.selector);assert.ok(input,test.page+' input');const value='synthetic manual draft';
 await act(()=>props(input).onChange({target:{value}}));
 let buttons=[...input.parentElement.querySelectorAll('button')].filter(b=>b.textContent.trim()===test.button);
 if(!buttons.length)buttons=[...c.querySelectorAll('button')].filter(b=>b.textContent.trim()===test.button);
 assert.equal(buttons.length,1,test.page+' submit button');const start=writes.length,noticeStart=notices.length;
 const submit=props(buttons[0]).onClick;
 await act(()=>{void submit();void submit()});
 const count=writes.length-start,expected=test.page===''?1:2;
 assert.equal(count,expected,'same-frame guard baseline changed');
 await act(()=>releaseWrite());
 results.push({page:test.page||'dashboard',field:test.selector,sameFramePostCount:count,status:count>1?'confirmed-open':'guard-present',noticeCount:notices.length-noticeStart});
 await act(()=>r.unmount());c.remove();
 }
 console.log(JSON.stringify({cases:results.length,results,scope:'Actual four SFA pages and actual shared client/date/summary helpers, synthetic held successful POST only. Confirms six same-frame duplicate submission paths and dashboard single-submit guard; no real API/DB/provider or private production operation.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
