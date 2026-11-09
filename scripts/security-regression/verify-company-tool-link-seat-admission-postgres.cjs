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
      assert(tx,'Audit must use the link transaction');
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
  await prep('kintai',{seats:3,...spec});state.failAudit=false;state.noSession=false;state.auditGate=null;sessionCalls=0;
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
(async()=>{try{
  for(const tool of Object.keys(linkModules)){
    for(const seats of [3,2]){
      failedCase=tool+' link '+(seats===3?'available':'full');await setup({seats},tool);
      const r=await invoke(makeApi(),tool);
      await record(failedCase,seats===3?201:409,r,{tool,usage:await license('kintai')});
      assert.equal(rows.at(-1).usage.used,seats===3?3:2);
      assert.equal(rows.at(-1).links,seats===3?1:0);
      assert.equal(rows.at(-1).auditRows,seats===3?1:0);
      if(seats===2)assert.equal(r.body.code,'SEAT_CAPACITY_EXCEEDED');
    }
  }
  await denyCase('missing capacity',503,()=>raw.accountCompanyBilling.deleteMany(), 'SEAT_CAPACITY_UNAVAILABLE');
  await denyCase('financial operation busy',409,async()=>{await raw.systemSetting.upsert({where:{key},create:{key,value:JSON.stringify({revision:1,active:{phase:'preparing',operationKey:'30000000-0000-4000-8000-000000000003',requested:2,token:crypto.randomUUID(),leaseUntil:Date.now()+300000}})},update:{value:JSON.stringify({revision:1,active:{phase:'preparing',operationKey:'30000000-0000-4000-8000-000000000003',requested:2,token:crypto.randomUUID(),leaseUntil:Date.now()+300000}})}})},'SEAT_OPERATION_BUSY');
  await denyCase('malformed financial state',503,()=>raw.systemSetting.upsert({where:{key},create:{key,value:'bad-state'},update:{value:'bad-state'}}),'SEAT_CAPACITY_UNAVAILABLE');
  await denyCase('company admin demoted after context',403,()=>raw.accountCompanyMember.update({where:{id:'central-actor'},data:{role:'member'}}),'NOT_ALLOWED');
  await denyCase('tool owner demoted after context',403,()=>raw.kintaiMember.update({where:{id:'org-b-owner'},data:{role:'manager'}}),'NOT_TOP_MEMBER');
  await denyCase('unknown company role',403,()=>raw.accountCompanyMember.update({where:{id:'central-actor'},data:{role:'unknown'}}),'NOT_ALLOWED');
  await denyCase('conflicting company roles',403,()=>raw.accountCompanyMember.create({data:{id:'conflict',companyId:company,userId:'actor',email:'actor-other@example.invalid',role:'guest',status:'active'}}),'NOT_ALLOWED');
  await denyCase('unknown tool owner role',403,()=>raw.kintaiMember.update({where:{id:'org-b-owner'},data:{role:'unknown'}}),'NOT_TOP_MEMBER');

  failedCase='same User across tools';await setup({seats:2},'promane');
  await raw.promaneMember.update({where:{id:'org-b-member'},data:{userId:'owner-a'}});
  await record(failedCase,201,await invoke(makeApi(),'promane'),{usage:await license('kintai')});assert.equal((await license('kintai')).used,2);

  failedCase='readonly Promane guest';await setup({seats:2},'promane');
  await raw.promaneMember.update({where:{id:'org-b-member'},data:{role:'guest'}});
  await record(failedCase,201,await invoke(makeApi(),'promane'));assert.equal((await license('kintai')).used,2);

  failedCase='idempotent retry while busy and missing cache';await setup();
  assert.equal((await invoke()).status,201);
  const prior=await raw.systemSetting.findUnique({where:{key}});const active=JSON.stringify({revision:JSON.parse(prior.value).revision,active:{phase:'preparing',operationKey:'30000000-0000-4000-8000-000000000003',requested:2,token:crypto.randomUUID(),leaseUntil:Date.now()+300000}});
  await raw.systemSetting.update({where:{key},data:{value:active}});await raw.accountCompanyBilling.deleteMany();
  await record(failedCase,200,await invoke());assert.equal(await raw.accountCompanyRoleEvent.count(),1);assert.equal((await raw.systemSetting.findUnique({where:{key}})).value,active);

  await denyCase('failure after audit SQL rolls back link and event',503,async()=>{state.failAudit=true});

  failedCase='new pricing off preserves explicit linking';await setup({seats:1});
  config.NEW_PRICING_ROLLOUT='off';await raw.accountCompanyBilling.deleteMany();
  await record(failedCase,201,await invoke());assert.equal(await raw.systemSetting.count(),0);assert.equal((await raw.user.findUnique({where:{id:'actor'}})).plan,'FREE');

  failedCase='company owner without central row';await setup();
  await raw.kintaiMember.update({where:{id:'org-b-owner'},data:{userId:'owner-a'}});
  await record(failedCase,201,await invoke(makeApi({companyId:company,userId:'owner-a',role:'owner'})));

  failedCase='already linked elsewhere';await setup();
  await raw.accountCompany.create({data:{id:'company-other',userId:'third',name:'Synthetic other company'}});
  await raw.accountCompanyToolOrg.create({data:{companyId:'company-other',tool:'kintai',organizationId:'org-b',linkedBy:'third'}});
  const elsewhere=await invoke();assert.equal(elsewhere.body.code,'LINKED_ELSEWHERE');await record(failedCase,409,elsewhere);assert.equal(rows.at(-1).links,1);assert.equal(rows.at(-1).auditRows,0);assert.equal((await raw.accountCompanyToolOrg.findUnique({where:{tool_organizationId:{tool:'kintai',organizationId:'org-b'}}})).companyId,'company-other');

  failedCase='explicit setup for transferred creator convention';await setup();
  await raw.kintaiMember.update({where:{id:'org-b-member'},data:{createdAt:new Date('2025-01-01T00:00:00Z')}});
  assert.equal((await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw)).error,'setup-required');
  await record(failedCase,201,await invoke());assert.equal((await license('kintai')).used,3);

  failedCase='no session';await setup();state.noSession=true;await record(failedCase,401,await invoke());
  failedCase='company role flag off';await setup();config.COMPANY_ROLES_ROLLOUT='off';await record(failedCase,404,await invoke());assert.equal(sessionCalls,0);
  failedCase='request starts below admin';await setup();await record(failedCase,403,await invoke(makeApi({companyId:company,userId:'actor',role:'member'})));
  failedCase='duplicate identical admin rows';await setup();await raw.accountCompanyMember.create({data:{id:'same-role',companyId:company,userId:'actor',email:'actor-duplicate@example.invalid',role:'admin',status:'active'}});await record(failedCase,201,await invoke());assert.equal((await license('kintai')).used,3);

  failedCase='two organization links for one final seat';await setup();
  await raw.user.create({data:{id:'fourth',email:'fourth@example.invalid',plan:'FREE'}});await target('kintai','org-c','actor','fourth');
  const simultaneous=await Promise.all([invoke(),invoke(makeApi(),'kintai','org-c')]);assert.deepEqual(simultaneous.map(r=>r.status).sort(),[201,409]);
  rows.push({name:failedCase,statuses:simultaneous.map(r=>r.status),usage:await license('kintai'),newLinks:await raw.accountCompanyToolOrg.count({where:{organizationId:{in:['org-b','org-c']}}}),auditRows:await raw.accountCompanyRoleEvent.count()});
  assert.equal(rows.at(-1).usage.used,3);assert.equal(rows.at(-1).newLinks,1);assert.equal(rows.at(-1).auditRows,1);

  failedCase='two companies race the same organization';await setup();
  await raw.user.create({data:{id:'owner-b',email:'owner-b@example.invalid',plan:'PRO',stripePriceId:'price_base_m'}});
  await raw.accountCompany.create({data:{id:'company-b',userId:'owner-b',name:'Synthetic second payer'}});
  await raw.accountCompanyBilling.create({data:{companyId:'company-b',seats:3,checkedAt:new Date(),stripeSubscriptionId:'sub_synthetic_second',billingInterval:'month'}});
  await raw.accountCompanyMember.create({data:{companyId:'company-b',userId:'actor',email:'actor@example.invalid',role:'admin',status:'active'}});
  const contenders=await Promise.all([invoke(),invoke(makeApi({companyId:'company-b',userId:'actor',role:'admin'}))]);assert.deepEqual(contenders.map(r=>r.status).sort(),[201,409]);rows.push({name:failedCase,statuses:contenders.map(r=>r.status),links:await raw.accountCompanyToolOrg.count({where:{organizationId:'org-b'}}),auditRows:await raw.accountCompanyRoleEvent.count()});assert.equal(rows.at(-1).links,1);assert.equal(rows.at(-1).auditRows,1);

  failedCase='stale cache refresh after link';await setup();const revision=await core.seatCacheRevision(company,raw);assert.equal((await invoke()).status,201);
  let cacheRejected=null,cacheWriteAttempted=false;try{await core.saveSeatCacheAtRevision(company,revision,async tx=>{cacheWriteAttempted=true;await tx.accountCompanyBilling.update({where:{companyId:company},data:{seats:2}})},raw)}catch(e){cacheRejected=e.code}assert.equal(cacheRejected,'SEAT_OPERATION_STALE');assert.equal(cacheWriteAttempted,false);rows.push({name:failedCase,cacheRejected,cacheWriteAttempted,usage:await license('kintai')});assert.equal(rows.at(-1).usage.limit,3);

  for(const kind of ['company','tool']){
    failedCase='late '+kind+' demotion waits for link commit';await setup();const pause=gate();state.auditGate=pause;
    const linking=invoke();await Promise.race([pause.entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Audit gate did not enter')),5000);timer.unref()})]);
    const mutation=kind==='company'?raw.accountCompanyMember.update({where:{id:'central-actor'},data:{role:'member'}}):raw.kintaiMember.update({where:{id:'org-b-owner'},data:{role:'manager'}});
    const changing=Promise.resolve(mutation);const observedWait=await waitForLock();pause.open();const linked=await linking;await changing;state.auditGate=null;
    assert(observedWait);assert.equal(linked.status,201);const retry=await invoke();assert.equal(retry.status,403);rows.push({name:failedCase,status:linked.status,retry:retry.status,nativeLockWaitObserved:observedWait,auditRows:await raw.accountCompanyRoleEvent.count()});assert.equal(rows.at(-1).auditRows,1);
  }

  failedCase='link races actual Kintai employee invitation';await setup();state.session={id:'actor',email:'actor@example.invalid',name:'Synthetic operator'};
  const initialInviteScope=await unionScope.resolveToolUnionScope({tool:'kintai',organizationId:'org-b'},raw);assert(initialInviteScope.enabled&&'scope'in initialInviteScope&&initialInviteScope.scope.ownerUserId==='actor'&&initialInviteScope.scope.companyId===null);const pause=gate();state.auditGate=pause;const linking=invoke();await Promise.race([pause.entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Audit gate did not enter')),5000);timer.unref()})]);
  const invitation=kPost.POST(new Request('http://localhost/api/kintai/employees',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Synthetic new invite',email:'new-invite@example.invalid',role:'employee'})}));
  const invitePromise=Promise.resolve(invitation);const observedWait=await waitForLock();pause.open();const linked=await linking,invited=await invitePromise;state.auditGate=null;
  assert(observedWait);assert.equal(linked.status,201);assert.equal(invited.status,409);
  rows.push({name:failedCase,linkStatus:linked.status,inviteStatus:invited.status,nativeLockWaitObserved:observedWait,employees:await raw.kintaiEmployee.count({where:{organizationId:'org-b'}}),usage:await license('kintai'),syntheticMailCallbacks:mailCallbacks});
  assert.equal(rows.at(-1).employees,2);assert.equal(rows.at(-1).usage.used,3);assert.equal(mailCallbacks,0);

  completed=true;failedCase=null;
}finally{
  await raw.$disconnect();fs.mkdirSync(evidenceDir,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'company-link-api-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),completed,failedCase,count:rows.length,rows,linkPrivateResponses:linkResponseChecks,kintaiPrivateResponses:privateResponseChecks,fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),actualApiEnvelopeAndPost:true,actualLinkAndCompanyLicense:true,realPrivateSql:true,syntheticSessionAndInitialCompanyContext:true,sourceHashes:{...explicitSourceHashes,...roleHashes},realProviderRequests:providerCalls,realMailSends:0,productionWrites:0,scope:'Current company/tool authority and capacity are actual SQL; initial HTTP session/company context and financial/cache states are synthetic. No production flag activation or financial acceptance.'},null,2)+'\n');
}assert(completed);})().catch(e=>{console.error(e);process.exitCode=1});
