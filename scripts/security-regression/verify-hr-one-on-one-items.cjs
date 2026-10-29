const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const {oneOnOneFormItems}=load('src/lib/hr/one-on-one-items.ts');
function fixture({agenda=[],actions=[],anonymous=false,denied=false}={}){
 const state={reads:0,writes:0,employeeReads:0,providerCalls:0,reservations:0,row:{id:'meeting',organizationId:'org',status:'SCHEDULED',agenda,aiActionItems:actions,employee:{firstName:'Member',lastName:'Synthetic'},manager:{firstName:'Manager',lastName:'Synthetic'},managerNotes:null,employeeNotes:null}};
 const dependencies={
  'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>anonymous?null:{user:{id:'user'}}},'@/lib/auth':{authOptions:{}},
  '@/lib/hr/access':{getHrContext:async()=>anonymous?null:{organizationId:'org',role:'OWNER'}},'@/lib/hr/constants':{},
  '@seo/lib/gemini':{GEMINI_TEXT_MODEL_DEFAULT:'synthetic',geminiGenerateText:async()=>{state.providerCalls++;return'synthetic'}},
  '@/lib/hr/prompts':{buildOneOnOneSummaryPrompt:()=> 'synthetic'},
  '@/lib/hr/billing':{reserveAiUsage:async()=>{state.reservations++;return{granted:true,reservation:{}}},releaseAiUsage:async()=>{}},
  '@/lib/hr/one-on-one-access':{canAccessOneOnOne:async()=>!denied,getOneOnOneViewer:async()=>({employeeId:null}),canViewManagerNotes:()=>true,filterOneOnOneFields:row=>row,getOneOnOneReadWhere:async()=>({organizationId:'org'})},
  '@/lib/prisma':{prisma:{
   hrEmployee:{findFirst:async({where})=>{state.employeeReads++;return{id:where.id}}},
   hrOneOnOne:{
    findFirst:async()=>{state.reads++;return state.row},
    update:async({data})=>{state.writes++;state.row={...state.row,...data};return state.row},
    create:async({data})=>{state.writes++;return{id:'new',...data}},
   },
  }},
 };
 return {state,detail:load('src/app/api/hr/one-on-one/[id]/route.ts',dependencies),collection:load('src/app/api/hr/one-on-one/route.ts',dependencies),ai:load('src/app/api/hr/one-on-one/[id]/ai-summary/route.ts',dependencies),ctx:{params:Promise.resolve({id:'meeting'})}};
}
function privateResponse(response,status){assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/i)}
(async()=>{
 for(const agenda of ['bad',{},false,1,[null],[1],[[]],[{topic:null}],[{topic:{}}],[{category:[]}],[{id:{}}]]){
  await check('agenda malformed POST/PATCH rejected before writes '+JSON.stringify(agenda),async()=>{
   const f=fixture();const before=JSON.stringify(f.state.row);
   const created=await f.collection.POST({json:async()=>({employeeId:'employee',managerId:'manager',agenda})});privateResponse(created,400);assert.equal(f.state.employeeReads,0);
   const changed=await f.detail.PATCH({json:async()=>({agenda})},f.ctx);privateResponse(changed,400);assert.equal(f.state.writes,0);assert.equal(JSON.stringify(f.state.row),before);
  });
 }
 for(const actions of ['bad',null,{},[null],[false],[[]],[{content:null}],[{assignee:1}],[{dueDate:{}}],[{done:'false'}],[{done:null}],[{id:[]} ]]){
  await check('action malformed alias/canonical PATCH rejected '+JSON.stringify(actions),async()=>{
   for(const key of ['actionItems','aiActionItems']){const f=fixture();privateResponse(await f.detail.PATCH({json:async()=>({[key]:actions})},f.ctx),400);assert.equal(f.state.writes,0);}
  });
 }
 for(const [agenda,actions]of [[[null],[]],[[],[null]],['bad',[]],[[],[{done:'yes'}]]]){
  await check('stored malformed data gives private controlled error without mutation '+JSON.stringify([agenda,actions]),async()=>{
   const f=fixture({agenda,actions});f.state.row.managerNotes='synthetic existing notes';const before=JSON.stringify(f.state.row);const response=await f.detail.GET({},f.ctx);privateResponse(response,409);const body=await response.json();assert.equal(body.code,'ONE_ON_ONE_ITEMS_INVALID');assert.equal(body.oneOnOne,undefined);
   privateResponse(await f.detail.PATCH({json:async()=>({sharedNote:'unrelated'})},f.ctx),409);assert.equal(f.state.writes,0);assert.equal(JSON.stringify(f.state.row),before);
   privateResponse(await f.ai.POST({},f.ctx),409);assert.equal(f.state.reservations,0);assert.equal(f.state.providerCalls,0);assert.equal(f.state.writes,0);
  });
 }
 await check('legacy raw API contract retained and Form adapter supplies stable keys without DB writes',async()=>{
  const agenda=[{topic:'  Keep text  ',customNote:'extension'},{id:12,topic:'Numeric',category:'CUSTOM'},{id:12,topic:'Duplicate'}],actions=[{content:'Keep',customFlag:true},{id:'same',done:true},{id:'same',assignee:'person',dueDate:'2026-10-29'}];
  const f=fixture({agenda,actions}),before=JSON.stringify(f.state.row);const a=await(await f.detail.GET({},f.ctx)).json(),b=await(await f.detail.GET({},f.ctx)).json();assert.deepEqual(a.oneOnOne.agenda,agenda);assert.deepEqual(a.oneOnOne.actionItems,actions);const items=oneOnOneFormItems(a.oneOnOne.agenda,a.oneOnOne.actionItems,'meeting'),again=oneOnOneFormItems(b.oneOnOne.agenda,b.oneOnOne.actionItems,'meeting');assert.deepEqual(items,again);assert.equal(new Set(items.agenda.map(row=>row.id)).size,3);assert.equal(new Set(items.actionItems.map(row=>row.id)).size,3);assert.equal(items.agenda[0].topic,'  Keep text  ');assert.equal(items.agenda[0].customNote,'extension');assert.equal(items.agenda[1].category,'CUSTOM');assert.equal(items.actionItems[0].customFlag,true);assert.equal(items.actionItems[1].done,true);assert.equal(f.state.writes,0);assert.equal(JSON.stringify(f.state.row),before);
 });
 await check('valid partial/extended input retains raw JSON in storage and successful API response',async()=>{
  const f=fixture(),agenda=[{topic:'Keep',customNote:'extension'}],actionItems=[{done:true,extra:'retained'}];const response=await f.detail.PATCH({json:async()=>({agenda,actionItems})},f.ctx);privateResponse(response,200);assert.deepEqual(f.state.row.agenda,agenda);assert.deepEqual(f.state.row.aiActionItems,actionItems);const body=await response.json();assert.deepEqual(body.oneOnOne.agenda,agenda);assert.deepEqual(body.oneOnOne.actionItems,actionItems);assert.equal(f.state.writes,1);
 });
 await check('explicit valid replacement can repair malformed stored arrays',async()=>{
  const f=fixture({agenda:[null],actions:[null]});privateResponse(await f.detail.PATCH({json:async()=>({agenda:[],actionItems:[]})},f.ctx),200);assert.equal(f.state.writes,1);assert.deepEqual(f.state.row.agenda,[]);assert.deepEqual(f.state.row.aiActionItems,[]);
 });
 for(const mode of ['anonymous','denied'])await check('authorization precedes stored shape disclosure '+mode,async()=>{
  const f=fixture({agenda:[null],[mode]:true});const response=await f.detail.GET({},f.ctx);privateResponse(response,mode==='anonymous'?401:403);assert.equal((await response.json()).code,undefined);assert.equal(f.state.writes,0);if(mode==='anonymous')assert.equal(f.state.reads,0);
 });
 console.log(JSON.stringify({passed:results.length,scope:'Actual create/update/read handlers and real item helpers; synthetic auth/DB, zero providers. Invalid writes rejected, read normalization does not rewrite storage.',results},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
