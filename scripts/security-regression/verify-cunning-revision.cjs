const assert=require('node:assert/strict'),{load,check}=require('./load-typescript.cjs');let row={id:'s',userId:'u',status:'ended',updatedAt:new Date(1000)},updates=0,writes=0;let userExists=true;const tx={$queryRaw:async()=>userExists?[{id:'u'}]:[],cunningSession:{findUnique:async()=>row,update:async({data})=>{updates++;row={...row,...data};return row}}};
class Clock extends Date {static now(){return 1000}}
const writer=load('src/lib/cunning/session-write.ts',{'@/lib/prisma':{prisma:{$transaction:async f=>f(tx)}}},{Date:Clock});
(async()=>{
let authSession={user:{id:'deleted',email:'live@example.invalid'}};const auth=load('src/lib/cunning/access.ts',{'next-auth':{getServerSession:async()=>authSession},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{user:{findUnique:async({where})=>where.id==='live'||where.email==='live@example.invalid'?{id:'live'}:null}}}});
await check('stale account identity is not authorized through fallback email',async()=>assert.equal(await auth.getUserId(),null));
await check('legacy email-only session resolves an existing account',async()=>{authSession={user:{email:'live@example.invalid'}};assert.equal(await auth.getUserId(),'live')});
await check('missing authentication remains anonymous',async()=>{authSession=null;assert.equal(await auth.getUserId(),null)});
for(const [before,after] of [[999,1000],[1000,1001],[2000,2001]])await check('monotonic revision '+before,()=>assert.equal(writer.nextCunningRevision(new Date(before)).getTime(),after));
await check('content save increments revision',async()=>{assert.equal(await writer.writeCunningSession('u','s',async()=>{writes++}),true);assert.equal(row.updatedAt.getTime(),1001);assert.equal(updates,1);assert.equal(writes,1)});
await check('idempotent no-op preserves revision',async()=>{assert.equal(await writer.writeCunningSession('u','s',async()=>false),true);assert.equal(row.updatedAt.getTime(),1001);assert.equal(updates,1)});
await check('foreign row rejected without write',async()=>{assert.equal(await writer.writeCunningSession('other','s',async()=>{throw Error('must not run')}),false);assert.equal(updates,1)});
await check('deleted row rejected without write',async()=>{row.status='deleted';assert.equal(await writer.writeCunningSession('u','s',async()=>{throw Error('must not run')}),false);assert.equal(updates,1)});
await check('deleted account rejects orphan content without callback',async()=>{row.status='ended';userExists=false;assert.equal(await writer.writeCunningSession('u','s',async()=>{throw Error('must not run')}),false);assert.equal(updates,1);userExists=true});
for(const order of ['new-first','old-first'])await check('report route rejects superseded generation '+order,async()=>{
 let current={id:'s',userId:'u',status:'ended',updatedAt:new Date(1000),mode:'sales',report:null,transcripts:[],answers:[]};const jobs=[];
 const model={findUnique:async()=>({...current}),update:async({data})=>{current={...current,...data};return current},updateMany:async({where,data})=>{if(current.updatedAt.getTime()!==where.updatedAt.getTime())return{count:0};current={...current,...data};return{count:1}}};
 const api=load('src/app/api/cunning/sessions/[id]/report/route.ts',{'@/lib/cunning/report-freshness':{cunningReportFingerprint:async()=> 'synthetic',cunningReportStatus:()=> 'current'},'next/server':{NextResponse:{json:(d,i)=>new Response(JSON.stringify(d),i)}},'@/lib/prisma':{prisma:{$transaction:async f=>f({$queryRaw:async()=>[{id:'u'}],cunningSession:model}),cunningSession:model}},'@/lib/cunning/access':{getUserId:async()=> 'u'},'@/lib/cunning/session-write':writer,'@/lib/cunning/report':{generateReport:()=>new Promise(resolve=>jobs.push(resolve))},'@/lib/cunning/recording-ledger':{readCunningRecordingUsage:async()=>{}}});
 const ctx={params:Promise.resolve({id:'s'})},req={json:async()=>({force:true})};const a=api.POST(req,ctx);await new Promise(r=>setImmediate(r));const b=api.POST(req,ctx);await new Promise(r=>setImmediate(r));assert.equal(jobs.length,2);
 if(order==='old-first'){jobs[0]({title:'old'});assert.equal((await a).status,409);jobs[1]({title:'new'});assert.equal((await b).status,200)}else{jobs[1]({title:'new'});assert.equal((await b).status,200);jobs[0]({title:'old'});assert.equal((await a).status,409)}assert.equal(current.report.title,'new');
});
})().catch(e=>{console.error(e);process.exitCode=1});
