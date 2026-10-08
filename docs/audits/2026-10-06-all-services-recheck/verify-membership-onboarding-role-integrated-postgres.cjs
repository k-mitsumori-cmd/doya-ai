const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{PrismaClient,Prisma}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const privateApiResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const base='docs/audits/2026-10-06-all-services-recheck/';
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536);const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=membership_roles&connection_limit=12`}}});try{const conn=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(conn[0].address,null);assert.equal(conn[0].role,'doya_sfa');await db.$executeRawUnsafe('CREATE SCHEMA membership_roles');
  const quote=s=>'"'+s.replaceAll('"','""')+'"',sqlTypes={DateTime:'TIMESTAMP(3)',Int:'INTEGER',Float:'DOUBLE PRECISION',Boolean:'BOOLEAN',Json:'JSONB',BigInt:'BIGINT',Decimal:'DECIMAL',Bytes:'BYTEA'};
  for(const name of ['User','AioOrganization','AioMember','SfaOrganization','SfaMember','ShodanOrganization','ShodanMember','QuoteOrganization','QuoteMember','MensetsuOrganization','MensetsuMember','AishodanOrganization','AishodanMember','HrOrganization','HrOrganizationMember','KintaiOrganization','KintaiMember','KintaiEmployee','KintaiWorkRule','KintaiDepartment','HrEmployee','HrDepartment','SfaPipeline','SfaStage','SfaAccount','SfaDeal','SfaTask']){
    const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name);
    const fields=m.fields.filter(f=>f.kind!=='object').map(f=>{
      const type=sqlTypes[f.type]||'TEXT';let def='';
      if(f.type==='DateTime'&&f.isRequired)def=' DEFAULT CURRENT_TIMESTAMP';else if(f.isRequired&&!f.isId){if(f.isList)def=" DEFAULT '{}'";else if(f.type==='Boolean')def=' DEFAULT false';else if(['Int','Float','BigInt','Decimal'].includes(f.type))def=' DEFAULT 0';else if(f.type==='Json')def=" DEFAULT '[]'::jsonb";else def=" DEFAULT ''"}
      return quote(f.dbName||f.name)+' '+type+(f.isList?'[]':'')+def+(f.isRequired?' NOT NULL':'')+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'');
    });await db.$executeRawUnsafe('CREATE TABLE '+quote(m.dbName||m.name)+' ('+fields.join(',')+')');
    for(const unique of m.uniqueFields||[])await db.$executeRawUnsafe('ALTER TABLE '+quote(m.dbName||m.name)+' ADD UNIQUE ('+unique.map(name=>quote(m.fields.find(f=>f.name===name).dbName||name)).join(',')+')');
  }


const candidate=true,cases=[],observations=[],files=[];let seq=0;let session={user:{id:'synthetic',email:'synthetic@example.invalid'}};
const property=n=>n[0].toLowerCase()+n.slice(1);
async function seed(name,overrides){const m=Prisma.dmmf.datamodel.models.find(x=>x.name===name),data={};for(const f of m.fields){if(f.kind==='object'||!f.isRequired||f.hasDefaultValue||f.isUpdatedAt)continue;data[f.name]=f.isList?[]:f.type==='DateTime'?new Date():f.type==='Boolean'?true:['Int','Float','BigInt','Decimal'].includes(f.type)?1:f.type==='Json'?{}:'synthetic-'+(++seq)}return db[property(name)].create({data:{...data,...overrides}})}
await seed('User',{id:'synthetic',email:'synthetic@example.invalid'});await seed('User',{id:'foreign',email:'foreign@example.invalid'});
for(const [service,orgModel,memberModel] of [['aio','AioOrganization','AioMember'],['sfa','SfaOrganization','SfaMember'],['shodan','ShodanOrganization','ShodanMember'],['quote','QuoteOrganization','QuoteMember'],['mensetsu','MensetsuOrganization','MensetsuMember'],['aishodan','AishodanOrganization','AishodanMember'],['hr','HrOrganization','HrOrganizationMember'],['kintai','KintaiOrganization','KintaiMember']]){
 const typePath='src/lib/'+service+'/types.ts',accessPath='src/lib/'+service+'/access.ts',types=load(typePath),constantPath='src/lib/'+service+'/constants.ts',constants=fs.existsSync(constantPath)?load(constantPath,{'./types':types}):{};files.push(typePath,accessPath);if(fs.existsSync(constantPath))files.push(constantPath);const hierarchy=types.ROLE_HIERARCHY||constants.ROLE_HIERARCHY;
 const access=load(accessPath,{'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'./types':types,'./constants':constants});
 const apiFile='src/app/api/'+service+'/'+(['quote','mensetsu','aishodan'].includes(service)?'organizations':'organization')+'/route.ts';files.push(apiFile);const api=load(apiFile,{'@/lib/private-api-response':privateApiResponse,'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@prisma/client':{Prisma},'@/lib/prisma':{prisma:db},['@/lib/'+service+'/access']:access,['@/lib/'+service+'/types']:types});
 for(const role of [...Object.keys(hierarchy),'__UNRECOGNIZED__','','constructor','admin ',null]){
  await db[property(memberModel)].deleteMany();await db[property(orgModel)].deleteMany();let original=null;
  if(role!==null){original=await seed(orgModel,{slug:'existing',name:'Original'});await seed(memberModel,{organizationId:original.id,userId:'synthetic',role,status:'ACTIVE'})}
  const known=role!==null&&Object.hasOwn(hierarchy,role),blocked=candidate&&role!==null&&!known;
  if(blocked)await assert.rejects(()=>access.getOrCreateOrganization('synthetic','New','Synthetic','synthetic@example.invalid'),/組織の権限を確認できません/);
  else {const result=await access.getOrCreateOrganization('synthetic','New','Synthetic','synthetic@example.invalid');assert.equal(result.id===original?.id,known)}
  const count=await db[property(orgModel)].count();assert.equal(count,role===null?1:known||blocked?1:2);cases.push(service+' onboarding '+JSON.stringify(role));observations.push({service,role,known,blocked,organizationCount:count});
  const response=await api.POST(new Request('http://localhost/api/organization',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'New',memberName:'Synthetic',employeeName:'Synthetic'})}));assert.equal(response.status,blocked?403:200);if(blocked){const body=await response.json();assert.equal(body.code,'INVALID_MEMBERSHIP_ROLE');assert.match(body.error,/管理者に確認/)}assert.equal(await db[property(orgModel)].count(),count);cases.push(service+' HTTP '+JSON.stringify(role));
 }

 const knownRole=Object.keys(hierarchy)[0];
 for(const control of ['mixed-valid-and-unknown','inactive-known','foreign-known']){
  await db[property(memberModel)].deleteMany();await db[property(orgModel)].deleteMany();const original=await seed(orgModel,{slug:'control',name:'Control'});
  await seed(memberModel,{organizationId:original.id,userId:control==='foreign-known'?'foreign':'synthetic',role:knownRole,status:control==='inactive-known'?'INACTIVE':'ACTIVE'});
  if(control==='mixed-valid-and-unknown'){const other=await seed(orgModel,{slug:'other-unknown',name:'Other Unknown'});await seed(memberModel,{organizationId:other.id,userId:'synthetic',role:'__UNRECOGNIZED__',status:'ACTIVE'})}
  const result=await access.getOrCreateOrganization('synthetic','New','Synthetic','synthetic@example.invalid');assert.equal(result.id===original.id,control==='mixed-valid-and-unknown');assert.equal(await db[property(orgModel)].count(),2);cases.push(service+' '+control);
 }

 if(service==='hr'){
  for(const control of [...Object.keys(hierarchy).map(role=>({role})),...['__UNRECOGNIZED__','','constructor','ADMIN '].map(role=>({role})),{role:'OWNER',inactive:true},{role:'OWNER',foreign:true}]){
   await db.hrOrganizationMember.deleteMany();await db.hrOrganization.deleteMany();const original=await seed('HrOrganization',{slug:'hr-read',name:'Synthetic Private HR'});await seed('HrOrganizationMember',{organizationId:original.id,userId:control.foreign?'foreign':'synthetic',role:control.role,status:control.inactive?'INACTIVE':'ACTIVE'});
   const response=await api.GET();assert.equal(response.status,200);const body=await response.json(),allowed=!control.foreign&&!control.inactive&&(!candidate||Object.hasOwn(hierarchy,control.role));assert.equal(body.organizations.length,allowed?1:0);if(allowed)assert.equal(body.organizations[0].name,original.name);cases.push('HR organization GET '+JSON.stringify(control));
  }
  session=null;assert.equal((await api.GET()).status,401);cases.push('HR anonymous GET401');session={user:{id:'synthetic',email:'synthetic@example.invalid'}};
 }

 const unsafe='postgres://synthetic-secret@example.invalid/private';const apiFileForError='src/app/api/'+service+'/'+(['quote','mensetsu','aishodan'].includes(service)?'organizations':'organization')+'/route.ts';const denyApi=load(apiFileForError,{'@/lib/private-api-response':privateApiResponse,'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@prisma/client':{Prisma},'@/lib/prisma':{prisma:db},['@/lib/'+service+'/access']:{...access,getOrCreateOrganization:async()=>{throw Object.assign(new Error(unsafe),{code:'INVALID_MEMBERSHIP_ROLE'})}},['@/lib/'+service+'/types']:types});
 const countBefore=await db[property(orgModel)].count(),denied=await denyApi.POST(new Request('http://localhost/api/organization',{method:'POST',body:JSON.stringify({name:'New',memberName:'Synthetic',employeeName:'Synthetic'})}));assert.equal(denied.status,403);const deniedBody=await denied.json();assert.equal(deniedBody.error,'組織の権限を確認できません。管理者に確認してください。');assert.equal(deniedBody.code,'INVALID_MEMBERSHIP_ROLE');assert(!JSON.stringify(deniedBody).includes(unsafe));assert.equal(await db[property(orgModel)].count(),countBefore);cases.push(service+' coded error never echoes internal message');
 session=null;assert.equal((await api.POST(new Request('http://localhost/api/organization',{method:'POST',body:'{}'}))).status,401);cases.push(service+' anonymous HTTP401');session={user:{id:'synthetic',email:'synthetic@example.invalid'}};
}
assert.equal(cases.length,195);files.push(base+'verify-membership-onboarding-role-integrated-postgres.cjs','prisma/schema.prisma');const hashes=paths=>Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));const report={checkedAt:new Date().toISOString(),passed:195,cases,observations,sourceHashes:hashes(files),candidateHashes:{},schemaConstraints:'Scalar types, required columns, single and composite uniqueness; no foreign keys',scope:'Actual eight service onboarding functions and private Unix PostgreSQL synthetic rows. Invalid-role-only memberships must not silently create replacement organizations. Production invalid-role presence unproven.'};fs.writeFileSync(base+'membership-onboarding-role-integrated-'+(candidate?'candidate':'baseline')+'-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:195,candidate}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
