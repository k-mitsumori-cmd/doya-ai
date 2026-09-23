import puppeteer from 'puppeteer-core'
import {spawn} from 'node:child_process'
import {mkdir,writeFile,statfs} from 'node:fs/promises'
import path from 'node:path'
const id=process.argv[2]||'banner'
const take=process.argv[3]||'take-01'
const out=path.resolve('reference/generated-assets/2026-09-10-doyamarke-reshoot',id,take)
await mkdir(out,{recursive:true})
const disk=await statfs(out);if(disk.bavail*disk.bsize<8e9)throw Error('Less than 8GB disk reserve')
const browser=await puppeteer.connect({browserURL:'http://127.0.0.1:55509',defaultViewport:null})
const page=(await browser.pages()).find(p=>p.url().includes('doya-ai.vercel.app/'))
if(!page)throw Error('Dedicated authenticated tab unavailable')
page.setDefaultTimeout(15000)
const title='DOYA-RESHOOT-20260910'
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let started,recording,child,failed=null,resultVisible=false,cursor={x:420,y:280}
const actions=[],api=[]
const at=()=>started?(Date.now()-started)/1000:null
page.on('response',r=>{if(r.url().includes('/api/'))api.push({time:at(),path:new URL(r.url()).pathname,status:r.status()})})
async function setup(){
 const c=await page.createCDPSession(),{windowId}=await c.send('Browser.getWindowForTarget')
 await c.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}})
 await c.send('Browser.setWindowBounds',{windowId,bounds:{left:20,top:40,width:1440,height:897}})
 await page.bringToFront()
 await page.evaluate(t=>{
  document.title=t;window.scrollTo(0,0);document.documentElement.style.zoom='.85'
  document.querySelector('#reshoot-privacy')?.remove()
  const style=document.createElement('style');style.id='reshoot-privacy'
  style.textContent='iframe[title="Popup CTA"]{display:none!important} html,body{cursor:none!important} a,button,input,textarea{cursor:none!important}'
  document.head.append(style)
  for(const e of document.querySelectorAll('a'))if(e.innerText.trim().replace(/\s/g,'').includes('三森捷暉'))e.style.visibility='hidden'
  for(const e of document.querySelectorAll('img'))if(e.src.includes('googleusercontent.com'))e.style.visibility='hidden'
  document.querySelector('#reshoot-pointer')?.remove()
  const p=document.createElement('div');p.id='reshoot-pointer';p.style.cssText='position:fixed;zoom:1.176470588;left:420px;top:280px;width:25px;height:32px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 2px #0004)'
  p.innerHTML='<svg width="25" height="32" viewBox="0 0 25 32"><path d="M2 2V25L9 19L15 29L20 26L14 17H24Z" stroke="white" stroke-width="2" fill="#172033"/></svg>'
  document.body.append(p)
  document.addEventListener('mousemove',e=>{p.style.left=e.clientX+'px';p.style.top=e.clientY+'px'},true)
  document.addEventListener('pointerdown',e=>{const r=document.createElement('div');r.style.cssText=`position:fixed;zoom:1.176470588;left:${e.clientX-20}px;top:${e.clientY-20}px;width:40px;height:40px;border:2px solid #5665ee;border-radius:50%;pointer-events:none;z-index:2147483646`;document.body.append(r);r.animate([{transform:'scale(.7)',opacity:.8},{transform:'scale(1.4)',opacity:0}],{duration:450}).onfinish=()=>r.remove()},true)
 },title)
 await wait(1000)
}
async function button(re){for(const b of await page.$$('button')){if(await b.evaluate((n,s)=>n.getBoundingClientRect().width>0&&new RegExp(s).test(n.innerText.replace(/\s+/g,' ').trim()),re.source))return b}throw Error('Missing button '+re)}
async function scrollTo(el){
 const box=await el.boundingBox();if(!box)throw Error('Invisible target')
 if(box.y<100||box.y+box.height>740){
  const target=await el.evaluate(n=>Math.max(0,window.scrollY+n.getBoundingClientRect().top-innerHeight*.45))
  actions.push({type:'scroll-start',time:at()})
  await page.evaluate(y=>new Promise(resolve=>{const from=scrollY,start=performance.now();function tick(now){let t=Math.min(1,(now-start)/1000);window.scrollTo(0,from+(y-from)*(t*t*(3-2*t)));if(t<1)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)}),target)
  await wait(200);actions.push({type:'scroll-end',time:at()})
 }
}
async function move(x,y){
 const from={...cursor},start=Date.now(),duration=650
 while(Date.now()-start<duration){const t=Math.min(1,(Date.now()-start)/duration),k=t*t*(3-2*t);await page.mouse.move(from.x+(x-from.x)*k,from.y+(y-from.y)*k);await wait(16)}
 await page.mouse.move(x,y);cursor={x,y}
}
async function click(re){
 const el=await button(re);if(await el.evaluate(n=>n.disabled))throw Error('Disabled button '+re)
 await scrollTo(el);const b=await el.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2
 await move(x,y);await wait(200);actions.push({type:'click',time:at(),x:x/1440,y:y/810,label:await el.evaluate(n=>n.innerText.trim())})
 await page.mouse.click(x,y);await wait(950)
}
async function fill(selector,text){
 const el=await page.$(selector);if(!el)throw Error('Input missing '+selector)
 await scrollTo(el);const b=await el.boundingBox();await move(b.x+b.width*.3,b.y+b.height*.5)
 await el.click();await page.keyboard.down('Meta');await page.keyboard.press('A');await page.keyboard.up('Meta');await page.keyboard.press('Backspace')
 actions.push({type:'input-start',time:at(),label:selector})
 for(const char of text){await page.keyboard.sendCharacter(char);await wait(70)}
 actions.push({type:'input-end',time:at()});await wait(650)
}
async function start(){
 const file=path.join(out,'continuous-master.mov')
 child=spawn('scripts/recordings/bin/window-take-recorder',[file,'240',title])
 let log='',err=''
 recording=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(log):reject(Error(err||log)))})
 recording.catch(()=>{})
 child.stderr.on('data',b=>err+=b)
 await new Promise((resolve,reject)=>{let settled=false;child.stdout.on('data',b=>{log+=b;process.stdout.write(b);if(!settled&&log.includes('RECORDING_STARTED')){settled=true;started=Date.now();resolve()}});child.on('close',code=>{if(!settled)reject(Error(err||'Recorder exited '+code))})})
 await wait(1800)
}
try{
 await setup();await start()
 if(id==='banner'){
  await click(/サンプル入力/)
  await click(/^マーケ$/)
  await fill('textarea[maxlength="200"]','AIマーケティング入門。成果につながる活用法を無料セミナーで。')
  await click(/プロ品質バナーを生成する/)
  actions.push({type:'generation-start',time:at()});console.log('GENERATION_REQUESTED')
  const until=Date.now()+170000
  while(Date.now()<until){
   const status=await page.evaluate(()=>({complete:document.body.innerText.includes('GENERATION COMPLETE'),error:/生成に失敗|生成できませんでした|上限に達/.test(document.body.innerText)}))
   if(status.complete){resultVisible=true;break}
   if(status.error)throw Error('Application reported generation failure or limit')
   await wait(3000)
  }
  if(!resultVisible)throw Error('Generation result not visible within recording timeout')
  actions.push({type:'generation-result',time:at()});console.log('RESULT_VISIBLE')
  const result=await page.evaluateHandle(()=>[...document.querySelectorAll('*')].find(n=>n.childElementCount===0&&n.textContent.includes('GENERATION COMPLETE')))
  if(result.asElement())await scrollTo(result.asElement())
  await wait(3000)
  // Locate actual generated result images only after completion; do not substitute images.
  const imgs=await page.$$('img')
  let shown=0
  for(const img of imgs){
   const info=await img.evaluate(n=>({w:n.naturalWidth,h:n.naturalHeight,alt:n.alt,visible:n.getBoundingClientRect().width>60}))
   if(info.visible&&info.w>=500&&info.h>=300){
    await scrollTo(img);const b=await img.boundingBox();await move(b.x+b.width/2,b.y+Math.min(b.height/2,350));await wait(2200)
    actions.push({type:'result-image',time:at(),alt:info.alt,width:info.w,height:info.h});shown++;if(shown>=3)break
   }
  }
  await wait(4000)
 }else throw Error('Scenario not yet prepared for '+id)
}catch(e){failed=e.message;console.log('CAPTURE_INCOMPLETE',failed)}finally{
 if(started){await writeFile(path.join(out,'continuous-master.mov.stop'),'stop');try{console.log(await recording)}catch(e){failed=failed||e.message}}
 await page.screenshot({path:path.join(out,'last-frame.png')}).catch(()=>{})
 await writeFile(path.join(out,'capture.json'),JSON.stringify({id,take,capturedAt:new Date().toISOString(),source:'Native macOS ScreenCaptureKit isolated window',resultVisible,failed,actions,api,scope:resultVisible?'RESULT_CAPTURED_AWAITING_QA':'INCOMPLETE_NOT_DELIVERABLE',privacy:'User profile hidden and CTA iframe excluded from capture presentation',viewport:{width:1440,height:810,uiZoom:.85},contentCrop:[2880,1620,0,174]},null,2))
 await browser.disconnect()
}
