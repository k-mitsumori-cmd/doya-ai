const assert=require('node:assert/strict'),sharp=require('sharp'),{load}=require('./load-typescript.cjs');
const path='11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333.png';
(async()=>{
 let mode='ok',writes=0,reads=0,removes=0,networkOptions;const png=await sharp({create:{width:32,height:32,channels:3,background:'#4488aa'}}).png().toBuffer();
 const fakeClient = { storage: {
  getBucket: async () => ({data:mode==='missing'?null:{public:mode==='public'},error:mode==='error'?Error('internal'):null}),
  from: name => {
   assert.equal(name,'persona-private-images');
   return {
    upload:async(key,buf,opts)=>{writes++;assert.equal(key,path);assert.equal(opts.upsert,false);assert.equal(opts.contentType,'image/png');return{error:mode==='upload-fail'?Error('internal'):null}},
    download:async()=>{reads++;return{data:new Blob([png]),error:null}},
    remove:async()=>{removes++;return{error:null}}
   };
  }
 }};
 const storage=load('src/lib/persona/image-storage.ts',{
  '@supabase/supabase-js':{createClient:(_url,_key,options)=>{networkOptions=options;return fakeClient}},sharp
 },{process:{env:{SUPABASE_URL:'https://storage.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic'}},AbortSignal,fetch:async(_url,opts)=>{assert.ok(opts.signal instanceof AbortSignal);return new Response('ok')}});
 const normalized=await storage.normalizePersonaImage(png.toString('base64'));assert.equal((await sharp(normalized).metadata()).format,'png');assert.equal((await sharp(normalized).metadata()).width,32);
 for(const bad of ['', 'not base64!',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>').toString('base64'),Buffer.from('invalid image').toString('base64')])await assert.rejects(()=>storage.normalizePersonaImage(bad));console.log('PASS actual raster decoding, PNG normalization, SVG and malformed input rejection');
 for(const bad of ['../other.png','https://external.invalid/file',path.replace('11111111','..'),path+'?public=1'])await assert.rejects(()=>storage.savePersonaImageFile(bad,png));assert.equal(writes,0);
 for(mode of ['public','missing','error']){await assert.rejects(()=>storage.savePersonaImageFile(path,png));await assert.rejects(()=>storage.readPersonaImageFile(path));}assert.equal(writes,0);assert.equal(reads,0);console.log('PASS bucket privacy and exact path checked before upload/download');
 mode='ok';assert.equal(await storage.savePersonaImageFile(path,png),path);assert.deepEqual(await storage.readPersonaImageFile(path),png);await storage.removePersonaImageFile(path);assert.equal(writes,1);assert.equal(reads,1);assert.equal(removes,1);await networkOptions.global.fetch('https://storage.invalid',{});console.log('PASS private immutable upload, retrieval, cleanup and bounded fetch');
 mode='upload-fail';await assert.rejects(()=>storage.savePersonaImageFile(path,png));console.log('PASS upload failure remains failure');
 for(const scenario of ['owner','anonymous','foreign','deleted','pending','bad-path','storage-failure']){
  let downloads=0;const route=load('src/app/api/persona/images/[id]/route.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>scenario==='anonymous'?null:{user:{id:'owner'}}},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{personaImageJob:{findFirst:async({where})=>{assert.equal(where.project.userId,'owner');assert.equal(where.project.deletedAt,null);assert.equal(where.status,'succeeded');return ['foreign','deleted','pending'].includes(scenario)?null:{id:path.split('/')[1],projectId:path.split('/')[0],leaseToken:path.split('/')[2].replace('.png',''),outputRef:scenario==='bad-path'?'../other':path}}}}},'@/lib/persona/image-storage':{readPersonaImageFile:async()=>{downloads++;if(scenario==='storage-failure')throw Error('secret');return png}}});
  const res=await route.GET(new Request('http://test'),{params:Promise.resolve({id:'image'})});assert.equal(res.status,scenario==='anonymous'?401:scenario==='storage-failure'?503:scenario==='owner'?200:404);assert.equal(downloads,['owner','storage-failure'].includes(scenario)?1:0);assert.equal(res.headers.get('cache-control'),'private, no-store');assert.equal(res.headers.get('vary'),'Cookie');assert.equal(res.headers.get('x-content-type-options'),'nosniff');if(scenario==='owner')assert.deepEqual(Buffer.from(await res.arrayBuffer()),png);console.log('PASS owned image GET',scenario);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
