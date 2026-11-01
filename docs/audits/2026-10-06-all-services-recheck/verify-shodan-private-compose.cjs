const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),sharp=require('sharp'),{load}=require('../../../scripts/security-regression/load-typescript.cjs')
const base='docs/audits/2026-10-06-all-services-recheck/',cases=[],failures=[]
;(async()=>{const png=await sharp({create:{width:48,height:27,channels:3,background:'#4488aa'}}).png().toBuffer()
for(const scenario of ['no-logo','with-logo','logo-fetch-failure']){let publicWrites=0,privateWrites=0,providerCalls=0
 const client = { storage: {
   listBuckets: async () => ({ data: [{ name: 'doyaslide', public: true }] }),
   from: name => {
     assert.equal(name, 'doyaslide')
     return {
       upload: async () => { publicWrites++; return { error: null } },
       getPublicUrl: () => ({ data: { publicUrl: 'https://local.test/storage/v1/object/public/doyaslide/synthetic.png' } }),
     }
   },
 } }
 const publicStorage = load('src/lib/doyaslide/storage.ts', {
   '@supabase/supabase-js': { createClient: () => client }, crypto,
 })
 const fetchBuffer=async url=>{if(url==='https://local.test/logo.png'&&scenario==='logo-fetch-failure')throw Error('Synthetic unavailable logo');return png}
 const shared=load('src/lib/doyaslide/generate.ts',{'@/lib/image-generator':{generateImageWithFallback:async()=>{providerCalls++;return{base64:png.toString('base64'),mimeType:'image/png',model:'synthetic',fallbackUsed:false}}},'@/lib/fetch-timeout':{raceTimeout:async(_n,_ms,p)=>p},'./constants':{ASPECT_TO_SIZE:{wide:'1536x1024'},LOGO_POSITION_EN:{}},'./prompts':{buildImagePrompt:()=> 'Synthetic private proposal'},'./logo':{fetchBuffer,compositeLogo:async()=>png},'./aspect':{getAspectSafetyInstruction:()=>'',normalizeGeneratedSlide:async()=>({base64:png.toString('base64'),mimeType:'image/png',buffer:png})},'./storage':publicStorage})
 if(scenario==='no-logo'){for(const logo of [false,true]){const before=publicWrites,res=await shared.composeSlideImage('public-actor',{id:'public-project',aspectRatio:'wide',themeColor:'#4488aa',stylePreset:'corporate',logoPosition:'top-right',logoSize:'M',logoBackingChip:true,logoUrl:logo?'https://local.test/logo.png':null},{headline:'Synthetic public slide',visualPrompt:'Synthetic'});assert.equal(publicWrites-before,logo?2:1);assert(res.rawImageUrl.includes('/public/doyaslide/'));assert(res.imageUrl.includes('/public/doyaslide/'));cases.push(logo?'public-logo-preserved':'public-no-logo-preserved')};publicWrites=0;providerCalls=0}
 const shodan=load('src/lib/shodan/slide-image.ts',{'@/lib/doyaslide/generate':shared,'@/lib/doyaslide/logo':{fetchBuffer},'@/lib/fetch-timeout':{raceTimeout:async(_n,_ms,p)=>p},'./storage':{assertPrivateStorage:async()=>{},uploadPng:async(_path,buf)=>{assert.deepEqual(buf,png);privateWrites++}}})
 try{let result,error;try{result=await shodan.generateSlideImage('actor','prep',{title:'Synthetic Private Proposal',type:'cover'},0,scenario==='no-logo'?undefined:{brand:{logoUrl:'https://local.test/logo.png'}})}catch(e){error=e};assert.equal(publicWrites,0,'Private proposal persisted into public DoyaSlide bucket');assert.equal(providerCalls,1);if(scenario==='logo-fetch-failure'){assert(error,'Registered unavailable logo must not silently disappear');assert.equal(privateWrites,0)}else{assert(!error,error?.message);assert.equal(privateWrites,1);assert(result.imagePath.startsWith('shodan/slides/prep/'))};cases.push(scenario);console.log('PASS '+scenario)}catch(e){failures.push({scenario,error:e.message,publicWrites,privateWrites,providerCalls});console.log('FAIL '+scenario+': '+e.message+' (publicWrites='+publicWrites+')')}
}
const files=['src/lib/shodan/slide-image.ts','src/lib/doyaslide/generate.ts','src/lib/doyaslide/storage.ts'];fs.writeFileSync(base+'shodan-private-compose-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,failures,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual Shodan image pipeline, actual shared DoyaSlide composer and actual public storage module. Synthetic image provider/normalization/logo fetch/composition and Supabase adapter. No actual production data/provider/storage network. Public intermediate is a source/runtime behavior proof, not measured customer exposure.'},null,2)+'\n');if(failures.length)process.exitCode=1
})().catch(e=>{console.error(e);process.exitCode=1})
