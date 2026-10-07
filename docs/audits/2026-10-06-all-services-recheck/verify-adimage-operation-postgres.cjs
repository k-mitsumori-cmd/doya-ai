const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createRequire}=require('node:module')
const {load}=require('../../../scripts/security-regression/load-typescript.cjs')
const base='docs/audits/2026-10-06-all-services-recheck/'
const fixtureFile='scripts/security-regression/verify-adimage-image-budget.cjs'
const {PrismaClient,Prisma}=require('@prisma/client')
const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT)
assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536)
const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=adimage_lost_ack_fixture`}}})
async function setupDb(){
 const server=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(server[0].address,null);assert.equal(server[0].role,'doya_sfa')
 await db.$executeRawUnsafe('CREATE SCHEMA adimage_lost_ack_fixture')
 await db.$executeRawUnsafe('CREATE TABLE "User" (id TEXT PRIMARY KEY, plan TEXT NOT NULL)')
 const quote=s=>'"'+s.replaceAll('"','""')+'"'
 for(const name of ['SystemSetting','AdImageBrand','AdImageCampaign','AdImageConcept','AdImageCreative','AdImageFeedback']){
  const model=Prisma.dmmf.datamodel.models.find(m=>m.name===name)
  const columns=model.fields.filter(f=>f.kind!=='object').map(f=>{
   let type=({String:'TEXT',Int:'INTEGER',Boolean:'BOOLEAN',DateTime:'TIMESTAMP(3)',Json:'JSONB'})[f.type]||'TEXT';if(f.isList)type+='[]'
   let def='';if(f.type==='DateTime'&&(f.isUpdatedAt||f.default?.name==='now'))def=' DEFAULT CURRENT_TIMESTAMP';else if(f.hasDefaultValue&&['string','number','boolean'].includes(typeof f.default))def=' DEFAULT '+(typeof f.default==='string'?"'"+f.default.replaceAll("'","''")+"'":String(f.default))
   return quote(f.dbName||f.name)+' '+type+(f.isRequired?' NOT NULL':'')+def+(f.isId?' PRIMARY KEY':'')+(f.isUnique?' UNIQUE':'')
  });for(const fields of model.uniqueFields)columns.push('UNIQUE ('+fields.map(quote).join(',')+')')
  await db.$executeRawUnsafe('CREATE TABLE '+quote(model.dbName||name)+' ('+columns.join(',')+')')
 }
 for(const [table,col,parent]of [['adimage_campaign','brandId','adimage_brand'],['adimage_concept','campaignId','adimage_campaign'],['adimage_creative','conceptId','adimage_concept'],['adimage_feedback','conceptId','adimage_concept']])await db.$executeRawUnsafe(`ALTER TABLE ${table} ADD FOREIGN KEY ("${col}") REFERENCES ${parent}(id) ON DELETE CASCADE`)
}
async function makeBudget(){
 await db.$executeRawUnsafe('TRUNCATE "SystemSetting",adimage_brand,adimage_campaign,adimage_concept,adimage_creative,adimage_feedback CASCADE')
 await db.adImageBrand.create({data:{id:'brand',userId:'budget-user',name:'Synthetic'}})
 await db.adImageCampaign.create({data:{id:'campaign',brandId:'brand',userId:'budget-user',name:'Synthetic',placements:['square']}})
 await db.adImageConcept.create({data:{id:'original',campaignId:'campaign',label:'Synthetic',appealAxis:'benefit',tone:'plain',copy:{headline:'Synthetic',cta:'View'},compositionKey:'hero-center',genPaths:{},visualPrompt:'Synthetic',createdAt:new Date('2020-01-01'),creatives:{create:{placementKey:'square',size:'1024',genSize:'1024',compositionKey:'hero-center',imagePath:'old.png',createdAt:new Date('2020-01-01')}}}})
 const access={DAILY_CONCEPT_LIMIT:{FREE:5,PRO:40},DAILY_IMAGE_LIMIT:{FREE:3,PRO:50},MONTHLY_IMAGE_LIMIT:{FREE:15,PRO:300},MAX_PLACEMENTS_PER_RUN:10,ownerWhere:id=>({userId:id.userId}),quotaDenied:(reason,code,plan,usage)=>({ok:false,reason,code,plan,usage}),limitMessage:()=> 'Synthetic quota'}
 const module=load('src/lib/adimage/image-budget.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:db},'./access':access})
 const writes=[];return{...module,writes,settleImageBudget:async(...args)=>{const result=await module.settleImageBudget(...args);writes.push(result);return result}}
}

;(async()=>{
 await setupDb()
 const results=[]
 for(const operation of ['generate','refine']){
  const budget=await makeBudget(),id={userId:'budget-user',guestId:null,plan:'FREE'},brand={id:'brand',name:'Synthetic',logoPath:null},placement={key:'square',name:'Synthetic square',w:1024,h:1024}
  const original={id:'original',campaignId:'campaign',generation:1,label:'Synthetic',appealAxis:'benefit',tone:'plain',copy:{headline:'Synthetic',cta:'View'},compositionKey:'hero-center',designRefId:null,designRefStyle:null,feedbacks:[],creatives:[{placementKey:'square',imagePath:'old.png'}],campaign:{brand}}
  let generated=0,campaigns=0,signs=0
  const budgetApi={claimImageBudget:budget.claimImageBudget,releaseImageBudget:budget.releaseImageBudget,settleImageBudget:(reservation,n,write)=>budget.settleImageBudget(reservation,n,tx=>write({...tx,adImageConcept:{...tx.adImageConcept,create:async args=>{const saved=await tx.adImageConcept.create(args);return saved}}}))}
  const mocks={
   'crypto':crypto,'next/server':{NextResponse:Response},'sharp':()=>{throw Error('Unexpected real image operation')},
   '@/lib/prisma':{prisma:db},
   '@/lib/adimage/access':{assertQuota:async()=>({ok:true}),getIdentity:async()=>id,requireUser:()=>({ok:true}),ensureGuestId:()=>({identity:id,newGuestId:null}),ownerWhere:()=>({userId:id.userId})},
   '@/lib/adimage/image-budget':budgetApi,'@/lib/service-usage':{recordServiceUsage:async()=>{}},
   '@/lib/adimage/placements':{DEFAULT_PLACEMENT_KEYS:['square'],findPlacement:()=>placement,groupByGenSize:()=>[{genKey:'square',composition:'hero-center',placements:[placement]}]},
   '@/lib/adimage/ref-palette':{extractRefPalette:async()=>[]},'@/lib/adimage/generate':{generateBaked:async()=>{generated++;return{buffer:Buffer.from('synthetic'),genSize:'1024',genPath:'synthetic.png',prompt:'Synthetic',model:'synthetic',verify:{needsReview:false}}},exportToSize:async()=>({imagePath:'synthetic-'+generated+'.png'})},
   '@/lib/adimage/logo':{DEFAULT_LOGO_CONFIG:{}},'@/lib/adimage/copy':{normalizeCopy:x=>x},'@seo/lib/gemini':{},
   '@/lib/adimage/feedback':{REFINE_CHIPS:[],directivesToPromptLines:()=>['Synthetic instruction']},
   '@/lib/adimage/storage':{downloadBuffer:async()=>null,signedUrl:async image=>{if(++signs===1)throw Error('Synthetic signing failed AFTER saved concept');return'https://local.test/'+image}},
  }
  const file=operation==='generate'?'src/app/api/adimage/concepts/route.ts':'src/app/api/adimage/concepts/[id]/refine/route.ts'
  const route=load(file,mocks,{Buffer,URL,Response})
  const body=operation==='generate'?{brandId:'brand',copy:{headline:'Synthetic',cta:'View'},placements:['square'],variations:1}:{note:'Synthetic instruction'}
  const post=()=>route.POST(new Request('https://local.test/api/adimage/concepts',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:'original'})})
  await assert.rejects(post,/Synthetic signing failed AFTER saved concept/)
  assert.equal(budget.writes.length,1);assert.equal((await budget.readImageBudgetUsage(id.userId)).today,1)
  const retry=await post();assert.equal(retry.status,200);assert.equal(budget.writes.length,2);assert.equal(generated,2);assert.equal(await db.adImageConcept.count({where:{id:{not:'original'}}}),2);assert.equal((await budget.readImageBudgetUsage(id.userId)).today,2)
  results.push({operation,firstSaveCommittedBeforeSigningFailure:true,identicalPostRetryStatus:retry.status,simulatedProviderCalls:generated,savedConceptWrites:budget.writes.length,chargedImages:2,postgresSavedConcepts:await db.adImageConcept.count({where:{id:{not:'original'}}})})
 }
 const sourceHashes=Object.fromEntries(['src/app/api/adimage/concepts/route.ts','src/app/api/adimage/concepts/[id]/refine/route.ts','src/lib/adimage/image-budget.ts'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))
 const report={checkedAt:new Date().toISOString(),passed:2,cases:results,sourceHashes,scope:'Actual full generate/refine POST, actual budget, Prisma and isolated PostgreSQL with foreign keys. Synthetic identity/provider/export/signing. Signing failure after committed save admits repeat2saved concepts/2charged images. No native browser/provider/customer DB.'}
 fs.writeFileSync(base+'adimage-operation-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
})().finally(()=>db.$disconnect()).catch(error=>{console.error(error);process.exitCode=1})
