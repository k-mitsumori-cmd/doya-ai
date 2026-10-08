const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{PrismaClient,Prisma}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536);const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=membership_roles&connection_limit=12`}}});try{const conn=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(conn[0].address,null);assert.equal(conn[0].role,'doya_sfa');await db.$executeRawUnsafe('CREATE SCHEMA membership_roles');
  const quote=s=>'"'+s.replaceAll('"','""')+'"',sqlTypes={DateTime:'TIMESTAMP(3)',Int:'INTEGER',Float:'DOUBLE PRECISION',Boolean:'BOOLEAN',Json:'JSONB',BigInt:'BIGINT',Decimal:'DECIMAL',Bytes:'BYTEA'};
  for(const name of ['User','PromaneWorkspace','PromaneMember','PromaneInvitation','PromaneProject','PromaneTask','PromaneTimeEntry','SystemSetting']){
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
const workspace=await seed('PromaneWorkspace',{userId:'synthetic',name:'Synthetic Private Workspace',slug:'owned'}),project=await seed('PromaneProject',{workspaceId:workspace.id,name:'Synthetic Private Project'});
const apiFile='src/app/api/promane/workspaces/route.ts',timeFile='src/lib/promane/timesheet-read.ts',pageFile='src/app/promane/page.tsx',authFile='src/lib/promane/auth.ts';
let session={user:{id:'synthetic',email:'synthetic@example.invalid'}};
const common={'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'next/navigation':{redirect:url=>{throw Error('Unexpected redirect '+url)}},crypto};
const api=load(apiFile,{...common,'next/server':{NextResponse:Response}}),times=load(timeFile,{'@prisma/client':{Prisma}}),auth=load(authFile,common);
const React=require('react'),render=require('react-dom/server').renderToStaticMarkup,vm=require('node:vm'),ts=require('typescript');const component=({children})=>React.createElement('span',null,children);const exports={};
const code=ts.transpileModule(fs.readFileSync(process.env.DOYA_TEST_BASELINE&&fs.existsSync(process.env.DOYA_TEST_BASELINE+'/'+pageFile)?process.env.DOYA_TEST_BASELINE+'/'+pageFile:pageFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const mocks={...common,'react/jsx-runtime':require('react/jsx-runtime'),'@/lib/promane/auth':auth,'./PromaneLp':{PromaneLp:component},'next/image':component,'next/link':component,'@/components/promane/ui/button':{Button:component},'@/components/promane/ui/badge':{Badge:component},'@/components/promane/create-workspace-button':{CreateWorkspaceButton:component}};
vm.runInNewContext(code,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)},Date,Buffer,console},{filename:pageFile});
async function check(role,active=true,foreign=false){
 await db.promaneTimeEntry.deleteMany();await db.promaneTask.deleteMany();await db.promaneMember.deleteMany();const member=await seed('PromaneMember',{workspaceId:workspace.id,userId:foreign?'pending':'synthetic',role,isActive:active});const task=await seed('PromaneTask',{projectId:project.id,assigneeId:member.id,title:'Synthetic Private Task'});await seed('PromaneTimeEntry',{projectId:project.id,taskId:task.id,memberId:member.id,duration:37,date:new Date('2026-10-08T00:00:00Z'),note:'Synthetic Private Note'});
 const allowed=active&&!foreign&&(!candidate||['owner','admin','member','guest'].includes(role));const response=await api.GET();assert.equal(response.status,200);const result=await response.json();assert.equal(result.workspaces.length,allowed?1:0);if(allowed){assert.equal(result.workspaces[0].workspaceName,workspace.name);assert.equal(result.workspaces[0].myActiveTasks,1)}cases.push(role+' active='+active+' foreign='+foreign+' API');
 const time=await times.readTimesheet(db,'synthetic','owned',times.parseTimesheetQuery({}));assert.equal(!!time,allowed);if(time){assert.equal(time.totalMinutes,37);assert.equal(time.entries[0].note,'Synthetic Private Note');assert.equal(time.projects[0].name,project.name)}cases.push(role+' active='+active+' foreign='+foreign+' timesheet');
 const html=render(await exports.default({searchParams:Promise.resolve({select:'1'})}));assert.equal(html.includes(workspace.name),allowed);cases.push(role+' active='+active+' foreign='+foreign+' page');observations.push({role,active,foreign,allowed,apiWorkspaces:result.workspaces.length,timesheetReadable:!!time,pageShowsWorkspace:html.includes(workspace.name)});
}
for(const role of ['owner','admin','member','guest','__UNRECOGNIZED__','','constructor','admin '])await check(role);
for(const role of ['owner','admin','member','guest'])await check(role,false);
await check('owner',true,true);session=null;assert.equal((await api.GET()).status,401);cases.push('anonymous workspace API401');
session={user:{id:'synthetic',email:'synthetic@example.invalid'}};await seed('PromaneMember',{workspaceId:workspace.id,userId:'synthetic',role:'member',isActive:true});const inviteWorkspace=await seed('PromaneWorkspace',{userId:'pending',name:'Synthetic Invite Workspace',slug:'invited'}),inviteFile='src/app/api/promane/invite/[token]/route.ts';
const invites=load(inviteFile,{...common,'next/server':{NextResponse:Response},'@/lib/promane/invite-admission':{acceptPromaneInvitation:async()=>{throw Error('Read must not accept')}}});
for(const role of ['admin','member','guest','owner','__UNRECOGNIZED__','','constructor','admin ']){
 await db.promaneInvitation.deleteMany();const token='synthetic-token';await seed('PromaneInvitation',{workspaceId:inviteWorkspace.id,email:'synthetic@example.invalid',role,token,invitedById:'pending',acceptedAt:null,expiresAt:new Date(Date.now()+600000)});const known=['admin','member','guest'].includes(role);
 const response=await invites.GET({}, {params:Promise.resolve({token})});assert.equal(response.status,candidate&&!known?404:200);cases.push('invite role verification '+role);
 const html=render(await exports.default({searchParams:Promise.resolve({select:'1'})}));assert.equal(html.includes(inviteWorkspace.name),candidate?known:true);cases.push('invite role listing '+role);
}

const mutationFile='src/lib/promane/workspace-mutations.ts', operationFile='src/lib/promane/workspace-operation.ts', inputFile='src/lib/promane/workspace-input.ts';
const operation=load(operationFile,{'node:crypto':crypto});const input=load(inputFile);
const mutation=load(mutationFile,{'node:crypto':crypto,'@/lib/prisma':{prisma:db},'@/lib/promane/limits':{getUserPromaneLimits:async()=>({maxWorkspaces:30,tier:'PRO'}),countUserWorkspaces:async()=>db.promaneWorkspace.count()},'./workspace-input':input,'./workspace-operation':operation});
const operationId=crypto.randomUUID(),body={expectedUserId:'synthetic',operationId,name:'Synthetic Receipt Workspace'};
const saved=await mutation.createPromaneWorkspaceOperation('synthetic',body);assert.equal(saved.state,'saved');const created=saved.entry.id;
for(const role of ['owner','admin','member','guest','__UNRECOGNIZED__','','constructor','admin ']){
 await db.promaneMember.updateMany({where:{workspaceId:created,userId:'synthetic'},data:{role,isActive:true}});
 const allowed=!candidate||['owner','admin','member','guest'].includes(role),before=await db.promaneWorkspace.count();
 const recovered=await mutation.recoverPromaneWorkspaceMutation('synthetic',{expectedUserId:'synthetic',operationId,mode:'create',workspaceId:null,cancelIfMissing:false});assert.equal(recovered.state,allowed?'saved':'unavailable');if(!allowed)assert.equal(recovered.entry,null);cases.push('creation receipt recovery '+role);
 if(allowed){const replay=await mutation.createPromaneWorkspaceOperation('synthetic',body);assert.equal(replay.entry.id,created);assert.equal(replay.replayed,true)}else await assert.rejects(()=>mutation.createPromaneWorkspaceOperation('synthetic',body),/保存済みのワークスペースは現在開けません/);assert.equal(await db.promaneWorkspace.count(),before);cases.push('creation receipt replay '+role);
}
for(const change of [{isActive:false},{isActive:true,userId:'pending'}]){
 await db.promaneMember.updateMany({where:{workspaceId:created},data:{role:'owner',...change}});const count=await db.promaneWorkspace.count();
 const recovered=await mutation.recoverPromaneWorkspaceMutation('synthetic',{expectedUserId:'synthetic',operationId,mode:'create',workspaceId:null,cancelIfMissing:false});assert.equal(recovered.state,'unavailable');cases.push('creation receipt unavailable '+JSON.stringify(change));
 await assert.rejects(()=>mutation.createPromaneWorkspaceOperation('synthetic',body),/保存済みのワークスペースは現在開けません/);assert.equal(await db.promaneWorkspace.count(),count);cases.push('creation replay refused '+JSON.stringify(change));
}
assert.equal(cases.length,76);

const files=[apiFile,timeFile,pageFile,authFile,inviteFile,mutationFile,operationFile,inputFile,base+'verify-promane-known-read-receipt-role-integrated-postgres.cjs','prisma/schema.prisma'];const hashes=paths=>Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));const report={checkedAt:new Date().toISOString(),passed:76,cases,observations,sourceHashes:hashes(files),candidateHashes:{},scope:'Actual workspaces API, timesheet reader and async entry-page function/React server render with actual private Prisma/Unix PostgreSQL scalar tables. Synthetic sessions/UI leaf components, no native browser/Next routing/customer/providers; unknown stored roles presence in production unproven.'};fs.writeFileSync(base+'promane-known-read-receipt-role-integrated-'+(candidate?'candidate':'baseline')+'-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:76,candidate}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
