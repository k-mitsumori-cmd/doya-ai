const { withSfaAuthority } = require('./sfa-authority-fixture.cjs');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {matches}=require('./sfa-query-fixture.cjs');
const {load:loadModule,check,results}=require('./load-typescript.cjs');
function api(rows){return loadModule('src/app/api/sfa/tasks/route.ts',withSfaAuthority({
 'next/server':{NextResponse:Response},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org'}),orgSlugFrom:()=>null},
 '@/lib/prisma':{prisma:{sfaTask:{findMany:async({where,orderBy,skip,take})=>rows.filter(r=>matches(r,where)).sort((a,b)=>{for(const order of orderBy){const [k,d]=Object.entries(order)[0];if(a[k]===b[k])continue;return (a[k]<b[k]?-1:1)*(d==='asc'?1:-1)}return 0}).slice(skip,skip+take)},sfaDeal:{findUnique:async({where})=>['deal-a','deal-b'].includes(where.id)?{id:where.id,organizationId:'org',isActive:true,assigneeMemberId:'synthetic-member',name:'Synthetic deal'}:null,findMany:async({where})=>['deal-a','deal-b'].map(id=>({id,organizationId:'org',isActive:true,assigneeMemberId:'synthetic-member',name:'Synthetic deal'})).filter(row=>matches(row,where))}}},
}));}
const source=fs.readFileSync('src/app/(shell)/sfa/[orgSlug]/tasks/page.tsx','utf8'),ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let code;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='load')code=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit)}visit(ast);
function ui(fetch){
 const state={tasks:[],page:0,more:false,error:null,loading:false,skipped:0};
 const org=loadModule('src/lib/org-client-response.ts',{}, {fetch,AbortController,setTimeout,clearTimeout,TextDecoder,Uint8Array});
 const response=loadModule('src/lib/sfa/client-response.ts',{'@/lib/org-client-response':org,'./task-date':loadModule('src/lib/sfa/task-date.ts')});
 const fn=vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{ready:true,orgSlug:'org',Error,AbortController,mutations:{active:()=>true},listRequest:{current:null},sfaJson:response.sfaJson,isSfaClientTask:response.isSfaClientTask,sfaValidRows:response.sfaValidRows,setSkippedTasks:v=>state.skipped=typeof v==='function'?v(state.skipped):v,loadSequenceRef:{current:0},setTasks:f=>state.tasks=f(state.tasks),setLoadedPage:v=>state.page=v,setHasMore:v=>state.more=v,setListError:v=>state.error=v,setListLoading:v=>state.loading=v});return{fn,state};}

(async()=>{
 for(const count of [0,1,200,201,501])await check('all '+count+' tasks reachable through real GET and UI load',async()=>{
  const rows=Array.from({length:count},(_,i)=>({id:String(i).padStart(4,'0'),status:i===count-1?'open':'done',organizationId:'org',assigneeMemberId:'synthetic-member',title:'Synthetic',createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z',dueDate:null,dealId:null}));rows.push({id:'foreign',organizationId:'other',status:'open'});
  const route=api(rows),f=ui(url=>route.GET({nextUrl:new URL(url,'http://offline.invalid')}));
  await f.fn();if(count)assert.equal(f.state.tasks[0].status,'open');
  while(f.state.more)await f.fn(f.state.page+1);
  assert.equal(f.state.tasks.length,count);assert.equal(new Set(f.state.tasks.map(t=>t.id)).size,count);assert.equal(f.state.error,null);
 });
 for(const page of ['0','-1','1.5','bad'])await check('invalid page '+page,async()=>assert.equal((await api([]).GET({nextUrl:new URL('http://offline.invalid/?page='+page)})).status,400));
 await check('deal filter reaches every task without including other deals or organizations',async()=>{
  const rows=Array.from({length:501},(_,i)=>({id:String(i).padStart(4,'0'),status:'open',organizationId:'org',assigneeMemberId:'synthetic-member',title:'Synthetic',createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z',dueDate:null,dealId:i<250?'deal-a':'deal-b'}));
  rows.push({id:'foreign',status:'open',organizationId:'other',title:'Synthetic',createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z',dueDate:null,dealId:'deal-a'});
  const route=api(rows);const seen=new Set();let page=1,hasMore;
  do{const response=await route.GET({nextUrl:new URL(`http://offline.invalid/?dealId=deal-a&page=${page}`)});assert.equal(response.status,200);const body=await response.json();for(const task of body.tasks){assert.equal(task.dealId,'deal-a');assert(!seen.has(task.id));seen.add(task.id)}hasMore=body.hasMore;page++}while(hasMore);
  assert.equal(seen.size,250);
  assert.equal((await route.GET({nextUrl:new URL('http://offline.invalid/?dealId=')})).status,400);
 });
 await check('failed continuation retains rows and page; refresh replaces',async()=>{
  let fail=false;const f=ui(async url=>fail?Response.json({error:'offline'},{status:500}):Response.json({tasks:[{id:'a',title:'Synthetic',status:'open',dueDate:null,dealId:null,createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z'}],page:1,hasMore:true}));
  await f.fn();fail=true;await f.fn(2);assert.equal(f.state.tasks.length,1);assert.equal(f.state.page,1);assert.match(f.state.error,/確認できません|取得できません/);fail=false;await f.fn();assert.equal(f.state.tasks.length,1);assert.equal(f.state.error,null);
 });
 await check('DB failure returns a JSON 500 and logs the Prisma code',async()=>{
  const logged=[];
  {
   const route=loadModule('src/app/api/sfa/tasks/route.ts',withSfaAuthority({'next/server':{NextResponse:Response},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org'}),orgSlugFrom:()=>null},
    '@/lib/prisma':{prisma:{sfaTask:{findMany:async()=>{throw Object.assign(new Error('The column `sfa_tasks.x` does not exist'),{code:'P2022'})}},sfaDeal:{findMany:async()=>[]}}}}),{console:{log(){},warn(){},error:(...a)=>logged.push(a)}});
   const res=await route.GET({nextUrl:new URL('http://offline.invalid/?page=1')});
   assert.equal(res.status,500);assert.match((await res.json()).error,/タスク一覧を取得できませんでした/);
   assert(logged.some(a=>a[0]==='[sfa/tasks] GET failed'&&a[1].code==='P2022'));
  }
 });
 await check('one malformed task row is skipped and counted; legacy long titles stay visible',async()=>{
  const ok={title:'Synthetic',status:'open',dueDate:null,dealId:null,createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z'};
  const f=ui(async()=>Response.json({tasks:[{...ok,id:'a'},{...ok,id:'legacy',title:'長'.repeat(500)},{...ok,id:'bad',status:'archived'}],page:1,hasMore:false}));
  await f.fn();assert.equal(f.state.tasks.map(t=>t.id).join(),'a,legacy');assert.equal(f.state.skipped,1);assert.equal(f.state.error,null);
  await f.fn();assert.equal(f.state.skipped,1,'refresh resets the skipped count');
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
