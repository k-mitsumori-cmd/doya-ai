import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises'
import {createWriteStream} from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import sharp from 'sharp'
import archiver from 'archiver'
const out=path.resolve('reference/generated-assets/2026-09-10-doyamarke-click-zoom')
const ids=['banner','seo','interview','doyaslide']
await mkdir(path.join(out,'contact-sheets'),{recursive:true})
const previews=[]
for(const id of ids){
 const dir=path.join(out,id),qa=JSON.parse(await readFile(path.join(dir,'qa.json'),'utf8')),events=JSON.parse(await readFile(path.join(dir,'events.json'),'utf8'))
 if(qa.technicalStatus!=='PASS'||events.error||events.rawFile!=='continuous-master-hq.mp4')throw new Error(`Not ready: ${id}`)
 const frames=qa.frames
 const rows=Math.ceil(frames.length/2),tiles=[]
 for(let i=0;i<frames.length;i++){
  const name=frames[i].name
  const tile=await sharp(path.join(dir,'qa',`${name}.jpg`)).resize(640,360).toBuffer()
  tiles.push({input:tile,left:(i%2)*640,top:Math.floor(i/2)*388+28})
  const label=Buffer.from(`<svg width="640" height="28"><rect width="640" height="28" fill="#172033"/><text x="12" y="20" fill="white" font-family="sans-serif" font-size="15">${id} / ${name} / ${frames[i].at.toFixed(2)}s</text></svg>`)
  tiles.push({input:label,left:(i%2)*640,top:Math.floor(i/2)*388})
 }
 await sharp({create:{width:1280,height:rows*388,channels:3,background:'#e2e8f0'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(out,'contact-sheets',`${id}.jpg`))
 previews.push({id,name:events.name,video:`${id}/${id}-click-zoom-preview.mp4`,technicalStatus:qa.technicalStatus,visualReview:qa.visualReview,visualReviewNote:qa.visualReviewNote,workflowStatus:events.workflowStatus,endToEndComplete:false,clickCount:qa.clickCount,duration:qa.video.duration,sha256:qa.video.sha256})
}
const inventory=JSON.parse(await readFile(path.join(out,'preflight.json'),'utf8'))
const summary={updatedAt:new Date().toISOString(),status:'BLOCKED_AUTH',targetServices:17,endToEndComplete:0,inputPreviews:previews.length,services:inventory.map(x=>({id:x.id,name:x.name,route:x.route,status:'INCOMPLETE',preview:previews.find(p=>p.id===x.id)||null,blocker:ids.includes(x.id)?'Input workflow recorded; generation/saved result not completed. Demo account required for full capture.':'Authenticated tool UI unavailable; landing/login page only.'})),nextAction:'Confirm a demo account and normal login method; continue authenticated service-specific workflows.'}
await writeFile(path.join(out,'run-state.json'),JSON.stringify(summary,null,2))
await writeFile(path.join(out,'SHA256SUMS.txt'),previews.map(p=>`${p.sha256}  ${p.video}`).join('\n')+'\n')
const zipPath=path.join(out,'doyamarke-click-zoom-input-previews-4.zip')
const stream=createWriteStream(zipPath),archive=archiver('zip',{zlib:{level:6}})
const done=new Promise((resolve,reject)=>{stream.on('close',resolve);stream.on('error',reject);archive.on('error',reject)})
archive.pipe(stream)
for(const name of ['README.md','run-state.json','SHA256SUMS.txt'])archive.file(path.join(out,name),{name})
for(const p of previews){archive.file(path.join(out,p.video),{name:p.video});archive.file(path.join(out,p.id,'qa.json'),{name:`${p.id}/qa.json`})}
await archive.finalize();await done
console.log(JSON.stringify({zipPath,previews,status:summary.status},null,2))
