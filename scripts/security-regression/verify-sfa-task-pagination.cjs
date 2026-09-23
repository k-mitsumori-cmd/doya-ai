const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {load:loadModule,check,results}=require('./load-typescript.cjs');
function api(rows){return loadModule('src/app/api/sfa/tasks/route.ts',{
 'next/server':{NextResponse:Response},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org'}),orgSlugFrom:()=>null},
 '@/lib/prisma':{prisma:{sfaTask:{findMany:async({where,orderBy,skip,take})=>rows.filter(r=>r.organizationId===where.organizationId).sort((a,b)=>{for(const order of orderBy){const [k,d]=Object.entries(order)[0];if(a[k]===b[k])continue;return (a[k]<b[k]?-1:1)*(d==='asc'?1:-1)}return 0}).slice(skip,skip+take)}}},
});}
const source=fs.readFileSync('src/app/sfa/[orgSlug]/tasks/page.tsx','utf8'),ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let code;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='load')code=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit)}visit(ast);
function ui(fetch){const state={tasks:[],page:0,more:false,error:null,loading:false};const fn=vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{ready:true,orgSlug:'org',Error,fetch,sfaInit:()=>({}),loadSequenceRef:{current:0},setTasks:f=>state.tasks=f(state.tasks),setLoadedPage:v=>state.page=v,setHasMore:v=>state.more=v,setListError:v=>state.error=v,setListLoading:v=>state.loading=v});return{fn,state};}
(async()=>{
 for(const count of [0,1,200,201,501])await check('all '+count+' tasks reachable through real GET and UI load',async()=>{
  const rows=Array.from({length:count},(_,i)=>({id:String(i).padStart(4,'0'),status:i===count-1?'open':'done',organizationId:'org',createdAt:0,dueDate:null,dealId:null}));rows.push({id:'foreign',organizationId:'other',status:'open'});
  const route=api(rows),f=ui(url=>route.GET({nextUrl:new URL(url,'http://offline.invalid')}));
  await f.fn();if(count)assert.equal(f.state.tasks[0].status,'open');
  while(f.state.more)await f.fn(f.state.page+1);
  assert.equal(f.state.tasks.length,count);assert.equal(new Set(f.state.tasks.map(t=>t.id)).size,count);assert.equal(f.state.error,null);
 });
 for(const page of ['0','-1','1.5','bad'])await check('invalid page '+page,async()=>assert.equal((await api([]).GET({nextUrl:new URL('http://offline.invalid/?page='+page)})).status,400));
 await check('failed continuation retains rows and page; refresh replaces',async()=>{
  let fail=false;const f=ui(async url=>fail?Response.json({error:'offline'},{status:500}):Response.json({tasks:[{id:'a'}],page:1,hasMore:true}));
  await f.fn();fail=true;await f.fn(2);assert.equal(f.state.tasks.length,1);assert.equal(f.state.page,1);assert.equal(f.state.error,'offline');fail=false;await f.fn();assert.equal(f.state.tasks.length,1);assert.equal(f.state.error,null);
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
