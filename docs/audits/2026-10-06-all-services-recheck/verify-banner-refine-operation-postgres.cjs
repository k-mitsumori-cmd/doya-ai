const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
(async()=>{
 const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);
 assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert.ok(port>1024&&port<65536);
 const prisma=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=sfa_authority_fixture&connection_limit=12`}}});
 const results=[],waits=[];
 const deadline=setTimeout(()=>{console.error('Banner operation PG probe did not finish all assertions');process.exit(1)},20000);
 const waitForLock=async()=>{for(let i=0;i<100;i++){const r=await prisma.$queryRawUnsafe("SELECT count(*)::integer AS n FROM pg_stat_activity WHERE usename=current_user AND wait_event_type='Lock'");if(r[0].n){waits.push(r[0].n);return}await new Promise(r=>setTimeout(r,20))}throw Error('No PostgreSQL Lock wait observed')};
 try {
  const endpoint=await prisma.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(endpoint[0].address,null);assert.equal(endpoint[0].role,'doya_sfa');
  await prisma.$executeRawUnsafe('CREATE SCHEMA sfa_authority_fixture');
  const sqls=[
   'CREATE TABLE sfa_authority_fixture."SystemSetting" (id TEXT PRIMARY KEY,key TEXT UNIQUE NOT NULL,value TEXT NOT NULL)',
   'CREATE TABLE sfa_authority_fixture."User" (id TEXT PRIMARY KEY,plan TEXT NOT NULL)',
   'CREATE TABLE sfa_authority_fixture.sfa_members (id TEXT PRIMARY KEY,"organizationId" TEXT,"userId" TEXT,role TEXT,status TEXT,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
   'CREATE TABLE sfa_authority_fixture.sfa_pipelines (id TEXT PRIMARY KEY,"organizationId" TEXT,name TEXT,"isDefault" BOOLEAN,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
   'CREATE TABLE sfa_authority_fixture.sfa_stages (id TEXT PRIMARY KEY,"pipelineId" TEXT,name TEXT,"order" INT,probability INT,color TEXT,"isWon" BOOLEAN,"isLost" BOOLEAN)',
   'CREATE TABLE sfa_authority_fixture.sfa_accounts (id TEXT PRIMARY KEY,"organizationId" TEXT,name TEXT,"isActive" BOOLEAN DEFAULT TRUE)',
   'CREATE TABLE sfa_authority_fixture.sfa_deals (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"accountId" TEXT,"contactId" TEXT,name TEXT NOT NULL,amount BIGINT DEFAULT 0,currency TEXT DEFAULT \'JPY\',"stageId" TEXT,probability INT DEFAULT 0,"startDate" TIMESTAMP(3),"expectedCloseDate" TIMESTAMP(3),"contactName" TEXT,note TEXT,status TEXT DEFAULT \'open\',"wonAt" TIMESTAMP(3),"lostAt" TIMESTAMP(3),"lostReason" TEXT,"assigneeMemberId" TEXT,"lastActivityAt" TIMESTAMP(3),"isActive" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)'
  ];
  sqls.push('ALTER TABLE sfa_authority_fixture.sfa_accounts ADD COLUMN "corporateNumber" TEXT, ADD COLUMN industry TEXT, ADD COLUMN prefecture TEXT, ADD COLUMN address TEXT, ADD COLUMN url TEXT, ADD COLUMN "employeeCount" INT, ADD COLUMN capital BIGINT, ADD COLUMN "creditRank" TEXT, ADD COLUMN "ownerMemberId" TEXT, ADD COLUMN tags JSONB, ADD COLUMN note TEXT, ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP');
  sqls.push('CREATE TABLE sfa_authority_fixture.sfa_contacts (id TEXT PRIMARY KEY,"organizationId" TEXT,"accountId" TEXT,name TEXT,"nameKana" TEXT,title TEXT,department TEXT,email TEXT,phone TEXT,"isKeyPerson" BOOLEAN DEFAULT FALSE,note TEXT,"isActive" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)');
  sqls.push('CREATE TABLE sfa_authority_fixture.sfa_leads (id TEXT PRIMARY KEY,"organizationId" TEXT,name TEXT,"corporateNumber" TEXT,"contactName" TEXT,email TEXT,phone TEXT,status TEXT DEFAULT \'new\',score INT,source TEXT DEFAULT \'manual\',"assigneeMemberId" TEXT,"convertedAccountId" TEXT,note TEXT,raw JSONB,"isActive" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)');
  for(const sql of sqls)await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_authority_fixture."User" VALUES ('owner','FREE')`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_members (id,"organizationId","userId",role,status) VALUES ('member','org','actor','member','ACTIVE'),('owner-member','org','owner','owner','ACTIVE')`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_pipelines (id,"organizationId",name,"isDefault") VALUES ('pipeline','org','Synthetic',TRUE)`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_stages (id,"pipelineId",name,"order",probability,color,"isWon","isLost") VALUES ('open','pipeline','Open',0,50,'#123456',FALSE,FALSE),('won','pipeline','Won',1,100,'#123456',TRUE,FALSE),('lost','pipeline','Lost',2,0,'#123456',FALSE,TRUE)`);


  await prisma.$executeRawUnsafe('CREATE TABLE sfa_authority_fixture."UserServiceSubscription" (id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES sfa_authority_fixture."User"(id),"serviceId" TEXT NOT NULL,plan TEXT NOT NULL DEFAULT \'FREE\',"dailyUsage" INT NOT NULL DEFAULT0,"monthlyUsage" INT NOT NULL DEFAULT0,"lastUsageReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"stripeSubscriptionId" TEXT,"stripePriceId" TEXT,"stripeCurrentPeriodEnd" TIMESTAMP(3),UNIQUE("userId","serviceId"))'.replaceAll('DEFAULT0','DEFAULT 0'));
  await prisma.$executeRawUnsafe('CREATE TABLE sfa_authority_fixture."Generation" (id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES sfa_authority_fixture."User"(id) ON DELETE CASCADE,"serviceId" TEXT NOT NULL,"templateId" TEXT,input JSONB NOT NULL,output TEXT NOT NULL,"outputType" TEXT NOT NULL DEFAULT \'TEXT\',metadata JSONB,"isFavorite" BOOLEAN NOT NULL DEFAULT FALSE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const unified=load('src/lib/unified-plan.ts');
  const pricing=load('src/lib/pricing.ts',{'./unified-plan':unified});
  const quota=load('src/lib/banner/monthly-quota.ts',{'@/lib/prisma':{prisma},'@/lib/pricing':pricing,'@/lib/plan-utils':load('src/lib/plan-utils.ts')});
  const helper=load('src/lib/banner/refine-operation.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma},'./monthly-quota':quota});
  const id='10000000-0000-4000-8000-000000000001',cutoff=new Date(0),input={originalImage:'data:image/png;base64,synthetic',instruction:'Synthetic refinement',category:'other',size:'1x1'},fingerprint=helper.bannerRefineFingerprint(input),image='data:image/png;base64,synthetic';
  const reset=async()=>{await prisma.$executeRawUnsafe('TRUNCATE "Generation","UserServiceSubscription","SystemSetting"');await prisma.$executeRawUnsafe(`INSERT INTO "User" (id,plan) VALUES ('actor','FREE') ON CONFLICT (id) DO UPDATE SET plan='FREE'`);};
  const used=async()=> (await prisma.userServiceSubscription.findUnique({where:{userId_serviceId:{userId:'actor',serviceId:'banner'}}}))?.monthlyUsage??0;
  await reset();{
   const outcomes=await Promise.all(Array.from({length:12},()=>helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma)));assert.equal(outcomes.filter(x=>x.state==='started').length,1);assert.equal(outcomes.filter(x=>x.state==='pending').length,11);assert.equal(await used(),1);assert.equal(await prisma.systemSetting.count(),1);results.push('12 parallel same UUID admissions reserve exactly one image');
   await assert.rejects(helper.beginBannerRefinement('actor',id,'f'.repeat(64),cutoff,false,prisma),e=>e.status===409);assert.equal(await used(),1);results.push('UUID reused for changed input refuses without another quota reservation');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);const outputs=await Promise.all(Array.from({length:6},()=>helper.completeBannerRefinement('actor',id,fingerprint,image,input,prisma)));assert.equal(new Set(outputs.map(x=>x.id)).size,1);assert.equal(await prisma.generation.count(),1);assert.equal(await used(),1);assert.equal((await helper.recoverBannerRefinement('actor',id,cutoff,prisma)).generation.output,image);assert.equal((await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma)).state,'completed');assert.equal(await helper.failBannerRefinement('actor',id,fingerprint,prisma),'completed');assert.equal(await used(),1);results.push('parallel completion stores one private Generation/receipt; replay/recovery reuse it without refund');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);await Promise.all(Array.from({length:6},()=>helper.failBannerRefinement('actor',id,fingerprint,prisma)));assert.equal(await used(),0);assert.equal((await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma)).state,'failed');assert.equal(await used(),0);results.push('parallel proven-failure transitions refund once and same operation never auto-restarts');
  }
  await reset();{
   const held=deferred(),release=deferred();let paused=false;const db={$transaction:(fn,opts)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='$executeRaw')return async(strings,...values)=>{if(strings.join('').includes('banner-refine:v1')&&!paused){paused=true;held.resolve();await release.promise;}return t.$executeRaw(strings,...values)};const v=t[k];return typeof v==='function'?v.bind(t):v}})),opts)};
   const delayed=helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,db);await held.promise;assert.equal((await helper.cancelMissingBannerRefinement('actor',id,cutoff,prisma)).state,'cancelled');release.resolve();assert.equal((await delayed).state,'cancelled');assert.equal(await used(),0);results.push('cancellation fences delayed admission even after its older actor read');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);assert.equal((await helper.cancelMissingBannerRefinement('actor',id,cutoff,prisma)).state,'pending');assert.equal(await used(),1);await prisma.$executeRawUnsafe(`INSERT INTO "User" (id,plan) VALUES ('other','FREE') ON CONFLICT (id) DO NOTHING`);assert.equal((await helper.recoverBannerRefinement('other',id,cutoff,prisma)).state,'missing');results.push('pending work cannot be cancelled/refunded speculatively; another actor cannot recover it');
  }
  await reset();{
   await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_operation CHECK(key NOT LIKE 'banner-refine:v1:%')`);await assert.rejects(helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma));assert.equal(await used(),0);assert.equal(await prisma.systemSetting.count(),0);await prisma.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_operation');results.push('receipt insert failure rolls back quota reservation');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_completion CHECK(value NOT LIKE '%completed%')`);await assert.rejects(helper.completeBannerRefinement('actor',id,fingerprint,image,input,prisma));assert.equal(await prisma.generation.count(),0);assert.equal(await used(),1);assert.equal((await helper.recoverBannerRefinement('actor',id,cutoff,prisma)).state,'pending');await prisma.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_completion');assert((await helper.completeBannerRefinement('actor',id,fingerprint,image,input,prisma)).id);results.push('completion failure rolls back image and retains pending reservation; saving can retry without provider');
  }
  await reset();{
   await prisma.userServiceSubscription.create({data:{userId:'actor',serviceId:'banner',plan:'FREE',monthlyUsage:14}});const ids=Array.from({length:8},(_,i)=>'20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));const outcomes=await Promise.all(ids.map(op=>helper.beginBannerRefinement('actor',op,fingerprint,cutoff,false,prisma)));assert.equal(outcomes.filter(x=>x.state==='started').length,1);assert.equal(outcomes.filter(x=>x.state==='limit').length,7);assert.equal(await used(),15);results.push('different operation UUIDs at14/15 admit one and never exceed monthly limit');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);await helper.completeBannerRefinement('actor',id,fingerprint,image,input,prisma);
   const future=new Date(Date.now()+60000);assert.equal((await helper.recoverBannerRefinement('actor',id,future,prisma)).generation,null);assert.equal((await helper.beginBannerRefinement('actor',id,fingerprint,future,false,prisma)).state,'completed');assert.equal(await used(),1);
   await prisma.generation.deleteMany();assert.equal((await helper.recoverBannerRefinement('actor',id,cutoff,prisma)).generation,null);assert.equal((await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma)).state,'completed');assert.equal(await used(),1);results.push('expired or deleted completed result never re-admits the operation');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);const row=await prisma.systemSetting.findFirst();const saved=JSON.parse(row.value);saved.reservation.count=2;await prisma.systemSetting.update({where:{id:row.id},data:{value:JSON.stringify(saved)}});
   for(const action of [()=>helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma),()=>helper.recoverBannerRefinement('actor',id,cutoff,prisma),()=>helper.failBannerRefinement('actor',id,fingerprint,prisma),()=>helper.cancelMissingBannerRefinement('actor',id,cutoff,prisma)])await assert.rejects(action(),e=>e.status===409);
   assert.equal(await used(),1);assert.equal(await prisma.generation.count(),0);results.push('corrupt reservation fails closed across admission/recovery/failure/cancel without refund');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);const row=await prisma.userServiceSubscription.findFirst();await prisma.userServiceSubscription.update({where:{id:row.id},data:{lastUsageReset:new Date(row.lastUsageReset.getTime()+60000),monthlyUsage:7}});
   await helper.failBannerRefinement('actor',id,fingerprint,prisma);assert.equal(await used(),7);assert.equal((await helper.recoverBannerRefinement('actor',id,cutoff,prisma)).state,'failed');results.push('old operation refund cannot subtract from a reset usage period');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);await prisma.userServiceSubscription.deleteMany();await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id='actor'`);
   for(const action of [()=>helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma),()=>helper.recoverBannerRefinement('actor',id,cutoff,prisma),()=>helper.failBannerRefinement('actor',id,fingerprint,prisma),()=>helper.cancelMissingBannerRefinement('actor',id,cutoff,prisma)])await assert.rejects(action(),e=>e.status===403);
   assert.equal(await prisma.systemSetting.count(),1);assert.equal(await prisma.generation.count(),0);results.push('deleted actor with stale session cannot admit/recover/refund/cancel existing receipt');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);const generation=await helper.completeBannerRefinement('actor',id,fingerprint,image,input,prisma);const row=await prisma.systemSetting.findFirst();const saved=JSON.parse(row.value);saved.state='pending';saved.generationId=null;await prisma.systemSetting.update({where:{id:row.id},data:{value:JSON.stringify(saved)}});
   await assert.rejects(helper.failBannerRefinement('actor',id,fingerprint,prisma),e=>e.status===409);assert.equal(await used(),1);assert.equal((await helper.recoverBannerRefinement('actor',id,cutoff,prisma)).state,'pending');assert.equal((await prisma.generation.findUnique({where:{id:generation.id}})).output,image);results.push('persisted image with inconsistent pending receipt never refunds or erases result');
  }
  await reset();{
   await helper.beginBannerRefinement('actor',id,fingerprint,cutoff,false,prisma);const row=await prisma.systemSetting.findFirst();const saved=JSON.parse(row.value);
   const other=await prisma.userServiceSubscription.create({data:{userId:'other',serviceId:'banner',plan:'FREE',monthlyUsage:7,lastUsageReset:new Date(saved.reservation.lastUsageReset)}});saved.reservation.id=other.id;await prisma.systemSetting.update({where:{id:row.id},data:{value:JSON.stringify(saved)}});
   await assert.rejects(helper.failBannerRefinement('actor',id,fingerprint,prisma),e=>e.status===409);assert.equal((await prisma.userServiceSubscription.findUnique({where:{id:other.id}})).monthlyUsage,7);assert.equal(await used(),1);results.push('receipt pointing at another actor subscription cannot refund that actor usage');
  }
  // Execute the real route with real input decoder/quota/operation code against
  // this private database. Only session, provider, history policy and telemetry are synthetic.
  const sharp=require('sharp');
  const actualInput=load('src/lib/banner/refine-input.ts',{sharp,'./refine-operation':helper},{setTimeout,clearTimeout,TextDecoder});
  const png=await sharp({create:{width:64,height:64,channels:3,background:'#123456'}}).png().toBuffer();
  const requestBody={originalImage:'data:image/png;base64,'+png.toString('base64'),instruction:'文字を修正してください',size:'64x64',operationId:id};
  let actor='actor',historyCutoff=cutoff,providerCalls=0,alerts=0,provider;
  const goodResponse=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:png.toString('base64')}}]}}]}));
  const makeApi=(overrides={})=>load('src/app/api/banner/refine/route.ts',{
   'node:crypto':crypto,'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
   '@vercel/functions':{waitUntil:()=>{}},'next-auth':{getServerSession:async()=>actor?{user:{id:actor}}:null},'@/lib/auth':{authOptions:{}},
   '@/lib/notifications':{sendErrorNotification:async()=>{alerts++}},'@/lib/resolve-image-model':{resolveImageModel:async()=>['gemini-3-pro-image-preview','gemini-3-pro-image']},
   '@/lib/pricing':{HIGH_USAGE_CONTACT_URL:''},'@/lib/banner/history-access':{bannerHistoryCutoff:async()=>historyCutoff},
   '@/lib/banner/refine-input':actualInput,'@/lib/banner/refine-operation':{...helper,...overrides},
  },{process:{env:{GOOGLE_GENAI_API_KEY:'synthetic-key'}},AbortSignal,fetch:async(...args)=>{providerCalls++;return provider(...args)}});
  const api=makeApi();
  const post=(body=requestBody)=>new Request('https://local.test/api/banner/refine',{method:'POST',body:JSON.stringify(body)});
  const lookup=()=>new Request('https://local.test/api/banner/refine?operationId='+id);
  const privateResponse=response=>{assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie')};
  const apiReset=async()=>{await reset();actor='actor';historyCutoff=cutoff;providerCalls=0;alerts=0;provider=async()=>goodResponse()};
  await apiReset();{
   const started=deferred(),release=deferred();provider=async()=>{started.resolve();await release.promise;return goodResponse()};
   const first=api.POST(post());await started.promise;const others=await Promise.all(Array.from({length:8},()=>api.POST(post())));
   for(const response of others){assert.equal(response.status,202,await response.clone().text());privateResponse(response);assert.equal((await response.json()).state,'pending')}
   assert.equal(providerCalls,1);assert.equal(await used(),1);release.resolve();const response=await first;assert.equal(response.status,200,await response.clone().text());privateResponse(response);const saved=await response.json();assert.equal(saved.operationId,id);assert.equal(saved.state,'completed');assert.equal(await prisma.generation.count(),1);
   for(const replay of [await api.POST(post()),await api.GET(lookup()),await api.DELETE(lookup())]){assert.equal(replay.status,200);privateResponse(replay);assert.equal((await replay.json()).generationId,saved.generationId)}
   assert.equal(providerCalls,1);assert.equal(await used(),1);results.push('actual POST admits one of9 concurrent requests; POST/GET/DELETE reuse same saved private result');
  }
  await apiReset();{
   for(const body of [{...requestBody,instruction:' '},{...requestBody,size:'1x1'},{...requestBody,operationId:'bad'},{...requestBody,extra:true},{...requestBody,originalImage:'data:image/png;base64,ZmFrZQ=='}]){const response=await api.POST(post(body));assert.equal(response.status,400);privateResponse(response)}
   assert.equal(providerCalls,0);assert.equal(await used(),0);assert.equal(await prisma.systemSetting.count(),0);assert.equal(alerts,0);results.push('actual POST rejects invalid input/raster before quota, receipt, provider or alert');
  }
  await apiReset();{
   provider=async()=>new Response('failure',{status:500});const response=await api.POST(post());assert.equal(response.status,503);assert.equal((await response.json()).state,'failed');assert.equal(await used(),0);assert.equal(providerCalls,1);assert.equal(alerts,1);assert.equal((await api.POST(post())).status,409);assert.equal(providerCalls,1);results.push('actual provider500 never falls back; failure refunds once and old UUID refuses retry');
  }
  await apiReset();{
   provider=async()=>providerCalls===1?new Response('not found',{status:404}):goodResponse();const response=await api.POST(post());assert.equal(response.status,200);assert.equal(providerCalls,2);assert.equal(await used(),1);assert.equal(await prisma.generation.count(),1);results.push('actual definite404 may select second Pro endpoint under one reservation');
  }
  await apiReset();{
   await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT api_reject_completion CHECK(value NOT LIKE '%completed%')`);
   const response=await api.POST(post());assert.equal(response.status,503);assert.equal((await response.json()).state,'failed');assert.equal(providerCalls,1);assert.equal(await used(),0);assert.equal(await prisma.generation.count(),0);assert.equal((await api.POST(post())).status,409);assert.equal(providerCalls,1);await prisma.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT api_reject_completion');results.push('actual completion rollback retries only persistence, then authoritative no-result refund; no provider repeat');
  }
  await apiReset();{
   let saves=0;const uncertain=makeApi({completeBannerRefinement:async(...args)=>{saves++;await helper.completeBannerRefinement(...args);throw Error('simulated transport failure after commit')}});
   const response=await uncertain.POST(post());assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).state,'completed');assert.equal(saves,3);assert.equal(providerCalls,1);assert.equal(await used(),1);assert.equal(await prisma.generation.count(),1);assert.equal(alerts,0);results.push('actual route recovers successful commit after lost DB acknowledgement without provider repeat or refund');
  }
  await apiReset();{
   provider=async()=>{throw Error('simulated network uncertainty')};const outage=makeApi({failBannerRefinement:async()=>{throw Error('simulated DB outage during outcome check')}});
   const response=await outage.POST(post());assert.equal(response.status,503);assert.equal((await response.json()).state,'pending');assert.equal(await used(),1);assert.equal((await api.POST(post())).status,202);assert.equal(providerCalls,1);assert.equal((await helper.recoverBannerRefinement('actor',id,cutoff,prisma)).state,'pending');results.push('actual unavailable failure verification preserves pending evidence/quota and forbids provider replay');
  }
  await apiReset();{
   const completed=await api.POST(post());assert.equal(completed.status,200);actor='other';const other=await api.GET(lookup());privateResponse(other);assert.equal((await other.json()).state,'missing');actor=null;for(const response of [await api.POST(post()),await api.GET(lookup()),await api.DELETE(lookup())]){assert.equal(response.status,401);privateResponse(response)}
   actor='actor';historyCutoff=new Date(Date.now()+60000);for(const response of [await api.POST(post()),await api.GET(lookup()),await api.DELETE(lookup())]){assert.equal(response.status,410);privateResponse(response);assert.equal((await response.json()).state,'unavailable')}
   assert.equal(providerCalls,1);assert.equal(await used(),1);results.push('actual guest/other actor/expired result recovery never exposes or regenerates private image');
  }
  await apiReset();{
   const cancelled=await api.DELETE(lookup());assert.equal((await cancelled.json()).state,'cancelled');assert.equal((await api.POST(post())).status,409);assert.equal(providerCalls,0);assert.equal(await used(),0);results.push('actual DELETE missing-operation fence prevents delayed POST admission');
  }
  const files=['src/lib/banner/refine-operation.ts','src/lib/banner/monthly-quota.ts','src/lib/pricing.ts','src/lib/plan-utils.ts','src/lib/banner/refine-input.ts','src/app/api/banner/refine/route.ts'];
  assert.equal(results.length,24);fs.writeFileSync(base+'banner-refine-operation-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,lockWaitObservations:waits,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual route, input decoder, operation helper and monthly quota/pricing with Prisma against isolated Unix-socket-only PostgreSQL synthetic schema. Synthetic session, provider and telemetry. No real provider or customer DB calls. Mounted UI integration and authenticated production flows remain unproven.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,cases:results}));
 }finally{clearTimeout(deadline);await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
