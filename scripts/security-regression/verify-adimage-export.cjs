const assert=require('node:assert/strict'),{load,check}=require('./load-typescript.cjs');
function fixture(mode,auth=true){let archives=0;const files=[];
 const api=load('src/app/api/adimage/concepts/[id]/export/route.ts',{
 'next/server':{NextResponse:Response},archiver:()=>{archives++;const handlers={};return{on:(e,f)=>handlers[e]=f,append:(b,o)=>files.push({name:o.name,text:b.toString()}),finalize:async()=>{if(mode==='archive-error')throw Error('internal-secret');handlers.data(Buffer.from('zip'));handlers.end()}}},
 '@/lib/prisma':{prisma:{adImageConcept:{findFirst:async()=>{if(mode==='db-error')throw Error('internal-secret');return mode==='foreign'?null:{id:'c',label:'x',campaign:{brand:{name:'x'}},creatives:[1,2,3].map(i=>({id:'i'+i,imagePath:'private/'+i,placementKey:'p',size:'100x100',compositionKey:'same'}))}}}}},
 '@/lib/adimage/access':{getIdentity:async()=>({}),requireUser:()=>({ok:auth,reason:'Login required'}),ownerWhere:()=>({userId:'u'})},
 '@/lib/adimage/placements':{findPlacement:()=>({name:'test',media:'test'})},
 '@/lib/adimage/storage':{downloadBuffer:async p=>{if(mode==='throw')throw Error('private-storage-secret');if(mode==='all-missing')return null;if(mode==='empty')return Buffer.alloc(0);if(mode==='partial'&&p==='private/2')return null;return Buffer.from('image')}}});
 return{get:partial=>api.GET(new Request('http://localhost/export'+(partial?'?partial=1':'')),{params:Promise.resolve({id:'c'})}),files,get archives(){return archives}};
}
(async()=>{
await check('all images preserved with unique filenames',async()=>{const f=fixture('ok'),r=await f.get();assert.equal(r.status,200);assert.equal(f.files.length,3);assert.equal(new Set(f.files.map(x=>x.name)).size,3);assert.equal(r.headers.get('X-Export-Image-Count'),'3')});
for(const mode of ['partial','all-missing','throw','empty'])await check(mode+' cannot silently produce incomplete ZIP',async()=>{const f=fixture(mode),r=await f.get(),b=await r.json();assert.equal(r.status,502);assert.equal(f.archives,0);assert.equal(b.availableCount,mode==='partial'?2:0);assert(!JSON.stringify(b).includes('private'))});
await check('explicit partial export includes missing manifest',async()=>{const f=fixture('partial'),r=await f.get(true);assert.equal(r.status,200);assert.equal(r.headers.get('X-Export-Missing-Count'),'1');assert.equal(f.files.filter(x=>x.name.endsWith('.png')).length,2);assert(f.files.find(x=>x.name.endsWith('.txt')).text.includes('取得失敗1枚'));assert(r.headers.get('Content-Disposition').includes('_partial.zip'))});
await check('partial does not allow empty archive',async()=>assert.equal((await fixture('all-missing').get(true)).status,502));
for(const mode of ['db-error','archive-error'])await check(mode+' becomes retryable JSON without secrets',async()=>{const r=await fixture(mode).get();assert.equal(r.status,502);assert(!(await r.text()).includes('internal-secret'))});
await check('anonymous denied',async()=>{const f=fixture('ok',false);assert.equal((await f.get()).status,401);assert.equal(f.archives,0)});
await check('foreign concept denied',async()=>assert.equal((await fixture('foreign').get()).status,404));
})().catch(e=>{console.error(e);process.exitCode=1});
