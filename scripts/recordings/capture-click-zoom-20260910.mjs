import puppeteer from 'puppeteer-core'
import {mkdir,readFile,writeFile,statfs} from 'node:fs/promises'
import path from 'node:path'
import {recordPage} from './live-cdp-recorder.mjs'
const W=3200,H=1800
const id=process.argv[2]
const config=JSON.parse(await readFile('scripts/recordings/doyamarke-services.json','utf8'))
const service=config.services.find(s=>s.id===id)
if(!service)throw new Error('Service required')
const out=path.resolve('reference/generated-assets/2026-09-10-doyamarke-click-zoom',id)
await mkdir(out,{recursive:true})
const disk=await statfs(out)
if(disk.bavail*disk.bsize<8e9)throw new Error('Less than 8GB available for bounded single-service capture')
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,defaultViewport:{width:W,height:H,deviceScaleFactor:1},args:['--disable-background-networking','--no-first-run']})
const page=await browser.newPage()
// Keep third-party marketing popups out of the recording; application APIs are unchanged.
await page.setRequestInterception(true)
page.on('request',request=>{
 const url=new URL(request.url())
 if(url.hostname==='www.googletagmanager.com')void request.abort('blockedbyclient')
 else void request.continue()
})
page.setDefaultTimeout(15000)
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const actions=[],api=[]
let started=0,recorder,error=null,captureStats=null
const at=()=>Number(((Date.now()-started)/1000).toFixed(3))
const ui=()=>page.evaluate(()=>({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().width).map(n=>({text:n.innerText.trim(),disabled:n.disabled}))}))
page.on('response',r=>{if(r.url().includes('/api/'))api.push({at:started?at():null,path:new URL(r.url()).pathname,status:r.status()})})
async function button(pattern){
 for(const el of await page.$$('button')){
  const v=await el.evaluate(n=>({text:n.innerText.trim().replace(/\s+/g,' '),visible:n.getBoundingClientRect().width>0,disabled:n.disabled}))
  if(v.visible&&pattern.test(v.text)){if(v.disabled)throw new Error(`Disabled button: ${v.text}`);return el}
 }
 throw new Error(`Button not found: ${pattern}`)
}
async function point(el){
 await el.evaluate(n=>n.scrollIntoView({behavior:'smooth',block:'center'}))
 await wait(850)
 const box=await el.boundingBox()
 if(!box||box.y<0||box.y+box.height>H)throw new Error('Target outside viewport')
 const x=box.x+box.width/2,y=box.y+box.height/2
 await page.mouse.move(x,y,{steps:28});await wait(850)
 return {x:x/W,y:y/H,box}
}
async function click(pattern){
 const el=await button(pattern),p=await point(el)
 const label=await el.evaluate(n=>n.innerText.trim().replace(/\s+/g,' '))
 actions.push({type:'click',at:at(),x:p.x,y:p.y,label})
 await page.mouse.click(p.x*W,p.y*H)
 await wait(2900)
 await writeFile(path.join(out,'last-ui.json'),JSON.stringify(await ui(),null,2))
 console.log(id,'CLICK',label)
}
async function fill(selector,value){
 const el=await page.$(selector);if(!el)throw new Error(`Input not found ${selector}`)
 const p=await point(el)
 actions.push({type:'click',at:at(),x:p.x,y:p.y,label:'入力欄を選択'})
 await page.mouse.click(p.x*W,p.y*H)
 await page.keyboard.down('Meta');await page.keyboard.press('A');await page.keyboard.up('Meta')
 await page.keyboard.type(value,{delay:55})
 actions.push({type:'input',at:at(),label:value})
 await wait(2000)
}
try{
 await page.goto(`http://127.0.0.1:3040${service.route}`,{waitUntil:'networkidle2',timeout:90000})
 await page.evaluate(()=>document.fonts.ready)
 await page.evaluate(()=>{document.documentElement.style.zoom='2'})
 await wait(1500)
 // Visual cursor and click ripple only; application data and results are untouched.
 await page.evaluate(()=>{
  const pointer=document.createElement('div')
  pointer.id='recording-cursor'
  pointer.style.cssText='position:fixed;zoom:.5;left:100px;top:120px;width:48px;height:60px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 2px 3px #0005)'
  pointer.innerHTML='<svg width="48" height="60" viewBox="0 0 24 30"><path d="M2 1L2 24L8 18L13 28L18 25L13 16L22 16Z" fill="#172033" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>'
  document.body.append(pointer)
  document.addEventListener('mousemove',e=>{pointer.style.left=e.clientX+'px';pointer.style.top=e.clientY+'px'},true)
  document.addEventListener('pointerdown',e=>{
   const ring=document.createElement('div')
   ring.style.cssText=`position:fixed;zoom:.5;left:${e.clientX-36}px;top:${e.clientY-36}px;width:72px;height:72px;border:4px solid #6366f1;border-radius:50%;background:#6366f122;pointer-events:none;z-index:2147483646;box-sizing:border-box`
   document.body.append(ring)
   ring.animate([{transform:'scale(.45)',opacity:1},{transform:'scale(1.65)',opacity:0}],{duration:800,easing:'cubic-bezier(.16,1,.3,1)'}).onfinish=()=>ring.remove()
  },true)
 })
 recorder=await recordPage(page,path.join(out,'continuous-master-hq.mp4'))
 started=recorder.startedAt;await wait(1800)
 if(id==='banner'){
  await click(/サンプル入力/)
  await click(/^SNS広告$/)
  await click(/^マーケ$/)
  await click(/^リンク 1.91:1$/)
  await fill('textarea[maxlength="200"]','成果につながるAIマーケティング入門')
 }else if(id==='seo'){
  await click(/サンプル（切替）/)
  await fill('input[placeholder^="例：AIライティング"]','AIマーケティングの始め方｜導入手順と運用のポイント')
  await click(/^HowTo記事/)
  await click(/^次へ$/)
  await click(/^次へ$/)
 }else if(id==='interview'){
  await fill('input[placeholder]', 'AI活用による業務改善インタビュー（撮影サンプル）')
  await click(/導入事例・ケーススタディ/)
  await click(/^ビジネス$/)
  await fill('textarea','導入前の課題、使い始めたきっかけ、現場の変化について伺います。')
 }else if(id==='doyaslide'){
  await click(/サンプルを入れる/)
  await click(/セミナー・登壇/)
  await fill('input[placeholder^="例:"]','はじめてのAIマーケティング活用セミナー')
  await click(/^.*ミニマル$/)
  await click(/^＋$/)
  await click(/^crop_16_9 横$/)
 }else throw new Error('No authenticated operation scenario available')
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}))
 actions.push({type:'scroll',at:at(),label:'画面全体へ戻る'})
 await wait(4000)
}catch(e){error=e.message;console.log(id,'PARTIAL',error)}finally{
 await writeFile(path.join(out,'actions-recovery.json'),JSON.stringify({id,started,actions,api,error},null,2))
 if(recorder){try{captureStats=await recorder.stop()}catch(e){error=error||e.message}}
 const finalUi=await ui().catch(()=>null)
 await page.screenshot({path:path.join(out,'last-frame.jpg'),quality:90}).catch(()=>{})
 await writeFile(path.join(out,'events.json'),JSON.stringify({id,name:service.name,capturedAt:new Date().toISOString(),source:'Live Chromium continuous compositor screencast',captureProfile:'hq-clean-v1',rawFile:'continuous-master-hq.mp4',captureStats,viewport:{width:W,height:H,deviceScaleFactor:1,uiZoom:2},actions,api,workflowStatus:'INPUT_PREVIEW_ONLY',endToEndComplete:false,error,finalUi},null,2))
 await browser.close()
}
