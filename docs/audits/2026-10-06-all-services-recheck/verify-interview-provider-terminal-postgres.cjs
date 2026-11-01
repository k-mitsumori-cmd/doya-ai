const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{PrismaClient,Prisma}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536);
 const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=article_route_fixture&connection_limit=12`}}}),cases=[];
 try{
  const conn=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(conn[0].address,null);assert.equal(conn[0].role,'doya_sfa');await db.$executeRawUnsafe('CREATE SCHEMA article_route_fixture');
  const quote=s=>'"'+s.replaceAll('"','""')+'"',types={DateTime:'TIMESTAMP(3)',Int:'INTEGER',Float:'DOUBLE PRECISION',Boolean:'BOOLEAN',Json:'JSONB',BigInt:'BIGINT',Decimal:'DECIMAL',Bytes:'BYTEA'};
  for(const name of ['SystemSetting','InterviewProject','InterviewDraft','InterviewMaterial','InterviewTranscription','InterviewRecipe']){
    const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name);
    const fields=m.fields.filter(f=>f.kind!=='object').map(f=>{
      const type=types[f.type]||'TEXT';let def='';
      if(f.type==='DateTime')def=' DEFAULT CURRENT_TIMESTAMP';else if(f.isRequired&&!f.isId){if(f.isList)def=" DEFAULT '{}'";else if(f.type==='Boolean')def=' DEFAULT false';else if(['Int','Float','BigInt','Decimal'].includes(f.type))def=' DEFAULT 0';else if(f.type==='Json')def=" DEFAULT '[]'::jsonb";else def=" DEFAULT ''"}
      return quote(f.dbName||f.name)+' '+type+(f.isList?'[]':'')+def+(f.isRequired?' NOT NULL':'')+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'');
    });await db.$executeRawUnsafe('CREATE TABLE '+quote(m.dbName||m.name)+' ('+fields.join(',')+')');
  }
  await db.$executeRawUnsafe('ALTER TABLE interview_draft ADD CONSTRAINT draft_project FOREIGN KEY ("projectId") REFERENCES interview_project(id)');
  let actor='actor',plan='FREE',guestCookie=null,mode='success',providers=0,metrics=0,metricFailure=false,lostCommitAck=false,pollId=0;const polls=new Map(),held=[];
  const budget=load('src/lib/interview/article-budget.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:db}});
  const operation=load('src/lib/interview/article-operation.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:db},'./article-budget':budget});
  const access=load('src/lib/interview/access.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>actor?{user:{id:actor,interviewPlan:plan}}:null},'@/lib/auth':{authOptions:{}}},{process:{env:{DATABASE_URL:'synthetic-private-only'}}});
  const bodyReader=load('src/lib/operational-json.ts',{}, {TextDecoder,Uint8Array});
  const api=load('src/app/api/interview/articles/generate/route.ts',{'next/server':{},'node:crypto':crypto,'@/lib/prisma':{prisma:db},'@/lib/interview/access':access,'@/lib/interview/article-operation':{...operation,completeArticleOperation:async(...args)=>{const r=await operation.completeArticleOperation(...args);if(lostCommitAck)throw Error('synthetic lost acknowledgement');return r}},'@/lib/operational-json':bodyReader,'@/lib/interview/prompts':{buildArticlePrompt:()=>''},'@/lib/service-usage':{recordServiceUsage:async()=>{metrics++;if(metricFailure)throw Error('synthetic metrics outage')}},'@/lib/pricing':{SUPPORT_CONTACT_URL:'/contact'},'@/lib/interview/gemini-request':load('src/lib/interview/gemini-request.ts')},{TextEncoder,TextDecoder,ReadableStream,AbortController,AbortSignal,process:{env:{GEMINI_API_KEY:'synthetic'}},setInterval:fn=>{polls.set(++pollId,fn);return pollId},clearInterval:id=>polls.delete(id),fetch:async(_url,init)=>{
    providers++;
    const event=(text,reason,thought=false)=>'data:'+JSON.stringify({candidates:[{content:{parts:[{text,thought}]},...(reason===undefined?{}:{finishReason:reason})}]})+'\n\n';
    const responses={
      'max-tokens':event('Incomplete article','MAX_TOKENS'),
      safety:event('Incomplete article','SAFETY'),
      unknown:event('Incomplete article','OTHER'),
      missing:event('Incomplete article'),
      invalid:event('Incomplete article',null),
      late:event('Article','STOP')+event('unexpected'),
      conflicting:event('Article','STOP')+event('','MAX_TOKENS'),
      success:event('日本語の記事','STOP'),
      separate:event('日本語の記事')+event('','STOP')+'data: {"usageMetadata":{"totalTokenCount":3}}\n\n',
      thoughts:event('private reasoning',undefined,true)+event('日本語の記事','STOP'),
    };
    assert(Object.hasOwn(responses,mode));return new Response(responses[mode]);
  }});
  const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),body=(n=1,extra={})=>({projectId:'project',recipeId:'recipe',displayFormat:'MONOLOGUE',operationId:id(n),...extra});
  const request=(method,n=1,extra={})=>{const req=new Request('https://example.invalid/api/interview/articles/generate?projectId=project'+(n===null?'':'&operationId='+id(n)),{method,headers:{'content-type':'application/json','origin':'https://example.invalid'},...(method==='POST'?{body:JSON.stringify(body(n,extra))}:{})});req.cookies={get:()=>guestCookie?{value:guestCookie}:undefined};return req};
  const read=async r=>{assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');const text=await r.text();return{text,status:r.status,events:text.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6))),data:(r.headers.get('content-type')||'').includes('application/json')?JSON.parse(text):null}};
  const call=async(method,n=1,extra={})=>read(await api[method](request(method,n,extra)));
  const used=async subject=>{const key='interview-article:v1:'+crypto.createHash('sha256').update(subject||'user:actor').digest('hex'),r=await db.systemSetting.findUnique({where:{key}});return r?JSON.parse(r.value).count:0};
  const wait=async predicate=>{for(let n=0;n<400;n++){if(await predicate())return;await new Promise(r=>setTimeout(r,5))}throw Error('Fixture condition did not settle')};
  const settled=()=>wait(()=>polls.size===0);
  async function reset(){assert.equal(polls.size,0);await db.systemSetting.deleteMany();await db.interviewDraft.deleteMany();await db.interviewTranscription.deleteMany();await db.interviewMaterial.deleteMany();await db.interviewProject.deleteMany();await db.interviewRecipe.deleteMany();await db.$executeRawUnsafe(`INSERT INTO interview_project (id,"userId",title,status) VALUES ('project','actor','Synthetic project','TRANSCRIBING')`);await db.$executeRawUnsafe(`INSERT INTO interview_recipe (id,name,"isTemplate","isPublic","usageCount") VALUES ('recipe','Synthetic recipe',true,false,0)`);await db.$executeRawUnsafe(`INSERT INTO interview_transcription (id,"projectId",text,status) VALUES ('transcription','project','Synthetic source','COMPLETED')`);actor='actor';plan='FREE';guestCookie=null;mode='success';providers=0;metrics=0;metricFailure=false;lostCommitAck=false;held.length=0}
  async function check(name,fn){await reset();await fn();await settled();cases.push(name);console.log('PASS '+name)}
  for(const failure of ['max-tokens','safety','unknown','missing','invalid','late','conflicting'])await check(failure+': no draft or quota charge for incomplete/invalid provider termination',async()=>{mode=failure;const result=await call('POST');assert.equal(result.events.at(-1).type,'error');await wait(async()=>await used()===0);assert.equal(await db.interviewDraft.count(),0);assert.equal((await db.interviewRecipe.findUnique({where:{id:'recipe'}})).usageCount,0);assert.equal((await call('GET')).data.state,'failed');assert.equal(providers,1);assert.equal(metrics,0);await call('POST');assert.equal(providers,1);assert.equal(await used(),0)});
  for(const success of ['success','separate','thoughts'])await check(success+': normal STOP saves article once, excludes reasoning and replays',async()=>{mode=success;const result=await call('POST');assert.equal(result.events.at(-1).type,'done');await settled();assert.equal(await used(),1);const drafts=await db.interviewDraft.findMany();assert.equal(drafts.length,1);assert.equal(drafts[0].content,'日本語の記事');assert(!result.text.includes('private reasoning'));assert.equal((await db.interviewRecipe.findUnique({where:{id:'recipe'}})).usageCount,1);assert.equal((await call('GET')).data.state,'completed');await call('POST');assert.equal(providers,1);assert.equal(await used(),1)});
  assert.equal(cases.length,10);const files=['src/app/api/interview/articles/generate/route.ts','src/lib/interview/article-operation.ts','src/lib/interview/article-budget.ts','src/lib/interview/access.ts','src/lib/operational-json.ts','src/lib/interview/gemini-request.ts',base+'verify-interview-provider-terminal-postgres.cjs'];const report={checkedAt:new Date().toISOString(),expected:10,passed:10,cases,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual API/ORM/private Unix PostgreSQL with synthetic normal, incomplete and conflicting Gemini terminal responses; no external provider or customer data.'};fs.writeFileSync(base+'interview-provider-terminal-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await db.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
