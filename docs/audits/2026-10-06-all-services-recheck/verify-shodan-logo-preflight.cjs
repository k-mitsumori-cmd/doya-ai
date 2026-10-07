const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{load}=require('../../../scripts/security-regression/load-typescript.cjs')
const base='docs/audits/2026-10-06-all-services-recheck/',cases=[],failures=[]
;(async()=>{for(const kind of ['generate','regenerate'])for(const mode of ['no-logo','valid-logo','unavailable-logo']){
 let providers=0,saves=0,releases=0;const file=`src/app/api/shodan/preparations/[id]/slides/${kind}/route.ts`,prep={id:'prep',updatedAt:new Date('2026-10-07T00:00:00.000Z'),slidesJson:[{title:'Synthetic Slide',type:'cover'}],slideImages:[]}
 class Conflict extends Error{};class Pending extends Error{}
 const route=load(file,{'next/server':{NextResponse:Response},...require('../../../scripts/security-regression/shodan-editor-test-helpers.cjs'),
 '@/lib/prisma':{prisma:{shodanPreparation:{findFirst:async()=>prep},shodanCompanyProfile:{findUnique:async()=>({logoPath:mode==='no-logo'?null:'private/logo.png',brandColors:[]})}}},
 '@/lib/shodan/access':{getShodanContext:async()=>({userId:'actor',memberId:'member',organizationId:'org',organizationSlug:'synthetic',role:'owner'}),orgSlugFrom:()=> 'synthetic'},
 '@/lib/shodan/billing':{getShodanBilling:async()=>({ownerUserId:'actor',plan:'PRO'})},'@/lib/unified-plan':{isPaidPlan:()=>true},
 '@/lib/shodan/slide-generation-lease':{ShodanSlideGenerationInProgressError:Pending,claimShodanSlideLease:async()=> 'lease',releaseShodanSlideLease:async()=>{releases++}},
 '@/lib/shodan/save-slide-images':{SlideImageConflict:Conflict,saveSlideImages:async(_id,_org,_slides,_old,changes)=>{saves++;return changes.map(x=>x.image)}},
 '@/lib/shodan/slide-image':{generateSlideImage:async(...args)=>{providers++;assert.equal(args[4].brand.logoUrl,mode==='valid-logo'?'https://local.test/logo.png':null);return {title:'Synthetic Slide',imagePath:'private/new.png'}}},
 '@/lib/shodan/storage':{signedUrl:async(path)=>path==='private/logo.png'?(mode==='unavailable-logo'?null:'https://local.test/logo.png'):'https://local.test/slide.png'},
 '@/lib/fetch-timeout':{raceTimeout:async(_label,_ms,promise)=>promise}})
 try{const r=await route.POST(new Request('https://local.test/api',{method:'POST',body:JSON.stringify({index:0,expectedUpdatedAt:prep.updatedAt.toISOString()})}),{params:Promise.resolve({id:'prep'})});const body=await r.json();assert.equal(releases,1);if(mode==='unavailable-logo'){assert.equal(providers,0,'Registered logo unavailable but provider invoked');assert.equal(saves,0);assert.equal(r.status,503);assert(!body.success)}else{assert.equal(r.status,200);assert.equal(providers,1);assert.equal(saves,1)};cases.push({kind,mode});console.log('PASS',kind,mode)}catch(e){failures.push({kind,mode,error:e.message,providers,saves,releases});console.log('FAIL',kind,mode,e.message)}
}
const files=['generate','regenerate'].map(k=>`src/app/api/shodan/preparations/[id]/slides/${k}/route.ts`);fs.writeFileSync(base+'shodan-logo-preflight-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,failures,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual routes and validators; synthetic identity/DB/lease/storage/provider. No paid provider, customer DB or production storage.'},null,2)+'\n');if(failures.length)process.exitCode=1
})().catch(e=>{console.error(e);process.exitCode=1})
