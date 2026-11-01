const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{load}=require('../../../scripts/security-regression/load-typescript.cjs')
const base='docs/audits/2026-10-06-all-services-recheck/',cases=[],failures=[]
;(async()=>{for(const service of ['adimage','shodan'])for(const operation of service==='adimage'?['uploadPng','signedUrl','downloadBuffer']:['uploadPng','uploadFile','signedUrl'])for(const scenario of ['private','public','metadata-error','privacy-changed-after-warmup','unknown-privacy','missing-created-private','missing-created-public','missing-create-failed']){
 let unsafe=false,calls=0,checks=0,created=false,creates=0
 const fake={storage:{
   getBucket:async()=>{
     checks++
     if(scenario.startsWith('missing-')&&!created)return{data:null,error:{status:404}}
     return{data:scenario==='unknown-privacy'?{}:{public:scenario==='public'||unsafe||scenario==='missing-created-public'},error:scenario==='metadata-error'?Error('Synthetic private metadata error'):null}
   },
   createBucket:async(_name,options)=>{creates++;assert.equal(options.public,false);if(scenario==='missing-create-failed')return{error:Error('Synthetic create failed')};created=true;return{error:null}},
   from:()=>({
     upload:async()=>{calls++;return{error:null}},
     createSignedUrl:async()=>{calls++;return{data:{signedUrl:'https://local.test/private.png'},error:null}},
     download:async()=>{calls++;return{data:new Blob(['Synthetic private PNG']),error:null}},
   }),
 }}
 const file=`src/lib/${service}/storage.ts`,m=load(file,{'@/lib/interview/storage':{getSupabaseAdmin:()=>fake},'@/lib/private-storage-bucket':load('src/lib/private-storage-bucket.ts',{'@/lib/fetch-timeout':load('src/lib/fetch-timeout.ts',{}, {setTimeout,clearTimeout,AbortController})})},{Blob})
 const invoke=()=>operation==='uploadPng'?m.uploadPng('synthetic/path.png',Buffer.from('Synthetic PNG')):operation==='uploadFile'?m.uploadFile('synthetic/path.png',Buffer.from('Synthetic PNG'),'image/png'):m[operation]('synthetic/path.png')
 if(scenario==='privacy-changed-after-warmup'){await invoke();unsafe=true;calls=0}
 try{let result,failed=false;try{result=await invoke()}catch{failed=true};if(['private','missing-created-private'].includes(scenario)){assert(!failed);assert(result);assert.equal(calls,1);if(scenario.startsWith('missing-')){assert.equal(creates,1);assert.equal(checks,2)}}else{assert(failed||result===null,'Unsafe bucket operation succeeded');assert.equal(calls,0,'Storage object API called before verifying private bucket')};cases.push({service,operation,scenario});console.log('PASS '+service+' '+operation+' '+scenario)}catch(e){failures.push({service,operation,scenario,error:e.message});console.log('FAIL '+service+' '+operation+' '+scenario+': '+e.message)}
}
const files=['src/lib/adimage/storage.ts','src/lib/shodan/storage.ts','src/lib/private-storage-bucket.ts'];fs.writeFileSync(base+'private-image-bucket-policy-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,failures,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual AdImage/Shodan storage modules with synthetic Supabase object/metadata adapter. Misconfiguration and warm-cache privacy change probes; not actual production bucket state or customer exposure evidence.'},null,2)+'\n');if(failures.length)process.exitCode=1
})().catch(e=>{console.error(e);process.exitCode=1})
