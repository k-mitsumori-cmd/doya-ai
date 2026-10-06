const assert=require('node:assert/strict'),{createOrgClient}=require('./org-client-test-loader.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));const checks=[];async function check(name,fn){await fn();checks.push(name)}
const profileBody={brandName:' Brand ',brandUrl:'',aliases:['Alias'],competitors:[],category:'Category',market:'日本'};
const fields=['companyName','url','description','valueProp','products','targetCustomer','pricingNote','caseStudies'];const own=Object.fromEntries(fields.map(k=>[k,k==='companyName'?' Company ':'']));own.brandColors=[];own.logoPath=null;
const ownSaved={id:'profile',...Object.fromEntries(fields.map(k=>[k,own[k].trim()||null])),brandColors:[],logoPath:null};
const fixtures=[
 ['aio','/api/aio/members','POST',{email:' PERSON@EXAMPLE.INVALID ',role:'member'},{ok:true,emailSent:true,member:{id:'m1',inviteEmail:'person@example.invalid',role:'member'}}],
 ['aio','/api/aio/members/m1','DELETE',undefined,{ok:true}],
 ['aio','/api/aio/scans','POST',undefined,{id:'scan1',status:'done',summary:{coverage:{attempted:4,succeeded:3,failed:1}}}],
 ['aio','/api/aio/prompts','POST',{text:' Question '},{ok:true,prompt:{id:'q1',text:'Question',isActive:true}}],
 ['aio','/api/aio/prompts/q1','PATCH',{isActive:false},{ok:true,prompt:{id:'q1',isActive:false}}],
 ['aio','/api/aio/prompts/q1','DELETE',undefined,{ok:true,archived:true}],
 ['aio','/api/aio/brand-profile','PUT',profileBody,{ok:true,profile:{id:'profile',brandName:'Brand',brandUrl:null,aliases:['Alias'],competitors:[],category:'Category',market:'日本'}}],
 ['shodan','/api/shodan/members','POST',{email:'PERSON@EXAMPLE.INVALID',role:'manager'},{ok:true,emailSent:false,inviteUrl:'https://example.invalid/shodan/invite/token',member:{id:'m2',inviteEmail:'person@example.invalid',role:'manager'}}],
 ['shodan','/api/shodan/members/m2','DELETE',undefined,{ok:true}],
 ['shodan','/api/shodan/preparations','POST',{url:'https://example.invalid'},{id:'p1',status:'researched',research:require('./shodan-research-fixture.cjs')()}],
 ['shodan','/api/shodan/preparations/p1/slides/generate','POST',undefined,{success:true,count:1,total:3,remaining:2}],
 ['shodan','/api/shodan/preparations/p1/generate','POST',undefined,{id:'p1',status:'done'}],
 ['shodan','/api/shodan/preparations/p1/slides/regenerate','POST',{index:0,instruction:'Example'},{success:true,data:{index:0,image:{title:'Title',role:'cover',imageUrl:'https://example.invalid/image.png'}}}],
 ['shodan','/api/shodan/preparations/p1','DELETE',undefined,{ok:true}],
 ['shodan','/api/shodan/company-profile/extract','POST',{url:'https://example.invalid'},{suggested:Object.fromEntries(fields.map(k=>[k,'Example'])),gaps:['valueProp']}],
 ['shodan','/api/shodan/company-profile','PUT',own,{ok:true,profile:ownSaved}],
];
async function send(f,raw){const [service,path,method,body]=f;let calls=0;const {client}=createOrgClient(service,{fetch:async(url,init)=>{calls++;assert.equal(new URL(url,'https://example.invalid').searchParams.get('org'),'synthetic');assert.equal(init.cache,'no-store');return typeof raw==='string'?new Response(raw):Response.json(raw)}});const result=await client[service+'Send'](path,'synthetic',method,body);assert.equal(calls,1);return result}
(async()=>{
for(const f of fixtures){const label=f[1]+' '+f[2];await check('Valid server contract '+label,async()=>assert.deepEqual(clone(await send(f,f[4])),f[4]));for(const invalid of ['{not-json','null','[]','1','"text"','{}','{"ok":"true"}'])await check('Reject unconfirmed '+label+' '+invalid,()=>assert.rejects(send(f,invalid),e=>e.code==='RESPONSE_UNCONFIRMED'&&e.status===200));}
const bads=[
 [0,r=>r.member.inviteEmail='another@example.invalid'],[0,r=>r.member.role='owner'],[0,r=>r.emailSent='true'],[7,r=>r.inviteUrl='javascript:alert(1)'],
 [2,r=>r.status='processing'],[2,r=>r.summary.coverage.attempted=5],[2,r=>delete r.summary],
 [3,r=>r.prompt.text='Wrong'],[4,r=>r.prompt.id='other'],[4,r=>r.prompt.isActive=true],[5,r=>delete r.archived],
 [6,r=>r.profile.brandName='Wrong'],[6,r=>r.profile.aliases=['Wrong']],[6,r=>r.profile.id='../another'],
 [9,r=>r.status='failed'],[9,r=>r.id='undefined/path'],[10,r=>r.count=4],[10,r=>r.remaining=-1],[10,r=>r.total='3'],
 [11,r=>r.id='other'],[11,r=>r.status='processing'],[12,r=>r.data.index=1],[12,r=>r.data.image.imageUrl='data:text/html,bad'],
 [14,r=>r.suggested.companyName=4],[14,r=>r.gaps=['arbitrary']],[15,r=>r.profile.companyName='Wrong'],[15,r=>r.profile.brandColors=['#ffffff']],
];
for(const [index,mutate]of bads)await check('Reject mismatched acknowledgment '+fixtures[index][1]+' #'+checks.length,async()=>{const raw=clone(fixtures[index][4]);mutate(raw);await assert.rejects(send(fixtures[index],raw),e=>e.code==='RESPONSE_UNCONFIRMED')});
for(const service of ['aio','shodan']){
 for(const raw of ['{bad','null','[]','1','{}'])await check(service+' GET rejects malformed/non-object/empty success '+raw,async()=>{const {client}=createOrgClient(service,{fetch:async()=>new Response(raw)});await assert.rejects(client[service+'Get']('/api/'+service+'/members','synthetic'),e=>e.code==='RESPONSE_UNCONFIRMED')});
 await check(service+' definite HTTP rejection with malformed body stays rejection',async()=>{const {client}=createOrgClient(service,{fetch:async()=>new Response('<html>private</html>',{status:403})});await assert.rejects(client[service+'Send']('/api/'+service+'/members/m1','synthetic','DELETE'),e=>e.status===403&&!e.message.includes('private'))});
 await check(service+' network internals hidden with no write retry',async()=>{let calls=0;const {client}=createOrgClient(service,{fetch:async()=>{calls++;throw Error('synthetic private connection string')}});await assert.rejects(client[service+'Send']('/api/'+service+'/members/m1','synthetic','DELETE'),e=>e.code==='RESPONSE_UNCONFIRMED'&&!e.message.includes('private'));assert.equal(calls,1)});
 await check(service+' server errors never turn into paid quota guidance',async()=>{const {client}=createOrgClient(service,{fetch:async()=>Response.json({error:'synthetic private provider key',code:'LIMIT',canManageBilling:true,upgradeUrl:'/'+service+'/pricing'},{status:500})});await assert.rejects(client[service+'Send']('/api/'+service+'/members/m1','synthetic','DELETE'),e=>e.status===500&&!e.message.includes('private')&&!e.code&&!e.upgradeUrl&&!e.actionUrl)});
 await check(service+' existing query org replaced; Unicode scope encoded',async()=>{const {client}=createOrgClient(service,{fetch:async url=>{const q=new URL(url,'https://example.invalid').searchParams;assert.deepEqual(q.getAll('org'),['日本 space']);assert.equal(q.get('cursor'),'value');return Response.json({items:[]})}});await client[service+'Get']('/api/'+service+'/members?org=old&cursor=value','日本 space')});
 await check(service+' external/wrong-service/unsupported writes stop before fetch',async()=>{let calls=0;const {client}=createOrgClient(service,{fetch:async()=>{calls++;return Response.json({ok:true})}});for(const path of ['https://example.invalid/api/'+service+'/members/m1','/api/other/members/m1','/api/'+service+'/unknown'])await assert.rejects(client[service+'Send'](path,'synthetic','DELETE'));assert.equal(calls,0)});
 await check(service+' aborted request stops before fetch',async()=>{const c=new AbortController();c.abort();const {client}=createOrgClient(service,{fetch:async()=>{throw Error('must not fetch')}});await assert.rejects(client[service+'Get']('/api/'+service+'/members','synthetic',{signal:c.signal}),e=>e.code==='RESPONSE_UNCONFIRMED')});
 await check(service+' abort during ignored fetch rejects and removes timer',async()=>{const c=new AbortController(),timers=new Set();const {client}=createOrgClient(service,{setTimeout:fn=>{timers.add(fn);return fn},clearTimeout:fn=>timers.delete(fn),fetch:async()=>new Promise(()=>{})});const p=client[service+'Send']('/api/'+service+'/members/m1','synthetic','DELETE',undefined,{signal:c.signal});c.abort();await assert.rejects(p,e=>e.code==='RESPONSE_UNCONFIRMED');assert.equal(timers.size,0)});
 await check(service+' size bound cancels stream and rejects before JSON',async()=>{let cancelled=0;const {client}=createOrgClient(service,{fetch:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(8*1024*1024+1))},cancel(){cancelled++}}))});await assert.rejects(client[service+'Get']('/api/'+service+'/members','synthetic'));assert.equal(cancelled,1)});
 await check(service+' oversized declared length rejected without reading',async()=>{let cancelled=0;const {client}=createOrgClient(service,{fetch:async()=>new Response(new ReadableStream({cancel(){cancelled++}}),{headers:{'content-length':String(8*1024*1024+1)}})});await assert.rejects(client[service+'Get']('/api/'+service+'/members','synthetic'));assert.equal(cancelled,1)});
 await check(service+' invalid UTF-8 rejected',async()=>{const {client}=createOrgClient(service,{fetch:async()=>new Response(new Uint8Array([123,34,120,34,58,34,0xff,34,125]))});await assert.rejects(client[service+'Get']('/api/'+service+'/members','synthetic'))});
 await check(service+' unsafe quota link omitted while valid denial retained',async()=>{const {client}=createOrgClient(service,{fetch:async()=>Response.json({error:'無料枠です',code:'LIMIT',canManageBilling:false,upgradeUrl:'/'+service+'/pricing',contactUrl:'javascript:alert(1)'},{status:429})});await assert.rejects(client[service+'Send']('/api/'+service+'/members/m1','synthetic','DELETE'),e=>e.code==='LIMIT'&&!e.upgradeUrl&&!e.contactUrl&&!e.actionUrl)});
}
for (const service of ['aio','shodan']) await check(service+' validates against sent snapshot despite caller mutation', async()=>{
 const body={email:'original@example.invalid',role:'member'};let release;
 const {client}=createOrgClient(service,{fetch:async(_url,init)=>{assert.equal(JSON.parse(init.body).email,body.email);return new Promise(resolve=>{release=resolve})}});
 const pending=client[service+'Send']('/api/'+service+'/members','synthetic','POST',body);
 body.email='changed@example.invalid';
 release(Response.json({ok:true,emailSent:true,member:{id:'m1',inviteEmail:'original@example.invalid',role:'member'}}));
 assert.equal((await pending).ok,true);
});
await check('Invite default role matches server default',async()=>{const f=clone(fixtures[0]);delete f[3].role;assert.equal((await send(f,f[4])).ok,true)});
await check('Split Japanese UTF-8 bytes remain valid',async()=>{const bytes=new TextEncoder().encode(JSON.stringify({items:['日本語']}));const {client}=createOrgClient('aio',{fetch:async()=>new Response(new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close()}}))});assert.deepEqual(clone(await client.aioGet('/api/aio/members','synthetic')),{items:['日本語']})});
console.log(JSON.stringify({passed:checks.length,writeContracts:fixtures.length,checks,scope:'Actual service helpers, shared bounded transport and write response contracts; synthetic HTTP, streams, timers and bodies. Covers all current write endpoint patterns and invalid acknowledgments. Does not prove actor/org lifecycle, browser UX, real DB/provider/email or durable idempotency.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
