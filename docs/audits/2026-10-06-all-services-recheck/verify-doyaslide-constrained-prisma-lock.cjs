const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PrismaClient,Prisma}=require('/Users/mitsumori_katsuki/Code/09_Cursol/node_modules/@prisma/client');
const {load}=require('/Users/mitsumori_katsuki/Code/09_Cursol/scripts/security-regression/load-typescript.cjs');
const descriptor=JSON.parse(fs.readFileSync('/tmp/doya-local-slide-db-descriptor-20261006.json','utf8'));
assert.ok(path.basename(descriptor.root).startsWith('doya-slide-qa-'));assert.equal(descriptor.data,path.join(descriptor.root,'data'));const url=new URL(descriptor.url);assert.equal(url.hostname,'localhost');assert.equal(url.searchParams.get('host'),descriptor.socket);url.searchParams.set('connection_limit','1');
const clients=Array.from({length:5},()=>new PrismaClient({datasources:{db:{url:url.href}}}));const [observer,configDb,generateDb,parentDb,childDb]=clients;
const defer=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));const ident=x=>'"'+x.replace(/"/g,'""')+'"';const literal=x=>typeof x==='string'?"'"+x.replace(/'/g,"''")+"'":String(x);
async function waitLock(pid){const deadline=Date.now()+4000;for(;;){const rows=await observer.$queryRawUnsafe('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',pid);if(rows[0]?.wait_event_type==='Lock')return;if(Date.now()>deadline)throw Error('Expected local fixture SQL lock was not observed');await pause(20)}}
;(async()=>{
 const env=await observer.$queryRawUnsafe("SELECT current_setting('data_directory') AS data, inet_server_addr()::text AS addr, current_user AS actor");assert.equal(env[0].data,descriptor.data);assert.equal(env[0].addr,null);assert.equal(env[0].actor,'doya_qa');
 for(const name of ['DoyaSlideProject','DoyaSlideSlide','DoyaSlideVersion','DoyaSlideChatMessage']){const model=Prisma.dmmf.datamodel.models.find(m=>m.name===name);const fields=model.fields.filter(f=>f.kind==='scalar');const columns=fields.map(f=>{const types={String:'TEXT',Int:'INTEGER',Boolean:'BOOLEAN',DateTime:'TIMESTAMP(3)',Json:'JSONB'};assert.ok(types[f.type]);let sql=ident(f.dbName||f.name)+' '+types[f.type]+(f.isRequired?' NOT NULL':'')+(f.isId?' PRIMARY KEY':'');if(f.hasDefaultValue){if(f.default?.name==='now')sql+=' DEFAULT CURRENT_TIMESTAMP';else if(typeof f.default!=='object')sql+=' DEFAULT '+literal(f.default)}return sql});await observer.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS '+ident(model.dbName||model.name)+' ('+columns.join(', ')+')')}

 const results=[];
 const reset=async()=>{await observer.doyaSlideChatMessage.deleteMany();await observer.doyaSlideVersion.deleteMany();await observer.doyaSlideSlide.deleteMany();await observer.doyaSlideProject.deleteMany();await observer.doyaSlideProject.create({data:{id:'synthetic-project',userId:'synthetic-owner',title:'Synthetic only',status:'completed',logoUrl:'https://example.invalid/logo.png',logoSize:'M',updatedAt:new Date('2026-10-06T00:00:00Z')}});await observer.doyaSlideSlide.create({data:{id:'synthetic-slide',projectId:'synthetic-project',index:0,visualPrompt:'Synthetic only',status:'done',imageUrl:'https://example.invalid/old.png',rawImageUrl:'https://example.invalid/base.png'}})};
 const locks=db=>load('src/lib/doyaslide/project-lock.ts',{'@/lib/prisma':{prisma:db}});
 const context={params:Promise.resolve({id:'synthetic-slide'})};
 for(const kind of ['regenerate','chat'])for(const mode of ['queued_config','branding','owner','processing','success']){
  await reset();let releases=0,providers=0,observedLogoSize;
  const held=defer(),release=defer(),composeReady=defer(),composeRelease=defer();let holder,configRequest,generationRequest;
  const gen=load(`src/app/api/doyaslide/slides/[id]/${kind}/route.ts`,{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:generateDb},'@/lib/doyaslide/project-lock':locks(generateDb),'@/lib/doyaslide/access':{getUserId:async()=> 'synthetic-owner'},'@/lib/doyaslide/limits':{reserveMonthlySlides:async()=>({granted:1,limit:20}),releaseMonthlySlides:async()=>{releases++},quotaExceededPayload:()=>({})},'@/lib/doyaslide/generate':{composeSlideImage:async(_u,p)=>{providers++;observedLogoSize=p.logoSize;composeReady.resolve();await composeRelease.promise;return{imageUrl:'https://example.invalid/generated.png',rawImageUrl:'https://example.invalid/new-base.png',model:'synthetic'}}},'@/lib/doyaslide/logo':{fetchBuffer:async()=>Buffer.from('synthetic')},'@/lib/doyaslide/vision':{reviseSlidePrompt:async()=> 'synthetic revised'},'@/lib/fetch-timeout':{raceTimeout:async(_n,_ms,p)=>p}});
  const config=load('src/app/api/doyaslide/projects/[id]/logo-config/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:configDb},'@/lib/doyaslide/project-lock':locks(configDb),'@/lib/doyaslide/access':{getUserId:async()=> 'synthetic-owner'},'@/lib/doyaslide/logo':{fetchBuffer:async()=>Buffer.from('synthetic'),compositeLogo:async()=>Buffer.from('synthetic')},'@/lib/doyaslide/storage':{uploadComposedImage:async()=> 'https://example.invalid/recomposed.png'}});
  const configPid=(await configDb.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid,generatePid=(await generateDb.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
  try{
   if(mode==='success'){
    generationRequest=gen.POST({json:async()=>({message:'Synthetic edit'})},context);await composeReady.promise;composeRelease.resolve();
   }else if(mode==='queued_config'){
    holder=parentDb.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT id FROM doyaslide_projects WHERE id=$1 FOR UPDATE','synthetic-project');held.resolve();await release.promise},{timeout:15000});await held.promise;
    configRequest=config.PUT({json:async()=>({logoSize:'L'})},{params:Promise.resolve({id:'synthetic-project'})});await waitLock(configPid);
    generationRequest=gen.POST({json:async()=>({message:'Synthetic edit'})},context);await waitLock(generatePid);assert.equal(providers,0);
    release.resolve();await holder;const cfg=await configRequest;assert.equal(cfg.status,200);
   }else{
    generationRequest=gen.POST({json:async()=>({message:'Synthetic edit'})},context);await composeReady.promise;
    holder=parentDb.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT id FROM doyaslide_projects WHERE id=$1 FOR UPDATE','synthetic-project');await tx.doyaSlideProject.update({where:{id:'synthetic-project'},data:mode==='branding'?{logoSize:'L'}:mode==='owner'?{userId:'other-synthetic-owner'}:{status:'generating'}});held.resolve();await release.promise},{timeout:15000});await held.promise;
    composeRelease.resolve();await waitLock(generatePid);release.resolve();await holder;
   }
   const response=await generationRequest;assert.equal(response.status,mode==='success'?200:409);
   const project=await observer.doyaSlideProject.findUnique({where:{id:'synthetic-project'}}),slide=await observer.doyaSlideSlide.findUnique({where:{id:'synthetic-slide'}}),versions=await observer.doyaSlideVersion.count(),messages=await observer.doyaSlideChatMessage.count();
   if(mode==='success'){assert.equal(slide.imageUrl,'https://example.invalid/generated.png');assert.equal(slide.version,2);assert.equal(versions,1);assert.equal(messages,kind==='chat'?2:0);assert.equal(releases,0);assert.equal(providers,1)}else{assert.notEqual(slide.imageUrl,'https://example.invalid/generated.png');assert.equal(slide.version,1);assert.equal(versions,0);assert.equal(messages,0);assert.equal(releases,1);assert.equal(providers,mode==='queued_config'?0:1);if(mode!=='owner')assert.notEqual(slide.status,'generating')}
   results.push({kind,mode,generationStatus:response.status,providers,releases,versions,messages,staleGeneratedImagePersisted:false,foreignOwnerCleanupSuppressed:mode==='owner',currentLogoSize:project.logoSize,generatedLogoSize:observedLogoSize??null});
  }finally{release.resolve();composeRelease.resolve();await Promise.allSettled([holder,configRequest,generationRequest].filter(Boolean))}
 }
 console.log(JSON.stringify({passed:results.length,scope:'Actual API modules, generated Prisma, and actual project-lock helper in private Unix-only PostgreSQL17 synthetic fixtures. Parent row waits observed by backend PID. No production connections, AI/provider calls or real Storage writes. Local fixture also includes the four related models mapped cascade FKs and unique/normal indexes. Production triggers/RLS and full catalog are not reproduced. Foreign-owner cleanup intentionally does not alter new owner state.',results},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(async()=>{await Promise.all(clients.map(c=>c.$disconnect()))})
