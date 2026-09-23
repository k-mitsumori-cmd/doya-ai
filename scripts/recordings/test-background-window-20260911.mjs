import puppeteer from 'puppeteer-core'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
const out=path.resolve('reference/generated-assets/2026-09-11-doyamarke-background',process.argv[2]||'test-02')
await mkdir(out,{recursive:true})
const browser=await puppeteer.connect({browserURL:'http://127.0.0.1:55510',defaultViewport:null})
const page=(await browser.pages()).find(p=>p.url().startsWith('https://doya-ai.vercel.app/banner/dashboard'))||await browser.newPage()
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let cover,rec,recDone,started=false
const evidence={purpose:'Actual window recording with an unrelated task-owned window covering it; no generation API invoked',events:[]}
try {
 await page.goto('https://doya-ai.vercel.app/banner/dashboard',{waitUntil:'networkidle2',timeout:60000})
 const client=await page.createCDPSession(); const {windowId}=await client.send('Browser.getWindowForTarget')
 await client.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}})
 await client.send('Browser.setWindowBounds',{windowId,bounds:{left:30,top:40,width:1280,height:863}})
 await page.bringToFront()
 await page.evaluate(()=>{document.title='DOYA-BACKGROUND-TEST-0911';document.documentElement.style.zoom='.8';const s=document.createElement('style');s.textContent='iframe[title="Popup CTA"]{display:none!important}';document.head.append(s)})
 await wait(1500)
 let viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}))
 const current=await client.send('Browser.getWindowBounds',{windowId})
 await client.send('Browser.setWindowBounds',{windowId,bounds:{height:current.bounds.height+720-viewport.height}})
 await wait(1000)
 evidence.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,outerWidth,outerHeight,zoom:document.documentElement.style.zoom}))
 evidence.windowBounds=(await client.send('Browser.getWindowBounds',{windowId})).bounds
 if(evidence.viewport.width!==1280||evidence.viewport.height!==720)throw Error('Viewport is not 1280x720')
 evidence.ui=await page.evaluate(()=>document.body.innerText.slice(0,300))
 await page.screenshot({path:path.join(out,'before.png')})
 rec=spawn('scripts/recordings/bin/window-take-recorder',[path.join(out,'continuous-master.mov'),'23','DOYA-BACKGROUND-TEST-0911','--hide-system-cursor',`--capture-size=${evidence.windowBounds.width*2}x${evidence.windowBounds.height*2}`])
 let stdout='',stderr=''
 recDone=new Promise((resolve,reject)=>{rec.on('error',reject);rec.on('close',code=>code===0?resolve():reject(Error(stderr||stdout)))})
 recDone.catch(()=>{})
 rec.stderr.on('data',b=>stderr+=b)
 await new Promise((resolve,reject)=>{rec.stdout.on('data',b=>{stdout+=b;process.stdout.write(b);if(stdout.includes('RECORDING_STARTED'))resolve()});rec.on('close',()=>reject(Error(stderr||stdout)))})
 started=true;const t0=Date.now()
 async function scroll(y){await page.evaluate(y=>new Promise(done=>{const f=scrollY,t=performance.now();function tick(now){let k=Math.min(1,(now-t)/3500);scrollTo(0,f+(y-f)*(k*k*(3-2*k)));if(k<1)requestAnimationFrame(tick);else done()}requestAnimationFrame(tick)}),y)}
 await scroll(550)
 const c=await browser.target().createCDPSession()
 const {targetId}=await c.send('Target.createTarget',{url:'about:blank',newWindow:true,width:1440,height:897,left:30,top:50})
 const target=await browser.waitForTarget(t=>t._targetId===targetId,{timeout:10000});cover=await target.page()
 await cover.setContent('<!doctype html><html><body style="margin:0;background:#ef6c00;color:white;font:48px sans-serif;height:100vh;display:grid;place-items:center">録画の映り込み確認用ウィンドウ</body></html>')
 await cover.bringToFront();evidence.events.push({type:'cover-window-front',time:(Date.now()-t0)/1000})
 await cover.screenshot({path:path.join(out,'cover-window.png')})
 await scroll(1250);await scroll(1800);await scroll(2200)
 evidence.events.push({type:'background-scrolling-end',time:(Date.now()-t0)/1000})
 await recDone
 evidence.status='CAPTURED_AWAITING_FRAME_QA'
}catch(e){evidence.error=e.message;console.log('TEST_FAILED',e.message)}finally{
 if(started){await writeFile(path.join(out,'continuous-master.mov.stop'),'stop');await recDone.catch(e=>evidence.recorderError=e.message)}
 if(cover)await cover.close().catch(()=>{})
 await writeFile(path.join(out,'test.json'),JSON.stringify(evidence,null,2))
 await browser.disconnect()
}
