const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{PrismaClient,Prisma}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536);const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=membership_roles&connection_limit=12`}}});try{const conn=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(conn[0].address,null);assert.equal(conn[0].role,'doya_sfa');await db.$executeRawUnsafe('CREATE SCHEMA membership_roles');
  const quote=s=>'"'+s.replaceAll('"','""')+'"',sqlTypes={DateTime:'TIMESTAMP(3)',Int:'INTEGER',Float:'DOUBLE PRECISION',Boolean:'BOOLEAN',Json:'JSONB',BigInt:'BIGINT',Decimal:'DECIMAL',Bytes:'BYTEA'};
  for(const name of ['User','AioOrganization','AioMember','SfaOrganization','SfaMember','ShodanOrganization','ShodanMember','QuoteOrganization','QuoteMember','MensetsuOrganization','MensetsuMember','AishodanOrganization','AishodanMember','HrOrganization','HrOrganizationMember','KintaiOrganization','KintaiMember','KintaiEmployee']){
    const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name);
    const fields=m.fields.filter(f=>f.kind!=='object').map(f=>{
      const type=sqlTypes[f.type]||'TEXT';let def='';
      if(f.type==='DateTime'&&f.isRequired)def=' DEFAULT CURRENT_TIMESTAMP';else if(f.isRequired&&!f.isId){if(f.isList)def=" DEFAULT '{}'";else if(f.type==='Boolean')def=' DEFAULT false';else if(['Int','Float','BigInt','Decimal'].includes(f.type))def=' DEFAULT 0';else if(f.type==='Json')def=" DEFAULT '[]'::jsonb";else def=" DEFAULT ''"}
      return quote(f.dbName||f.name)+' '+type+(f.isList?'[]':'')+def+(f.isRequired?' NOT NULL':'')+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'');
    });await db.$executeRawUnsafe('CREATE TABLE '+quote(m.dbName||m.name)+' ('+fields.join(',')+')');
  }


const candidate=true,cases=[],observations=[],files=[];
const property=n=>n[0].toLowerCase()+n.slice(1);let seq=0;
async function seed(name,overrides){const m=Prisma.dmmf.datamodel.models.find(x=>x.name===name),data={};for(const f of m.fields){if(f.kind==='object'||!f.isRequired||f.hasDefaultValue||f.isUpdatedAt)continue;data[f.name]=f.isList?[]:f.type==='DateTime'?new Date():f.type==='Boolean'?true:['Int','Float','BigInt','Decimal'].includes(f.type)?1:f.type==='Json'?{}:'synthetic-'+(++seq)}return db[property(name)].create({data:{...data,...overrides}})}

await seed('User',{id:'synthetic',email:'synthetic@example.invalid'});
await seed('User',{id:'pending',email:'pending@example.invalid'});
for(const service of ['aio','shodan','quote','mensetsu','aishodan']){
 const model=service+'Member',orgModel=service[0].toUpperCase()+service.slice(1)+'Organization';
 const org=await seed(orgModel,{slug:'owned',name:'Synthetic'}),file=`src/app/api/${service}/invite/[token]/route.ts`;files.push(file);
 for(const role of ['admin','manager','member','owner','__UNRECOGNIZED__','','constructor','admin ']){
  const known=['admin','manager','member'].includes(role);
  for(const mode of ['GET','POST','role-change-before-lock']){
   await db[model].deleteMany();const token='synthetic-invitation-token';
   const member=await seed(service[0].toUpperCase()+service.slice(1)+'Member',{organizationId:org.id,userId:'pending',role:mode==='role-change-before-lock'?'member':role,status:'PENDING',inviteToken:token,inviteEmail:'synthetic@example.invalid',createdAt:new Date()});
   const wrapper={[model]:db[model],$transaction:async(fn,options)=>db.$transaction(async tx=>{if(mode==='role-change-before-lock')await tx[model].update({where:{id:member.id},data:{role}});return fn(tx)},options)};
   const route=load(file,{'next/server':{NextResponse:{json:(data,options={})=>({status:options.status||200,json:async()=>data})}},'next-auth':{getServerSession:async()=>({user:{id:'synthetic',email:'synthetic@example.invalid',name:'Synthetic'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:wrapper},['@/lib/'+service+'/access']:{resolveUserId:async()=> 'synthetic'}});
   const response=await route[mode==='GET'?'GET':'POST']({}, {params:Promise.resolve({token})});
   const expected=candidate&&!known?(mode==='role-change-before-lock'?409:404):mode!=='GET'&&role==='owner'?409:200;
   assert.equal(response.status,expected,service+' '+JSON.stringify(role)+' '+mode);
   const saved=await db[model].findUnique({where:{id:member.id}});assert.equal(saved.status,mode!=='GET'&&expected===200?'ACTIVE':'PENDING');
   if(saved.status==='ACTIVE'){assert.equal(saved.userId,'synthetic');assert.equal(saved.inviteToken,null)}else assert.equal(saved.userId,'pending');
   observations.push({service,role,mode,status:response.status,savedStatus:saved.status});cases.push(service+' '+JSON.stringify(role)+' '+mode);
  }
 }
}
assert.equal(cases.length,120);files.push(base+'verify-membership-invitation-role-integrated-postgres.cjs','prisma/schema.prisma');const hashes=paths=>Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={checkedAt:new Date().toISOString(),passed:120,cases,observations,sourceHashes:hashes(files),candidateHashes:{},scope:'Actual five invitation handlers and actual Prisma/private Unix PostgreSQL transactions, organization locks and stored activation results. Synthetic sessions and transaction-time role mutation; DMMF scalar tables, no foreign-key constraints in this fixture. No emails/providers/network/customer data and no evidence invalid roles exist in production.'};
fs.writeFileSync(base+'membership-invitation-role-integrated-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:120,candidate}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
