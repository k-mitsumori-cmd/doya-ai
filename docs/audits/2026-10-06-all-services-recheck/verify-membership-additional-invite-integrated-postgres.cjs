const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{PrismaClient,Prisma}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536);const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=membership_roles&connection_limit=12`}}});try{const conn=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(conn[0].address,null);assert.equal(conn[0].role,'doya_sfa');await db.$executeRawUnsafe('CREATE SCHEMA membership_roles');
  const quote=s=>'"'+s.replaceAll('"','""')+'"',sqlTypes={DateTime:'TIMESTAMP(3)',Int:'INTEGER',Float:'DOUBLE PRECISION',Boolean:'BOOLEAN',Json:'JSONB',BigInt:'BIGINT',Decimal:'DECIMAL',Bytes:'BYTEA'};
  for(const name of ['User','AioOrganization','AioMember','SfaOrganization','SfaMember','ShodanOrganization','ShodanMember','QuoteOrganization','QuoteMember','MensetsuOrganization','MensetsuMember','AishodanOrganization','AishodanMember','HrOrganization','HrOrganizationMember','KintaiOrganization','KintaiMember','KintaiEmployee','PromaneWorkspace','PromaneMember','PromaneInvitation']){
    const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name);
    const fields=m.fields.filter(f=>f.kind!=='object').map(f=>{
      const type=sqlTypes[f.type]||'TEXT';let def='';
      if(f.type==='DateTime'&&f.isRequired)def=' DEFAULT CURRENT_TIMESTAMP';else if(f.isRequired&&!f.isId){if(f.isList)def=" DEFAULT '{}'";else if(f.type==='Boolean')def=' DEFAULT false';else if(['Int','Float','BigInt','Decimal'].includes(f.type))def=' DEFAULT 0';else if(f.type==='Json')def=" DEFAULT '[]'::jsonb";else def=" DEFAULT ''"}
      return quote(f.dbName||f.name)+' '+type+(f.isList?'[]':'')+def+(f.isRequired?' NOT NULL':'')+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'');
    });await db.$executeRawUnsafe('CREATE TABLE '+quote(m.dbName||m.name)+' ('+fields.join(',')+')');
  }


const candidate=true,cases=[],observations=[];
const property=n=>n[0].toLowerCase()+n.slice(1);let seq=0;
async function seed(name,overrides){const m=Prisma.dmmf.datamodel.models.find(x=>x.name===name),data={};for(const f of m.fields){if(f.kind==='object'||!f.isRequired||f.hasDefaultValue||f.isUpdatedAt)continue;data[f.name]=f.isList?[]:f.type==='DateTime'?new Date():f.type==='Boolean'?true:['Int','Float','BigInt','Decimal'].includes(f.type)?1:f.type==='Json'?{}:'synthetic-'+(++seq)}return db[property(name)].create({data:{...data,...overrides}})}

await seed('User',{id:'synthetic',email:'synthetic@example.invalid'});await seed('User',{id:'pending',email:'pending@example.invalid'});
const kfile='src/app/api/kintai/invite/[token]/route.ts',pfile='src/lib/promane/invite-admission.ts',tokenFile='src/lib/kintai/invite-token.ts';
const tokenHelpers=load(tokenFile,{}, {crypto:crypto.webcrypto}),org=await seed('KintaiOrganization',{slug:'owned',name:'Synthetic'}),other=await seed('KintaiOrganization',{slug:'other',name:'Other'});
for(const role of ['system_admin','hr_admin','manager','employee','owner','__UNRECOGNIZED__','','constructor'])for(const mode of ['GET','POST']){
 await db.kintaiEmployee.deleteMany();await db.kintaiMember.deleteMany();
 const token=tokenHelpers.createKintaiInviteToken();const member=await seed('KintaiMember',{organizationId:org.id,userId:'pending',status:'PENDING',role,inviteToken:token,inviteEmail:'synthetic@example.invalid',createdAt:new Date()});
 await seed('KintaiEmployee',{organizationId:org.id,memberId:member.id,email:'synthetic@example.invalid',name:'Synthetic',isActive:true});const old=await seed('KintaiMember',{organizationId:other.id,userId:'synthetic',role:'employee',status:'ACTIVE'});
 const route=load(kfile,{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'synthetic',email:'synthetic@example.invalid'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'@/lib/kintai/invite-token':tokenHelpers});
 const r=await route[mode]({}, {params:Promise.resolve({token})});const known=['system_admin','hr_admin','manager','employee'].includes(role),expected=candidate&&!known?404:200;assert.equal(r.status,expected,role+' '+mode);
 const saved=await db.kintaiMember.findUnique({where:{id:member.id}}),prior=await db.kintaiMember.findUnique({where:{id:old.id}});assert.equal(saved.status,mode==='POST'&&expected===200?'ACTIVE':'PENDING');assert.equal(prior.status,mode==='POST'&&expected===200?'INACTIVE':'ACTIVE');
 observations.push({service:'kintai',role,mode,status:r.status,savedStatus:saved.status,priorStatus:prior.status});cases.push('kintai '+role+' '+mode);
}
const workspace=await seed('PromaneWorkspace',{userId:'synthetic',name:'Synthetic',slug:'owned'});
for(const role of ['admin','member','guest','owner','__UNRECOGNIZED__','','constructor','admin ']){
 await db.promaneInvitation.deleteMany();await db.promaneMember.deleteMany();const invitation=await seed('PromaneInvitation',{workspaceId:workspace.id,email:'synthetic@example.invalid',role,token:'synthetic-token',invitedById:'synthetic',expiresAt:new Date(Date.now()+600000),acceptedAt:null});
 const helper=load(pfile,{'@prisma/client':{Prisma},crypto,'@/lib/prisma':{prisma:db},'@/lib/promane/limits':{getUserPromaneLimits:async()=>({maxMembersPerWorkspace:30})}});
 const r=await helper.acceptPromaneInvitation({token:invitation.token,userId:'synthetic',email:'synthetic@example.invalid',displayName:'Synthetic'});const known=['admin','member','guest'].includes(role);assert.equal(r.success,candidate?known:true);if(!r.success)assert.equal(r.response.status,404);
 assert.equal(await db.promaneMember.count(),r.success?1:0);const saved=await db.promaneInvitation.findUnique({where:{id:invitation.id}});assert.equal(!!saved.acceptedAt,r.success);
 observations.push({service:'promane',role,status:r.success?200:r.response.status,memberCreated:r.success});cases.push('promane '+role);
}

const afile='src/lib/promane/auth.ts',auth=load(afile,{'next-auth':{getServerSession:async()=>({user:{id:'synthetic'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'next/navigation':{redirect:()=>{throw Error('unexpected redirect')}},crypto});
for(const role of ['owner','admin','member','guest','__UNRECOGNIZED__','','constructor','admin ']){
 await db.promaneInvitation.deleteMany();await db.promaneMember.deleteMany();await seed('PromaneMember',{workspaceId:workspace.id,userId:'synthetic',role,isActive:true});const known=['owner','admin','member','guest'].includes(role);
 const read=await auth.getWorkspaceBySlug('owned','synthetic');assert.equal(!!read,candidate?known:true);cases.push('promane read '+role);
 const current=await auth.getCurrentMember(workspace.id,'synthetic');assert.equal(!!current,candidate?known:true);cases.push('promane current member '+role);
 const fallback=await auth.getOrCreateWorkspace('synthetic');assert.equal(!!fallback,candidate?known:true);assert.equal(await db.promaneWorkspace.count(),1);cases.push('promane onboarding '+role);
 if(['owner','admin','member'].includes(role))assert(await auth.requireWritableWorkspace('owned','synthetic'));else await assert.rejects(()=>auth.requireWritableWorkspace('owned','synthetic'));cases.push('promane writable guest/unknown control '+role);
}
assert.equal(cases.length,56);const files=[kfile,pfile,afile,tokenFile,base+'verify-membership-additional-invite-integrated-postgres.cjs','prisma/schema.prisma'];const hashes=paths=>Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));const report={checkedAt:new Date().toISOString(),passed:56,cases,observations,sourceHashes:hashes(files),candidateHashes:{},scope:'Actual Kintai invitation API and Promane acceptance helper, real Prisma/private PostgreSQL transactions and stored before/after rows. Synthetic auth and Promane plan limits; DMMF scalar tables without foreign keys. No emails/providers/customer data; production invalid roles remain unknown.'};fs.writeFileSync(base+'membership-additional-invite-integrated-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:56,candidate}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
