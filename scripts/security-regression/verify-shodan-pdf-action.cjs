// Actual bounded PDF assembler. Synthetic image streams/browser decode/jsPDF only.
const assert=require('node:assert/strict'),{load,check,results}=require('./load-typescript.cjs')
const PNG=Uint8Array.from([137,80,78,71,13,10,26,10,0]),MiB=1024*1024
function fixture(mode='complete',count=14){
 const timers=new Map();let next=0,fetches=0,images=0,pages=1,saved=0,cancelled=0,readerAborts=0,decodeClears=0,fetchSignal,decodeImage,fileReader
 const ac=new AbortController(),stats=()=>({fetches,images,pages,saved,cancelled,readerAborts,decodeClears,timers:timers.size})
 let live=true
 class Reader{constructor(){this.readyState=0}readAsDataURL(){fileReader=this;this.readyState=1;if(mode==='reader-hold')return;this.readyState=2;this.result='data:image/png;base64,c3ludGhldGlj';queueMicrotask(()=>mode==='reader-error'?this.onerror?.():this.onload?.())}abort(){readerAborts++;this.readyState=2;this.onabort?.()}}
 class Image{constructor(){this.naturalWidth=mode==='zero-pixels'?0:mode==='huge-pixels'?100000:1920;this.naturalHeight=1080}set src(v){if(!v){decodeClears++;return}decodeImage=this;if(mode==='decode-hold')return;queueMicrotask(()=>mode==='decode-error'?this.onerror?.():this.onload?.())}}
 class PDF{constructor(){this.internal={pageSize:{getWidth:()=>842,getHeight:()=>595}}}addPage(){pages++}addImage(){images++}save(name){assert.ok(!/[\\/:*?"<>|]/.test(name));saved++}}
 const bytes=mode==='bad-magic'?new Uint8Array([1,2,3]):mode==='empty'?new Uint8Array():mode==='stream-large'?new Uint8Array(26*MiB):mode==='aggregate-large'?new Uint8Array(23*MiB):PNG
 if(bytes.length>8)bytes.set(PNG)
 const fetch=async(url,init)=>{fetches++;fetchSignal=init.signal;assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(new URL(url).hostname,'images.example.invalid');if(mode==='fetch-error')throw Error('synthetic fetch');if(mode==='fetch-hold')return new Promise(()=>{});
   let read=0;const body={getReader:()=>({read:async()=>{if(mode==='stream-hold')return new Promise(()=>{});return ++read===1&&bytes.length?{done:false,value:bytes}:{done:true}},cancel:async()=>{cancelled++}}),cancel:async()=>{cancelled++}}
   return{ok:mode!=='http-error',body,headers:new Headers(mode==='header-large'?{'content-length':String(26*MiB)}:{})}}
 const {exportSlidesPdf}=load('src/lib/shodan/export-slides-pdf.ts',{'./complete-slide-images':load('src/lib/shodan/complete-slide-images.ts'),'jspdf':{jsPDF:PDF}},{fetch,AbortController,Blob,FileReader:Reader,window:{Image},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)})
 const prep={slidesJson:Array.from({length:count},()=>({title:'Slide'})),slideImages:Array.from({length:mode==='missing'?count-1:count},()=>({imageUrl:'https://images.example.invalid/file.png'})),targetName:'Synthetic:/name?'}
 const flush=async()=>{for(let i=0;i<25;i++)await new Promise(setImmediate)}
 return{run:()=>exportSlidesPdf(prep,ac.signal,()=>live),stats,flush,abort:()=>ac.abort(),expire:ms=>{const t=[...timers.values()].find(t=>t.ms===ms);assert.ok(t,'timer '+ms);t.fn()},signal:()=>fetchSignal,image:()=>decodeImage,reader:()=>fileReader,leave:()=>{live=false}}
}
;(async()=>{
 await check('PDF creates all 14 pages with bounded credentials-free image reads',async()=>{const f=fixture();await f.run();assert.deepEqual(f.stats(),{fetches:14,images:14,pages:14,saved:1,cancelled:14,readerAborts:0,decodeClears:14,timers:0})})
 for(const mode of ['missing','http-error','header-large','stream-large','aggregate-large','bad-magic','empty','zero-pixels','huge-pixels','fetch-error','reader-error','decode-error'])await check('PDF rejects '+mode+' without saving and cleans deadlines',async()=>{const f=fixture(mode);await assert.rejects(f.run());assert.equal(f.stats().saved,0);assert.equal(f.stats().timers,0);if(mode==='aggregate-large')assert.equal(f.stats().fetches,3);if(['http-error','header-large'].includes(mode))assert.equal(f.stats().cancelled,1)})
 await check('PDF refuses more than 50 slides before IO',async()=>{const f=fixture('complete',51);await assert.rejects(f.run(),/50/);assert.equal(f.stats().fetches,0)})
 for(const mode of ['fetch-hold','stream-hold','reader-hold','decode-hold']){
  await check('PDF cancels '+mode+' without late save',async()=>{const f=fixture(mode),pending=f.run();const rejected=assert.rejects(pending);await f.flush();f.abort();await rejected;assert.equal(f.stats().saved,0);assert.equal(f.stats().timers,0);assert.ok(f.signal().aborted);if(mode==='stream-hold')assert.ok(f.stats().cancelled);if(mode==='reader-hold')assert.equal(f.stats().readerAborts,1);if(mode==='decode-hold'){f.image().onload?.();assert.ok(f.stats().decodeClears)}})
  await check('PDF times out '+mode+' and disposes work',async()=>{const f=fixture(mode),pending=f.run();const rejected=assert.rejects(pending,/時間内/);await f.flush();f.expire(mode==='fetch-hold'||mode==='stream-hold'?30000:10000);await rejected;assert.equal(f.stats().saved,0);assert.equal(f.stats().timers,0);assert.ok(f.signal().aborted)})
 }
 await check('overall PDF deadline aborts stalled image stream',async()=>{const f=fixture('stream-hold'),pending=f.run(),rejected=assert.rejects(pending,/時間内/);await f.flush();f.expire(120000);await rejected;await f.flush();assert.equal(f.stats().timers,0);assert.equal(f.stats().saved,0);assert.ok(f.stats().cancelled)})
 await check('PDF scope departure is rechecked after image decode',async()=>{const f=fixture('decode-hold'),pending=f.run(),rejected=assert.rejects(pending);await f.flush();f.leave();f.image().onload();await rejected;assert.equal(f.stats().saved,0);assert.equal(f.stats().images,0)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
