import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import path from 'node:path'
const root=process.cwd()
const output=path.resolve('reference/generated-assets/2026-09-10-doyamarke-tight-edit')
const preview=path.resolve('reference/generated-assets/2026-09-10-doyamarke-click-zoom')
const run=(command,args)=>new Promise((resolve,reject)=>{const p=spawn(command,args);let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',c=>c?reject(new Error(stderr)):resolve(stdout))})
const probe=async file=>JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]))
const ids=process.argv.slice(2).length?process.argv.slice(2):['banner','seo','interview','doyaslide']
await mkdir(output,{recursive:true})
const reports=[]
for(const id of ids){
 const dir=path.join(output,id)
 await mkdir(path.join(dir,'segments'),{recursive:true});await mkdir(path.join(dir,'qa'),{recursive:true})
 let source,segments,scope
 if(id==='banner'){
  source=path.resolve('reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings/public/banner/raw/banner-browser.webm')
  scope='2026-09-01の連続録画から再編集。サンプル入力、生成ボタン、処理中、実際に生成された3案を収録。最後のみ結果を読むため静止ホールド。'
  segments=[
   {label:'サービス画面',start:0,end:1.05,speed:1.5,crop:[1280,720,0,0]},
   {label:'サンプル入力',start:1.05,end:3.15,speed:2,crop:[1120,630,160,125]},
   {label:'生成ボタン',start:5.6,end:7.25,speed:1.35,crop:[1120,630,160,230]},
   {label:'生成中・待ち時間を省略',start:7.8,end:11.8,speed:4,crop:[1120,630,160,135]},
   {label:'生成終盤',start:55,end:56.8,speed:2.5,crop:[1120,630,160,135]},
   {label:'実際の生成結果3案',start:63.15,end:64.95,speed:1,crop:[640,360,960,60],hold:3},
  ]
 }else{
  source=path.join(preview,id,'continuous-master-hq.mp4')
  const events=JSON.parse(await readFile(path.join(preview,id,'events.json'),'utf8'))
  scope='2026-09-10の実入力操作の短縮版。生成結果は未収録。'
  const clicks=events.actions.filter(a=>a.type==='click')
  segments=clicks.map((a,i)=>{
   const next=events.actions.find(b=>b.at>a.at&&b.type==='input'&&b.at<(clicks[i+1]?.at||Infinity))
   const nav=/^次へ$/.test(a.label)
   const start=Math.max(0,a.at-.45),end=next?next.at+.5:a.at+(nav?.12:.95)
   const w=2240,h=1260,x=Math.round(Math.max(0,Math.min(320,a.x*3200-w/2))/2)*2,y=Math.round(Math.max(0,Math.min(540,a.y*1800-h/2))/2)*2
   return {label:a.label,start,end,speed:next?2:1.35,crop:[w,h,x,y]}
  })
  // Only SEO has a useful new settled state after its last navigation.
  // Other recordings scroll back or show an unrelated gallery at the end.
  if(id==='seo'){
   const info=await probe(source),end=Number(info.format.duration)-.1
   segments.push({label:'設定の確認（生成前）',start:end-1.6,end,speed:1.3,crop:[2240,1260,320,0]})
  }else segments.at(-1).hold=1
 }
 let elapsed=0
 for(let i=0;i<segments.length;i++){
  const s=segments[i],file=path.join(dir,'segments',`${String(i).padStart(2,'0')}.mp4`)
  const filter=`setpts=(PTS-STARTPTS)/${s.speed},fps=30,crop=${s.crop.join(':')},scale=1920:1080:flags=lanczos:in_range=auto:out_range=tv:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709${s.hold?`,tpad=stop_mode=clone:stop_duration=${s.hold}`:''}`
  await run('ffmpeg',['-v','error','-y','-ss',String(s.start),'-t',String(s.end-s.start),'-i',source,'-vf',filter,'-an','-c:v','libx264','-threads','3','-preset','fast','-crf','16','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',file])
  const p=await probe(file);s.outputStart=elapsed;s.outputDuration=Number(p.format.duration);elapsed+=s.outputDuration;s.file=path.relative(dir,file)
 }
 const concatFile=path.join(dir,'concat.txt')
 await writeFile(concatFile,segments.map(s=>`file '${s.file}'`).join('\n')+'\n')
 const final=path.join(dir,`${id}-${id==='banner'?'result':'input'}-tight.mp4`)
 await run('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',concatFile,'-c','copy','-movflags','+faststart',final])
 await run('ffmpeg',['-v','error','-i',final,'-f','null','-'])
 const p=await probe(final),v=p.streams[0],duration=Number(p.format.duration)
 const frames=[]
 for(let i=0;i<segments.length;i++){
  const s=segments[i],at=s.outputStart+Math.min(s.outputDuration*.65,s.outputDuration-.05),file=`shot-${i+1}.jpg`
  await run('ffmpeg',['-v','error','-y','-ss',String(at),'-i',final,'-frames:v','1',path.join(dir,'qa',file)])
  frames.push({file,label:s.label,at})
 }
 const checks={resolution:v.width===1920&&v.height===1080,codec:v.codec_name==='h264',pixelFormat:v.pix_fmt==='yuv420p',fps:v.avg_frame_rate==='30/1',noAudio:p.streams.every(s=>s.codec_type!=='audio'),duration:duration>4&&duration<18&&Math.abs(duration-elapsed)<.15}
 const report={id,source,scope,video:path.relative(output,final),duration,technicalStatus:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,generatedResultVisible:id==='banner',visualReview:'PENDING',zoomReturns:0,editing:'Fixed focus per shot, straight cuts, 2x typing, waiting omitted; no repeated zoom-out.',segments,frames,sha256:createHash('sha256').update(await readFile(final)).digest('hex')}
 await writeFile(path.join(dir,'edit-decision-list.json'),JSON.stringify(report,null,2))
 reports.push(report)
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(reports,null,2))
 console.log('EDITED',id,duration,'seconds',report.technicalStatus)
}
