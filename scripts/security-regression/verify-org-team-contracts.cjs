const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs'),protocol=load('src/lib/org-team-response.ts');
const self={id:'self',name:null,inviteEmail:null,role:'owner',status:'ACTIVE',acceptedAt:null},list={members:[self],myMemberId:'self',myRole:'owner'};
assert.equal(protocol.readTeamMembers(list).myMemberId,'self');
for(const value of [{},[],{...list,myRole:'toString'},{...list,myMemberId:'missing'},{...list,members:[]},{...list,members:[self,self]},{...list,members:[{...self,status:'INACTIVE'}]},{...list,members:[self,{...self,id:'bad',role:'__proto__'}]},{...list,members:[{...self,name:123}]}])assert.throws(()=>protocol.readTeamMembers(value));
assert.equal(protocol.readTeamMembers({...list,members:[self,{...self,id:'inactive',role:'member',status:'INACTIVE'}]}).members.length,2);
const sent={email:'synthetic@example.invalid',role:'member'};
assert.equal(protocol.normalizeTeamInvitation(' SYNTHETIC@example.invalid ','member','owner').email,sent.email);
for(const input of [[[], 'member','owner'],[sent.email,'admin','admin'],[sent.email,'owner','owner'],[sent.email,'member','toString'],['a'.repeat(255)+'@example.invalid','member','owner']])assert.throws(()=>protocol.normalizeTeamInvitation(...input));
assert.equal(protocol.teamDeleteConfirmed({ok:true,memberId:'target'},'target'),true);for(const value of [{ok:true},{ok:true,memberId:'other'},{ok:false,memberId:'target'},{ok:true,memberId:'target',error:'bad'}])assert.equal(protocol.teamDeleteConfirmed(value,'target'),false);
(async()=>{
for(const service of ['aio','shodan']){
 const base=`https://doya-ai.surisuta.jp/${service}/invite/12345678-1234-1234-1234-123456789abc`,ack={ok:true,emailSent:false,inviteUrl:base,member:{id:'new-member',inviteEmail:sent.email,role:sent.role}};
 assert.equal(protocol.readTeamInvitation(ack,sent,service,'https://example.invalid').inviteUrl,base);
 for(const value of [{},{...ack,emailSent:'false'},{...ack,member:{...ack.member,role:'admin'}},{...ack,inviteUrl:base+'?foreign=true'},{...ack,inviteUrl:base.replace('doya-ai.surisuta.jp','evil.invalid')},{...ack,inviteUrl:base.replace('/'+service+'/', '/other/')},{...ack,inviteUrl:base+'#fragment'}])assert.throws(()=>protocol.readTeamInvitation(value,sent,service,'https://example.invalid'));
 const title=service==='aio'?'Aio':'Shodan';let mailCalls=0,creates=0;const tx={$queryRaw:async()=>[{id:'org',role:'owner'}],[service+'Member']:{findFirst:async()=>null,deleteMany:async()=>({count:0}),create:async({data})=>{creates++;return{id:'new-member',...data}}}};
 for(const delivered of [false,true]){
  const route=load(`src/app/api/${service}/members/route.ts`,{'next/server':{NextResponse:Response},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},'@/lib/prisma':{prisma:{[service+'Organization']:{findUnique:async()=>({name:'Synthetic'})},[service+'Member']:{findMany:async()=>[self]},$transaction:async fn=>fn(tx)}},['@/lib/'+service+'/access']:{['get'+title+'Context']:async()=>({userId:'actor',memberId:'self',organizationId:'org',role:'owner'}),hasMinRole:()=>true,orgSlugFrom:()=> 'alpha'},'@/lib/email':{sendEmail:async()=>{mailCalls++;return{success:delivered}}},'@/lib/html-escape':{escapeHtml:s=>s},['@/lib/'+service+'/types']:{ROLE_HIERARCHY:{owner:3,admin:2,manager:1,member:0}}});
  const response=await route.POST({json:async()=>({email:' SYNTHETIC@example.invalid ',role:'member'})});assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.match(response.headers.get('vary'),/Cookie/);assert.equal(protocol.readTeamInvitation(await response.json(),sent,service,'https://example.invalid').emailSent,delivered);
  const read=await route.GET({});assert.equal(protocol.readTeamMembers(await read.json()).myMemberId,'self');assert.match(read.headers.get('cache-control'),/private.*no-store/);assert.equal(read.headers.get('vary'),'Cookie');
 }
 assert.equal(mailCalls,2);assert.equal(creates,2);
}
console.log('PASS strict team list/input/invitation/delete contracts and actual AIO/Shodan GET/POST routes consumed by the real protocol. Synthetic Prisma/token/mail only; no real emails or DB writes.')
})().catch(e=>{console.error(e);process.exitCode=1});
