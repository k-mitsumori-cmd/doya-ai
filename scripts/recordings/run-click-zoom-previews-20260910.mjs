import {spawn} from 'node:child_process'
import {readFile,writeFile,access} from 'node:fs/promises'
import path from 'node:path'
const out=path.resolve('reference/generated-assets/2026-09-10-doyamarke-click-zoom')
const ids=process.argv.slice(2)
const run=args=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit'});p.on('error',reject);p.on('close',c=>c?reject(new Error(`Exit ${c}: ${args.join(' ')}`)):resolve())})
const results=[]
for(const id of ids){
 try{
  let validCapture=false
  try{const e=JSON.parse(await readFile(path.join(out,id,'events.json'),'utf8'));validCapture=e.captureProfile==='hq-clean-v1'&&e.rawFile==='continuous-master-hq.mp4'&&!e.error&&e.captureStats.sourceEvents>10;await access(path.join(out,id,e.rawFile))}catch{}
  if(!validCapture)await run(['scripts/recordings/capture-click-zoom-20260910.mjs',id])
  await run(['scripts/recordings/render-click-zoom-20260910.mjs',path.join(out,id)])
  const qa=JSON.parse(await readFile(path.join(out,id,'qa.json'),'utf8'))
  results.push({id,technicalStatus:qa.technicalStatus,workflowStatus:'INPUT_PREVIEW_ONLY'})
 }catch(e){results.push({id,technicalStatus:'FAILED',reason:e.message});console.log('FAILED',id,e.message)}
 await writeFile(path.join(out,'preview-run.json'),JSON.stringify(results,null,2))
}
console.log('Preview run ended; authenticated end-to-end recordings remain incomplete.')
