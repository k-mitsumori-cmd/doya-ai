const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),{PrismaClient,Prisma}=require(path.join(root,'node_modules/@prisma/client')),{load}=require(path.join(root,'scripts/security-regression/load-typescript.cjs'));
const desc=JSON.parse(fs.readFileSync('/tmp/doya-local-interview-upload-db-20261006.json','utf8'));
assert.equal(path.dirname(desc.root),'/private/tmp');assert.ok(path.basename(desc.root).startsWith('doya-iu-qa-'));assert.equal(desc.data,path.join(desc.root,'data'));
const url=new URL(desc.url);assert.equal(url.hostname,'localhost');assert.equal(url.searchParams.get('host'),desc.socket);url.searchParams.set('connection_limit','1');
const clients=Array.from({length:4},()=>new PrismaClient({datasources:{db:{url:url.href}}})),[db,one,two,observer]=clients;
const ident=s=>'"'+s.replace(/"/g,'""')+'"',literal=x=>typeof x==='string'?"'"+x.replace(/'/g,"''")+"'":String(x);
const helper=c=>load('src/lib/interview/upload-create.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:c}});
const defer=()=>{let resolve,reject;return{promise:new Promise((r,j)=>{resolve=r;reject=j}),resolve,reject}};
async function waitLock(pid){const until=Date.now()+5000;while(Date.now()<until){const rows=await observer.$queryRawUnsafe('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',pid);if(rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,20))}throw Error('Backend did not enter advisory wait')}
const data={projectId:'project',fileName:'file.wav',mimeType:'audio/wav',fileSize:10n,type:'audio',filePath:'synthetic/path',status:'UPLOADED'};
async function duplicate(user,guest,key){
 const pids=await Promise.all([one,two].map(async c=>(await c.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)),held=defer(),release=defer();
 const holder=db.$transaction(async tx=>{await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'),hashtext($1))",'project');held.resolve();await release.promise},{timeout:15000});
 holder.catch(e=>held.reject(e));let requests=[];
 try{await held.promise;requests=[one,two].map(c=>helper(c).prepareInterviewUpload(data,user,guest,key));await Promise.all(pids.map(waitLock));assert.equal(await observer.interviewMaterial.count(),0);release.resolve();const rows=await Promise.all(requests);await holder;return rows}
 finally{release.resolve();await Promise.allSettled([holder,...requests])}
}
(async()=>{
 const actual=(await db.$queryRawUnsafe("SELECT current_setting('data_directory') AS data,current_user AS actor,inet_server_addr() AS tcp"))[0];assert.equal(actual.data,desc.data);assert.equal(actual.actor,'doya_qa');assert.equal(actual.tcp,null);
 for(const name of ['User','SystemSetting','InterviewProject','InterviewMaterial']){
  const model=Prisma.dmmf.datamodel.models.find(m=>m.name===name),types={String:'TEXT',Int:'INTEGER',Boolean:'BOOLEAN',DateTime:'TIMESTAMP(3)',Json:'JSONB',Float:'DOUBLE PRECISION',BigInt:'BIGINT',Decimal:'DECIMAL'};
  const cols=model.fields.filter(f=>f.kind==='scalar').map(f=>{assert.ok(types[f.type]);const type=types[f.type]+(f.isList?'[]':'');let sql=ident(f.dbName||f.name)+' '+type+(f.isRequired?' NOT NULL':'')+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'');if(f.hasDefaultValue){if(f.default?.name==='now')sql+=' DEFAULT CURRENT_TIMESTAMP';else if(Array.isArray(f.default))sql+=' DEFAULT ARRAY['+f.default.map(literal).join(',')+']::'+type;else if(typeof f.default!=='object')sql+=' DEFAULT '+literal(f.default)}return sql});
  await db.$executeRawUnsafe('CREATE TABLE '+ident(model.dbName||name)+' ('+cols.join(',')+')');
 }
 const materialTable=Prisma.dmmf.datamodel.models.find(m=>m.name==='InterviewMaterial').dbName||'InterviewMaterial';
 await db.$executeRawUnsafe('ALTER TABLE interview_project ADD CONSTRAINT synthetic_user_fk FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL');
 await db.$executeRawUnsafe('ALTER TABLE '+ident(materialTable)+' ADD CONSTRAINT synthetic_project_fk FOREIGN KEY ("projectId") REFERENCES interview_project(id) ON DELETE CASCADE');
 await db.user.createMany({data:[{id:'owner',email:'owner@example.invalid'},{id:'foreign',email:'foreign@example.invalid'}]});
 const reset=async user=>{await db.interviewProject.deleteMany();await db.systemSetting.deleteMany();await db.interviewProject.create({data:{id:'project',title:'synthetic',userId:user,guestId:user?null:'guest'}})};
 const results=[];
 for(const[user,guest]of[['owner',null],[null,'guest']]){
  await reset(user);const key=crypto.randomUUID(),rows=await duplicate(user,guest,key);assert.equal(rows[0].id,rows[1].id);assert.equal(rows[0].filePath,rows[1].filePath);assert.equal(await db.interviewMaterial.count(),1);assert.equal(await db.systemSetting.count(),1);
  assert.equal((await helper(one).prepareInterviewUpload({...data,filePath:'unused/path'},user,guest,key.toUpperCase())).id,rows[0].id);
  await assert.rejects(helper(one).prepareInterviewUpload({...data,fileSize:11n},user,guest,key),e=>e.code==='UPLOAD_REQUEST_CONFLICT');
  await db.interviewProject.update({where:{id:'project'},data:{userId:'foreign'}});await assert.rejects(helper(one).prepareInterviewUpload(data,user,guest,key),e=>e.code==='UPLOAD_REQUEST_UNAVAILABLE');
  await db.interviewProject.update({where:{id:'project'},data:{userId:user}});await db.interviewMaterial.delete({where:{id:rows[0].id}});await assert.rejects(helper(one).prepareInterviewUpload(data,user,guest,key),e=>e.code==='UPLOAD_REQUEST_UNAVAILABLE');assert.equal(await db.interviewMaterial.count(),0);assert.equal(await db.systemSetting.count(),1);
  results.push((user?'account':'guest')+' actual simultaneous wait/replay/input conflict/owner change/deletion tombstone');
 }
 await reset('owner');await db.$executeRawUnsafe("CREATE FUNCTION synthetic_fail_upload_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key LIKE 'interview-material-create:v1:%' THEN RAISE EXCEPTION 'synthetic receipt failure'; END IF; RETURN NEW; END $$");
 await db.$executeRawUnsafe('CREATE TRIGGER synthetic_upload_receipt_failure BEFORE INSERT ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_upload_receipt()');
 await assert.rejects(helper(one).prepareInterviewUpload(data,'owner',null,crypto.randomUUID()));assert.equal(await db.interviewMaterial.count(),0);assert.equal(await db.systemSetting.count(),0);
 results.push('actual receipt trigger failure rolls back material and receipt');
 console.log(JSON.stringify({passed:results.length,results,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src/lib/interview/upload-create.ts'))).digest('hex'),scope:'Actual upload replay helper, generated Prisma and private Unix-only PostgreSQL17. Both independent caller PIDs observed waiting on actual project advisory lock. Synthetic scalar User/SystemSetting/InterviewProject/InterviewMaterial tables with receipt uniqueness and project/user FKs; not full catalog/RLS, route/auth/storage signing or real provider E2E.'},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await Promise.all(clients.map(c=>c.$disconnect()))});
