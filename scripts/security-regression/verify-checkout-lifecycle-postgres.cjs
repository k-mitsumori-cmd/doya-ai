process.env.NODE_ENV='test'
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto')
const repo=path.resolve(__dirname,'../..');module.paths.unshift(path.join(repo,'node_modules'))
const pinnedLegacy='scripts/security-regression/fixtures/checkout-reservation-v1-91f5c8af.ts';assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,pinnedLegacy))).digest('hex'),'11dab2b148831dbb3e7afd5d87bf0670aabd69550e2d28b8e4c01c307dc3c803')
const {PrismaClient,Prisma}=require('@prisma/client'),{load}=require('./load-typescript.cjs')
const folder=process.env.DOYA_CHECKOUT_PG_ROOT,port=Number(process.env.DOYA_CHECKOUT_PG_PORT),socket=process.env.DOYA_CHECKOUT_PG_SOCKET
assert(!process.env.DOYA_TEST_BASELINE);assert.match(folder||'',/^\/tmp\/doya-checkout-[a-f0-9]{8}$/);assert.equal(socket,folder+'/socket');assert(port>1024&&port<65536)
const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_checkout@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=checkout_fixture`}}})
const models=['User','SystemSetting','KintaiEmployee',...require('./retirement-fixture.cjs').retirementModels]
const state=load('src/lib/account-lifecycle/state.ts',{'node:crypto':crypto})
const store=load('src/lib/account-lifecycle/store.ts',{'node:crypto':crypto,'@prisma/client':{Prisma},'./state':state})
const orgFence=load('src/lib/account-lifecycle/organization-fence.ts',{'@prisma/client':{Prisma},'./state':state,'./store':store})
const digest=crypto.createHash('sha256').update('synthetic-input').digest('hex'),target='m_target',actor='a_actor',owner='z_owner',second='n_second'
const identity=(kind='retirement',user=target,operationId=crypto.randomUUID(),operator={kind:'admin',id:'synthetic_admin_principal'})=>({operator,targetUserId:user,operationId,kind})
const resource=(type='subscription_cancel',resourceId='sub_synthetic')=>({type,mode:'test',resourceId,inputDigest:digest})
const snapshot=()=>db.systemSetting.findMany({select:{key:true,value:true},orderBy:{key:'asc'}})
const plain=v=>JSON.parse(JSON.stringify(v)),defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
async function rejects(fn){await assert.rejects(fn)}
async function reserve(id=identity()){return{identity:id,...await store.reserveLifecycleOperation(db,id,digest)}}
async function executing(resources=[resource()],id=identity()){const r=await reserve(id);await store.prepareLifecycleActions(db,r.claim,resources);await store.startLifecycleOperation(db,r.claim);return r}
async function baseReset(){await db.$executeRawUnsafe('TRUNCATE "User","SystemSetting",hr_organizations,kintai_organizations,sfa_organizations,shodan_organizations,aio_organizations,mensetsu_organizations,quote_organizations,aishodan_organizations,income_organizations,expense_organizations,promane_workspaces CASCADE');for(const id of [actor,target,second,owner])await db.user.create({data:{id,email:id+'@example.invalid',plan:'FREE'}})}
const cases=[]
async function check(name,fn){await reset();await fn();cases.push({name,classification:'unconnected_checkout_foundation_contract',passed:true});console.log('PASS '+name)}
function requiredData(model,overrides){const data={};for(const f of Prisma.dmmf.datamodel.models.find(m=>m.name===model).fields.filter(f=>f.kind!=='object'&&f.isRequired&&!f.hasDefaultValue&&!f.isUpdatedAt)){data[f.name]=f.type==='String'?'Synthetic':f.type==='Boolean'?true:f.type==='DateTime'?new Date():f.type==='Json'?{}:1}return{...data,...overrides}}
const services=[['hr','HrOrganization','HrOrganizationMember','OWNER','MEMBER'],['kintai','KintaiOrganization','KintaiMember','system_admin','employee'],...['sfa','shodan','aio','mensetsu','quote','aishodan','income','expense'].map(n=>[n,n[0].toUpperCase()+n.slice(1)+'Organization',n[0].toUpperCase()+n.slice(1)+'Member','owner','member']),['promane','PromaneWorkspace','PromaneMember','owner','member']]
const delegate=name=>db[name[0].toLowerCase()+name.slice(1)]
async function seedOrg(service='expense',options={}){const[s,orgName,memberName,ownerRole,memberRole]=services.find(row=>row[0]===service),org=await delegate(orgName).create({data:requiredData(orgName,{slug:options.slug||'synthetic-'+s,...(s==='promane'?{userId:owner}:{} )})});const member=async(userId,role)=>{const row=await delegate(memberName).create({data:requiredData(memberName,{[s==='promane'?'workspaceId':'organizationId']:org.id,userId,role,...(s==='promane'?{isActive:true}:{status:'ACTIVE'})})});if(s==='kintai')await db.kintaiEmployee.create({data:{organizationId:org.id,memberId:row.id,name:'Synthetic',email:(userId||'pending')+'@example.invalid'}});return row};const chief=await member(owner,ownerRole),mine=await member(actor,s==='kintai'&&options.twoAdmins?ownerRole:memberRole);return{org,chief,mine,member,model:delegate(memberName)}}
const scope=(service,org,overrides={})=>({service,organizationId:org.id,actorUserId:actor,access:'member',targetMemberIds:[],targetUserIds:[target],targetEmails:[],grantsAuthority:true,pendingClaimUserId:null,repairsUnknownTargetRole:false,...overrides})
async function writable(user){return db.$transaction(async tx=>{await store.lockLifecycleUsers(tx,[user]);await store.assertLifecycleWritable(tx,[user])})}
async function setup(){
 const s=await db.$queryRawUnsafe("SELECT inet_server_addr() AS address,current_user AS role,current_setting('data_directory') AS folder");assert.equal(s[0].address,null);assert.equal(s[0].role,'doya_checkout');assert.equal(s[0].folder,folder+'/data')
 await db.$executeRawUnsafe('CREATE SCHEMA checkout_fixture')
 const quote=s=>'"'+s.replaceAll('"','""')+'"'
 for(const name of models){
  const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name),cols=m.fields.filter(f=>f.kind!=='object').map(f=>{let type=({String:'TEXT',Int:'INTEGER',Boolean:'BOOLEAN',DateTime:'TIMESTAMP(3)',Json:'JSONB',Float:'DOUBLE PRECISION',BigInt:'BIGINT',Decimal:'DECIMAL'})[f.type]||'TEXT';if(f.isList)type+='[]';let def='';if(f.type==='DateTime'&&(f.isUpdatedAt||f.default?.name==='now'))def=' DEFAULT CURRENT_TIMESTAMP';else if(f.hasDefaultValue&&['string','number','boolean'].includes(typeof f.default))def=' DEFAULT '+(typeof f.default==='string'?"'"+f.default.replaceAll("'","''")+"'":String(f.default));return quote(f.dbName||f.name)+' '+type+(f.isRequired?' NOT NULL':'')+def+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'')});for(const fields of m.uniqueFields)cols.push('UNIQUE ('+fields.map(quote).join(',')+')');await db.$executeRawUnsafe('CREATE TABLE '+quote(m.dbName||name)+' ('+cols.join(',')+')')
 }
 const selected=models;for(const model of Prisma.dmmf.datamodel.models.filter(m=>selected.includes(m.name))){for(const field of model.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length&&selected.includes(f.type))){const target=Prisma.dmmf.datamodel.models.find(m=>m.name===field.type),onDelete=field.relationOnDelete||(!field.isRequired?'SetNull':'Restrict'),action={Cascade:'CASCADE',SetNull:'SET NULL',Restrict:'RESTRICT',NoAction:'NO ACTION'}[onDelete];await db.$executeRawUnsafe('ALTER TABLE '+quote(model.dbName||model.name)+' ADD FOREIGN KEY ('+field.relationFromFields.map(quote).join(',')+') REFERENCES '+quote(target.dbName||target.name)+' ('+field.relationToFields.map(quote).join(',')+') ON DELETE '+action)}}
}

const checkoutUrls=load('src/lib/account-lifecycle/checkout-urls.ts',{});
const checkoutReceipt=load('src/lib/account-lifecycle/checkout-receipt.ts',{'node:crypto':crypto,'./state':state,'./checkout-urls':checkoutUrls});
const checkoutProvider=load('src/lib/account-lifecycle/checkout-provider.ts',{'./state':state,'./checkout-receipt':checkoutReceipt,'./checkout-urls':checkoutUrls});
const checkoutLegacy=load('src/lib/account-lifecycle/checkout-legacy.ts',{'./checkout-receipt':checkoutReceipt,'./state':state});
const checkoutStore=load('src/lib/account-lifecycle/checkout-store.ts',{'node:crypto':crypto,'@prisma/client':{Prisma},'./state':state,'./store':store,'./checkout-receipt':checkoutReceipt,'./checkout-provider':checkoutProvider,'./checkout-legacy':checkoutLegacy});
const coordinator=load('src/lib/account-lifecycle/checkout.ts',{'./state':state,'./store':store,'./checkout-receipt':checkoutReceipt,'./checkout-urls':checkoutUrls,'./checkout-provider':checkoutProvider,'./checkout-store':checkoutStore});
const subscriptionPlan=load('src/lib/account-lifecycle/subscription-plan.ts',{'node:crypto':crypto,'./state':state});
const adminSubscriptionPlan=load('src/lib/account-lifecycle/admin-subscription-plan.ts',{'node:crypto':crypto,'./state':state});
const adminSubscriptionFact=load('src/lib/account-lifecycle/admin-subscription-fact.ts',{'./state':state,'./admin-subscription-plan':adminSubscriptionPlan});
const selfSettlement=load('src/lib/account-lifecycle/self-subscription-settlement.ts',{'./state':state});
const adminStore=load('src/lib/account-lifecycle/store.ts',{'node:crypto':crypto,'@prisma/client':{Prisma},'./state':state,'./admin-subscription-plan':adminSubscriptionPlan,'./admin-subscription-fact':adminSubscriptionFact,'@/lib/admin-auth':{verifyAdminAuthorityTx:async()=>true},'@/lib/billing-sync':{projectUnifiedBilling:async()=>{throw Error('not used by admission')}}});
const epoch=crypto.randomUUID(),expiry=Math.floor(Date.now()/1000)+2400;
async function reset(){await baseReset();await db.systemSetting.create({data:{key:checkoutReceipt.checkoutKeys.cutover('test'),value:JSON.stringify({version:1,mode:'test',epoch,coverage:'old_ingress_stopped_and_workers_reconciled',evidenceDigest:digest})}})}
const request=(overrides={})=>({cutoverEpoch:epoch,identity:identity('checkout',target,crypto.randomUUID(),{kind:'user',id:target}),mode:'test',source:'generic',organizationId:null,customerMode:'implicit',customerId:null,terms:{priceId:'price_synthetic',planId:'pro',serviceId:'synthetic',trialDays:0,successUrl:'https://example.invalid/success',cancelUrl:'https://example.invalid/cancel',email:target+'@example.invalid',name:'Synthetic',expiresAt:expiry},...overrides});
function providerFixture(){
 const counts={customerCreate:0,checkoutCreate:0,customerRead:0,checkoutRead:0},customers=new Map(),sessions=new Map(),keys=new Map(),hooks={};
 const same=(key,payload,result)=>{const old=keys.get(key),serialized=JSON.stringify(payload);if(old){assert.equal(old.payload,serialized);return old.result}keys.set(key,{payload:serialized,result});return result};
 const api={
  createCustomer:async(params,opts)=>{counts.customerCreate++;const raw=same(opts.idempotencyKey,params,{id:'cus_synthetic_'+counts.customerCreate,livemode:false,metadata:{...params.metadata}});customers.set(raw.id,raw);if(hooks.customerCreate)await hooks.customerCreate(raw);return raw},
  retrieveCustomer:async id=>{counts.customerRead++;const raw=customers.get(id);assert(raw);if(hooks.customerRead)await hooks.customerRead(raw);return raw},
  createCheckout:async(params,opts)=>{counts.checkoutCreate++;const raw=same(opts.idempotencyKey,params,{id:'cs_synthetic_'+counts.checkoutCreate,livemode:false,mode:'subscription',status:'open',client_reference_id:params.client_reference_id,metadata:{...params.metadata},customer:params.customer,subscription:null,url:'https://checkout.example.invalid/synthetic_'+counts.checkoutCreate,expires_at:params.expiresAt,line_items:{data:[{quantity:1,price:{id:params.priceId}}]}});sessions.set(raw.id,raw);if(hooks.checkoutCreate)await hooks.checkoutCreate(raw);return raw},
  retrieveCheckout:async id=>{counts.checkoutRead++;const raw=sessions.get(id);assert(raw);if(hooks.checkoutRead)await hooks.checkoutRead(raw);return raw},
 };
 const adapter=checkoutProvider.checkoutProviderAdapter(api);return{api,adapter,client:coordinator.checkoutCoordinator(db,adapter),counts,customers,sessions,hooks};
}
async function started(r){const admitted=await checkoutStore.admitCheckoutLifecycle(db,r);assert(admitted.claim);await checkoutStore.prepareCheckoutLifecycle(db,admitted.claim);await store.startLifecycleOperation(db,admitted.claim);return admitted}
async function keyRow(key){return db.systemSetting.findUnique({where:{key}})}
async function stateRows(){return plain(await snapshot())}
const subscriptionFactOnly=(operationId,shape)=>shape==='complete'?JSON.stringify({operationId,actionKey:'a'.repeat(64),subscriptionId:'sub_synthetic',customerId:'cus_synthetic',mode:'test',status:'active',cancelAtPeriodEnd:true,currentPeriodEnd:1900000000,outcome:{proof:'ack',resourceId:'sub_synthetic',status:'scheduled_cancel'}}):'{malformed';
const makeAdminPlan=(shared,user=target)=>adminSubscriptionPlan.makeAdminSubscriptionPlan({identity:identity('cancel',user,shared,{kind:'admin',id:'synthetic_admin_principal'}),intent:'period_end_cancel',mode:'test',email:user+'@example.invalid',expectedCustomerId:null,expectedSubscriptionId:'sub_synthetic',expectedPriceId:null,target:{id:'sub_synthetic',customerId:'cus_synthetic',status:'active',cancelAtPeriodEnd:false,currentPeriodEnd:1900000000}});
function c3aOrphan(namespace,shared,shape){
 const admin=makeAdminPlan(shared);
 const self=subscriptionPlan.makeSubscriptionPlan({identity:identity('cancel',target,shared,{kind:'user',id:target}),mode:'test',email:target+'@example.invalid',expectedCustomerId:null,expectedSubscriptionId:null,serviceId:'banner',cancelMode:'immediate',targets:[{id:'sub_synthetic',customerId:'cus_synthetic',status:'active',cancelAtPeriodEnd:false,currentPeriodEnd:1900000000}]});
 const rows={
  adminPlan:[adminSubscriptionPlan.adminSubscriptionPlanKey(shared),JSON.stringify(admin)],
  adminFact:[adminSubscriptionPlan.adminSubscriptionFactKey(shared),JSON.stringify(adminSubscriptionFact.verifyAdminSubscriptionFact(admin,{proof:'write_ack',status:'active',cancelAtPeriodEnd:true,currentPeriodEnd:1900000000}))],
  adminSettlement:[adminSubscriptionPlan.adminSubscriptionSettlementKey(shared),JSON.stringify({version:1,source:'admin',settlementPolicyVersion:1,operationId:shared,targetHash:admin.targetHash,planDigest:admin.inputDigest,projected:false,userPlan:null,appliedAt:new Date().toISOString()})],
  selfRequirement:[selfSettlement.selfSettlementRequirementKey(shared),JSON.stringify(selfSettlement.makeSelfSettlementRequirement(self))],
  selfCoverage:[selfSettlement.selfSettlementCoverageKey(shared),JSON.stringify({version:1,source:'self_service',policyVersion:1,operationId:shared,targetHash:self.targetHash,planDigest:self.inputDigest,userPlan:'FREE',appliedAt:new Date().toISOString()})],
 };
 const [key,value]=rows[namespace];return{key,value:shape==='complete'?value:'{malformed'};
}
function legacyParts(r){return{priceId:r.terms.priceId,planId:r.terms.planId,service:r.terms.serviceId,email:r.terms.email,successUrl:r.terms.successUrl,cancelUrl:r.terms.cancelUrl,...(r.terms.trialDays?{trialDays:r.terms.trialDays}:{})}}
async function legacyReady(p,r,status='open'){
 const parts=legacyParts(r),signature=checkoutLegacy.verifiedLegacySignature(r,parts),sessionId='cs_legacy',url='https://checkout.example.invalid/legacy';
 const raw=JSON.stringify({phase:'ready',signature,sessionId,url,expiresAt:r.terms.expiresAt});
 await db.systemSetting.create({data:{key:`checkout-reservation:v1:${r.mode}:${r.identity.targetUserId}`,value:raw}});
 p.sessions.set(sessionId,{id:sessionId,livemode:r.mode==='live',mode:'subscription',status,client_reference_id:r.identity.targetUserId,metadata:{userId:r.identity.targetUserId,planId:r.terms.planId,serviceId:r.terms.serviceId},customer:status==='complete'?'cus_legacy':null,customer_email:r.terms.email,subscription:status==='complete'?'sub_legacy':null,url:status==='open'?url:null,success_url:r.terms.successUrl,cancel_url:r.terms.cancelUrl,expires_at:r.terms.expiresAt,line_items:{data:[{quantity:1,price:{id:r.terms.priceId}}]}});
 return{parts,raw,sessionId,url}
}
async function assertRevokedBeforeDispatch(change){
 const p=providerFixture(),{org,chief}=await seedOrg('hr'),customerId='cus_existing';
 await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 await db.user.update({where:{id:target},data:{stripeCustomerId:customerId}});
 p.customers.set(customerId,{id:customerId,livemode:false,metadata:{userId:target}});
 const r=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId});
 assert((await checkoutStore.admitCheckoutLifecycle(db,r)).claim);
 const seen=defer(),release=defer();p.hooks.customerRead=async()=>{seen.resolve();await release.promise};
 const secondDb=new PrismaClient({datasources:{db:{url:`postgresql://doya_checkout@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=checkout_fixture`}}});
 const creating=p.client.recover(r).then(()=>null,error=>error);
 try{await seen.promise;await change(secondDb,{org,chief})}finally{release.resolve();await secondDb.$disconnect()}
 assert(await creating instanceof Error);assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,0)
}
;(async()=>{try{await setup();
await check('one User lane serializes generic and HR admissions',async()=>{const{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});const a=request(),b=request({source:'hr',organizationId:org.id});const results=await Promise.allSettled([checkoutStore.admitCheckoutLifecycle(db,a),checkoutStore.admitCheckoutLifecycle(db,b)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-account-operation:v2:'}}}),1)});
await check('same payload replay resolves current operation; changed payload cannot replace it',async()=>{const r=request(),a=await checkoutStore.admitCheckoutLifecycle(db,r),again=await checkoutStore.admitCheckoutLifecycle(db,{...r,identity:{...r.identity,operationId:crypto.randomUUID()}});assert.equal(again.identity.operationId,r.identity.operationId);assert.equal(again.claim,null);await rejects(()=>checkoutStore.admitCheckoutLifecycle(db,{...r,terms:{...r.terms,trialDays:1}}));assert(a.claim)});
await check('principal and HR owner binding are checked before provider dispatch',async()=>{const p=providerFixture(),r=request();await rejects(()=>p.client.create({...r,identity:{...r.identity,operator:{kind:'user',id:actor}}}));const{org}=await seedOrg('hr');await rejects(()=>p.client.create({...r,source:'hr',organizationId:org.id}));assert.equal(p.counts.checkoutCreate,0);assert.equal(p.counts.customerCreate,0)});
await check('HR owner revocation during Customer reuse blocks external creates',async()=>{const p=providerFixture(),{org,chief}=await seedOrg('hr'),customerId='cus_existing';await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});await db.user.update({where:{id:target},data:{stripeCustomerId:customerId}});p.customers.set(customerId,{id:customerId,livemode:false,metadata:{userId:target}});const r=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId}),admitted=await checkoutStore.admitCheckoutLifecycle(db,r);assert(admitted.claim);const seen=defer(),release=defer();p.hooks.customerRead=async()=>{seen.resolve();await release.promise};const secondDb=new PrismaClient({datasources:{db:{url:`postgresql://doya_checkout@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=checkout_fixture`}}});const creating=p.client.recover(r).then(()=>null,error=>error);try{await seen.promise;await secondDb.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}})}finally{release.resolve();await secondDb.$disconnect()}assert(await creating instanceof Error);assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,0)});
await check('HR organization deletion during Customer reuse blocks external creates',()=>assertRevokedBeforeDispatch((secondDb,{org})=>secondDb.hrOrganization.delete({where:{id:org.id}})));
await check('HR membership reassignment during Customer reuse blocks external creates',()=>assertRevokedBeforeDispatch((secondDb,{chief})=>secondDb.hrOrganizationMember.update({where:{id:chief.id},data:{userId:second}})));
await check('HR membership deactivation during Customer reuse blocks external creates',()=>assertRevokedBeforeDispatch((secondDb,{chief})=>secondDb.hrOrganizationMember.update({where:{id:chief.id},data:{status:'INACTIVE'}})));
await check('User email change during Customer reuse blocks external creates',()=>assertRevokedBeforeDispatch(secondDb=>secondDb.user.update({where:{id:target},data:{email:'changed@example.invalid'}})));
await check('User Customer reference change during reuse blocks external creates',()=>assertRevokedBeforeDispatch(secondDb=>secondDb.user.update({where:{id:target},data:{stripeCustomerId:'cus_replaced'}})));
await check('HR owner loss before Customer-create dispatch blocks external creates',async()=>{const p=providerFixture(),{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});const r=request({source:'hr',organizationId:org.id,customerMode:'create'}),a=await started(r);await db.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}});await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'customer_create',r));assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,0)});
await check('dispatch binds the original request to its immutable plan',async()=>{const r=request(),a=await started(r),other={...r,terms:{...r.terms,priceId:'price_other'}};await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'checkout_create',other));assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-dispatch:v2:'}}}),0)});
await check('foreign User request is rejected before any dispatch transaction or row read',async()=>{const r=request(),a=await started(r),foreign=request({identity:identity('checkout',second,crypto.randomUUID(),{kind:'user',id:second}),terms:{...r.terms,email:second+'@example.invalid'}});let transactions=0;const observed={$transaction:()=>{transactions++;throw Error('unexpected foreign User read')}};await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(observed,a.claim,'checkout_create',foreign));assert.equal(transactions,0);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-dispatch:v2:'}}}),0)});
await check('foreign HR organization scope is rejected before organization or member read',async()=>{const{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});const r=request({source:'hr',organizationId:org.id}),a=await started(r),other=await db.hrOrganization.create({data:requiredData('HrOrganization',{slug:'synthetic-other'})}),observed=[];const audited={$transaction:(fn,opts)=>db.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='$queryRaw')return(strings,...values)=>{observed.push(strings.join('?'));return t.$queryRaw(strings,...values)};return Reflect.get(t,k)}})),opts)};await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(audited,a.claim,'checkout_create',{...r,organizationId:other.id}));assert.equal(observed.filter(sql=>sql.includes('hr_organizations')||sql.includes('hr_organization_members')).length,0);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-dispatch:v2:'}}}),0)});
for(const stop of ['reserved','prepared','started'])await check('explicit same operation recovery after '+stop,async()=>{const p=providerFixture(),r=request(),a=await checkoutStore.admitCheckoutLifecycle(db,r);assert(a.claim);if(stop!=='reserved')await checkoutStore.prepareCheckoutLifecycle(db,a.claim);if(stop==='started')await store.startLifecycleOperation(db,a.claim);const result=await p.client.recover(r);assert.match(result.id,/^cs_/);assert.equal(p.counts.checkoutCreate,1);await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'checkout_create',r))});
await check('customer dependency must be confirmed before checkout can dispatch',async()=>{const r=request({customerMode:'create'}),a=await started(r);await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'checkout_create',r));const resources=[{type:'customer_create',mode:'test',resourceId:state.lifecycleSubject(target),inputDigest:digest},{type:'checkout_create',mode:'test',resourceId:state.lifecycleSubject(target),inputDigest:digest}],r2=request({identity:identity('checkout',second,crypto.randomUUID(),{kind:'user',id:second}),terms:{...r.terms,email:second+'@example.invalid'}});const b=await store.reserveLifecycleOperation(db,r2.identity,digest);await store.prepareLifecycleActions(db,b.claim,resources.map(x=>({...x,resourceId:state.lifecycleSubject(second)})));await store.startLifecycleOperation(db,b.claim);await rejects(()=>store.dispatchLifecycleAction(db,b.claim,state.lifecycleActionKey(resources[1]={...resources[1],resourceId:state.lifecycleSubject(second)})))});
await check('Customer then Checkout creates private ready capability and resource index before lane release',async()=>{const p=providerFixture(),r=request({customerMode:'create'}),result=await p.client.create(r);assert.match(result.id,/^cs_/);assert.equal(p.counts.customerCreate,1);assert.equal(p.counts.checkoutCreate,1);assert.match((await db.user.findUnique({where:{id:target}})).stripeCustomerId,/^cus_/);assert(await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId)));assert.equal(await keyRow(state.lifecycleFenceKey(target)),null);const rows=await snapshot();for(const row of rows.filter(x=>!x.key.startsWith('doya-checkout-capability:')))assert(!row.value.includes('https://')&&!row.value.includes('@example.invalid'));assert.equal((await p.client.create(r)).id,result.id);assert.equal(p.counts.checkoutCreate,1)});
await check('Customer response loss remains unknown beyond TTL, rejects abort/new operation, and reconciles exact ID without create',async()=>{const p=providerFixture(),r=request({customerMode:'create'});p.hooks.customerCreate=async()=>{throw Error('Synthetic lost response')};await rejects(()=>p.client.create(r));const status=await p.client.status(r);assert.equal(status.reason,'EXTERNAL_UNKNOWN');const before=await stateRows(),counts={...p.counts};await p.client.status(r);assert.deepEqual(await stateRows(),before);assert.deepEqual(p.counts,counts);const now=Date.now;try{Date.now=()=>now()+100*86400000;await p.client.create({...r,identity:{...r.identity,operationId:crypto.randomUUID()}});await rejects(()=>p.client.abort(r));await rejects(()=>p.client.recover(r));assert.equal(p.counts.customerCreate,1)}finally{Date.now=now}delete p.hooks.customerCreate;const id=[...p.customers.keys()][0];await p.client.reconcile(r,id);assert.equal(p.counts.customerCreate,1);assert.equal((await db.user.findUnique({where:{id:target}})).stripeCustomerId,id);assert((await p.client.recover(r)).id);assert.equal(p.counts.checkoutCreate,1)});
await check('checkout response loss never changes key or creates twice; explicit read reconciliation restores ready receipt',async()=>{const p=providerFixture(),r=request();p.hooks.checkoutCreate=async()=>{throw Error('Synthetic checkout response lost')};await rejects(()=>p.client.create(r));assert.equal((await p.client.status(r)).reason,'EXTERNAL_UNKNOWN');await p.client.create(r);assert.equal(p.counts.checkoutCreate,1);delete p.hooks.checkoutCreate;await p.client.reconcile(r,[...p.sessions.keys()][0]);assert.equal(p.counts.checkoutCreate,1);assert.match((await p.client.authorizeReadyRead(r)).id,/^cs_/)});
await check('customer dependent append uses expected revisions and is idempotent without rewriting confirmed actions',async()=>{const p=providerFixture(),r=request({customerMode:'create'}),a=await started(r),sent=await checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'customer_create',r),fact=await p.adapter.createCustomer(r,sent.plan,sent.dispatch),before=await stateRows();await rejects(()=>checkoutStore.recordCustomerAckAndPlanCheckout(db,a.claim,fact,{operationRevision:sent.operationRevision,ledgerRevision:sent.ledgerRevision+1}));assert.deepEqual(await stateRows(),before);const first=await checkoutStore.recordCustomerAckAndPlanCheckout(db,a.claim,fact,sent),after=await stateRows();assert.equal((await checkoutStore.recordCustomerAckAndPlanCheckout(db,a.claim,fact,sent)).ledgerRevision,first.ledgerRevision);assert.deepEqual(await stateRows(),after)});
for(const field of ['email','name','expiresAt','trialDays','priceId','successUrl','cancelUrl'])await check('sealed payload refuses changed '+field,async()=>{const p=providerFixture(),r=request();await checkoutStore.admitCheckoutLifecycle(db,r);const value=field==='trialDays'?1:field==='expiresAt'?expiry+60:field==='email'?'other@example.invalid':field==='name'?'Changed':field==='priceId'?'price_other':'https://other.example.invalid';await rejects(()=>p.client.recover({...r,terms:{...r.terms,[field]:value}}));assert.equal(p.counts.checkoutCreate,0);assert.equal(p.counts.customerCreate,0)});
for(const field of ['livemode','client_reference_id','price','metadata','sessionId','customer'])await check('provider checkout ack refuses wrong '+field,async()=>{const p=providerFixture(),r=request();p.hooks.checkoutCreate=async raw=>{if(field==='livemode')raw.livemode=true;else if(field==='client_reference_id')raw.client_reference_id=second;else if(field==='price')raw.line_items.data[0].price.id='price_other';else if(field==='metadata')raw.metadata.doyaInput='0'.repeat(64);else if(field==='sessionId')raw.id='bad';else raw.customer='bad'};await rejects(()=>p.client.create(r));assert.equal((await p.client.status(r)).reason,'NEEDS_REVIEW');assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId)),null);assert(await keyRow(state.lifecycleFenceKey(target)))});
await check('JSON fact and mutable dispatch cannot manufacture runtime provider provenance',async()=>{const p=providerFixture(),r=request(),a=await started(r),sent=await checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'checkout_create',r),fact=await p.adapter.createCheckout(r,sent.plan,sent.dispatch),before=await stateRows();await rejects(()=>checkoutStore.ingestCorrelatedCheckoutLateFact(db,plain(fact)));assert.deepEqual(await stateRows(),before);assert(Object.isFrozen(fact)&&Object.isFrozen(fact.dispatch)&&Object.isFrozen(fact.dispatch.plan));assert.equal(fact.dispatch.idempotencyKey,sent.dispatch.idempotencyKey)});
await check('ready retrieve is outside DB locks and retirement admission invalidates final URL authorization',async()=>{const p=providerFixture(),r=request();await p.client.create(r);const seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.authorizeReadyRead(r);await seen.promise;const retiring=await store.reserveLifecycleOperation(db,identity('retirement'),digest);assert(retiring.claim);release.resolve();await rejects(()=>reading);assert.equal(p.counts.checkoutCreate,1)});
await check('provider write wait does not hold User row locks on a second connection',async()=>{const p=providerFixture(),r=request(),seen=defer(),release=defer();p.hooks.checkoutCreate=async()=>{seen.resolve();await release.promise};const creating=p.client.create(r);await seen.promise;try{await db.$transaction(tx=>tx.user.update({where:{id:target},data:{name:'Synthetic independent update'}}),{timeout:2000,maxWait:2000})}finally{release.resolve()}assert.match((await creating).id,/^cs_/)});
for(const value of [null,'{bad',JSON.stringify({phase:'creating',signature:'old',idempotencyKey:'old-key',createdAt:0,leaseUntil:1,expiresAt:2}),...['open','expired','complete'].map(()=>JSON.stringify({phase:'ready',signature:'old',sessionId:'cs_legacy',url:'https://checkout.example.invalid/old',expiresAt:2}))])await check('legacy classification preserves raw values and grants no admission '+cases.length,async()=>{const p=providerFixture(),r=request(),key='checkout-reservation:v1:test:'+target;if(value!==null)await db.systemSetting.create({data:{key,value}});const first=await p.client.classifyLegacy(r),before=await stateRows(),again=await p.client.classifyLegacy(r);assert.deepEqual(plain(first),plain(again));assert.deepEqual(await stateRows(),before);assert.equal((await keyRow(key))?.value??null,value);if(value!==null)await rejects(()=>p.client.create(r));else{await db.systemSetting.delete({where:{key:checkoutReceipt.checkoutKeys.cutover('test')}});await rejects(()=>p.client.create(r))}assert.equal(p.counts.checkoutCreate,0)});
await check('late exact ack after User deletion records technical data only and never creates User or ready URL',async()=>{const p=providerFixture(),r=request(),seen=defer(),release=defer();p.hooks.checkoutCreate=async()=>{seen.resolve();await release.promise};const creating=p.client.create(r);await seen.promise;await db.user.delete({where:{id:target}});release.resolve();await rejects(()=>creating);assert.equal(await db.user.count({where:{id:target}}),0);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId)),null);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-fact:v2:'}}}),1);assert.equal(p.counts.checkoutCreate,1)});
await check('correlated complete fact during retirement advances dirty revision and adds exact subscription without restoring URL',async()=>{const p=providerFixture(),r=request();await p.client.create(r);const ticket=await checkoutStore.captureCheckoutReadyRead(db,r),retiring=await store.reserveLifecycleOperation(db,identity('retirement'),digest);const raw=p.sessions.get(ticket.capability.sessionId);raw.status='complete';raw.customer='cus_late';raw.subscription='sub_exact';raw.url=null;const fact=await p.adapter.reconcileCheckout(ticket.plan,ticket.dispatch,raw.id),result=await checkoutStore.ingestCorrelatedCheckoutLateFact(db,fact);assert.equal(result.urlAuthorized,false);const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(ticket.plan.targetHash))).value);assert.equal(index.dirty,true);assert.equal(index.notifiedRetirement,retiring.identity?.operationId||retiring.operationId);assert(index.revision>ticket.indexRevision);assert(index.resources.some(x=>x.id==='sub_exact'));const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId))).value);assert.equal(cap.status,'complete');assert.equal(cap.url,null);assert(await db.user.findUnique({where:{id:target}}))});
await check('Customer success followed by User-save failure retains unknown resource and reconciles without replacement',async()=>{const p=providerFixture(),r=request({customerMode:'create'});let once=true;const faulty={$transaction:(fn,opts)=>db.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='user')return new Proxy(t.user,{get(m,n){if(n==='updateMany')return args=>{if(once&&args.data.stripeCustomerId){once=false;throw Error('Synthetic User-save failure')}return m.updateMany(args)};return Reflect.get(m,n)}});return Reflect.get(t,k)}})),opts)};const client=coordinator.checkoutCoordinator(faulty,p.adapter);await rejects(()=>client.create(r));assert.equal(p.counts.customerCreate,1);assert.equal((await db.user.findUnique({where:{id:target}})).stripeCustomerId,null);assert.equal((await p.client.status(r)).reason,'EXTERNAL_UNKNOWN');await p.client.reconcile(r,[...p.customers.keys()][0]);assert.equal(p.counts.customerCreate,1);assert((await p.client.recover(r)).id)});
await check('Customer reference conflict never overwrites another Customer or dispatches checkout',async()=>{const p=providerFixture(),r=request({customerMode:'create'});p.hooks.customerCreate=async()=>{await db.user.update({where:{id:target},data:{stripeCustomerId:'cus_other'}})};await rejects(()=>p.client.create(r));assert.equal((await db.user.findUnique({where:{id:target}})).stripeCustomerId,'cus_other');assert.equal((await p.client.status(r)).reason,'NEEDS_REVIEW');assert.equal(p.counts.checkoutCreate,0);assert.equal(p.counts.customerCreate,1);await rejects(()=>p.client.reconcile(r,[...p.customers.keys()][0]));assert.equal((await db.user.findUnique({where:{id:target}})).stripeCustomerId,'cus_other')});
await check('resource index save failure prevents completion and URL while preserving dispatched outcome for reconcile',async()=>{const p=providerFixture(),r=request();let once=true;const faulty={$transaction:(fn,opts)=>db.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='systemSetting')return new Proxy(t.systemSetting,{get(m,n){if(n==='create')return args=>{if(once&&args.data.key.startsWith('doya-checkout-resource:')){once=false;throw Error('Synthetic index write failure')}return m.create(args)};return Reflect.get(m,n)}});return Reflect.get(t,k)}})),opts)};await rejects(()=>coordinator.checkoutCoordinator(faulty,p.adapter).create(r));assert.equal((await p.client.status(r)).phase,'executing');assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId)),null);assert(await keyRow(state.lifecycleFenceKey(target)));assert.equal(p.counts.checkoutCreate,1);await p.client.reconcile(r,[...p.sessions.keys()][0]);assert.equal(p.counts.checkoutCreate,1);assert.equal((await p.client.status(r)).phase,'completed')});
await check('same late Customer ack is idempotent after generation rotation; conflicting resource is review-only',async()=>{const p=providerFixture(),r=request({customerMode:'create'}),a=await started(r),sent=await checkoutStore.dispatchCheckoutLifecycle(db,a.claim,'customer_create',r),fact=await p.adapter.createCustomer(r,sent.plan,sent.dispatch);await checkoutStore.recordCustomerAckAndPlanCheckout(db,a.claim,fact,sent);const next=await store.resumeLifecycleOperation(db,r.identity),before=await stateRows();await checkoutStore.ingestCorrelatedCheckoutLateFact(db,fact);assert.deepEqual(await stateRows(),before);assert.notEqual(next.generation,a.claim.generation);const raw=p.customers.get(fact.resourceId);p.customers.set('cus_conflicting',{...raw,id:'cus_conflicting'});const conflict=await p.adapter.reconcileCustomer(sent.plan,sent.dispatch,'cus_conflicting');assert.equal((await checkoutStore.ingestCorrelatedCheckoutLateFact(db,conflict)).needsReview,true);assert.equal((await db.user.findUnique({where:{id:target}})).stripeCustomerId,fact.resourceId);await rejects(()=>checkoutStore.dispatchCheckoutLifecycle(db,next,'checkout_create',r));assert.equal((await p.client.status(r)).reason,'NEEDS_REVIEW');assert.equal(p.counts.checkoutCreate,0)});
await check('unstarted abort is stable, status has no authority tokens and never calls provider',async()=>{const p=providerFixture(),r=request();await p.client.admit(r);const before=await stateRows(),status=await p.client.status(r);assert.equal(status.phase,'reserved');assert.equal('claim' in status,false);assert.equal('dispatchToken' in status,false);assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);await p.client.abort(r);assert.equal((await p.client.status(r)).phase,'aborted');await rejects(()=>p.client.recover(r));assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,0)});
await check('completed old checkout late fact cannot restore old URL after new operation owns lane',async()=>{const p=providerFixture(),r=request();await p.client.create(r);const ticket=await checkoutStore.captureCheckoutReadyRead(db,r),raw=p.sessions.get(ticket.capability.sessionId);raw.status='expired';raw.url=null;await rejects(()=>p.client.authorizeReadyRead(r));const nextRequest=request({terms:{...r.terms,expiresAt:expiry+300}}),next=await checkoutStore.admitCheckoutLifecycle(db,nextRequest);assert(next.claim);const old=await p.adapter.reconcileCheckout(ticket.plan,ticket.dispatch,raw.id);await checkoutStore.ingestCorrelatedCheckoutLateFact(db,old);const pointer=JSON.parse((await keyRow(state.lifecycleFenceKey(target))).value);assert.equal(pointer.operationId,nextRequest.identity.operationId);const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId))).value);assert.equal(cap.url,null);assert.equal(cap.status,'expired');assert.equal(p.counts.checkoutCreate,1)});
await check('late fact and finalization revision guard share User then index order without losing a new exact subscription',async()=>{const p=providerFixture(),r=request();await p.client.create(r);const ticket=await checkoutStore.captureCheckoutReadyRead(db,r),retirement=await store.reserveLifecycleOperation(db,identity('retirement'),digest);await store.prepareLifecycleActions(db,retirement.claim,[]);await store.startLifecycleOperation(db,retirement.claim);const raw=p.sessions.get(ticket.capability.sessionId);raw.status='complete';raw.customer='cus_final';raw.subscription='sub_final';raw.url=null;const fact=await p.adapter.reconcileCheckout(ticket.plan,ticket.dispatch,raw.id),seen=defer(),release=defer();const guard=db.$transaction(async tx=>{const proof=await checkoutStore.assertCheckoutRetirementFactRevision(tx,retirement.claim,ticket.indexRevision);assert.equal(proof.closureProved,false);seen.resolve();await release.promise},{timeout:5000});await seen.promise;let done=false;const recording=checkoutStore.ingestCorrelatedCheckoutLateFact(db,fact).then(x=>{done=true;return x});let waiting=false;for(let n=0;n<100;n++){const rows=await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_stat_activity WHERE usename='doya_checkout' AND wait_event_type='Lock' AND query LIKE '%User%FOR UPDATE%'");if(rows[0].count){waiting=true;break}await new Promise(r=>setTimeout(r,10))}assert(waiting);assert.equal(done,false);release.resolve();await guard;await recording;await rejects(()=>db.$transaction(tx=>checkoutStore.assertCheckoutRetirementFactRevision(tx,retirement.claim,ticket.indexRevision)));const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(ticket.plan.targetHash))).value);assert(index.resources.some(x=>x.id==='sub_final'));assert(index.dirty);assert(await db.user.findUnique({where:{id:target}}))});
await check('legacy open is adopted atomically and same input reuses only the exact session',async()=>{
 const p=providerFixture(),r=request(),old=await legacyReady(p,r),result=await p.client.legacyReady(r,old.parts);
 assert.equal(result.id,old.sessionId);assert.equal(result.url,old.url);assert.equal(p.counts.checkoutCreate,0);
 const mapped=await keyRow(checkoutReceipt.checkoutKeys.legacyMapping(state.lifecycleSubject(target),'test'));
 const cap=await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId));
 assert(mapped&&cap);assert.equal((await keyRow(`checkout-reservation:v1:test:${target}`)).value.includes('"phase":"migrated"'),true);
 assert.equal((await db.systemSetting.updateMany({where:{key:`checkout-reservation:v1:test:${target}`,value:old.raw},data:{value:'late-old-worker'}})).count,0);
 const replay=request();assert.equal((await p.client.legacyReady(replay,legacyParts(replay))).id,old.sessionId);
 await rejects(()=>p.client.create(replay));assert.equal(p.counts.checkoutCreate,0)
});
await check('legacy ready rejects changed input without a new Checkout',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const changed=request({terms:{...r.terms,priceId:'price_other'}});await rejects(()=>p.client.legacyReady(changed,legacyParts(changed)));assert.equal(p.counts.checkoutCreate,0)});
await check('legacy generic source signature matches actual undefined trialDays property',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),sourceParts={...old.parts,trialDays:undefined};assert.equal(checkoutLegacy.verifiedLegacySignature(r,sourceParts),JSON.parse(old.raw).signature);assert.equal((await p.client.legacyReady(r,sourceParts)).id,old.sessionId)});
await check('legacy signature canonicalizes source literal property order',async()=>{const r=request(),parts=legacyParts(r),reordered={cancelUrl:parts.cancelUrl,email:parts.email,service:parts.service,priceId:parts.priceId,successUrl:parts.successUrl,planId:parts.planId};assert.equal(checkoutLegacy.verifiedLegacySignature(r,reordered),crypto.createHash('sha256').update(JSON.stringify({...parts,trialDays:undefined})).digest('hex'))});
for(const status of ['expired','complete'])await check('legacy '+status+' adoption records terminal capability and blocks new operation',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r,status);await rejects(()=>p.client.legacyReady(r,old.parts));const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId))).value),index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);assert.equal(cap.status,status);assert.equal(cap.url,null);assert(index.resources.some(x=>x.id===old.sessionId));if(status==='complete')assert(index.resources.some(x=>x.id==='sub_legacy'));await rejects(()=>p.client.create(request()));assert.equal(p.counts.checkoutCreate,0)});
await check('legacy adoption response loss reuses saved mapping without duplicate capability',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),ticket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),fact=await p.adapter.readLegacyReady(r,ticket.sessionId,ticket.rawHash,ticket.signature);await checkoutStore.adoptLegacyCheckoutReady(db,r,ticket,fact,old.parts);const before=await stateRows(),replay=request();assert.equal((await p.client.legacyReady(replay,legacyParts(replay))).id,old.sessionId);assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0)});
await check('parallel legacy adoption uses one raw CAS and one mapping',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),first=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),secondTicket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),fact=await p.adapter.readLegacyReady(r,first.sessionId,first.rawHash,first.signature);await checkoutStore.adoptLegacyCheckoutReady(db,r,first,fact,old.parts);await rejects(()=>checkoutStore.adoptLegacyCheckoutReady(db,r,secondTicket,fact,old.parts));assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),1);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-capability:v2:'}}}),1)});
await check('legacy capability write failure rolls back tombstone mapping and index',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);let once=true;const faulty={$transaction:(fn,opts)=>db.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='systemSetting')return new Proxy(t.systemSetting,{get(m,n){if(n==='create')return args=>{if(once&&args.data.key.startsWith('doya-checkout-capability:v2:')){once=false;throw Error('Synthetic capability write failure')}return m.create(args)};return Reflect.get(m,n)}});return Reflect.get(t,k)}})),opts)};await rejects(()=>coordinator.checkoutCoordinator(faulty,p.adapter).legacyReady(r,old.parts));assert.equal((await keyRow(`checkout-reservation:v1:test:${target}`)).value,old.raw);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),0);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-capability:v2:'}}}),0);assert.equal((await p.client.legacyReady(r,old.parts)).id,old.sessionId)});
for(const field of ['livemode','client_reference_id','price','metadata','return_url','sessionId'])await check('legacy provider exact read rejects wrong '+field,async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),raw=p.sessions.get(old.sessionId);if(field==='livemode')raw.livemode=true;else if(field==='client_reference_id')raw.client_reference_id=second;else if(field==='price')raw.line_items.data[0].price.id='price_other';else if(field==='metadata')raw.metadata.planId='wrong';else if(field==='return_url')raw.success_url='https://other.example.invalid';else raw.id='cs_other';await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal((await keyRow(`checkout-reservation:v1:test:${target}`)).value,old.raw);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),0);assert.equal(p.counts.checkoutCreate,0)});
for(const value of ['{broken',JSON.stringify({phase:'creating',signature:'old',idempotencyKey:'old',createdAt:1,leaseUntil:2,expiresAt:3})])await check('malformed or creating legacy row remains closed to adoption '+cases.length,async()=>{const p=providerFixture(),r=request(),parts=legacyParts(r);await db.systemSetting.create({data:{key:`checkout-reservation:v1:test:${target}`,value}});await rejects(()=>p.client.legacyReady(r,parts));assert.equal(p.counts.checkoutRead,0);assert.equal(p.counts.checkoutCreate,0)});
await check('missing cutover evidence blocks legacy adoption before provider read',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await db.systemSetting.delete({where:{key:checkoutReceipt.checkoutKeys.cutover('test')}});await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal(p.counts.checkoutRead,0)});
await check('legacy retrieve wait sees retirement fence and cannot adopt or authorize a URL',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.legacyReady(r,old.parts).then(()=>null,error=>error);await seen.promise;const retiring=await store.reserveLifecycleOperation(db,identity('retirement'),digest);assert(retiring.claim);release.resolve();assert(await reading instanceof Error);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),0);assert.equal(p.counts.checkoutCreate,0)});
await check('legacy retrieve wait rejects changed index revision before adoption',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.legacyReady(r,old.parts).then(()=>null,error=>error);await seen.promise;await db.systemSetting.create({data:{key:checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)),value:JSON.stringify({version:1,targetHash:state.lifecycleSubject(target),revision:1,currentOperationId:null,dirty:false,notifiedRetirement:null,resources:[]})}});release.resolve();assert(await reading instanceof Error);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),0)});
await check('legacy retrieve wait rejects changed v1 raw hash before adoption',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.legacyReady(r,old.parts).then(()=>null,error=>error);await seen.promise;await db.systemSetting.update({where:{key:`checkout-reservation:v1:test:${target}`},data:{value:JSON.stringify({...JSON.parse(old.raw),url:'https://other.example.invalid'})}});release.resolve();assert(await reading instanceof Error);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),0)});
await check('mapped legacy open becomes complete with exact subscription and no URL restoration',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const raw=p.sessions.get(old.sessionId);raw.status='complete';raw.customer='cus_legacy';raw.subscription='sub_legacy';raw.url=null;await rejects(()=>p.client.legacyReady(r,old.parts));const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId))).value),index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);assert.equal(cap.status,'complete');assert.equal(cap.url,null);assert(index.resources.some(x=>x.id==='sub_legacy'));const before=await stateRows();await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before)});
await check('new binary v1 reservation export cannot touch owned PostgreSQL or provider',async()=>{const helper=load('src/lib/checkout-reservation.ts'),before=await stateRows();let providerWrites=0,providerReads=0;await assert.rejects(helper.createReservedCheckoutSession({userId:target,signatureParts:{phase:'creating',expiresAt:1},create:async()=>{providerWrites++;throw Error('provider create prohibited')}},db,async()=>{providerReads++;throw Error('provider read prohibited')}),e=>e.code==='CHECKOUT_LEGACY_ENTRY_CLOSED'&&e.status===503);assert.deepEqual(await stateRows(),before);assert.equal(providerWrites,0);assert.equal(providerReads,0)});
await check('legacy ready v1 reader can still return its already-read URL after adoption',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),legacyModule=load('scripts/security-regression/fixtures/checkout-reservation-v1-91f5c8af.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:db},'@/lib/stripe':{stripe:{checkout:{sessions:{retrieve:async()=>{throw Error('unused')}}}}}}),seen=defer(),release=defer(),previous=process.env.STRIPE_SECRET_KEY;process.env.STRIPE_SECRET_KEY='sk_test_synthetic';try{const oldReading=legacyModule.createReservedCheckoutSession({userId:target,signatureParts:old.parts,create:async()=>{throw Error('unexpected legacy write')}},db,async id=>{assert.equal(id,old.sessionId);seen.resolve();await release.promise;return{id,status:'open',url:old.url}});await seen.promise;assert.equal((await p.client.legacyReady(r,old.parts)).id,old.sessionId);release.resolve();assert.equal((await oldReading).url,old.url);assert.equal((await db.systemSetting.updateMany({where:{key:`checkout-reservation:v1:test:${target}`,value:old.raw},data:{value:'late-old-worker'}})).count,0)}finally{if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous}});
await check('mapped legacy ready read rejects retirement after provider wait',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.legacyReady(r,old.parts).then(()=>null,error=>error);await seen.promise;const retiring=await store.reserveLifecycleOperation(db,identity('retirement'),digest);assert(retiring.claim);release.resolve();assert(await reading instanceof Error);assert.equal(p.counts.checkoutCreate,0)});
await check('mapped legacy ready read rejects index revision change after provider wait',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.legacyReady(r,old.parts).then(()=>null,error=>error);await seen.promise;const key=checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)),row=await keyRow(key);await db.systemSetting.update({where:{key},data:{value:JSON.stringify({...JSON.parse(row.value),revision:JSON.parse(row.value).revision+1})}});release.resolve();assert(await reading instanceof Error)});
for(const field of ['operationId','mode'])await check('mapped legacy corrupted capability '+field+' returns no URL',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const key=checkoutReceipt.checkoutKeys.capability(r.identity.operationId),row=await keyRow(key),cap=JSON.parse(row.value);cap[field]=field==='operationId'?crypto.randomUUID():'live';await db.systemSetting.update({where:{key},data:{value:JSON.stringify(cap)}});const reads=p.counts.checkoutRead;await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal(p.counts.checkoutRead,reads)});
await check('mapped legacy rejects a verified fact for a foreign target before URL authorization',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const ticket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),foreign=request({identity:identity('checkout',second,crypto.randomUUID(),{kind:'user',id:second})}),raw=p.sessions.get(old.sessionId);raw.client_reference_id=second;raw.metadata.userId=second;const fact=await p.adapter.readLegacyReady(foreign,old.sessionId,ticket.rawHash,ticket.signature);assert.equal(fact.inputDigest,ticket.plan.inputDigest);assert.notEqual(fact.targetHash,ticket.plan.targetHash);await rejects(()=>checkoutStore.authorizeLegacyCheckoutReady(db,r,ticket,fact));assert.equal(p.counts.checkoutCreate,0)});
await check('mapped legacy rejects a verified fact for another provider mode',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const ticket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),foreign=request({mode:'live'}),raw=p.sessions.get(old.sessionId);raw.livemode=true;const fact=await p.adapter.readLegacyReady(foreign,old.sessionId,ticket.rawHash,ticket.signature);assert.equal(fact.mode,'live');await rejects(()=>checkoutStore.authorizeLegacyCheckoutReady(db,r,ticket,fact));assert.equal(p.counts.checkoutCreate,0)});
await check('mapped legacy rejects a verified HR fact for generic source',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const ticket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),{org}=await seedOrg('hr'),baseUrl='https://example.invalid',foreign=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:'cus_hr_legacy',terms:{...r.terms,planId:'hr-pro',serviceId:'hr',successUrl:`${baseUrl}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${baseUrl}/hr/settings/billing`}}),raw=p.sessions.get(old.sessionId);raw.metadata={userId:target,planId:'hr-pro',serviceId:'hr'};raw.customer='cus_hr_legacy';raw.success_url=foreign.terms.successUrl;raw.cancel_url=foreign.terms.cancelUrl;const fact=await p.adapter.readLegacyReady(foreign,old.sessionId,ticket.rawHash,ticket.signature);assert.equal(fact.source,'hr');await rejects(()=>checkoutStore.authorizeLegacyCheckoutReady(db,r,ticket,fact));assert.equal(p.counts.checkoutCreate,0)});
await check('HR legacy source signature and exact owner/customer mapping are adopted',async()=>{
 const p=providerFixture(),{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});await db.user.update({where:{id:target},data:{stripeCustomerId:'cus_hr_legacy'}});
 const baseUrl='https://example.invalid',r=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:'cus_hr_legacy',terms:{...request().terms,planId:'hr-pro',serviceId:'hr',successUrl:`${baseUrl}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${baseUrl}/hr/settings/billing`}});
 const parts={priceId:r.terms.priceId,plan:'pro',interval:'monthly',stripeCustomerId:'cus_hr_legacy',baseUrl},signature=checkoutLegacy.verifiedLegacySignature(r,parts),sessionId='cs_hr_legacy',url='https://checkout.example.invalid/hr-legacy';
 await db.systemSetting.create({data:{key:`checkout-reservation:v1:test:${target}`,value:JSON.stringify({phase:'ready',signature,sessionId,url,expiresAt:r.terms.expiresAt})}});
 p.sessions.set(sessionId,{id:sessionId,livemode:false,mode:'subscription',status:'open',client_reference_id:target,metadata:{userId:target,planId:'hr-pro',serviceId:'hr'},customer:'cus_hr_legacy',customer_email:null,subscription:null,url,success_url:r.terms.successUrl,cancel_url:r.terms.cancelUrl,expires_at:r.terms.expiresAt,line_items:{data:[{quantity:1,price:{id:r.terms.priceId}}]}});
 assert.equal((await p.client.legacyReady(r,parts)).id,sessionId);assert.equal(p.counts.checkoutCreate,0);
});
await check('HR legacy owner loss during retrieve blocks mapping and URL',async()=>{
 const p=providerFixture(),{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});await db.user.update({where:{id:target},data:{stripeCustomerId:'cus_hr_legacy'}});
 const baseUrl='https://example.invalid',r=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:'cus_hr_legacy',terms:{...request().terms,planId:'hr-pro',serviceId:'hr',successUrl:`${baseUrl}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${baseUrl}/hr/settings/billing`}}),parts={priceId:r.terms.priceId,plan:'pro',interval:'monthly',stripeCustomerId:'cus_hr_legacy',baseUrl},signature=checkoutLegacy.verifiedLegacySignature(r,parts),sessionId='cs_hr_legacy',url='https://checkout.example.invalid/hr-legacy';
 await db.systemSetting.create({data:{key:`checkout-reservation:v1:test:${target}`,value:JSON.stringify({phase:'ready',signature,sessionId,url,expiresAt:r.terms.expiresAt})}});
 p.sessions.set(sessionId,{id:sessionId,livemode:false,mode:'subscription',status:'open',client_reference_id:target,metadata:{userId:target,planId:'hr-pro',serviceId:'hr'},customer:'cus_hr_legacy',customer_email:null,subscription:null,url,success_url:r.terms.successUrl,cancel_url:r.terms.cancelUrl,expires_at:r.terms.expiresAt,line_items:{data:[{quantity:1,price:{id:r.terms.priceId}}]}});
 const seen=defer(),release=defer();p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};const reading=p.client.legacyReady(r,parts).then(()=>null,error=>error),secondDb=new PrismaClient({datasources:{db:{url:`postgresql://doya_checkout@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=checkout_fixture`}}});try{await seen.promise;await secondDb.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}})}finally{release.resolve();await secondDb.$disconnect()}assert(await reading instanceof Error);assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-legacy-mapping:v2:'}}}),0);assert.equal(p.counts.checkoutCreate,0)
});
await check('unknown legacy mode is rejected before provider or database access',async()=>{const p=providerFixture(),r=request({mode:'unknown'}),parts=legacyParts(r);await rejects(()=>p.client.legacyReady(r,parts));assert.equal(p.counts.checkoutRead,0);assert.equal(p.counts.checkoutCreate,0)});
await check('terminal fact cannot replace known legacy customer or index resource',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),raw=p.sessions.get(old.sessionId);raw.customer='cus_A';await p.client.legacyReady(r,old.parts);const before=await stateRows();raw.status='complete';raw.customer='cus_B';raw.subscription='sub_B';raw.url=null;await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before)});
await check('foreign lifecycle receipt UUID cannot gain legacy capability',async()=>{const p=providerFixture(),shared=crypto.randomUUID();await store.reserveLifecycleOperation(db,identity('retirement',target,shared),digest);const r=request({identity:identity('checkout',second,shared,{kind:'user',id:second}),terms:{...request().terms,email:second+'@example.invalid'}}),old=await legacyReady(p,r),before=await stateRows();await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(shared)),null)});
for(const customer of ['cus_B',null])await check('expired legacy fact cannot replace known customer with '+customer,async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),raw=p.sessions.get(old.sessionId);raw.customer='cus_A';await p.client.legacyReady(r,old.parts);const before=await stateRows();raw.status='expired';raw.customer=customer;raw.url=null;await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before)});
await check('open legacy capability with subscription is rejected before provider read',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const key=checkoutReceipt.checkoutKeys.capability(r.identity.operationId),cap=JSON.parse((await keyRow(key)).value);cap.subscriptionId='sub_A';await db.systemSetting.update({where:{key},data:{value:JSON.stringify(cap)}});const reads=p.counts.checkoutRead;await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal(p.counts.checkoutRead,reads)});
await check('unknown customer becomes exact complete customer and subscription once',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const raw=p.sessions.get(old.sessionId);raw.status='complete';raw.customer='cus_A';raw.subscription='sub_A';raw.url=null;await rejects(()=>p.client.legacyReady(r,old.parts));const after=await stateRows(),cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId))).value);assert.equal(cap.customerId,'cus_A');assert.equal(cap.subscriptionId,'sub_A');await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),after);raw.customer='cus_B';raw.subscription='sub_B';await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),after)});
for(const status of ['expired','complete'])await check('known matching customer can become '+status,async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r),raw=p.sessions.get(old.sessionId);raw.customer='cus_A';await p.client.legacyReady(r,old.parts);raw.status=status;raw.url=null;if(status==='complete')raw.subscription='sub_A';await rejects(()=>p.client.legacyReady(r,old.parts));const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(r.identity.operationId))).value);assert.equal(cap.status,status);assert.equal(cap.customerId,'cus_A')});
for(const kind of ['checkout','retirement'])await check('same-target existing '+kind+' receipt UUID blocks legacy adoption',async()=>{const p=providerFixture(),shared=crypto.randomUUID(),id=identity(kind,target,shared,kind==='checkout'?{kind:'user',id:target}:{kind:'admin',id:'synthetic_admin_principal'});await store.reserveLifecycleOperation(db,id,digest);const r=request({identity:{...request().identity,operationId:shared}}),old=await legacyReady(p,r);await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(shared)),null)});
await check('plan-only and capability-only global UUID collisions reject legacy adoption',async()=>{for(const namespace of ['plan','capability']){await reset();const p=providerFixture(),r=request(),old=await legacyReady(p,r),key=checkoutReceipt.checkoutKeys[namespace](r.identity.operationId);await db.systemSetting.create({data:{key,value:'synthetic-orphan'}});const before=await stateRows();await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before)}});
await check('legacy-first UUID blocks later ordinary lifecycle reservation',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);await rejects(()=>store.reserveLifecycleOperation(db,identity('retirement',second,r.identity.operationId),digest));assert.equal(await keyRow(`doya-account-operation:v2:${r.identity.operationId}`),null)});
await check('parallel legacy and ordinary reservation admit only one global UUID',async()=>{const p=providerFixture(),shared=crypto.randomUUID(),r=request({identity:{...request().identity,operationId:shared}}),old=await legacyReady(p,r),results=await Promise.allSettled([p.client.legacyReady(r,old.parts),store.reserveLifecycleOperation(db,identity('retirement',second,shared),digest)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await db.systemSetting.count({where:{key:{in:[`doya-account-operation:v2:${shared}`,checkoutReceipt.checkoutKeys.capability(shared)]}}})),1)});
for(const kind of ['retirement','checkout'])await check('aborted same-target '+kind+' UUID cannot become legacy capability',async()=>{const p=providerFixture(),shared=crypto.randomUUID(),id=identity(kind,target,shared,{kind:'admin',id:'synthetic_admin_principal'});await store.reserveLifecycleOperation(db,id,digest);await store.abortUnstartedLifecycleOperation(db,id,digest);const r=request({identity:{...request().identity,operationId:shared}}),old=await legacyReady(p,r),before=await stateRows();await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before)});
await check('aborted other-actor checkout UUID cannot become legacy capability',async()=>{const p=providerFixture(),shared=crypto.randomUUID(),id=identity('checkout',target,shared,{kind:'admin',id:actor});await store.reserveLifecycleOperation(db,id,digest);await store.abortUnstartedLifecycleOperation(db,id,digest);const r=request({identity:{...request().identity,operationId:shared}}),old=await legacyReady(p,r);await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(shared)),null)});
await check('legacy-first UUID blocks ordinary checkout admission for another User',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);const other=request({identity:identity('checkout',second,r.identity.operationId,{kind:'user',id:second}),terms:{...r.terms,email:second+'@example.invalid'}});await rejects(()=>checkoutStore.admitCheckoutLifecycle(db,other));assert.equal(await keyRow(`doya-account-operation:v2:${r.identity.operationId}`),null)});
await check('legacy-first UUID blocks receipt creation by abort without reservation',async()=>{const p=providerFixture(),r=request(),old=await legacyReady(p,r);await p.client.legacyReady(r,old.parts);await rejects(()=>store.abortUnstartedLifecycleOperation(db,identity('retirement',second,r.identity.operationId),digest));assert.equal(await keyRow(`doya-account-operation:v2:${r.identity.operationId}`),null)});
await check('ordinary checkout-first UUID blocks foreign legacy adoption',async()=>{const p=providerFixture(),shared=crypto.randomUUID(),ordinary=request({identity:{...request().identity,operationId:shared}});await checkoutStore.admitCheckoutLifecycle(db,ordinary);const r=request({identity:identity('checkout',second,shared,{kind:'user',id:second}),terms:{...ordinary.terms,email:second+'@example.invalid'}}),old=await legacyReady(p,r);await rejects(()=>p.client.legacyReady(r,old.parts));assert.equal(await keyRow(checkoutReceipt.checkoutKeys.capability(shared)),null)});
await check('parallel ordinary checkout admission and legacy adoption share UUID lock',async()=>{const p=providerFixture(),shared=crypto.randomUUID(),ordinary=request({identity:{...request().identity,operationId:shared}}),r=request({identity:identity('checkout',second,shared,{kind:'user',id:second}),terms:{...ordinary.terms,email:second+'@example.invalid'}}),old=await legacyReady(p,r),results=await Promise.allSettled([checkoutStore.admitCheckoutLifecycle(db,ordinary),p.client.legacyReady(r,old.parts)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(await db.systemSetting.count({where:{key:{in:[`doya-account-operation:v2:${shared}`,checkoutReceipt.checkoutKeys.capability(shared)]}}}),1)});
async function seedOrphanLedger(shape,shared){if(shape==='malformed'){await db.systemSetting.create({data:{key:`doya-account-action:v2:${shared}`,value:'{broken'}});return}const id=identity('retirement',target,shared),old=await store.reserveLifecycleOperation(db,id,digest);await store.prepareLifecycleActions(db,old.claim,[resource()]);await db.systemSetting.delete({where:{key:state.lifecycleReceiptKey(id)}});await db.systemSetting.delete({where:{key:state.lifecycleFenceKey(target)}})}
for(const shape of ['same-target-old-generation','foreign-target','malformed'])for(const creator of ['reserve','abort','admit','legacy'])await check('ledger-only '+shape+' UUID rejects '+creator+' before mutation',async()=>{const shared=crypto.randomUUID();await seedOrphanLedger(shape,shared);const user=shape==='foreign-target'?second:target,p=providerFixture(),id=identity('checkout',user,shared,{kind:'user',id:user}),r=request({identity:id,terms:{...request().terms,email:user+'@example.invalid'}}),old=creator==='legacy'?await legacyReady(p,r):null,before=await stateRows();if(creator==='reserve')await rejects(()=>store.reserveLifecycleOperation(db,identity('retirement',user,shared),digest));else if(creator==='abort')await rejects(()=>store.abortUnstartedLifecycleOperation(db,identity('retirement',user,shared),digest));else if(creator==='admit')await rejects(()=>checkoutStore.admitCheckoutLifecycle(db,r));else await rejects(()=>p.client.legacyReady(r,old.parts));assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);assert.equal(p.counts.customerCreate,0)});
// C1 fact-only namespace must block each actual Checkout creator, not only the generic reserve helper.
for(const shape of ['complete','malformed'])for(const creator of ['admit','legacy-adopt','expired-legacy-next'])await check('C1 fact-only '+shape+' UUID rejects actual '+creator+' with DB mutation zero',async()=>{
 const p=providerFixture(),shared=crypto.randomUUID();
 if(creator==='admit'){
  const r=request({identity:identity('checkout',target,shared,{kind:'user',id:target})});
  await db.systemSetting.create({data:{key:`doya-subscription-fact:v1:${shared}:${'a'.repeat(64)}`,value:subscriptionFactOnly(shared,shape)}});
  const before=await stateRows();await assert.rejects(()=>checkoutStore.admitCheckoutLifecycle(db,r),e=>e.code==='LIFECYCLE_IDENTITY_CONFLICT');assert.deepEqual(await stateRows(),before);
 }else if(creator==='legacy-adopt'){
  const r=request({identity:identity('checkout',target,shared,{kind:'user',id:target})}),old=await legacyReady(p,r),ticket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),fact=await p.adapter.readLegacyReady(r,ticket.sessionId,ticket.rawHash,ticket.signature);
  await db.systemSetting.create({data:{key:`doya-subscription-fact:v1:${shared}:${'a'.repeat(64)}`,value:subscriptionFactOnly(shared,shape)}});
  const before=await stateRows();await assert.rejects(()=>checkoutStore.adoptLegacyCheckoutReady(db,r,ticket,fact,old.parts),e=>e.code==='LIFECYCLE_IDENTITY_CONFLICT');assert.deepEqual(await stateRows(),before);
  assert.equal((await keyRow(`checkout-reservation:v1:test:${target}`)).value,old.raw);
 }else{
  const previous=request(),old=await legacyReady(p,previous,'expired');await rejects(()=>p.client.legacyReady(previous,old.parts));
  const next=request({identity:identity('checkout',target,shared,{kind:'user',id:target}),terms:{...previous.terms,expiresAt:expiry+600}}),ticket=await checkoutStore.captureLegacyCheckoutReady(db,previous,old.parts),fact=await p.adapter.readLegacyReady(previous,ticket.sessionId,ticket.rawHash,ticket.signature);
  await db.systemSetting.create({data:{key:`doya-subscription-fact:v1:${shared}:${'a'.repeat(64)}`,value:subscriptionFactOnly(shared,shape)}});
  const before=await stateRows();await assert.rejects(()=>checkoutStore.admitAfterExpiredLegacyCheckout(db,previous,next,ticket,fact),e=>e.code==='LIFECYCLE_IDENTITY_CONFLICT');assert.deepEqual(await stateRows(),before);
  assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(shared)),null);
 }
 assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,0);
});
for(const namespace of ['adminPlan','adminFact','adminSettlement','selfRequirement','selfCoverage'])for(const shape of ['complete','malformed'])for(const creator of ['admit','legacy-adopt','expired-legacy-next'])await check('C3a '+namespace+' orphan '+shape+' rejects actual Checkout '+creator+' mutation zero',async()=>{
 const p=providerFixture(),shared=crypto.randomUUID(),orphan=c3aOrphan(namespace,shared,shape);
 if(creator==='admit'){
  const r=request({identity:identity('checkout',target,shared,{kind:'user',id:target})});
  await db.systemSetting.create({data:orphan});const before=await stateRows();
  await assert.rejects(()=>checkoutStore.admitCheckoutLifecycle(db,r),e=>e.code==='LIFECYCLE_IDENTITY_CONFLICT');assert.deepEqual(await stateRows(),before);
 }else if(creator==='legacy-adopt'){
  const r=request({identity:identity('checkout',target,shared,{kind:'user',id:target})}),old=await legacyReady(p,r),ticket=await checkoutStore.captureLegacyCheckoutReady(db,r,old.parts),fact=await p.adapter.readLegacyReady(r,ticket.sessionId,ticket.rawHash,ticket.signature);
  await db.systemSetting.create({data:orphan});const before=await stateRows();
  await assert.rejects(()=>checkoutStore.adoptLegacyCheckoutReady(db,r,ticket,fact,old.parts),e=>e.code==='LIFECYCLE_IDENTITY_CONFLICT');assert.deepEqual(await stateRows(),before);
  assert.equal((await keyRow(`checkout-reservation:v1:test:${target}`)).value,old.raw);
 }else{
  const previous=request(),old=await legacyReady(p,previous,'expired');await rejects(()=>p.client.legacyReady(previous,old.parts));
  const next=request({identity:identity('checkout',target,shared,{kind:'user',id:target}),terms:{...previous.terms,expiresAt:expiry+600}}),ticket=await checkoutStore.captureLegacyCheckoutReady(db,previous,old.parts),fact=await p.adapter.readLegacyReady(previous,ticket.sessionId,ticket.rawHash,ticket.signature);
  await db.systemSetting.create({data:orphan});const before=await stateRows();
  await assert.rejects(()=>checkoutStore.admitAfterExpiredLegacyCheckout(db,previous,next,ticket,fact),e=>e.code==='LIFECYCLE_IDENTITY_CONFLICT');assert.deepEqual(await stateRows(),before);
  assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(shared)),null);
 }
 assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,0);
});
await check('C1 parallel actual Checkout and Subscription creators share global UUID lock',async()=>{
 const shared=crypto.randomUUID(),checkout=request({identity:identity('checkout',target,shared,{kind:'user',id:target})});
 const subscription=subscriptionPlan.makeSubscriptionPlan({identity:identity('cancel',second,shared,{kind:'user',id:second}),mode:'test',email:second+'@example.invalid',expectedCustomerId:null,expectedSubscriptionId:null,serviceId:'banner',cancelMode:'period_end',targets:[{id:'sub_synthetic',customerId:'cus_synthetic',status:'active',cancelAtPeriodEnd:false,currentPeriodEnd:1900000000}]});
 // Hold the exact advisory UUID lock until both actual creator transactions are observed waiting on it.
 const acquired=defer(),release=defer();
 const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${shared})::bigint)`;acquired.resolve();await release.promise},{timeout:10000});
 await acquired.promise;
 const pending=Promise.allSettled([checkoutStore.admitCheckoutLifecycle(db,checkout),store.admitSubscriptionLifecycle(db,subscription)]);
 let waiting=0;
 try{
  for(let n=0;n<200;n++){
   const rows=await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND a.usename='doya_checkout' AND a.query LIKE '%pg_advisory_xact_lock%'");
   waiting=rows[0].count;if(waiting>=2)break;await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(waiting,2,'both actual creators must reach the same advisory UUID lock');
 }finally{release.resolve();await blocker}
 const outcome=await pending;
 assert.equal(outcome.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcome.find(x=>x.status==='rejected').reason.code,'LIFECYCLE_IDENTITY_CONFLICT');
 assert.equal(await db.systemSetting.count({where:{key:{in:[`doya-account-operation:v2:${shared}`,checkoutReceipt.checkoutKeys.plan(shared),subscriptionPlan.subscriptionPlanKey(shared)]}}}),2);
 const checkoutPlan=await keyRow(checkoutReceipt.checkoutKeys.plan(shared)),subscriptionRow=await keyRow(subscriptionPlan.subscriptionPlanKey(shared));
 assert.equal(Boolean(checkoutPlan)+Boolean(subscriptionRow),1);
});
await check('C3a admin and Checkout actual creators wait on one UUID and leave one plan/fence',async()=>{
 const shared=crypto.randomUUID(),checkout=request({identity:identity('checkout',target,shared,{kind:'user',id:target})});
 await db.user.update({where:{id:second},data:{stripeSubscriptionId:'sub_synthetic'}});
 const admin=makeAdminPlan(shared,second),acquired=defer(),release=defer();
 const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${shared})::bigint)`;acquired.resolve();await release.promise},{timeout:10000});
 await acquired.promise;
 const pending=Promise.allSettled([checkoutStore.admitCheckoutLifecycle(db,checkout),adminStore.admitAdminSubscriptionLifecycle(db,admin,'synthetic-test-token')]);
 let waiting=0;
 try{
  for(let n=0;n<200;n++){
   const rows=await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND a.usename='doya_checkout' AND a.query LIKE '%pg_advisory_xact_lock%'");
   waiting=rows[0].count;if(waiting>=2)break;await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(waiting,2,'both actual creators reached the same advisory UUID lock');
 }finally{release.resolve();await blocker}
 const outcome=await pending;
 assert.equal(outcome.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcome.find(x=>x.status==='rejected').reason.code,'LIFECYCLE_IDENTITY_CONFLICT');
 assert.equal(await db.systemSetting.count({where:{key:{in:[`doya-account-operation:v2:${shared}`,checkoutReceipt.checkoutKeys.plan(shared),adminSubscriptionPlan.adminSubscriptionPlanKey(shared)]}}}),2);
 assert.equal(Number(Boolean(await keyRow(checkoutReceipt.checkoutKeys.plan(shared))))+Number(Boolean(await keyRow(adminSubscriptionPlan.adminSubscriptionPlanKey(shared)))),1);
 assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-account-fence:v2:'}}}),1);
});
await check('B1 expired legacy switches atomically to one ordinary Checkout and preserves history',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}});
 const result=await p.client.advanceAfterTerminal(previous,next,old.parts);
 assert.match(result.id,/^cs_synthetic_/);assert.equal(p.counts.checkoutCreate,1);
 const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);
 assert.equal(index.currentOperationId,next.identity.operationId);
 assert(index.resources.some(x=>x.id===old.sessionId&&x.operationId===previous.identity.operationId));
 assert(index.resources.some(x=>x.id===result.id&&x.operationId===next.identity.operationId));
 assert((await keyRow(`checkout-reservation:v1:test:${target}`)).value.includes('"phase":"migrated"'));
 assert(await keyRow(checkoutReceipt.checkoutKeys.legacyMapping(state.lifecycleSubject(target),'test')));
 assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(previous.identity.operationId)),null);
 const replay=request({terms:{...next.terms}}),again=await p.client.advanceAfterTerminal(previous,replay,old.parts);
 assert.equal(again.id,result.id);assert.equal(p.counts.checkoutCreate,1);
});
for(const damage of ['subscription','resource'])await check('B1 moved legacy '+damage+' corruption blocks current recovery',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),result=await p.client.advanceAfterTerminal(previous,next,old.parts);
 assert(result.id);const key=damage==='subscription'?checkoutReceipt.checkoutKeys.capability(previous.identity.operationId):checkoutReceipt.checkoutKeys.resource('test','checkout',old.sessionId);
 const row=await keyRow(key),value=JSON.parse(row.value);
 await db.systemSetting.update({where:{key},data:{value:JSON.stringify(damage==='subscription'?{...value,subscriptionId:'sub_foreign'}:{...value,targetHash:'0'.repeat(64)})}});
 const before=await stateRows(),reads=p.counts.checkoutRead;
 await rejects(()=>p.client.advanceAfterTerminal(previous,request({terms:{...next.terms}}),old.parts));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutRead,reads);assert.equal(p.counts.checkoutCreate,1);
});
await check('B1 complete legacy refuses a second purchase and keeps exact subscription',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'complete'),next=request({terms:{...previous.terms,expiresAt:expiry+600}});
 await rejects(()=>p.client.advanceAfterTerminal(previous,next,old.parts));
 const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(previous.identity.operationId))).value);
 assert.equal(cap.status,'complete');assert.equal(cap.subscriptionId,'sub_legacy');
 assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);
 assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 ordinary expired Checkout uses exact retrieve before new UUID admission',async()=>{
 const p=providerFixture(),previous=request(),initial=await p.client.create(previous),raw=p.sessions.get(initial.id);
 raw.status='expired';raw.url=null;
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),result=await p.client.advanceAfterTerminal(previous,next);
 assert.notEqual(result.id,initial.id);assert.equal(p.counts.checkoutCreate,2);
 const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);
 assert.equal(index.currentOperationId,next.identity.operationId);
 assert(index.resources.some(x=>x.id===initial.id&&x.operationId===previous.identity.operationId));
});
await check('B1 ordinary complete Checkout records exact subscription but does not unlock repurchase',async()=>{
 const p=providerFixture(),previous=request(),initial=await p.client.create(previous),raw=p.sessions.get(initial.id);
 raw.status='complete';raw.customer='cus_exact';raw.subscription='sub_exact';raw.url=null;
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}});
 await rejects(()=>p.client.advanceAfterTerminal(previous,next));
 const cap=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.capability(previous.identity.operationId))).value);
 assert.equal(cap.status,'complete');assert.equal(cap.subscriptionId,'sub_exact');
 assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);
 assert.equal(p.counts.checkoutCreate,1);
});
for(const damage of ['missing_fact','old_generation_fact','foreign_capability','missing_dispatch','foreign_resource'])await check('B1 direct ordinary admit rejects '+damage+' despite expired capability',async()=>{
 const p=providerFixture(),previous=request(),initial=await p.client.create(previous),ticket=await checkoutStore.captureCheckoutReadyRead(db,previous),raw=p.sessions.get(initial.id);
 raw.status='expired';raw.url=null;await rejects(()=>p.client.authorizeReadyRead(previous));
 const capKey=checkoutReceipt.checkoutKeys.capability(previous.identity.operationId),factKey=checkoutReceipt.checkoutKeys.fact(ticket.dispatch.dispatchToken),dispatchKey=checkoutReceipt.checkoutKeys.dispatch(ticket.dispatch.dispatchToken),resourceKey=checkoutReceipt.checkoutKeys.resource('test','checkout',initial.id);
 if(damage==='missing_fact')await db.systemSetting.delete({where:{key:factKey}});
 if(damage==='missing_dispatch')await db.systemSetting.delete({where:{key:dispatchKey}});
 if(damage==='old_generation_fact'){const fact=JSON.parse((await keyRow(factKey)).value);await db.systemSetting.update({where:{key:factKey},data:{value:JSON.stringify({...fact,generation:crypto.randomUUID()})}})}
 if(damage==='foreign_capability'){const cap=JSON.parse((await keyRow(capKey)).value);await db.systemSetting.update({where:{key:capKey},data:{value:JSON.stringify({...cap,targetHash:'0'.repeat(64)})}})}
 if(damage==='foreign_resource'){const resource=JSON.parse((await keyRow(resourceKey)).value);await db.systemSetting.update({where:{key:resourceKey},data:{value:JSON.stringify({...resource,targetHash:'0'.repeat(64)})}})}
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();
 await rejects(()=>checkoutStore.admitCheckoutLifecycle(db,next));
 assert.deepEqual(await stateRows(),before);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);assert.equal(p.counts.checkoutCreate,1);
});
await check('B1 direct ordinary admit joins a known Customer to its stored plan',async()=>{
 const p=providerFixture(),customer='cus_known';await db.user.update({where:{id:target},data:{stripeCustomerId:customer}});
 p.customers.set(customer,{id:customer,livemode:false,metadata:{userId:target}});
 const previous=request({customerMode:'reuse',customerId:customer}),initial=await p.client.create(previous),ticket=await checkoutStore.captureCheckoutReadyRead(db,previous),raw=p.sessions.get(initial.id);
 raw.status='expired';raw.url=null;await rejects(()=>p.client.authorizeReadyRead(previous));
 for(const key of [checkoutReceipt.checkoutKeys.capability(previous.identity.operationId),checkoutReceipt.checkoutKeys.fact(ticket.dispatch.dispatchToken)]){
  const row=await keyRow(key),value=JSON.parse(row.value);await db.systemSetting.update({where:{key},data:{value:JSON.stringify({...value,customerId:'cus_foreign'})}});
 }
 const next=request({customerMode:'reuse',customerId:customer,terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();
 await rejects(()=>checkoutStore.admitCheckoutLifecycle(db,next));
 assert.deepEqual(await stateRows(),before);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);assert.equal(p.counts.checkoutCreate,1);
});
await check('B1 HR expired legacy reuses Customer without reassigning its historical resource',async()=>{
 const p=providerFixture(),{org,chief}=await seedOrg('hr');
 await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 const customer='cus_hr_legacy';await db.user.update({where:{id:target},data:{stripeCustomerId:customer}});
 p.customers.set(customer,{id:customer,livemode:false,metadata:{userId:target}});
 const baseUrl='https://example.invalid',terms={...request().terms,planId:'hr-pro',serviceId:'hr',successUrl:`${baseUrl}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${baseUrl}/hr/settings/billing`};
 const previous=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:customer,terms});
 const parts={priceId:terms.priceId,plan:'pro',interval:'monthly',stripeCustomerId:customer,baseUrl},signature=checkoutLegacy.verifiedLegacySignature(previous,parts),sessionId='cs_hr_old';
 await db.systemSetting.create({data:{key:`checkout-reservation:v1:test:${target}`,value:JSON.stringify({phase:'ready',signature,sessionId,url:'https://checkout.example.invalid/old',expiresAt:terms.expiresAt})}});
 p.sessions.set(sessionId,{id:sessionId,livemode:false,mode:'subscription',status:'expired',client_reference_id:target,metadata:{userId:target,planId:'hr-pro',serviceId:'hr'},customer,customer_email:null,subscription:null,url:null,success_url:terms.successUrl,cancel_url:terms.cancelUrl,expires_at:terms.expiresAt,line_items:{data:[{quantity:1,price:{id:terms.priceId}}]}});
 const next=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:customer,terms:{...terms,expiresAt:expiry+600}});
 const result=await p.client.advanceAfterTerminal(previous,next,parts);assert.match(result.id,/^cs_synthetic_/);
 const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);
 assert(index.resources.some(x=>x.type==='customer'&&x.id===customer&&x.operationId===previous.identity.operationId));
 const resource=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.resource('test','customer',customer))).value);
 assert.equal(resource.operationId,previous.identity.operationId);assert.equal(p.counts.customerCreate,0);assert.equal(p.counts.checkoutCreate,1);
});
await check('B1 HR ordinary expired Checkout reuses existing Customer with one new session',async()=>{
 const p=providerFixture(),{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 const customer='cus_hr_existing';await db.user.update({where:{id:target},data:{stripeCustomerId:customer}});p.customers.set(customer,{id:customer,livemode:false,metadata:{userId:target}});
 const terms={...request().terms,planId:'hr-pro',serviceId:'hr'},previous=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:customer,terms});
 const initial=await p.client.create(previous),raw=p.sessions.get(initial.id);raw.status='expired';raw.url=null;
 const next=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:customer,terms:{...terms,expiresAt:expiry+600}}),result=await p.client.advanceAfterTerminal(previous,next);
 assert.notEqual(result.id,initial.id);assert.equal(p.counts.checkoutCreate,2);assert.equal(p.counts.customerCreate,0);
 const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);
 assert(index.resources.some(x=>x.type==='customer'&&x.id===customer&&x.operationId===previous.identity.operationId));
});
await check('B1 open legacy returns only the same sealed input and never creates another Checkout',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous),same=request({terms:{...previous.terms}});
 assert.equal((await p.client.advanceAfterTerminal(previous,same,old.parts)).id,old.sessionId);
 await rejects(()=>p.client.advanceAfterTerminal(previous,request({terms:{...previous.terms,priceId:'price_other'}}),old.parts));
 assert.equal(p.counts.checkoutCreate,0);
});
for(const namespace of ['receipt','ledger','plan','capability'])await check('B1 expired legacy '+namespace+' UUID collision rolls back pointer and new receipt',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 await rejects(()=>p.client.legacyReady(previous,old.parts));
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),key=namespace==='receipt'?`doya-account-operation:v2:${next.identity.operationId}`:namespace==='ledger'?`doya-account-action:v2:${next.identity.operationId}`:checkoutReceipt.checkoutKeys[namespace](next.identity.operationId);
 await db.systemSetting.create({data:{key,value:'{orphan'}});
 const before=await stateRows();await rejects(()=>p.client.advanceAfterTerminal(previous,next,old.parts));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 stale mapped index revision rejects pointer switch with no new receipt',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 await rejects(()=>p.client.legacyReady(previous,old.parts));
 const ticket=await checkoutStore.captureLegacyCheckoutReady(db,previous,old.parts);
 const fact=await p.adapter.readLegacyReady(previous,ticket.sessionId,ticket.rawHash,ticket.signature);
 const key=checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)),row=await keyRow(key),index=JSON.parse(row.value);
 await db.systemSetting.update({where:{key},data:{value:JSON.stringify({...index,revision:index.revision+1})}});
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();
 await rejects(()=>checkoutStore.admitAfterExpiredLegacyCheckout(db,previous,next,ticket,fact));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 foreign legacy resource prevents new pointer and provider write',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 await rejects(()=>p.client.legacyReady(previous,old.parts));
 const key=checkoutReceipt.checkoutKeys.resource('test','checkout',old.sessionId),resource=JSON.parse((await keyRow(key)).value);
 await db.systemSetting.update({where:{key},data:{value:JSON.stringify({...resource,targetHash:'0'.repeat(64)})}});
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();
 await rejects(()=>p.client.advanceAfterTerminal(previous,next,old.parts));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 legacy UUID with a forged ordinary plan is never classified as either owner',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 await rejects(()=>p.client.legacyReady(previous,old.parts));
 const key=checkoutReceipt.checkoutKeys.plan(previous.identity.operationId);
 await db.systemSetting.create({data:{key,value:'{forged'}});
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();
 await rejects(()=>p.client.advanceAfterTerminal(previous,next,old.parts));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 full historical resource index is not trimmed to admit a new Checkout',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 await rejects(()=>p.client.legacyReady(previous,old.parts));
 const key=checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)),index=JSON.parse((await keyRow(key)).value);
 for(let i=0;i<125;i++){
  const id='cus_history_'+i,resource={version:1,targetHash:index.targetHash,operationId:previous.identity.operationId,mode:'test',type:'customer',id};
  await db.systemSetting.create({data:{key:checkoutReceipt.checkoutKeys.resource('test','customer',id),value:JSON.stringify(resource)}});
  index.resources.push({type:'customer',id,operationId:previous.identity.operationId});
 }
 await db.systemSetting.update({where:{key},data:{value:JSON.stringify(index)}});
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();
 await rejects(()=>p.client.advanceAfterTerminal(previous,next,old.parts));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 new plan write failure rolls back receipt fence and pointer together',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 await rejects(()=>p.client.legacyReady(previous,old.parts));
 const next=request({terms:{...previous.terms,expiresAt:expiry+600}}),before=await stateRows();let once=true;
 const faulty={$transaction:(fn,opts)=>db.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='systemSetting')return new Proxy(t.systemSetting,{get(m,n){if(n==='create')return args=>{if(once&&args.data.key===checkoutReceipt.checkoutKeys.plan(next.identity.operationId)){once=false;throw Error('Synthetic plan failure')}return m.create(args)};return Reflect.get(m,n)}});return Reflect.get(t,k)}})),opts)};
 await rejects(()=>coordinator.checkoutCoordinator(faulty,p.adapter).advanceAfterTerminal(previous,next,old.parts));
 assert.deepEqual(await stateRows(),before);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 provider wait permits independent User update then rejects mutated request',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired'),next=request({terms:{...previous.terms,expiresAt:expiry+600}}),seen=defer(),release=defer();
 p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};
 const moving=p.client.advanceAfterTerminal(previous,next,old.parts).then(()=>null,error=>error);
 await seen.promise;
 await db.user.update({where:{id:target},data:{name:'Independent'}});
 next.terms.priceId='price_changed';release.resolve();
 assert(await moving instanceof Error);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 retirement during legacy retrieve refuses new pointer and Checkout write',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired'),next=request({terms:{...previous.terms,expiresAt:expiry+600}}),seen=defer(),release=defer();
 p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};
 const moving=p.client.advanceAfterTerminal(previous,next,old.parts).then(()=>null,error=>error);
 await seen.promise;assert((await store.reserveLifecycleOperation(db,identity('retirement'),digest)).claim);
 release.resolve();assert(await moving instanceof Error);
 assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 cutover epoch change during retrieve refuses new pointer',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired'),next=request({terms:{...previous.terms,expiresAt:expiry+600}}),seen=defer(),release=defer();
 p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};
 const moving=p.client.advanceAfterTerminal(previous,next,old.parts).then(()=>null,error=>error);
 await seen.promise;
 const key=checkoutReceipt.checkoutKeys.cutover('test'),marker=JSON.parse((await keyRow(key)).value);
 await db.systemSetting.update({where:{key},data:{value:JSON.stringify({...marker,epoch:crypto.randomUUID()})}});
 release.resolve();assert(await moving instanceof Error);
 assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 HR OWNER downgrade during retrieve refuses new pointer',async()=>{
 const p=providerFixture(),{org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 const customer='cus_hr_legacy';await db.user.update({where:{id:target},data:{stripeCustomerId:customer}});
 const baseUrl='https://example.invalid',terms={...request().terms,planId:'hr-pro',serviceId:'hr',successUrl:`${baseUrl}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${baseUrl}/hr/settings/billing`};
 const previous=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:customer,terms}),parts={priceId:terms.priceId,plan:'pro',interval:'monthly',stripeCustomerId:customer,baseUrl},signature=checkoutLegacy.verifiedLegacySignature(previous,parts),sessionId='cs_hr_old';
 await db.systemSetting.create({data:{key:`checkout-reservation:v1:test:${target}`,value:JSON.stringify({phase:'ready',signature,sessionId,url:'https://checkout.example.invalid/old',expiresAt:terms.expiresAt})}});
 p.sessions.set(sessionId,{id:sessionId,livemode:false,mode:'subscription',status:'expired',client_reference_id:target,metadata:{userId:target,planId:'hr-pro',serviceId:'hr'},customer,customer_email:null,subscription:null,url:null,success_url:terms.successUrl,cancel_url:terms.cancelUrl,expires_at:terms.expiresAt,line_items:{data:[{quantity:1,price:{id:terms.priceId}}]}});
 const next=request({source:'hr',organizationId:org.id,customerMode:'reuse',customerId:customer,terms:{...terms,expiresAt:expiry+600}}),seen=defer(),release=defer();
 p.hooks.checkoutRead=async()=>{seen.resolve();await release.promise};
 const moving=p.client.advanceAfterTerminal(previous,next,parts).then(()=>null,error=>error);
 await seen.promise;await db.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}});
 release.resolve();assert(await moving instanceof Error);
 assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next.identity.operationId)),null);assert.equal(p.counts.checkoutCreate,0);
});
await check('B1 two distinct UUID callers with the same payload converge without a second provider write',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 const first=request({terms:{...previous.terms,expiresAt:expiry+600}}),second=request({terms:{...first.terms}}),seen=defer(),release=defer();
 p.hooks.checkoutCreate=async()=>{seen.resolve();await release.promise};
 const creating=p.client.advanceAfterTerminal(previous,first,old.parts);
 await seen.promise;
 const pending=await p.client.advanceAfterTerminal(previous,second,old.parts);
 assert.equal(pending.operationId,first.identity.operationId);assert.equal(pending.resultUnknown,true);
 assert.equal(p.counts.checkoutCreate,1);
 release.resolve();const ready=await creating;
 assert.equal((await p.client.advanceAfterTerminal(previous,second,old.parts)).id,ready.id);
 assert.equal(p.counts.checkoutCreate,1);
 assert.equal(await db.systemSetting.count({where:{key:{startsWith:'doya-checkout-plan:v2:'}}}),1);
});
await check('B1 different payload during a new provider write cannot join or replace current',async()=>{
 const p=providerFixture(),previous=request(),old=await legacyReady(p,previous,'expired');
 const first=request({terms:{...previous.terms,expiresAt:expiry+600}}),second=request({terms:{...previous.terms,expiresAt:expiry+900}}),seen=defer(),release=defer();
 p.hooks.checkoutCreate=async()=>{seen.resolve();await release.promise};
 const creating=p.client.advanceAfterTerminal(previous,first,old.parts);
 await seen.promise;await rejects(()=>p.client.advanceAfterTerminal(previous,second,old.parts));
 assert.equal(p.counts.checkoutCreate,1);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(second.identity.operationId)),null);
 release.resolve();await creating;
});
// B2a: actual route -> shared HTTP bridge -> coordinator/store -> synthetic Stripe SDK transport.
const b2env={STRIPE_SECRET_KEY:'sk_test_synthetic',NEXT_PUBLIC_APP_URL:'https://example.invalid',NEXTAUTH_URL:'https://example.invalid'};
const b2process={env:b2env};
const b2sdkState={customers:new Map(),sessions:new Map(),customerWrites:0,checkoutWrites:0,checkoutReads:0,customerReads:0,incomplete:false,beforeCustomerWrite:null,beforeCheckoutRead:null,reset(){this.customers.clear();this.sessions.clear();this.customerWrites=0;this.checkoutWrites=0;this.checkoutReads=0;this.customerReads=0;this.incomplete=false;this.beforeCustomerWrite=null;this.beforeCheckoutRead=null}};
const b2sdk={
 customers:{
  create:async(params,options)=>{assert(options.idempotencyKey);if(b2sdkState.beforeCustomerWrite)await b2sdkState.beforeCustomerWrite();const id='cus_b2_'+(++b2sdkState.customerWrites),raw={id,livemode:false,email:params.email,name:params.name,metadata:params.metadata};b2sdkState.customers.set(id,raw);return raw},
  retrieve:async id=>{b2sdkState.customerReads++;const raw=b2sdkState.customers.get(id);assert(raw);return raw},
 },
 checkout:{sessions:{
  create:async(params,options)=>{assert(options.idempotencyKey);const id='cs_b2_'+(++b2sdkState.checkoutWrites),raw={id,livemode:false,mode:params.mode,status:'open',client_reference_id:params.client_reference_id,metadata:params.metadata,customer:params.customer||null,customer_email:params.customer_email||null,subscription:null,url:'https://checkout.example.invalid/'+id,success_url:params.success_url,cancel_url:params.cancel_url,expires_at:params.expires_at,line_items:{data:[{quantity:1,price:{id:params.line_items[0].price}}],has_more:b2sdkState.incomplete}};b2sdkState.sessions.set(id,raw);return raw},
  retrieve:async id=>{b2sdkState.checkoutReads++;if(b2sdkState.beforeCheckoutRead)await b2sdkState.beforeCheckoutRead();const raw=b2sdkState.sessions.get(id);assert(raw);return raw},
 }}
};
const b2prices=new Proxy({},{get:()=>new Proxy({},{get:()=>({monthly:'price_synthetic',yearly:'price_synthetic'})})});
const b2stripeLib={stripe:b2sdk,STRIPE_PRICE_IDS:b2prices,findActiveLikeSubscriptions:async()=>[]};
const b2sdkProvider=load('src/lib/account-lifecycle/checkout-stripe-provider.ts',{'server-only':{},'./state':state},{process:b2process});
const b2http=load('src/lib/account-lifecycle/checkout-http.ts',{'server-only':{},'./state':state,'./checkout-receipt':checkoutReceipt,'./checkout':coordinator,'./checkout-store':checkoutStore,'./checkout-provider':checkoutProvider,'./checkout-stripe-provider':b2sdkProvider,'@/lib/stripe':b2stripeLib,'@/lib/prisma':{prisma:db}},{process:b2process});
let b2session={user:{id:target,email:target+'@example.invalid',name:'Synthetic'}},b2hrContext=null;
const b2next={NextResponse:{json:(body,options={})=>Response.json(body,options)}};
const b2routeMocks={'next/server':b2next,'next-auth':{getServerSession:async()=>b2session},'@/lib/auth':{authOptions:{}},'@/lib/stripe':b2stripeLib,'@/lib/prisma':{prisma:db},'@/lib/account-lifecycle/state':state,'@/lib/account-lifecycle/checkout-urls':checkoutUrls,'@/lib/account-lifecycle/checkout-http':b2http,'@/lib/account-lifecycle/checkout-stripe-provider':b2sdkProvider};
const b2organizationSelection=load('src/lib/hr/organization-selection.ts');
const b2services=load('src/lib/services.ts',{'./unified-plan':{UNIFIED_PRO_PRICE:9980}},{process:b2process});
const b2generic=load('src/app/api/stripe/checkout/route.ts',{...b2routeMocks,'@/lib/unified-plan':{UNIFIED_TRIAL_DAYS:30},'@/lib/services':b2services,'@/lib/trial':{isTrialEligible:async()=>false},'@/lib/hr/organization-selection':b2organizationSelection},{process:b2process});
const b2hr=load('src/app/api/hr/billing/checkout/route.ts',{...b2routeMocks,'@/lib/hr/access':{getHrContext:async()=>b2hrContext},'@/lib/hr/types':{HrMemberRole:{OWNER:'OWNER'}},'@/lib/hr/audit':{logAudit:async()=>{}}},{process:b2process});
const b2post=async(route,body,headers={})=>{const response=await route.POST(new Request('https://example.invalid/api/checkout',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)}));return{response,body:await response.json()}};
const b2start=id=>({action:'start',operationId:id,planId:'banner-pro',billingPeriod:'monthly',serviceId:'banner',returnTo:'/banner'});
const b2hrStart=id=>({action:'start',operationId:id,plan:'pro',interval:'monthly'});
const b2reset=()=>{b2sdkState.reset();b2session={user:{id:target,email:target+'@example.invalid',name:'Synthetic'}};b2hrContext=null;b2env.STRIPE_SECRET_KEY='sk_test_synthetic'};
await check('B2a generic actual route stores private v2 recipe and returns only exact ready URL',async()=>{
 b2reset();const id=crypto.randomUUID(),started=await b2post(b2generic,b2start(id));assert.equal(started.response.status,200);assert.equal(started.response.headers.get('cache-control'),'private, no-store');assert.equal(started.response.headers.get('vary'),'Cookie');assert.equal(started.body.operationId,id);assert.equal(started.body.actorId,target);assert.match(started.body.url,/^https:\/\/checkout\.example\.invalid\//);
 const row=await keyRow(checkoutReceipt.checkoutKeys.plan(id)),plan=checkoutReceipt.parseCheckoutPlan(row.value);assert.equal(plan.version,2);assert.equal(plan.recovery.version,2);assert.equal(plan.recovery.origin,'https://example.invalid');assert.equal(plan.recovery.returnPath,'/banner');assert.equal(plan.recovery.workingPath,'/banner/dashboard');assert.equal(plan.trialDays,0);assert(!row.value.includes(target+'@example.invalid'));assert(!row.value.includes('Synthetic'));assert(!row.value.includes(started.body.url));
 const session=b2sdkState.sessions.get(started.body.sessionId);assert.equal(session.success_url,'https://example.invalid/banner/dashboard?success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}');assert.equal(session.cancel_url,'https://example.invalid/banner?payment=cancelled');
 const before=b2sdkState.checkoutWrites,status=await b2post(b2generic,{action:'status',operationId:id}),ready=await b2post(b2generic,{action:'ready',operationId:id});assert.equal(status.body.phase,'completed');assert.equal(status.body.actorId,target);assert.equal(ready.body.actorId,target);assert.equal(ready.body.sessionId,started.body.sessionId);assert.equal(ready.body.id,undefined);assert.equal(ready.body.url,started.body.url);assert.equal(b2sdkState.checkoutWrites,before)
});
await check('B2b new URL recipe returns global pricing to home and preserves allowed working query',async()=>{
 b2reset();const id=crypto.randomUUID(),started=await b2post(b2generic,{...b2start(id),returnTo:'/pricing'});assert.equal(started.response.status,200);
 const plan=checkoutReceipt.parseCheckoutPlan((await keyRow(checkoutReceipt.checkoutKeys.plan(id))).value);assert.equal(plan.recovery.version,2);assert.equal(plan.recovery.workingPath,'/home');
 const session=b2sdkState.sessions.get(started.body.sessionId);assert.equal(session.success_url,'https://example.invalid/home?success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}');assert.equal(session.cancel_url,'https://example.invalid/pricing?payment=cancelled');
 const query=checkoutUrls.checkoutUrls({version:2,recipe:'generic_working',origin:'https://example.invalid',returnPath:'/hr/settings/billing',workingPath:'/hr/dashboard?tab=people'},'hr-pro','hr');
 assert.equal(query.successUrl,'https://example.invalid/hr/dashboard?tab=people&success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}');assert.equal(query.cancelUrl,'https://example.invalid/hr/settings/billing?payment=cancelled')
 for(const returnPath of ['/', '/all-in-one']) { const global=checkoutUrls.checkoutUrls({version:2,recipe:'generic_working',origin:'https://example.invalid',returnPath,workingPath:'/home'},'banner-pro','banner');assert.equal(global.successUrl,'https://example.invalid/home?success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}');assert.equal(global.cancelUrl,`https://example.invalid${returnPath}?payment=cancelled`) }
 const previous=checkoutUrls.checkoutUrls({version:1,recipe:'generic',origin:'https://example.invalid',returnPath:'/all-in-one'},'banner-pro','banner');assert.equal(previous.successUrl,'https://example.invalid/?success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}')
});
await check('B2a generic same intent with distinct UUID converges to one current operation',async()=>{
 b2reset();const first=crypto.randomUUID(),second=crypto.randomUUID();const initial=await b2post(b2generic,b2start(first));assert.equal(initial.response.status,200);assert.equal(initial.body.operationId,first);const again=await b2post(b2generic,b2start(second));assert.equal(again.response.status,200);assert.equal(again.body.operationId,first);assert.equal(again.body.sessionId,'cs_b2_1');assert.equal(b2sdkState.checkoutWrites,1);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(second)),null)
});
await check('B2a missing handle abort tombstones UUID and prevents late start',async()=>{
 b2reset();const id=crypto.randomUUID();const missing=await b2post(b2generic,{action:'status',operationId:id});assert.equal(missing.body.phase,'missing');assert.equal(missing.body.actorId,target);const aborted=await b2post(b2generic,{action:'abort',operationId:id});assert.equal(aborted.body.phase,'aborted');assert.equal(aborted.body.actorId,target);const late=await b2post(b2generic,b2start(id));assert.notEqual(late.response.status,200);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a HR admission reserves before first Customer write and joins provider fact',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};const id=crypto.randomUUID();b2sdkState.beforeCustomerWrite=async()=>{assert(await keyRow(checkoutReceipt.checkoutKeys.plan(id)));assert.equal((await db.user.findUnique({where:{id:target},select:{stripeCustomerId:true}})).stripeCustomerId,null)};
 const started=await b2post(b2hr,b2hrStart(id));assert.equal(started.response.status,200);assert.equal(started.body.success,true);assert.equal(started.body.actorId,target);const plan=checkoutReceipt.parseCheckoutPlan((await keyRow(checkoutReceipt.checkoutKeys.plan(id))).value);assert.equal(plan.source,'hr');assert.equal(plan.organizationId,org.id);assert.equal(plan.customerMode,'create');assert.equal(plan.trialDays,0);assert.equal(b2sdkState.customerWrites,1);assert.equal(b2sdkState.checkoutWrites,1);assert.equal((await db.user.findUnique({where:{id:target},select:{stripeCustomerId:true}})).stripeCustomerId,'cus_b2_1');
 const session=b2sdkState.sessions.get(started.body.sessionId);assert.equal(session.success_url,'https://example.invalid/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}');assert.equal(session.cancel_url,'https://example.invalid/hr/settings/billing')
});
await check('B2a owner downgrade blocks ready before provider retrieve',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};const id=crypto.randomUUID();assert.equal((await b2post(b2hr,b2hrStart(id))).response.status,200);await db.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}});const reads=b2sdkState.checkoutReads,ready=await b2post(b2hr,{action:'ready',operationId:id});assert.equal(ready.response.status,403);assert.equal(b2sdkState.checkoutReads,reads)
});
await check('B2a actual routes reject mismatched session identity before operation and provider reads',async()=>{
 b2reset();b2session={user:{id:target,email:second+'@example.invalid'}};const id=crypto.randomUUID(),before=await stateRows();for(const route of [b2generic,b2hr]){const result=await b2post(route,{action:'status',operationId:id});assert.equal(result.response.status,403);assert.equal(result.body.code,'CHECKOUT_ACTOR_MISMATCH')}assert.deepEqual(await stateRows(),before);assert.equal(b2sdkState.checkoutReads,0)
});
await check('B2a incomplete SDK line items become unknown and never retry provider write',async()=>{
 b2reset();b2sdkState.incomplete=true;const id=crypto.randomUUID(),started=await b2post(b2generic,b2start(id));assert.notEqual(started.response.status,200);const status=await b2post(b2generic,{action:'status',operationId:id});assert.equal(status.body.phase,'executing');assert.equal(status.body.dispatched,true);assert.equal(b2sdkState.checkoutWrites,1);const resume=await b2post(b2generic,{action:'resume',operationId:id});assert.notEqual(resume.response.status,200);assert.equal(b2sdkState.checkoutWrites,1)
});
await check('B2a both actual routes fail private for missing actor and unavailable User',async()=>{
 b2reset();const id=crypto.randomUUID();for(const route of [b2generic,b2hr]){
  b2session=null;const unauth=await b2post(route,{action:'status',operationId:id});assert.equal(unauth.response.status,401);assert.equal(unauth.response.headers.get('cache-control'),'private, no-store');assert.equal(unauth.response.headers.get('vary'),'Cookie');
  b2session={user:{id:'missing_actor'}};const missing=await b2post(route,{action:'status',operationId:id});assert.equal(missing.response.status,404);assert.equal(missing.response.headers.get('cache-control'),'private, no-store');
 }assert.equal(b2sdkState.checkoutReads,0);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a strict action and unknown provider mode fail before mutation',async()=>{
 b2reset();const id=crypto.randomUUID(),before=await stateRows();const malformed=await b2post(b2generic,{...b2start(id),extra:'ignored'});assert.equal(malformed.response.status,400);
 b2env.STRIPE_SECRET_KEY='not-a-stripe-secret';const mode=await b2post(b2generic,b2start(id));assert.equal(mode.response.status,503);assert.equal(mode.body.code,'CHECKOUT_STRIPE_MODE_UNKNOWN');assert.deepEqual(await stateRows(),before);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a unconfigured origin never trusts request Host for either route',async()=>{
 b2reset();const savedPublic=b2env.NEXT_PUBLIC_APP_URL,savedAuth=b2env.NEXTAUTH_URL;
 delete b2env.NEXT_PUBLIC_APP_URL;delete b2env.NEXTAUTH_URL;
 try{
  const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
  const before=await stateRows();
  for(const [route,body] of [[b2generic,b2start(crypto.randomUUID())],[b2hr,b2hrStart(crypto.randomUUID())]]){
   const response=await route.POST(new Request('https://host-spoof.example.invalid/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
   assert.equal(response.status,503);assert.equal((await response.json()).code,'CHECKOUT_ORIGIN_UNAVAILABLE');
  }
  assert.deepEqual(await stateRows(),before);assert.equal(b2sdkState.customerWrites,0);assert.equal(b2sdkState.checkoutWrites,0);
 }finally{b2env.NEXT_PUBLIC_APP_URL=savedPublic;b2env.NEXTAUTH_URL=savedAuth}
});
await check('B2a missing cutover evidence refuses Checkout before provider write',async()=>{
 b2reset();const id=crypto.randomUUID(),key=checkoutReceipt.checkoutKeys.cutover('test');await db.systemSetting.delete({where:{key}});const before=await stateRows(),result=await b2post(b2generic,b2start(id));assert.equal(result.response.status,503);assert.equal(result.body.code,'CHECKOUT_CUTOVER_NOT_VERIFIED');assert.deepEqual(await stateRows(),before);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a generic HR retains generic source and selected organization OWNER seal',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});const id=crypto.randomUUID(),headers={'X-HR-Selected-Organization':org.id,'X-HR-Selected-Actor':target,'X-HR-Organization-Id':org.id};const started=await b2post(b2generic,{...b2start(id),serviceId:'hr',returnTo:'/hr'},headers);assert.equal(started.response.status,200);
 const plan=checkoutReceipt.parseCheckoutPlan((await keyRow(checkoutReceipt.checkoutKeys.plan(id))).value);assert.equal(plan.source,'generic');assert.equal(plan.organizationId,org.id);assert.equal(plan.customerMode,'implicit');assert.equal(plan.recovery.recipe,'generic_working');assert.equal(plan.recovery.workingPath,'/hr/dashboard');
 await db.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}});const reads=b2sdkState.checkoutReads,ready=await b2post(b2generic,{action:'ready',operationId:id},headers);assert.equal(ready.response.status,403);assert.equal(b2sdkState.checkoutReads,reads)
});
await check('B2a generic HR without selected OWNER refuses reservation and provider write',async()=>{
 b2reset();const id=crypto.randomUUID(),before=await stateRows(),result=await b2post(b2generic,{...b2start(id),serviceId:'hr',returnTo:'/hr'});assert.equal(result.response.status,403);assert.deepEqual(await stateRows(),before);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a generic HR handle requires the same currently selected organization',async()=>{
 b2reset();const a=await seedOrg('hr'),b=await seedOrg('hr',{slug:'synthetic-hr-second'});for(const chief of [a.chief,b.chief])await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 const id=crypto.randomUUID(),aHeaders={'X-HR-Selected-Organization':a.org.id,'X-HR-Selected-Actor':target},bHeaders={'X-HR-Selected-Organization':b.org.id,'X-HR-Selected-Actor':target};
 const started=await b2post(b2generic,{...b2start(id),serviceId:'hr',returnTo:'/hr'},aHeaders);assert.equal(started.response.status,200);
 const reads=b2sdkState.checkoutReads,writes=b2sdkState.checkoutWrites;for(const headers of [{},bHeaders,{'X-HR-Selected-Organization':a.org.id,'X-HR-Selected-Actor':'wrong'}]){
  const ready=await b2post(b2generic,{action:'ready',operationId:id},headers);assert.equal(ready.response.status,403);assert.equal(ready.body.code,'HR_BILLING_OWNER_REQUIRED');assert.equal(ready.body.url,undefined);
 }assert.equal(b2sdkState.checkoutReads,reads);assert.equal(b2sdkState.checkoutWrites,writes);
 const ready=await b2post(b2generic,{action:'ready',operationId:id},aHeaders);assert.equal(ready.response.status,200);assert.equal(ready.body.actorId,target);assert.equal(ready.body.url,started.body.url)
});
await check('B2a dedicated HR handle binds current selected organization and endpoint source',async()=>{
 b2reset();const a=await seedOrg('hr'),b=await seedOrg('hr',{slug:'synthetic-hr-second'});for(const chief of [a.chief,b.chief])await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 b2hrContext={userId:target,organizationId:a.org.id,role:'OWNER'};const id=crypto.randomUUID(),started=await b2post(b2hr,b2hrStart(id));assert.equal(started.response.status,200);
 const reads=b2sdkState.checkoutReads,writes=b2sdkState.checkoutWrites;b2hrContext={userId:target,organizationId:b.org.id,role:'OWNER'};
 for(const action of ['status','resume','ready','abort']){const denied=await b2post(b2hr,{action,operationId:id});assert.equal(denied.response.status,403);assert.equal(denied.body.code,'HR_BILLING_OWNER_REQUIRED');assert.equal(denied.body.url,undefined)}
 assert.equal(b2sdkState.checkoutReads,reads);assert.equal(b2sdkState.checkoutWrites,writes);
 b2hrContext={userId:target,organizationId:a.org.id,role:'OWNER'};const ready=await b2post(b2hr,{action:'ready',operationId:id});assert.equal(ready.response.status,200);assert.equal(ready.body.actorId,target);assert.equal(ready.body.sessionId,started.body.sessionId);
 const crossReads=b2sdkState.checkoutReads,crossWrites=b2sdkState.checkoutWrites;
 const generic=await b2post(b2generic,{action:'ready',operationId:id},{'X-HR-Selected-Organization':a.org.id,'X-HR-Selected-Actor':target});assert.equal(generic.response.status,409);assert.equal(generic.body.code,'CHECKOUT_IDENTITY_CHANGED');assert.equal(generic.body.url,undefined);assert.equal(b2sdkState.checkoutReads,crossReads);assert.equal(b2sdkState.checkoutWrites,crossWrites)
});
await check('B2a dedicated HR handle rejects a separately admitted generic source',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
 const genericId=crypto.randomUUID(),genericStart=await b2post(b2generic,b2start(genericId));assert.equal(genericStart.response.status,200);
 const reads=b2sdkState.checkoutReads,writes=b2sdkState.checkoutWrites,cross=await b2post(b2hr,{action:'ready',operationId:genericId});assert.equal(cross.response.status,409);assert.equal(cross.body.code,'CHECKOUT_IDENTITY_CHANGED');assert.equal(cross.body.url,undefined);assert.equal(b2sdkState.checkoutReads,reads);assert.equal(b2sdkState.checkoutWrites,writes)
});
await check('B2a generic HR OWNER downgrade during ready provider read returns no URL',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});
 const headers={'X-HR-Selected-Organization':org.id,'X-HR-Selected-Actor':target},id=crypto.randomUUID();const started=await b2post(b2generic,{...b2start(id),serviceId:'hr',returnTo:'/hr'},headers);assert.equal(started.response.status,200);
 const writes=b2sdkState.checkoutWrites;b2sdkState.beforeCheckoutRead=async()=>{b2sdkState.beforeCheckoutRead=null;await db.hrOrganizationMember.update({where:{id:chief.id},data:{role:'MEMBER'}})};
 const ready=await b2post(b2generic,{action:'ready',operationId:id},headers);assert.equal(ready.response.status,403);assert.equal(ready.body.code,'HR_BILLING_OWNER_REQUIRED');assert.equal(ready.body.url,undefined);assert.equal(b2sdkState.checkoutWrites,writes)
});
await check('B2a dedicated HR new UUID after Customer creation cannot reinterpret old create intent',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
 const first=crypto.randomUUID(),started=await b2post(b2hr,b2hrStart(first));assert.equal(started.response.status,200);const customerWrites=b2sdkState.customerWrites,checkoutWrites=b2sdkState.checkoutWrites;
 const second=crypto.randomUUID(),again=await b2post(b2hr,b2hrStart(second));assert.equal(again.response.status,409);assert.equal(again.body.url,undefined);assert.equal(b2sdkState.customerWrites,customerWrites);assert.equal(b2sdkState.checkoutWrites,checkoutWrites);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(second)),null);
 const ready=await b2post(b2hr,{action:'ready',operationId:first});assert.equal(ready.response.status,200);assert.equal(ready.body.actorId,target);assert.equal(ready.body.operationId,first);assert.equal(ready.body.url,started.body.url)
});
await check('B2a reserved exact handle resumes once and status never writes',async()=>{
 b2reset();const id=crypto.randomUUID(),recovery={version:1,recipe:'generic',origin:'https://example.invalid',returnPath:'/banner'},urls=checkoutUrls.checkoutUrls(recovery,'banner-pro','banner');
 const r={cutoverEpoch:epoch,identity:b2http.checkoutIdentity(target,id),mode:'test',source:'generic',organizationId:null,customerMode:'implicit',customerId:null,recovery,terms:{priceId:'price_synthetic',planId:'banner-pro',serviceId:'banner',trialDays:0,successUrl:urls.successUrl,cancelUrl:urls.cancelUrl,email:target+'@example.invalid',name:'',expiresAt:Math.floor(Date.now()/1000)+2400}};
 const admitted=await checkoutStore.admitCheckoutLifecycle(db,r);assert(admitted.claim);const observed=await b2post(b2generic,{action:'status',operationId:id});assert.equal(observed.body.phase,'reserved');assert.equal(b2sdkState.checkoutWrites,0);
 const resumed=await b2post(b2generic,{action:'resume',operationId:id});assert.equal(resumed.response.status,200);assert.match(resumed.body.url,/^https:\/\/checkout\.example\.invalid\//);assert.equal(b2sdkState.checkoutWrites,1);
 const again=await b2post(b2generic,{action:'resume',operationId:id});assert.notEqual(again.response.status,200);assert.equal(b2sdkState.checkoutWrites,1)
});
await check('B2a reserved Customer-create handle refuses changed Stripe transport mode before any I/O',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
 const id=crypto.randomUUID(),recovery={version:1,recipe:'hr',origin:'https://example.invalid',returnPath:null},urls=checkoutUrls.checkoutUrls(recovery,'hr-pro','hr');
 const r={cutoverEpoch:epoch,identity:b2http.checkoutIdentity(target,id),mode:'test',source:'hr',organizationId:org.id,customerMode:'create',customerId:null,recovery,terms:{priceId:'price_synthetic',planId:'hr-pro',serviceId:'hr',trialDays:0,successUrl:urls.successUrl,cancelUrl:urls.cancelUrl,email:target+'@example.invalid',name:'',expiresAt:Math.floor(Date.now()/1000)+2400}};
 assert((await checkoutStore.admitCheckoutLifecycle(db,r)).claim);b2env.STRIPE_SECRET_KEY='sk_live_synthetic';
 try{for(const action of ['resume','ready']){const response=await b2post(b2hr,{action,operationId:id});assert.equal(response.response.status,409);assert.equal(response.body.code,'CHECKOUT_STRIPE_MODE_MISMATCH');assert.equal(response.body.url,undefined)}
  assert.equal(b2sdkState.customerReads,0);assert.equal(b2sdkState.customerWrites,0);assert.equal(b2sdkState.checkoutReads,0);assert.equal(b2sdkState.checkoutWrites,0)
 }finally{b2env.STRIPE_SECRET_KEY='sk_test_synthetic'}
 const resumed=await b2post(b2hr,{action:'resume',operationId:id});assert.equal(resumed.response.status,200);assert.equal(resumed.body.actorId,target);assert.match(resumed.body.url,/^https:\/\/checkout\.example\.invalid\//)
});
await check('B2a reserved handle refuses changed live User name without write',async()=>{
 b2reset();const id=crypto.randomUUID(),recovery={version:1,recipe:'generic',origin:'https://example.invalid',returnPath:'/banner'},urls=checkoutUrls.checkoutUrls(recovery,'banner-pro','banner');
 const r={cutoverEpoch:epoch,identity:b2http.checkoutIdentity(target,id),mode:'test',source:'generic',organizationId:null,customerMode:'implicit',customerId:null,recovery,terms:{priceId:'price_synthetic',planId:'banner-pro',serviceId:'banner',trialDays:0,successUrl:urls.successUrl,cancelUrl:urls.cancelUrl,email:target+'@example.invalid',name:'',expiresAt:Math.floor(Date.now()/1000)+2400}};
 await checkoutStore.admitCheckoutLifecycle(db,r);await db.user.update({where:{id:target},data:{name:'Changed'}});const result=await b2post(b2generic,{action:'resume',operationId:id});assert.equal(result.response.status,409);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a expired ordinary starts a new explicit UUID and preserves old resources',async()=>{
 b2reset();const prior=crypto.randomUUID(),started=await b2post(b2generic,b2start(prior));assert.equal(started.response.status,200);const oldSession=b2sdkState.sessions.get(started.body.sessionId);oldSession.status='expired';oldSession.url=null;
 const terminal=await b2post(b2generic,{action:'ready',operationId:prior});assert.equal(terminal.response.status,409);assert.equal(terminal.body.code,'CHECKOUT_EXPIRED');assert.equal(terminal.body.url,undefined);
 const next=crypto.randomUUID(),advanced=await b2post(b2generic,{...b2start(next),action:'start_after_terminal',previousOperationId:prior});assert.equal(advanced.response.status,200);assert.equal(advanced.body.operationId,next);assert.equal(b2sdkState.checkoutWrites,2);
 const secondCaller=await b2post(b2generic,{...b2start(crypto.randomUUID()),action:'start_after_terminal',previousOperationId:prior});assert.equal(secondCaller.response.status,200);assert.equal(secondCaller.body.operationId,next);assert.equal(secondCaller.body.sessionId,advanced.body.sessionId);assert.equal(b2sdkState.checkoutWrites,2);
 const index=JSON.parse((await keyRow(checkoutReceipt.checkoutKeys.index(state.lifecycleSubject(target)))).value);assert.equal(index.currentOperationId,next);assert(index.resources.some(item=>item.operationId===prior&&item.id===started.body.sessionId));assert(index.resources.some(item=>item.operationId===next&&item.id===advanced.body.sessionId))
});
await check('B2a completed ordinary rejects a second purchase UUID',async()=>{
 b2reset();const prior=crypto.randomUUID(),started=await b2post(b2generic,b2start(prior));assert.equal(started.response.status,200);const oldSession=b2sdkState.sessions.get(started.body.sessionId);oldSession.status='complete';oldSession.url=null;oldSession.customer='cus_b2_paid';oldSession.subscription='sub_b2_paid';
 const terminal=await b2post(b2generic,{action:'ready',operationId:prior});assert.equal(terminal.response.status,409);assert.equal(terminal.body.code,'CHECKOUT_ALREADY_COMPLETED');assert.equal(terminal.body.url,undefined);
 const next=crypto.randomUUID(),advanced=await b2post(b2generic,{...b2start(next),action:'start_after_terminal',previousOperationId:prior});assert.equal(advanced.response.status,409);assert.equal(b2sdkState.checkoutWrites,1);assert.equal(await keyRow(checkoutReceipt.checkoutKeys.plan(next)),null)
});
for(const fault of ['foreign-email','foreign-owner'])await check('B2a HR reused Customer '+fault+' blocks Checkout write',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
 const customerId='cus_b2_existing';await db.user.update({where:{id:target},data:{stripeCustomerId:customerId}});b2sdkState.customers.set(customerId,{id:customerId,livemode:false,email:fault==='foreign-email'?'other@example.invalid':target+'@example.invalid',metadata:{userId:fault==='foreign-owner'?second:target}});
 const started=await b2post(b2hr,b2hrStart(crypto.randomUUID()));assert.equal(started.response.status,409);assert.equal(b2sdkState.customerReads,1);assert.equal(b2sdkState.customerWrites,0);assert.equal(b2sdkState.checkoutWrites,0)
});
await check('B2a reused Customer reference change blocks handle ready before provider read',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
 const customerId='cus_b2_original';await db.user.update({where:{id:target},data:{stripeCustomerId:customerId}});b2sdkState.customers.set(customerId,{id:customerId,livemode:false,email:target+'@example.invalid',metadata:{userId:target}});
 const id=crypto.randomUUID(),started=await b2post(b2hr,b2hrStart(id));assert.equal(started.response.status,200);await db.user.update({where:{id:target},data:{stripeCustomerId:'cus_b2_other'}});
 const reads=b2sdkState.checkoutReads,ready=await b2post(b2hr,{action:'ready',operationId:id});assert.equal(ready.response.status,409);assert.equal(ready.body.code,'CHECKOUT_CUSTOMER_REFERENCE_CONFLICT');assert.equal(ready.body.url,undefined);assert.equal(b2sdkState.checkoutReads,reads);
 const status=await b2post(b2hr,{action:'status',operationId:id});assert.equal(status.response.status,409);assert.equal(status.body.code,'CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
});
await check('B2a reused Customer reference change during provider read blocks ready URL',async()=>{
 b2reset();const {org,chief}=await seedOrg('hr');await db.hrOrganizationMember.update({where:{id:chief.id},data:{userId:target}});b2hrContext={userId:target,organizationId:org.id,role:'OWNER'};
 const customerId='cus_b2_original';await db.user.update({where:{id:target},data:{stripeCustomerId:customerId}});b2sdkState.customers.set(customerId,{id:customerId,livemode:false,email:target+'@example.invalid',metadata:{userId:target}});
 const id=crypto.randomUUID(),started=await b2post(b2hr,b2hrStart(id));assert.equal(started.response.status,200);const writes=b2sdkState.checkoutWrites;
 b2sdkState.beforeCheckoutRead=async()=>{b2sdkState.beforeCheckoutRead=null;await db.user.update({where:{id:target},data:{stripeCustomerId:'cus_b2_other'}})};
 const ready=await b2post(b2hr,{action:'ready',operationId:id});assert.equal(ready.response.status,409);assert.equal(ready.body.code,'CHECKOUT_CUSTOMER_REFERENCE_CONFLICT');assert.equal(ready.body.url,undefined);assert.equal(b2sdkState.checkoutWrites,writes)
});
await check('B2a corrupted saved plan refuses ready before provider retrieve',async()=>{
 b2reset();const id=crypto.randomUUID(),started=await b2post(b2generic,b2start(id));assert.equal(started.response.status,200);const key=checkoutReceipt.checkoutKeys.plan(id),row=await keyRow(key),plan=JSON.parse(row.value);
 plan.inputDigest='f'.repeat(64);plan.customerDigest=checkoutReceipt.checkoutDigest([plan.inputDigest,'customer']);plan.checkoutDigest=checkoutReceipt.checkoutPayloadDigest(plan,plan.customerId);
 await db.systemSetting.update({where:{key},data:{value:JSON.stringify(plan)}});const reads=b2sdkState.checkoutReads,ready=await b2post(b2generic,{action:'ready',operationId:id});assert.equal(ready.response.status,409);assert.equal(b2sdkState.checkoutReads,reads)
});
console.log(JSON.stringify({executed:cases.length,contractPassed:cases.length,classification:'R2_B2A_SYNTHETIC_HTTP_ONLY',scope:'Actual generic and HR POST routes through coordinator/core and isolated Prisma transactions with synthetic Stripe SDK transport. B2b UI, B3, R2-C, R3, unsafe2 closure, operational old-worker drain and real provider proof remain outstanding.',cases,providerIO:'synthetic only',operationalCutover:'fixture-seeded evidence only, not production drain'},null,2));
}finally{await db.$disconnect()}})().catch(error=>{console.error(error);process.exitCode=1});
