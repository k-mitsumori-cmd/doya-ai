import puppeteer from 'puppeteer-core'
import {readFile, mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
const root = process.cwd()
const out = path.join(root, 'reference/generated-assets/2026-09-10-doyamarke-click-zoom')
const config = JSON.parse(await readFile('scripts/recordings/doyamarke-services.json', 'utf8'))
await mkdir(path.join(out, 'preflight'), {recursive:true})
const browser = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,defaultViewport:{width:1600,height:900,deviceScaleFactor:1},args:['--disable-background-networking','--no-first-run']})
const rows=[]
for (const service of config.services) {
 const page=await browser.newPage()
 try {
  const response=await page.goto(`http://127.0.0.1:3040${service.route}`,{waitUntil:'networkidle2',timeout:90000})
  await page.evaluate(()=>document.fonts.ready)
  const ui=await page.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,18000),controls:[...document.querySelectorAll('button,input,textarea,select,a')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).map(n=>({tag:n.tagName,text:(n.innerText||'').trim().slice(0,100),type:n.type,placeholder:n.placeholder,href:n.getAttribute('href'),disabled:n.disabled}))}))
  const item={id:service.id,name:service.name,route:service.route,url:page.url(),status:response.status(),...ui}
  rows.push(item)
  await page.screenshot({path:path.join(out,'preflight',`${service.id}.jpg`),quality:78})
  await writeFile(path.join(out,'preflight',`${service.id}.json`),JSON.stringify(item,null,2))
  console.log(JSON.stringify({id:service.id,status:item.status,url:item.url,text:item.text.slice(0,140),buttons:item.controls.filter(x=>x.tag==='BUTTON').map(x=>x.text).slice(0,18)}))
 }catch(error){rows.push({id:service.id,error:error.message});console.log(service.id,error.message)}
 await page.close()
 await writeFile(path.join(out,'preflight.json'),JSON.stringify(rows,null,2))
}
await browser.close()
