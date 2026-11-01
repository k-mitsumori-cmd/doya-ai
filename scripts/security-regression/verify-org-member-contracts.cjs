const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const protocol=load('src/lib/org-member-response.ts');
const self={id:'self',userId:'actor',role:'owner',status:'ACTIVE',name:null,inviteEmail:null};
const list={members:[self],myUserId:'actor',myRole:'owner'};
assert.equal(protocol.parseOrganizationMembers(list,'actor','owner').members.length,1);
for(const value of [{},[],{...list,myUserId:'other'},{...list,myRole:'member'},{...list,members:[]},{...list,members:[self,self]},{...list,members:[self,{...self,id:'bad',userId:null,role:'toString'}]},{...list,members:[{...self,status:'PENDING'}]}])assert.throws(()=>protocol.parseOrganizationMembers(value,'actor','owner'));
const sent={email:'synthetic@example.invalid',role:'member'};
assert.equal(protocol.normalizeMemberInvitation(' SYNTHETIC@example.invalid ','member','owner').email,sent.email);
for(const email of [[],null,123,'invalid','a'.repeat(255)+'@example.invalid'])assert.throws(()=>protocol.normalizeMemberInvitation(email,'member','owner'));
for(const role of ['owner','toString','__proto__'])assert.throws(()=>protocol.normalizeMemberInvitation(sent.email,role,'owner'));
for(const service of ['quote','aishodan']){
 const member={id:'invited',status:'PENDING',inviteEmail:sent.email,role:'member'},url=`https://doya-ai.surisuta.jp/${service}/invite/abcdefghijklmnopqrstuvwx`,ack={member,url,emailSent:false};
 assert.equal(protocol.parseMemberInvitationAcknowledgement(ack,sent,service,'https://example.invalid').emailSent,false);
 for(const value of [{},{...ack,emailSent:'true'},{...ack,member:{...member,inviteEmail:'other@example.invalid'}},{...ack,member:{...member,role:'admin'}},{...ack,url:url+'?unsafe=true'},{...ack,url:url.replace('doya-ai.surisuta.jp','evil.invalid')},{...ack,url:url.replace('/'+service+'/', '/other/')}])assert.throws(()=>protocol.parseMemberInvitationAcknowledgement(value,sent,service,'https://example.invalid'));
}
assert.equal(protocol.isMemberMutationAcknowledgement({ok:true,memberId:'target',role:'manager'},'target','manager'),true);
for(const ack of [{ok:true},{ok:true,memberId:'other',role:'manager'},{ok:true,memberId:'target',role:'admin'}])assert.equal(protocol.isMemberMutationAcknowledgement(ack,'target','manager'),false);
(async()=>{
for(const service of ['quote','aishodan']){
 let calls=0;const transport=load('src/lib/org-client-response.ts',{}, {AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout,fetch:async(url,init)=>{calls++;assert.equal(init.cache,'no-store');assert.match(url,new RegExp('/api/'+service+'/'));return Response.json({ok:true})}});
 await transport.requestOrgJson(service,`/api/${service}/organizations`,null);
 await transport.requestOrgJson(service,`/api/${service}/members`,'alpha');
 for(const path of [`/api/${service}/members`,'/api/other/members','https://evil.invalid/api/'+service+'/organizations'])await assert.rejects(transport.requestOrgJson(service,path,null));
 assert.equal(calls,2);
 let fire;const bounded=load('src/lib/org-client-response.ts',{}, {AbortController,TextDecoder,Uint8Array,setTimeout:fn=>{fire=fn;return 1},clearTimeout:()=>{},fetch:async()=>new Response(new ReadableStream({start(){}}))});
 const pending=bounded.requestOrgJson(service,`/api/${service}/members`,'alpha');await new Promise(setImmediate);fire();await assert.rejects(pending,e=>e.code==='RESPONSE_UNCONFIRMED');
 const {QuoteWorkspaceContext}=load('src/lib/quote/workspace-context.ts',{}, {AbortController});const context=new QuoteWorkspaceContext(()=> 'alpha',service),epoch=context.update({actor:'actor',selection:'alpha',status:'authenticated'});assert.equal(context.verifyOrganization(epoch,'alpha'),true);const ticket=context.begin('test',false,epoch);assert.equal(ticket.url(`/api/${service}/members`),`/api/${service}/members?org=alpha`);assert.equal(ticket.url('/api/other/members'),null);context.invalidate();assert.equal(ticket.current(),false);assert.equal(ticket.signal.aborted,true);
}
console.log('PASS member list, invitation, exact mutation acknowledgement, both scoped transports and bounded body/context contracts')
})().catch(e=>{console.error(e);process.exitCode=1});
