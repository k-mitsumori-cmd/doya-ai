const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{load}=require('../../../scripts/security-regression/load-typescript.cjs')
const base='docs/audits/2026-10-06-all-services-recheck/',cases=[]
;(async()=>{for(const service of ['adimage','shodan'])for(const scenario of ['private','public','metadata-error','metadata-stall']){
 let providers=0,objects=0
 const fake={storage:{getBucket:async()=>scenario==='metadata-stall'?new Promise(()=>{}):({data:{public:scenario==='public'},error:scenario==='metadata-error'?Error('Synthetic metadata error'):null}),createBucket:async()=>{throw Error('Unexpected provisioning')},from:()=>({upload:async()=>{objects++;return{error:null}}})}}
 const storage=load(`src/lib/${service}/storage.ts`,{'@/lib/interview/storage':{getSupabaseAdmin:()=>fake},'@/lib/private-storage-bucket':load('src/lib/private-storage-bucket.ts',{'@/lib/fetch-timeout':load('src/lib/fetch-timeout.ts',{}, {setTimeout:scenario==='metadata-stall'?((callback,ms)=>{assert.equal(ms,15000);return setTimeout(callback,1)}):setTimeout,clearTimeout,AbortController})})})
 if(service==='adimage'){
   const generator=load('src/lib/adimage/generate.ts',{sharp:()=>{throw Error('Unexpected image processing')},'@/lib/image-generator':{generateImageWithFallback:async()=>{providers++;throw Error('Synthetic provider reached')}},'./prompt':{buildImagePrompt:()=> 'Synthetic'},'./verify':{},'./storage':storage,'./logo':{}})
   await assert.rejects(()=>generator.generateBaked({brand:{name:'Synthetic'},copy:{headline:'Synthetic'},tone:'plain',placement:{genW:1024,genH:1024},composition:'hero',pathPrefix:'synthetic'}),e=>scenario==='private'?e.message==='Synthetic provider reached':!e.message.includes('Synthetic provider reached'))
 }else{
   const generator=load('src/lib/shodan/slide-image.ts',{'@/lib/doyaslide/generate':{composePrivateSlideImage:async()=>{providers++;return{buffer:Buffer.from('Synthetic PNG')}}},'@/lib/fetch-timeout':{raceTimeout:async(_name,_ms,p)=>p},'./storage':storage})
   const work=()=>generator.generateSlideImage('actor','prep',{title:'Synthetic',type:'cover'},0)
   if(scenario==='private')assert((await work()).imagePath);else await assert.rejects(work)
 }
 assert.equal(providers,scenario==='private'?1:0);assert.equal(objects,service==='shodan'&&scenario==='private'?1:0);cases.push({service,scenario});console.log('PASS '+service+' '+scenario+' preflight')
}
const files=['src/lib/adimage/generate.ts','src/lib/shodan/slide-image.ts','src/lib/private-storage-bucket.ts'];fs.writeFileSync(base+'private-image-preflight-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual generators/storage/privacy helper with synthetic Supabase/provider. Unsafe metadata blocks before simulated provider or upload. No paid or external calls.'},null,2)+'\n')
})().catch(e=>{console.error(e);process.exitCode=1})
