const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {root,seatSourcePath,evidenceDir}=require('./seat-regression-support.cjs'),{load:rawLoad}=require('./load-typescript.cjs'),{PrismaClient,Prisma}=require(root+'/node_modules/@prisma/client');
const explicitSourceHashes={};function load(file,mocks,globals){explicitSourceHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath(file))).digest('hex');return rawLoad(file,mocks,globals)}
const env=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),privateState=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),url=new URL(env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(url.hostname)&&url.searchParams.get('host')===privateState.socket&&privateState.socket.startsWith('/tmp/doya-')&&/^\/doya_seat_models_[0-9]+$/.test(url.pathname));
const raw=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}}),company='company-a',key='team-seat-operation:v1:'+company;
const config={NEW_PRICING_ROLLOUT:'all',STRIPE_PRICE_TEAM_BASE_MONTHLY:'price_base_m',STRIPE_PRICE_TEAM_BASE_YEARLY:'price_base_y',STRIPE_PRICE_TEAM_SEAT_MONTHLY:'price_seat_m',STRIPE_PRICE_TEAM_SEAT_YEARLY:'price_seat_y'},globals={Date,process:{env:config}};let state,providerCalls=0,auditCalls=0;
const forbidden=()=>{providerCalls++;throw Error('No provider IO')};
const ui=load('src/lib/ui-next.ts',{},globals),rollout=load('src/lib/pricing-v2/rollout.ts',{'@/lib/ui-next':ui},globals),plans=load('src/lib/pricing-v2/plans.ts',{},globals),prices=load('src/lib/pricing-v2/prices.ts',{},globals),team=load('src/lib/pricing-v2/team.ts',{'./plans':plans},globals),unified=load('src/lib/unified-plan.ts',{},globals),view=load('src/lib/pricing-v2/view.ts',{'@/lib/unified-plan':unified},globals),roles=load('src/lib/company-roles/roles.ts',{},globals),toolRoles=load('src/lib/company-roles/tool-roles.ts',{'./roles':roles},globals);
const core=load('src/lib/pricing-v2/seat-operation.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:raw},'./team':team},globals);
const kintaiToken=load('src/lib/kintai/invite-token.ts',{},globals),unionPure=load('src/lib/pricing-v2/company-seat-usage.ts',{},globals);
const unionUsers=load('src/lib/pricing-v2/company-seat-usage-users.server.ts',{'@prisma/client':{Prisma},'./company-seat-usage':unionPure},globals);
const actualRoleRollout=load('src/lib/company-roles/rollout.ts',{'@/lib/ui-next':ui},globals);
const unionEntries=load('src/lib/pricing-v2/company-seat-entries.server.ts',{'@/lib/company-roles/rollout':actualRoleRollout,'@/lib/company-roles/tool-roles':toolRoles,'@/lib/kintai/invite-token':kintaiToken,'./company-seat-usage':unionPure},globals);
const unionMinimum=load('src/lib/pricing-v2/company-seat-minimum.server.ts',{'./company-seat-entries.server':unionEntries,'./company-seat-usage-users.server':unionUsers},globals);
const capReader=load('src/lib/pricing-v2/checkout-seat-capacity.server.ts',{},globals);
const server=load('src/lib/pricing-v2/team.server.ts',{'@/lib/prisma':{prisma:raw},'@/lib/stripe':{stripe:{subscriptions:{retrieve:forbidden}},findActiveLikeSubscriptions:forbidden},'@/lib/unified-plan':unified,'./rollout':rollout,'./plans':plans,'./prices':prices,'./team':team,'./view':view,'./seat-operation':core,'./company-seat-minimum.server':unionMinimum},globals);
const ownership=load('src/lib/pricing-v2/tool-seat-ownership.server.ts',{'@/lib/company-roles/tool-roles':toolRoles,'./view':view,'./prices':prices,'./rollout':rollout},globals);
const unionScope=load('src/lib/pricing-v2/tool-seat-union-scope.server.ts',{'node:crypto':crypto,'./checkout-seat-capacity.server':capReader,'./tool-seat-ownership.server':ownership,'./team.server':server,'./team':team,'./company-seat-entries.server':unionEntries,'./company-seat-usage-users.server':unionUsers},globals);
const admission=load('src/lib/pricing-v2/tool-seat-admission.server.ts',{'@/lib/company-roles/access.server':{ceilToolRole:(input,tx)=>roleLoad('src/lib/company-roles/access.server.ts').ceilToolRole(input,tx)},'@prisma/client':{Prisma},'@/lib/prisma':{prisma:raw},'@/lib/company-roles/tool-roles':toolRoles,'./tool-seat-union-scope.server':unionScope,'./seat-operation':core},globals);


const vm=require('node:vm'),ts=require(root+'/node_modules/typescript'),roleCache=new Map(),roleHashes={};function roleLoad(file){if(roleCache.has(file))return roleCache.get(file);assert(file.startsWith('src/lib/company-roles/'));const text=fs.readFileSync(seatSourcePath(file),'utf8');roleHashes[file]=crypto.createHash('sha256').update(text).digest('hex');const mod={exports:{}};roleCache.set(file,mod.exports);function req(n){if(n==='node:crypto')return crypto;if(n==='next-auth')return{getServerSession:async()=>({user:{id:'actor',email:'actor@example.invalid',name:'Synthetic operator'}})};if(n==='@/lib/auth')return{authOptions:{}};if(n==='@/lib/prisma')return{prisma:raw};if(n==='@/lib/pricing-v2/rollout')return rollout;if(n==='@/lib/pricing-v2/prices')return prices;if(n==='@/lib/pricing-v2/tool-seat-ownership.server')return ownership;if(n==='@/lib/pricing-v2/tool-seat-union-scope.server')return unionScope;if(n==='@/lib/pricing-v2/seat-operation')return core;if(n==='@/lib/ui-next')return ui;let f=n.startsWith('@/')?'src/'+n.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),n));return roleLoad(f+'.ts');}vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:req,Date,URL,Map,Set,Error,Object,Array,Promise,console:{log(){},warn(){},error(){}},process:{env:config}},{filename:file});return mod.exports;}
const privateResponse=load('src/lib/private-api-response.ts',{'next/server':{NextResponse:Response}},globals),html=load('src/lib/html-escape.ts',{},globals);let mailCallbacks=0;const tools=['sfa'];const invitation=load('src/lib/pricing-v2/tool-seat-invitation.server.ts',{'@/lib/prisma':{prisma:raw},'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'@/lib/company-roles/tool-roles':toolRoles,'./tool-seat-admission.server':admission},globals);const planUtilities=load('src/lib/plan-utils.ts',{},globals),sfaLimits=load('src/lib/sfa/limits.ts',{'@/lib/prisma':{prisma:raw},'@/lib/plan-utils':planUtilities,'@/lib/private-api-response':privateResponse},globals);const accesses={},apis={};for(const tool of tools){const types=load('src/lib/'+tool+'/types.ts',{},globals),access=load('src/lib/'+tool+'/access.ts',{'next-auth':{getServerSession:async()=>({user:state.session})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:raw},'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'./types':types,'./constants':load('src/lib/sfa/constants.ts',{},globals)},globals);accesses[tool]=access;apis[tool]=load('src/app/api/'+tool+'/members/route.ts',{'next/server':{NextRequest:Request,NextResponse:Response},crypto,'@/lib/prisma':{prisma:raw},'@/lib/html-escape':html,['@/lib/'+tool+'/access']:access,['@/lib/'+tool+'/types']:types,'@/lib/email':{sendEmail:async()=>{mailCallbacks++;return{success:false}}},'@/lib/company-roles/tool-roles':toolRoles,'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'@/lib/private-api-response':privateResponse,'@/lib/sfa/limits':sfaLimits,'@/lib/pricing-v2/tool-seat-admission.server':admission,'@/lib/pricing-v2/tool-seat-invitation.server':invitation},globals);}

const promaneLimits=load('src/lib/promane/limits.ts',{'@/lib/prisma':{prisma:raw},'@/lib/plan-utils':planUtilities},globals),promaneIssue=load('src/lib/promane/invite-admission.ts',{'@prisma/client':{Prisma},crypto,'@/lib/prisma':{prisma:raw},'@/lib/promane/limits':promaneLimits,'@/lib/pricing-v2/tool-seat-invitation.server':invitation,'@/lib/company-roles/tool-roles':toolRoles,'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'@/lib/pricing-v2/tool-seat-admission.server':admission},globals);
const kTypes=load('src/lib/kintai/types.ts',{},globals),kAccess=load('src/lib/kintai/access.ts',{'next-auth':{getServerSession:async()=>({user:state.session})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:raw},'./types':kTypes,'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts')},globals),kManager=load('src/lib/kintai/manager-admission.ts',{'@/lib/company-roles/tool-roles':toolRoles},globals),kEmployee=load('src/lib/kintai/employee-admission.ts',{'@/lib/pricing':{getKintaiEmployeeLimitByUserPlan:()=>{throw Error('Quota helper not used by token reissue')},HIGH_USAGE_CONTACT_URL:'http://synthetic.invalid/contact'},'@/lib/plan-utils':planUtilities},globals),kToken=load('src/lib/kintai/invite-token.ts',{}, {...globals,crypto}),kApi=load('src/app/api/kintai/employees/[id]/invite/route.ts',{'next/server':{NextRequest:Request,NextResponse:Response},'@/lib/prisma':{prisma:raw},'@/lib/html-escape':html,'@/lib/kintai/access':kAccess,'@/lib/kintai/employee-admission':kEmployee,'@/lib/kintai/manager-admission':kManager,'@/lib/kintai/invite-token':kToken,'@/lib/private-api-response':privateResponse,'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'@/lib/company-roles/tool-roles':toolRoles,'@/lib/pricing-v2/tool-seat-admission.server':admission,'@/lib/pricing-v2/tool-seat-invitation.server':invitation,'@/lib/email':{sendEmail:async()=>{mailCallbacks++;return{success:false}}}},globals);
const kPricing=load('src/lib/pricing.ts',{'./unified-plan':unified},globals),kPostEmployee=load('src/lib/kintai/employee-admission.ts',{'@/lib/pricing':kPricing,'@/lib/plan-utils':planUtilities},globals),kPostManager=load('src/lib/kintai/manager-admission.ts',{'@/lib/company-roles/tool-roles':toolRoles,'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'./employee-admission':kPostEmployee},globals),kPostActual=load('src/app/api/kintai/employees/route.ts',{'next/server':{NextRequest:Request,NextResponse:Response},'@/lib/prisma':{prisma:raw},'@/lib/html-escape':html,'@/lib/kintai/access':kAccess,'@/lib/kintai/employee-admission':kPostEmployee,'@/lib/kintai/manager-admission':kPostManager,'@/lib/kintai/invite-token':kToken,'@/lib/company-roles/access.server':roleLoad('src/lib/company-roles/access.server.ts'),'@/lib/pricing-v2/tool-seat-admission.server':admission,'@/lib/pricing-v2/rollout':rollout,'@/lib/private-api-response':privateResponse,'@/lib/email':{sendEmail:async()=>{mailCallbacks++;return {success:false}}}}, {...globals,crypto});let privateResponseChecks=0;const kPost=new Proxy(kPostActual,{get(target,key){const fn=target[key];if(typeof fn!=='function')return fn;return async(...args)=>{const r=await fn(...args);assert.equal(r.headers.get('cache-control'),'private, no-store');assert((r.headers.get('vary')||'').split(',').some(v=>v.trim().toLowerCase()==='cookie'));privateResponseChecks++;return r}}});const rows=[];let completed=false,failedCase=null;async function prep(tool,spec){state={session:{id:'owner-a',email:'owner-a@example.invalid',name:'Synthetic owner'}};config.NEW_PRICING_ROLLOUT='all';config.COMPANY_ROLES_ROLLOUT='all';await raw.promaneWorkspace.deleteMany();await raw.kintaiOrganization.deleteMany();await raw.sfaOrganization.deleteMany();await raw.accountCompanyToolOrg.deleteMany();await raw.systemSetting.deleteMany();await raw.user.deleteMany();await raw.user.createMany({data:[{id:'owner-a',email:'owner-a@example.invalid',plan:'PRO',stripePriceId:'price_base_m'},{id:'actor',email:'actor@example.invalid',plan:'FREE'}]});await raw.accountCompany.create({data:{id:company,userId:'owner-a',name:'Synthetic company'}});if(!spec.missing)await raw.accountCompanyBilling.create({data:{companyId:company,seats:spec.seats||2,checkedAt:new Date(),stripeSubscriptionId:'sub_synthetic_'+tool,billingInterval:'month'}});
if(tool==='promane'){await raw.promaneWorkspace.create({data:{id:'org-a',userId:'owner-a',name:'Synthetic workspace',slug:'synthetic-creation'}});await raw.promaneMember.create({data:{workspaceId:'org-a',userId:'owner-a',role:'owner',displayName:'Synthetic owner',isActive:true}})}else{await raw.kintaiOrganization.create({data:{id:'org-a',name:'Synthetic Kintai',slug:'synthetic-creation'}});await raw.kintaiMember.createMany({data:[{id:'k-owner',organizationId:'org-a',userId:'owner-a',role:'system_admin',status:'ACTIVE'},{id:'k-target',organizationId:'org-a',userId:'actor',role:'employee',status:'INACTIVE'}]});await raw.kintaiEmployee.createMany({data:[{id:'k-owner-employee',organizationId:'org-a',memberId:'k-owner',name:'Synthetic owner',email:'owner-a@example.invalid'},{id:'k-target-employee',organizationId:'org-a',memberId:'k-target',name:'Synthetic target',email:'actor@example.invalid'}]})}
await raw.accountCompanyToolOrg.create({data:{companyId:company,tool,organizationId:'org-a',linkedBy:'owner-a'}});if(spec.busy)await raw.systemSetting.create({data:{key,value:JSON.stringify({revision:100,active:{phase:'preparing',operationKey:'30000000-0000-4000-8000-000000000003',requested:2,token:crypto.randomUUID(),leaseUntil:Date.now()+300000}})}})}
async function license(tool){const resolved=await unionScope.resolveToolUnionScope({tool,organizationId:'org-a'},raw);try{return resolved.enabled&&'scope'in resolved?await unionScope.readToolUnionLicense(resolved.scope,raw):{unavailable:true}}catch{return{unavailable:true}}}

const linkModules = {
  kintai:['kintaiOrganization','kintaiMember'], hr:['hrOrganization','hrOrganizationMember'],
  expense:['expenseOrganization','expenseMember'], income:['incomeOrganization','incomeMember'],
  quote:['quoteOrganization','quoteMember'], promane:['promaneWorkspace','promaneMember'],
  sfa:['sfaOrganization','sfaMember'], shodan:['shodanOrganization','shodanMember'],
  aio:['aioOrganization','aioMember'], mensetsu:['mensetsuOrganization','mensetsuMember'],
  aishodan:['aishodanOrganization','aishodanMember'],
};
let sessionCalls=0,linkResponseChecks=0;
function makeApi(context={companyId:company,userId:'actor',role:'admin'}) {
  const envelope=load('src/lib/company-roles/api.server.ts',{
    '@/lib/private-api-response':privateResponse,'next-auth':{getServerSession:async()=>{sessionCalls++;return state.noSession?null:{user:{id:context.userId,email:context.userId+'@example.invalid'}}}},
    '@/lib/auth':{authOptions:{}},'./rollout':actualRoleRollout,
    './members.server':{companyRolesSession:async()=>context},
  },globals);
  return load('src/app/api/company/tool-orgs/route.ts',{
    '@/lib/prisma':{prisma:raw},'@/lib/company-roles/api.server':envelope,
    '@/lib/company-roles/roles':roles,'@/lib/company-roles/tool-roles':toolRoles,
    '@/lib/company-roles/tool-orgs.server':roleLoad('src/lib/company-roles/tool-orgs.server.ts'),
    '@/lib/company-roles/access':roleLoad('src/lib/company-roles/access.ts'),
    '@/lib/company-roles/access.server':{writeRoleEvent:async(event,tx)=>{
      if(state.failAuditBeforeSql)throw Error('Synthetic audit SQL failure');
      const saved=await roleLoad('src/lib/company-roles/access.server.ts').writeRoleEvent(event,tx);
      if(state.auditGate){state.auditGate.enter();await state.auditGate.release;}
      if(state.failAudit)throw Error('Synthetic failure after audit SQL');
      return saved;
    }},
  },globals);
}
async function target(tool,id='org-b',owner='actor',operator='third'){
  const [orgName,memberName]=linkModules[tool];
  await raw[orgName].create({data:{id,name:'Synthetic link target',slug:'synthetic-link-'+tool+'-'+id,...(tool==='promane'?{userId:owner}:{})}});
  const order=toolRoles.TOOL_ROLE_TABLES[tool].order,top=order[order.length-1],member=tool==='promane'?'member':order[0];
  const scope=tool==='promane'?{workspaceId:id}:{organizationId:id};
  await raw[memberName].createMany({data:[
    {id:id+'-owner',...scope,userId:owner,role:top,createdAt:new Date('2025-01-02T00:00:00Z'),...(tool==='promane'?{isActive:true,displayName:'Synthetic owner'}:{status:'ACTIVE'}),...(tool==='expense'?{name:'Synthetic owner'}:{})},
    {id:id+'-member',...scope,userId:operator,role:member,createdAt:new Date('2025-01-03T00:00:00Z'),...(tool==='promane'?{isActive:true,displayName:'Synthetic member'}:{status:'ACTIVE'}),...(tool==='expense'?{name:'Synthetic member'}:{})},
  ]});
  if(tool==='kintai')await raw.kintaiEmployee.createMany({data:[
    {id:id+'-employee-owner',organizationId:id,memberId:id+'-owner',name:'Synthetic owner',email:owner+'@example.invalid'},
    {id:id+'-employee-member',organizationId:id,memberId:id+'-member',name:'Synthetic member',email:operator+'@example.invalid'},
  ]});
}
async function setup(spec={},tool='kintai'){
  await raw.accountCompanyRoleEvent.deleteMany();
  for(const [org] of Object.values(linkModules))await raw[org].deleteMany();
  await prep('kintai',{seats:3,...spec});state.failAudit=false;state.noSession=false;state.auditGate=null;sessionCalls=0;mailCallbacks=0;
  await raw.user.create({data:{id:'third',email:'third@example.invalid',plan:'FREE'}});
  await raw.accountCompanyMember.create({data:{id:'central-actor',companyId:company,userId:'actor',email:'actor@example.invalid',role:'admin',status:'active'}});
  await target(tool);
}
function request(tool='kintai',organizationId='org-b'){
  return new Request('http://localhost/api/company/tool-orgs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tool,organizationId})});
}
async function invoke(api=makeApi(),tool='kintai',org='org-b'){
  const response=await api.POST(request(tool,org));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert((response.headers.get('vary')||'').split(',').some(v=>v.trim().toLowerCase()==='cookie'));
  linkResponseChecks++;return {status:response.status,body:await response.json()};
}
async function record(name,expected,response,extra={}){
  assert.equal(response.status,expected,name);
  rows.push({name,status:response.status,code:response.body.code??null,
    links:await raw.accountCompanyToolOrg.count({where:{organizationId:'org-b'}}),
    auditRows:await raw.accountCompanyRoleEvent.count(),...extra});
}
async function denyCase(name,expected,mutate,code){
  failedCase=name;await setup();await mutate();const r=await invoke();
  if(code)assert.equal(r.body.code,code,name);
  assert.equal(await raw.accountCompanyToolOrg.count({where:{organizationId:'org-b'}}),0,name+' rollback link');
  assert.equal(await raw.accountCompanyRoleEvent.count(),0,name+' no audit after denial');
  await record(name,expected,r);
}
function gate(){let enter,release;const entered=new Promise(r=>{enter=r}),wait=new Promise(r=>{release=r});return{entered,enter,release:wait,open:release};}
async function waitForLock(){
  const deadline=Date.now()+4000;
  while(Date.now()<deadline){
    const x=await raw.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock'");
    if(x[0].n>0)return true;
    await new Promise(r=>setTimeout(r,20));
  }
  return false;
}

function profileApi(userId='actor'){
  const pure=load('src/lib/shell/company.ts',{}, {...globals,URL});
  const server=load('src/lib/shell/company.server.ts',{
    'next-auth':{getServerSession:async()=>state.noSession?null:{user:{id:userId,email:userId+'@example.invalid'}}},
    '@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:raw},'./company':pure,
  },{...globals,URL});
  return load('src/app/api/account/company/route.ts',{
    'next/server':{NextRequest:Request,NextResponse:Response},
    '@/lib/shell/company':pure,'@/lib/shell/company.server':server,
  },{...globals,URL});
}
async function putProfile(userId='actor',body={name:'Synthetic actor profile',userId:'owner-a'}){
  const response=await profileApi(userId).PUT(new Request('http://localhost/api/account/company',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  return {status:response.status,privateNoStore:true,varyCookie:(response.headers.get('vary')||'').toLowerCase().includes('cookie')};
}
async function remove(context={companyId:company,userId:'owner-a',role:'owner'},org='org-a',tool='kintai'){
  const response=await makeApi(context).DELETE(new Request('http://localhost/api/company/tool-orgs?tool='+tool+'&organizationId='+org,{method:'DELETE'}));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert((response.headers.get('vary')||'').toLowerCase().includes('cookie'));
  return {status:response.status,body:await response.json()};
}
async function links(org='org-a'){return raw.accountCompanyToolOrg.count({where:{tool:'kintai',organizationId:org}});}
function entered(pause){return Promise.race([pause.entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Expected SQL gate did not enter')),5000);timer.unref()})]);}
raw.$use(async(params,next)=>{
  const result=await next(params);
  if(params.model==='KintaiEmployee'&&params.action==='create'&&state?.admissionGate){
    state.admissionGate.enter();await state.admissionGate.release;
  }
  return result;
});
async function kCreate(){
  state.session={id:'actor',email:'actor@example.invalid',name:'Synthetic operator'};
  return kPost.POST(new Request('http://localhost/api/kintai/employees',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Synthetic pending employee',email:'profile-race@example.invalid',role:'employee'})}));
}
(async()=>{try{
  failedCase='owner unlink control';await setup();let r=await remove();assert.equal(r.status,200);assert.equal(await links(),0);rows.push({name:failedCase,status:r.status,linksAfter:0,auditRows:await raw.accountCompanyRoleEvent.count()});
  failedCase='unlink followed by automatic role resolution';
  const roleAssociation=await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-a');
  assert.equal(roleAssociation.linked,false);assert.equal(await links(),0);
  rows.push({name:failedCase,automaticRelinkSuppressed:true,linksAfter:0,auditRows:await raw.accountCompanyRoleEvent.count(),policyGap:false,scope:'Same-company automatic relinking remains suppressed; verified billing scope remains.'});

  failedCase='admin cannot unlink';await setup();r=await remove({companyId:company,userId:'actor',role:'admin'});assert.equal(r.status,403);assert.equal(await links(),1);rows.push({name:failedCase,status:r.status,linksAfter:1});
  failedCase='owner cannot unlink another company';await setup();await raw.user.create({data:{id:'owner-b',email:'owner-b@example.invalid',plan:'FREE'}});await raw.accountCompany.create({data:{id:'company-b',userId:'owner-b',name:'Synthetic company B'}});r=await remove({companyId:'company-b',userId:'owner-b',role:'owner'});assert.equal(r.status,404);assert.equal(await links(),1);rows.push({name:failedCase,status:r.status,linksAfter:1});

  failedCase='audit failure after link deletion';await setup();state.failAuditBeforeSql=true;r=await remove();state.failAuditBeforeSql=false;assert.equal(r.status,503);assert.equal(await links(),1);assert.equal(await raw.accountCompanyRoleEvent.count(),0);
  rows.push({name:failedCase,status:r.status,linksAfter:1,auditRows:0,policyGap:false,failedResponseRolledBack:true,syntheticAuditFailure:true});

  failedCase='ownership changes after initial context';await setup();await raw.user.create({data:{id:'owner-b',email:'owner-b@example.invalid',plan:'FREE'}});await raw.accountCompany.update({where:{id:company},data:{userId:'owner-b'}});r=await remove();assert.equal(r.status,403);assert.equal(await links(),1);rows.push({name:failedCase,status:r.status,linksAfter:1,initialActor:'owner-a',currentOwner:'owner-b',currentOwnerNotRechecked:false,scope:'Conditional database ownership mutation; no public ownership-transfer API or production exploit is asserted.'});

  failedCase='unlink without session';await setup();state.noSession=true;r=await remove();assert.equal(r.status,401);assert.equal(await links(),1);rows.push({name:failedCase,status:r.status,linksAfter:1});
  failedCase='unlink company flag off';await setup();config.COMPANY_ROLES_ROLLOUT='off';r=await remove();assert.equal(r.status,404);assert.equal(sessionCalls,0);assert.equal(await links(),1);rows.push({name:failedCase,status:r.status,linksAfter:1,sessionCalls});

  failedCase='profile without session';await setup();state.noSession=true;let p=await putProfile();assert.equal(p.status,401);assert.equal(await raw.accountCompany.count({where:{userId:'actor'}}),0);rows.push({name:failedCase,...p,createdOwnProfile:false});
  failedCase='profile ignores supplied userId';await setup();p=await putProfile();assert.equal(p.status,200);const own=await raw.accountCompany.findUnique({where:{userId:'actor'}});assert(own);assert.equal((await raw.accountCompany.findUnique({where:{id:company}})).name,'Synthetic company');assert.equal((await raw.user.findUnique({where:{id:'actor'}})).plan,'FREE');assert.equal(await raw.accountCompanyMember.count({where:{companyId:own.id}}),0);rows.push({name:failedCase,...p,onlySessionUserModified:true,userPlanUnchanged:true,noAutomaticCentralMembership:true});
  failedCase='profile invalid name';await setup();p=await putProfile('actor',{name:'  '});assert.equal(p.status,400);assert.equal(await raw.accountCompany.count({where:{userId:'actor'}}),0);rows.push({name:failedCase,...p});

  failedCase='profile exists before explicit linking';await setup();assert.equal((await putProfile()).status,200);const old=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);assert(old.enabled&&'scope'in old&&old.scope.companyId);const linked=await invoke();assert.equal(linked.status,201);const now=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);assert.equal(now.scope.companyId,company);rows.push({name:failedCase,linkStatus:201,oldCompanyDifferentFromDestination:old.scope.companyId!==company,usage:await license('kintai')});assert.equal(rows.at(-1).usage.used,3);

  failedCase='new profile waits for explicit link User lock';await setup();let pause=gate();state.auditGate=pause;let linking=invoke();await entered(pause);let profiling=putProfile();let waiting=await waitForLock();pause.open();const linkResult=await linking;const profileResult=await profiling;state.auditGate=null;assert(waiting);assert.equal(linkResult.status,201);assert.equal(profileResult.status,200);rows.push({name:failedCase,linkStatus:201,profileStatus:200,nativeLockWaitObserved:waiting,usage:await license('kintai')});assert.equal(rows.at(-1).usage.used,3);assert.equal((await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw)).scope.companyId,company);

  failedCase='existing profile update waits for Company lock';await setup();pause=gate();state.auditGate=pause;linking=invoke();await entered(pause);profiling=putProfile('owner-a',{name:'Synthetic renamed profile'});waiting=await waitForLock();pause.open();assert.equal((await linking).status,201);assert.equal((await profiling).status,200);state.auditGate=null;assert(waiting);assert.equal((await raw.accountCompany.findUnique({where:{id:company}})).name,'Synthetic renamed profile');assert.equal((await raw.kintaiOrganization.findUnique({where:{id:'org-a'}})).name,'Synthetic Kintai');rows.push({name:failedCase,nativeLockWaitObserved:waiting,companyOwnerUnchanged:true,toolOrganizationNameUnchanged:true,usage:await license('kintai')});

  failedCase='profile insertion waits for actual admission User pin';await setup();pause=gate();state.admissionGate=pause;const admitting=kCreate();await entered(pause);profiling=putProfile();waiting=await waitForLock();pause.open();const admitted=await admitting;assert.equal((await profiling).status,200);state.admissionGate=null;assert(waiting);assert.equal(admitted.status,201);const resolved=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);const licensed=await unionScope.readToolUnionLicense(resolved.scope,raw);assert.equal(licensed.used,3);assert.equal(licensed.limit,3);rows.push({name:failedCase,admissionStatus:201,nativeForeignKeyWaitObserved:waiting,used:licensed.used,limit:licensed.limit,syntheticMailCallbacks:mailCallbacks,realMailSends:0});

  failedCase='profile between scope resolution and User pin rejects stale admission';await setup();const initial=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);assert(initial.enabled&&'scope'in initial&&!initial.scope.companyId);pause=gate();const blocker=raw.$transaction(tx=>core.withSeatContextInTransaction(initial.scope.fenceKey,tx,async()=>{pause.enter();await pause.release}),{timeout:10000});await entered(pause);const obsolete=kCreate();waiting=await waitForLock();assert(waiting);assert.equal((await putProfile()).status,200);pause.open();await blocker;const stale=await obsolete;assert.equal(stale.status,409);assert.equal(await raw.kintaiEmployee.count({where:{organizationId:'org-b'}}),2);assert.equal(mailCallbacks,0);rows.push({name:failedCase,status:stale.status,nativeOldScopeFenceWaitObserved:waiting,newEmployees:0,syntheticMailCallbacks:0});

  failedCase='profile does not enlarge legacy seat limit';await setup();await raw.user.update({where:{id:'actor'},data:{plan:'PRO',stripePriceId:null}});assert.equal((await putProfile()).status,200);let scope=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);let capacity=await unionScope.readToolUnionLicense(scope.scope,raw);assert.equal(capacity.limit,1);const denied=await kCreate();assert.equal(denied.status,409);assert.equal(mailCallbacks,0);rows.push({name:failedCase,status:denied.status,kind:scope.scope.kind,limit:1,realMailSends:0});
  failedCase='profile does not invent Team cache';await setup();await raw.user.update({where:{id:'actor'},data:{plan:'PRO',stripePriceId:'price_base_m'}});assert.equal((await putProfile()).status,200);scope=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);assert.equal(scope.scope.kind,'team');const unavailable=await kCreate();assert.equal(unavailable.status,503);assert.equal(mailCallbacks,0);assert.equal(await raw.accountCompanyBilling.count({where:{companyId:scope.scope.companyId}}),0);rows.push({name:failedCase,status:unavailable.status,kind:'team',createdSeatCache:false,realProviderRequests:providerCalls});
  for(const tool of Object.keys(linkModules)){
    failedCase=tool+' persistent unlink and explicit relink';await setup();await target(tool,'org-c','owner-a','third');
    await raw.accountCompanyToolOrg.create({data:{tool,organizationId:'org-c',companyId:company,linkedBy:'owner-a'}});
    const unlinked=await remove(undefined,'org-c',tool);assert.equal(unlinked.status,200,tool);
    const association=await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg(tool,'org-c');
    assert.equal(association.linked,false);assert.equal(await raw.accountCompanyToolOrg.count({where:{tool,organizationId:'org-c'}}),0);
    const beforeScope=await unionScope.resolveToolUnionScope({tool,organizationId:'org-c'},raw);assert.equal(beforeScope.scope.companyId,company);
    assert.equal((await unionScope.readToolUnionLicense(beforeScope.scope,raw)).used,3);
    const relink=await invoke(makeApi({companyId:company,userId:'owner-a',role:'owner'}),tool,'org-c');assert.equal(relink.status,201,tool);
    const after=await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg(tool,'org-c');assert.equal(after.linked,true);
    const marker=await roleLoad('src/lib/company-roles/auto-link-opt-out.server.ts').automaticLinkOptedOut(raw,company,tool,'org-c');assert.equal(marker,false);
    rows.push({name:failedCase,unlinkStatus:200,automaticRelink:false,relinkStatus:201,seatUsage:3,optOutClearedAfterExplicitLink:true});
  }

  const optOut=roleLoad('src/lib/company-roles/auto-link-opt-out.server.ts');
  for(const spec of [
    {name:'missing purchased-seat cache',spec:{missing:true},status:503},
    {name:'financial change in progress',spec:{busy:true},status:409},
    {name:'insufficient seats after unlink',spec:{seats:1},status:409},
    {name:'malformed financial state',spec:{},status:503,corrupt:true},
  ]){
    failedCase=spec.name;await setup(spec.spec);
    if(spec.corrupt)await raw.systemSetting.create({data:{key,value:'{broken'}});
    const oldState=await raw.systemSetting.findUnique({where:{key}});
    const result=await remove();assert.equal(result.status,spec.status);
    assert.equal(await links(),1);assert.equal(await optOut.automaticLinkOptedOut(raw,company,'kintai','org-a'),false);
    assert.equal(await raw.accountCompanyRoleEvent.count(),0);
    assert.equal((await raw.systemSetting.findUnique({where:{key}}))?.value,oldState?.value);
    rows.push({name:failedCase,status:result.status,linkRetained:true,optOutNotCommitted:true,financialClaimUnchanged:true});
  }
  failedCase='failure after actual audit SQL rolls back marker and unlink';await setup();state.failAudit=true;
  r=await remove();state.failAudit=false;assert.equal(r.status,503);assert.equal(await links(),1);
  assert.equal(await optOut.automaticLinkOptedOut(raw,company,'kintai','org-a'),false);assert.equal(await raw.accountCompanyRoleEvent.count(),0);
  rows.push({name:failedCase,status:503,actualAuditSqlRolledBack:true,markerRolledBack:true,linkRetained:true});

  failedCase='explicit relink denial retains opt out';await setup();assert.equal((await remove()).status,200);
  await raw.accountCompanyBilling.update({where:{companyId:company},data:{seats:1}});
  const relinkDenied=await invoke(makeApi({companyId:company,userId:'owner-a',role:'owner'}),'kintai','org-a');
  assert.equal(relinkDenied.status,409);assert.equal(await links(),0);assert.equal(await optOut.automaticLinkOptedOut(raw,company,'kintai','org-a'),true);
  rows.push({name:failedCase,status:409,markerRetained:true,linkNotRecreated:true});

  failedCase='marker contents cannot restore automatic link';await setup();assert.equal((await remove()).status,200);
  await raw.systemSetting.update({where:{key:optOut.automaticLinkOptOutKey(company,'kintai','org-a')},data:{value:'corrupt-or-legacy'}});
  assert.equal((await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-a')).linked,false);
  assert.equal(await links(),0);assert.equal(await optOut.automaticLinkOptedOut(raw,'unrelated-company','kintai','org-a'),false);
  rows.push({name:failedCase,unknownMarkerStillBlocks:true,unrelatedCompanyUnaffected:true});

  failedCase='pricing off unlink choice survives reenable';await setup();config.NEW_PRICING_ROLLOUT='off';
  assert.equal((await remove()).status,200);config.NEW_PRICING_ROLLOUT='all';
  assert.equal((await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-a')).linked,false);
  assert.equal(await links(),0);assert.equal((await license('kintai')).used,2);
  rows.push({name:failedCase,linkNotRecreated:true,seatUsage:2});

  for(const seats of [1,3]){
    failedCase='unlink to verified other owner company seats '+seats;await setup();
    await raw.user.update({where:{id:'actor'},data:{plan:'PRO',stripePriceId:'price_base_m'}});
    await raw.accountCompany.create({data:{id:'company-b',userId:'actor',name:'Synthetic payer B'}});
    await raw.accountCompanyBilling.create({data:{companyId:'company-b',seats,checkedAt:new Date(),stripeSubscriptionId:'sub_synthetic_b',billingInterval:'month'}});
    await raw.accountCompanyToolOrg.create({data:{companyId:company,tool:'kintai',organizationId:'org-b',linkedBy:'owner-a'}});
    r=await remove(undefined,'org-b');assert.equal(r.status,seats===1?409:200);
    assert.equal(await raw.accountCompanyToolOrg.count({where:{organizationId:'org-b'}}),seats===1?1:0);
    if(seats===3){
      const inferred=await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-b');
      assert.equal(inferred.companyId,'company-b');assert.equal(inferred.linked,true);
      assert.equal(await optOut.automaticLinkOptedOut(raw,company,'kintai','org-b'),true);
      const scope=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);
      assert.equal((await unionScope.readToolUnionLicense(scope.scope,raw)).used,2);
    }
    rows.push({name:failedCase,status:r.status,noInventedPayer:true,destinationSeats:seats});
  }

  failedCase='transferred creator ambiguity cannot invent payer on unlink';await setup();
  await raw.kintaiMember.update({where:{id:'k-owner'},data:{role:'employee'}});
  await raw.kintaiMember.update({where:{id:'k-target'},data:{role:'system_admin',status:'ACTIVE'}});
  r=await remove();assert.equal(r.status,503);assert.equal(await links(),1);
  rows.push({name:failedCase,status:503,linkRetained:true,transferPayerNotInvented:true});

  failedCase='parallel unlink commits once';await setup();
  const pair=await Promise.all([remove(),remove()]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,404]);
  assert.equal(await links(),0);assert.equal(await raw.accountCompanyRoleEvent.count(),1);
  assert.equal((await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-a')).linked,false);
  rows.push({name:failedCase,statuses:pair.map(x=>x.status),auditRows:1,automaticRelink:false});

  failedCase='unlink waits for actual employee admission and preserves seats';await setup();
  await raw.accountCompanyBilling.update({where:{companyId:company},data:{seats:4}});
  await raw.accountCompanyToolOrg.create({data:{companyId:company,tool:'kintai',organizationId:'org-b',linkedBy:'owner-a'}});
  let admissionPause=gate();state.admissionGate=admissionPause;let actualAdmission=kCreate();await entered(admissionPause);
  let pendingUnlink=remove(undefined,'org-b');let nativeWaiting=await waitForLock();admissionPause.open();
  const admissionResponse=await actualAdmission,unlinkResponse=await pendingUnlink;state.admissionGate=null;
  assert(nativeWaiting);assert.equal(admissionResponse.status,201);
  // FREE retains its configured three-account allowance; no purchased seats
  // are invented. Verify the complete resulting union, including reservation.
  assert.equal(unlinkResponse.status,200);assert.equal(await raw.accountCompanyToolOrg.count({where:{organizationId:'org-b'}}),0);
  const freeScope=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);
  const freeLicense=await unionScope.readToolUnionLicense(freeScope.scope,raw);assert.equal(freeLicense.used,3);assert.equal(freeLicense.limit,3);
  rows.push({name:failedCase,admissionStatus:201,unlinkStatus:200,nativeLockWaitObserved:true,used:3,limit:3,realMailSends:0});


  failedCase='first automatic link remains available without opt out';await setup();await raw.accountCompanyToolOrg.deleteMany({where:{tool:'kintai',organizationId:'org-a'}});
  const firstAuto=await roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-a');
  assert.equal(firstAuto.linked,true);assert.equal(await links(),1);
  rows.push({name:failedCase,automaticLinkCreated:true,explicitOptOutNotRequiredForUntouchedOrg:true});

  failedCase='stale automatic link read cannot overwrite concurrent unlink';await setup();await raw.accountCompanyToolOrg.deleteMany({where:{tool:'kintai',organizationId:'org-a'}});
  const lazyPause=gate();
  const blockAuto=raw.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT id FROM account_companies WHERE id=$1 FOR UPDATE',company);
    lazyPause.enter();await lazyPause.release;
    // Model a concurrent committed explicit unlink while the first role read
    // has already seen no link and is waiting on this actual Company row.
    await optOut.suppressAutomaticLink(tx,company,'kintai','org-a');
  },{timeout:10000});
  await entered(lazyPause);
  const staleAutomatic=roleLoad('src/lib/company-roles/tool-orgs.server.ts').companyOfToolOrg('kintai','org-a');
  const lazyWait=await waitForLock();assert(lazyWait);lazyPause.open();await blockAuto;
  assert.equal((await staleAutomatic).linked,false);assert.equal(await links(),0);
  rows.push({name:failedCase,nativeCompanyWaitObserved:true,automaticLinkNotRecreated:true});

  failedCase='failed relink audit retains opt out';await setup();assert.equal((await remove()).status,200);
  state.failAudit=true;
  const failedRelink=await invoke(makeApi({companyId:company,userId:'owner-a',role:'owner'}),'kintai','org-a');
  state.failAudit=false;assert.equal(failedRelink.status,503);assert.equal(await links(),0);
  assert.equal(await optOut.automaticLinkOptedOut(raw,company,'kintai','org-a'),true);
  assert.equal(await raw.accountCompanyRoleEvent.count(),1);
  rows.push({name:failedCase,status:503,optOutRetained:true,failedAuditRolledBack:true});

  failedCase='company guest ceiling survives unlink without losing operator seats';await setup();
  await raw.accountCompanyMember.update({where:{id:'central-actor'},data:{role:'guest'}});
  await raw.kintaiMember.update({where:{id:'k-target'},data:{status:'ACTIVE'}});
  const beforeGuest=await roleLoad('src/lib/company-roles/access.server.ts').ceilToolRole({tool:'kintai',organizationId:'org-a',userId:'actor',email:'actor@example.invalid',toolRole:'employee'},raw);
  assert.equal((await remove()).status,200);
  const afterGuest=await roleLoad('src/lib/company-roles/access.server.ts').ceilToolRole({tool:'kintai',organizationId:'org-a',userId:'actor',email:'actor@example.invalid',toolRole:'employee'},raw);
  assert.equal(afterGuest,beforeGuest);
  assert.equal((await license('kintai')).used,1);
  rows.push({name:failedCase,roleCeilingUnchanged:true,guestNotCharged:true,used:1});

  completed=true;failedCase=null;
}finally{
  await raw.$disconnect();fs.mkdirSync(evidenceDir,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'company-unlink-seat-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),completed,failedCase,count:rows.length,rows,sourceHashes:{...explicitSourceHashes,...roleHashes},actualDeleteAndProfilePut:true,actualAdmissionAndLinkGuards:true,realPrivateSql:true,syntheticSessionAndInitialCompanyContext:true,productionWrites:0,realProviderRequests:providerCalls,realMailSends:0,scope:'Persistent unlink, explicit relink, role and profile/admission coordination. No production mutations or public owner-transfer exploit claim.'},null,2)+'\n');
}assert(completed);})().catch(e=>{console.error(e);process.exitCode=1});
