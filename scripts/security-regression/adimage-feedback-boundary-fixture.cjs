// Actual streamed parser/result formatter and feedback evaluator; in-memory operation
// admission only. The private PostgreSQL suite covers real receipts and concurrency.
const crypto=require('node:crypto'),{load}=require('./load-typescript.cjs')
const operationId='40000000-0000-4000-8000-000000000001'
function connect(mocks){
 const actual=load('src/lib/adimage/image-operation.ts',{'node:crypto':crypto,'./access':{},'./image-budget':{}})
 const prisma=mocks['@/lib/prisma'].prisma
 let latest,creativeId,settled=false
 const create=prisma.adImageFeedback.create
 prisma.adImageFeedback.create=async args=>{const result=await create(args);latest={...args.data,...result};return result}
 prisma.adImageFeedback.findFirst=async()=>latest
 const findConcept=prisma.adImageConcept.findFirst
 prisma.adImageConcept.findFirst=async args=>{const row=await findConcept(args);return row?{campaignId:'campaign',generation:1,...row,creatives:row.creatives.map(c=>({size:'1024x1024',verify:null,...c}))}:null}
 prisma.adImageConcept.findMany=async args=>{const row=await prisma.adImageConcept.findFirst({where:{...args.where,id:args.where.id.in[0]}});return row&&args.where.id.in.includes(row.id)?[row]:[]}
 const core={...actual,adImageTargetHash:()=> 'a'.repeat(64),recoverAdImageOperation:async()=>({state:settled?'completed':'missing'}),beginAdImageOperation:async(_input,body)=>{settled=false;creativeId=body.creativeId;return{state:'started'}},failAdImageOperation:async()=>null,settleAdImageFeedbackOperation:async(input,write)=>{const saved=await write(prisma,creativeId);settled=true;return{...input,phase:'completed',conceptId:input.targetId,targetHash:'a'.repeat(64),produced:0,feedbackId:saved.id,creativeId,failedPlacements:[],appliedDirectives:[]}}}
 mocks['@/lib/adimage/image-operation']=core
 mocks['@/lib/adimage/image-operation-http']=load('src/lib/adimage/image-operation-http.ts',{
  'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'./access':mocks['@/lib/adimage/access'],'./storage':{signedUrl:async()=> 'https://local.test/synthetic.png'},'./placements':{findPlacement:()=>({name:'Square',media:'Test',w:1024,h:1024})},'./image-operation':core,'./feedback':mocks['@/lib/adimage/feedback'],'@/lib/fetch-timeout':{raceTimeout:async(_name,_ms,promise)=>promise},
 },{setTimeout,clearTimeout,TextDecoder})
}
module.exports={connect,operationId}
