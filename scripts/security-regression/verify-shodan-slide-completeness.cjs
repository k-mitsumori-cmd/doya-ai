const assert=require('node:assert/strict');const{load,check,results}=require('./load-typescript.cjs');
const {completeSlideImages}=load('src/lib/shodan/complete-slide-images.ts');
function fixture(total,failedIndex=-1){const row={id:'p',slidesJson:Array.from({length:total},(_,i)=>({title:'slide'+i})),slideImages:[]};const generated=[];
 class SlideImageConflict extends Error{};
 const api=load('src/app/api/shodan/preparations/[id]/slides/generate/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{user:{findUnique:async()=>({plan:'PRO'})},shodanPreparation:{findFirst:async()=>JSON.parse(JSON.stringify(row))},shodanCompanyProfile:{findUnique:async()=>null}}},'@/lib/shodan/access':{getShodanContext:async()=>({organizationId:'o',userId:'u'}),orgSlugFrom:()=> 'o'},'@/lib/unified-plan':{isPaidPlan:()=>true},'@/lib/shodan/slide-image':{generateSlideImage:async(_u,_p,s,index)=>{generated.push(index);if(index===failedIndex)throw Error('synthetic failure');return{title:s.title,imagePath:'image'+index}}},'@/lib/shodan/storage':{signedUrl:async()=>''},'@/lib/fetch-timeout':{raceTimeout:async(_name,_ms,p)=>p},'@/lib/shodan/save-slide-images':{SlideImageConflict,saveSlideImages:async(_id,_org,_slides,_images,changes)=>{const next=row.slidesJson.map((s,i)=>row.slideImages[i]||{title:s.title,imagePath:null});for(const c of changes)next[c.index]=c.image;row.slideImages=next;return next}}});
 return{row,generated,run:()=>api.POST({},{params:Promise.resolve({id:'p'})})};}
(async()=>{
 for(const total of [1,8,9,14,15])await check('generate all '+total+' slides with two-per-call batches',async()=>{const f=fixture(total);let done;
 for(let i=0;i<Math.ceil(total/2);i++){const before=f.generated.length,r=await f.run();assert.equal(r.status,200);done=await r.json();assert.equal(done.total,total);assert.ok(f.generated.length-before<=2);assert.equal(done.remaining,total-Math.min(total,(i+1)*2));}
 assert.equal(done.remaining,0);assert.deepEqual(f.generated,Array.from({length:total},(_,i)=>i));await f.run();assert.equal(f.generated.length,total);
 });
 await check('failed final slide is not complete',async()=>{const f=fixture(14,13);let last;for(let i=0;i<7;i++)last=await(await f.run()).json();assert.equal(last.total,14);assert.equal(last.count,13);assert.equal(last.remaining,1)});
 for(const n of [1,8,14])await check('PDF preserves every page '+n,async()=>{const slides=Array.from({length:n},()=>({})),images=slides.map((_,i)=>({imageUrl:'url'+i}));const returned=completeSlideImages(slides,images);assert.deepEqual(returned.map(x=>x.imageUrl),images.map(x=>x.imageUrl));assert.notEqual(returned,images)});
 for(const [name,slides,images]of [['none',[],[]],['missing',Array(14).fill({}),Array(8).fill({imageUrl:'url'})],['extra',[{}],[{imageUrl:'url'},{imageUrl:'extra'}]],['null',[{}],[{imageUrl:null}]],['blank',[{}],[{imageUrl:' '}]],['numeric',[{}],[{imageUrl:1}]]])await check('PDF rejects '+name,async()=>assert.throws(()=>completeSlideImages(slides,images)));
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
