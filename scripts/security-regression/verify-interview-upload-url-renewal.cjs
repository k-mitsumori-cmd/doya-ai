const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
function fixture(change, actor='user') {
 let signed=0,writes=0,paths=0,owner=actor==='guest'?null:'owner';
 let row={id:'material',projectId:'project',status:'UPLOADED',filePath:'saved/path',fileName:'file.wav',fileSize:10n,mimeType:'audio/wav',type:'audio'};
 const project={findUnique:async()=>({id:'project',userId:owner,guestId:'guest'})};
 const material={findUnique:async()=>row,create:async()=>{writes++;return{id:'new'}}};
 const api=load('src/app/api/interview/materials/upload-url/route.ts',{
  '@/lib/interview/upload-create': { prepareInterviewUpload: () => { throw Error('Unexpected keyed creation in legacy/renewal fixture') }, InterviewUploadReplayError: class extends Error {} },
    'next/server':{NextResponse:Response},
  '@/lib/prisma':{prisma:{interviewProject:project,interviewMaterial:material,$transaction:async fn=>fn({$executeRaw:async()=>1,interviewProject:project,interviewMaterial:material})}},
  '@/lib/interview/access':{requireDatabase:()=>null,getInterviewUser:async()=>({userId:actor==='guest'?null:'owner',plan:'FREE'}),getGuestIdFromRequest:()=> 'guest',ensureGuestId:()=> 'guest',setGuestCookie(){}},
  '@/lib/interview/storage':{ensureBucket:async()=>{},getDetectedMaxFileSize:()=>100,buildStoragePath:()=>{paths++;return'new/path'},createSignedUploadUrl:async path=>{signed++;assert.equal(path,'saved/path');if(change)change({get row(){return row},set row(v){row=v},setOwner:v=>owner=v});return{signedUrl:'https://example.invalid/renewed',path,token:'synthetic'}}},
  '@/lib/interview/types':{ALLOWED_MIME_TYPES:{'audio/wav':'audio'},ALLOWED_EXTENSIONS:new Set(['wav']),getMaxFileSize:()=>100},
  '@/lib/pricing':{getInterviewLimitsByPlan:()=>({uploadSizeLimit:100}),getInterviewGuestLimits:()=>({uploadSizeLimit:100}),SUPPORT_CONTACT_URL:'https://example.invalid/contact'},
 });
 return{post:body=>api.POST({json:async()=>({projectId:'project',fileName:'file.wav',fileSize:10,mimeType:'audio/wav',materialId:'material',...body})}),get stats(){return{signed,writes,paths}},setRow:v=>row=v,setOwner:v=>owner=v};
}
(async()=>{let passed=0;
 for(const actor of ['user','guest']){const f=fixture(null,actor);for(let i=0;i<2;i++){const r=await f.post({});assert.equal(r.status,200);assert.equal((await r.json()).materialId,'material')}assert.deepEqual(f.stats,{signed:2,writes:0,paths:0});passed++}
 for(const body of [{materialId:{}},{materialId:''},{materialId:'../other'},{preflight:true}]){const f=fixture();assert.equal((await f.post(body)).status,400);assert.equal(f.stats.signed,0);passed++}
 for(const change of [f=>f.setOwner('other'),f=>f.setRow(null),f=>f.setRow({id:'material',projectId:'foreign'})]){const f=fixture();change(f);assert.equal((await f.post({})).status,404);assert.equal(f.stats.signed,0);passed++}
 for(const status of ['COMPLETED','PROCESSING']){const f=fixture();f.setRow({id:'material',projectId:'project',status,filePath:'saved/path',fileName:'file.wav',fileSize:10n,mimeType:'audio/wav',type:'audio'});assert.equal((await f.post({})).status,409);assert.equal(f.stats.signed,0);passed++}
 for(const body of [{fileName:'other.wav'},{fileSize:11}]){const f=fixture();assert.equal((await f.post(body)).status,409);assert.equal(f.stats.signed,0);passed++}
 for(const change of [f=>f.row=null,f=>f.row={...f.row,status:'COMPLETED'},f=>f.row={...f.row,filePath:'changed'},f=>f.row={...f.row,fileSize:11n},f=>f.setOwner('other')]){
  const f=fixture(change),r=await f.post({});assert.equal(r.status,404);const b=await r.json();assert.equal(b.signedUrl,undefined);assert.deepEqual(f.stats,{signed:1,writes:0,paths:0});passed++;
 }
 console.log(JSON.stringify({passed,scope:'Actual upload-url API, synthetic Prisma transaction/auth/storage signing. Reuses material/path; rechecks ownership and material after signing. Not real DB/storage concurrency.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
