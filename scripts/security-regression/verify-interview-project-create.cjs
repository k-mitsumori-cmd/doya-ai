const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {load}=require('./load-typescript.cjs');
function fixture(userId='owner',guestId=null){
 const rows=new Map(),settings=new Map();let queue=Promise.resolve(),writes=0,cookies=0,failReceipt=false;
 const tx={
  $executeRaw:async(parts)=>{assert.match(parts.join('?'),/pg_advisory_xact_lock/);return 1},
  interviewProject:{count:async({where})=>[...rows.values()].filter(x=>x.guestId===where.guestId).length,
   create:async({data})=>{writes++;const row={...data,id:'project-'+writes,createdAt:new Date()};rows.set(row.id,row);return row},
   findFirst:async({where})=>[...rows.values()].find(x=>Object.entries(where).every(([k,v])=>x[k]===v))||null},
  systemSetting:{findUnique:async({where})=>settings.has(where.key)?{value:settings.get(where.key)}:null,
   upsert:async({where,create,update})=>{settings.set(where.key,settings.has(where.key)?update.value:create.value)},
   create:async({data})=>{if(failReceipt)throw Error('SYNTHETIC_PRIVATE');assert.equal(settings.has(data.key),false);settings.set(data.key,data.value)}},
 };
 const db={...tx,$transaction:async work=>{const previous=queue;let release;queue=new Promise(r=>release=r);await previous;const oldRows=new Map(rows),oldSettings=new Map(settings),oldWrites=writes;try{return await work(tx)}catch(error){rows.clear();settings.clear();for(const[k,v]of oldRows)rows.set(k,v);for(const[k,v]of oldSettings)settings.set(k,v);writes=oldWrites;throw error}finally{release()}}};
 const helper=load('src/lib/interview/project-create.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:db},'@/lib/interview/access':{interviewGuestTotalLimit:()=>3}});
 const route=load('src/app/api/interview/projects/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/interview/project-create':helper,'@/lib/interview/thumbnail-storage':{thumbnailUrlForClient:()=>null},'@/lib/interview/access':{getInterviewUser:async()=>({userId}),getGuestIdFromRequest:()=>guestId,ensureGuestId:()=> 'new-guest',setGuestCookie:()=>cookies++,requireDatabase:()=>null}});
 const key=crypto.randomUUID(),scope=helper.interviewProjectCreationScope(userId,guestId);
 return {rows,settings,helper,route,key,scope,get writes(){return writes},get cookies(){return cookies},fail:()=>failReceipt=true,
  post:(body={})=>route.POST({json:async()=>({title:'synthetic',requestKey:key,creationScope:scope,...body})})};
}
(async()=>{const results=[];
 for(const [name,user,guest]of[['account','owner',null],['guest',null,'guest']]){
  const f=fixture(user,guest);const responses=await Promise.all([f.post(),f.post()]);assert.deepEqual(responses.map(x=>x.status),[200,200]);const ids=await Promise.all(responses.map(async x=>(await x.json()).project.id));assert.equal(ids[0],ids[1]);assert.equal(f.writes,1);
  if(guest)assert.equal(f.settings.get('interview-guest-project:v1:guest'),'1');
  assert.equal((await f.post({requestKey:f.key.toUpperCase()})).status,200);assert.equal(f.writes,1);
  assert.equal((await f.post({title:'changed'})).status,409);assert.equal(f.writes,1);
  f.rows.get(ids[0]).title='edited after creation';assert.equal((await f.post()).status,200);assert.equal(f.rows.get(ids[0]).title,'edited after creation');
  f.rows.get(ids[0]).userId='foreign';assert.equal((await f.post()).status,409);assert.equal(f.writes,1);
  f.rows.delete(ids[0]);assert.equal((await f.post()).status,409);assert.equal(f.writes,1);
  results.push(name+' duplicate replay/input conflict/edited replay/ownership/deletion');
 }
 const guest=fixture(null,'guest');for(let i=0;i<3;i++)assert.equal((await guest.post({requestKey:crypto.randomUUID()})).status,200);
 assert.equal((await guest.post({requestKey:crypto.randomUUID()})).status,429);guest.rows.clear();assert.equal((await guest.post({requestKey:crypto.randomUUID()})).status,429);results.push('guest cumulative cap survives deletion');
 for(const body of [{requestKey:'bad'},{creationScope:'bad'},{intervieweeName:{}},{mediaType:[]},{title:'x'.repeat(201)},{theme:'x'.repeat(501)}]){const f=fixture();const r=await f.post(body);assert.ok([400,409].includes(r.status));assert.equal(f.writes,0)}results.push('invalid key/scope/types/length rejected before writes');
 for(const body of [null,[],3,'text']){const f=fixture();assert.equal((await f.route.POST({json:async()=>body})).status,400);assert.equal(f.writes,0)}results.push('non-object request rejected');
 const missing=fixture(null,null);assert.equal((await missing.post()).status,409);assert.equal(missing.writes,0);const pre=await missing.route.GET({nextUrl:new URL('http://local/api/interview/projects?prepareCreate=1')});assert.equal(pre.status,200);assert.match((await pre.json()).creationScope,/^[a-f0-9]{64}$/);assert.equal(pre.headers.get('cache-control'),'no-store');assert.equal(missing.cookies,1);assert.equal(missing.writes,0);results.push('prepare cookie before writes and reject keyed requests without cookie');
 const rollback=fixture(null,'guest');rollback.fail();const failed=await rollback.post();assert.equal(failed.status,500);assert.equal(rollback.writes,0);assert.equal(rollback.settings.size,0);assert.equal((await failed.text()).includes('SYNTHETIC_PRIVATE'),false);results.push('receipt failure rolls back project and guest ledger in synthetic transaction');
 const corrupt=fixture();corrupt.settings.set('interview-project-create:v1:'+crypto.createHash('sha256').update(corrupt.scope+':'+corrupt.key).digest('hex'),'invalid');assert.equal((await corrupt.post()).status,500);assert.equal(corrupt.writes,0);results.push('corrupt receipt fails closed');
 assert.notEqual(fixture('owner').scope,fixture('foreign').scope);assert.notEqual(fixture(null,'guest').scope,fixture(null,'other').scope);
 console.log(JSON.stringify({passed:results.length,scope:'Actual API and creation helper; synthetic auth, transactions, cookies and records. Real PostgreSQL concurrency must be verified separately.',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
