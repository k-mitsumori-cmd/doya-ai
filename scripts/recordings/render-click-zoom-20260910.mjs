import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import path from 'node:path'
const dir=path.resolve(process.argv[2])
const data=JSON.parse(await readFile(path.join(dir,'events.json'),'utf8'))
const raw=path.join(dir,data.rawFile||'continuous-master.webm')
const final=path.join(dir,`${data.id}-click-zoom-preview.mp4`)
const run=(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',c=>c?reject(new Error(err)):resolve(out))})
const clicks=data.actions.filter(a=>a.type==='click'&&a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1)
if(clicks.length===0)throw new Error('No genuine on-screen click events')
const pulses=clicks.map(a=>{
 const start=Math.max(0,a.at-.72),hold=a.at+1.05,end=hold+.85
 const ramp=`clip((it-${start})/0.72,0,1)`
 const fall=`clip((${end}-it)/0.85,0,1)`
 const ease=x=>`((${x})*(${x})*(3-2*(${x})))`
 return {start,end,x:a.x,y:a.y,expr:`if(lt(it,${hold}),${ease(ramp)},${ease(fall)})`}
})
let z='1',x='iw/2-iw/zoom/2',y='ih/2-ih/zoom/2'
for(const p of pulses.reverse()){
 const condition=`between(it,${p.start},${p.end})`
 z=`if(${condition},1+0.48*(${p.expr}),${z})`
 x=`if(${condition},clip(${p.x}*iw-iw/zoom/2,0,iw-iw/zoom),${x})`
 y=`if(${condition},clip(${p.y}*ih-ih/zoom/2,0,ih-ih/zoom),${y})`
}
const filter=`fps=30,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=1920x1080:fps=30,scale=1920:1080:in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709`
await writeFile(path.join(dir,'zoom-filter.txt'),filter)
await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',raw,'-vf',filter,'-an','-c:v','libx264','-threads','4','-preset','fast','-crf','16','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',final])
const probe=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',final]))
const source=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',raw]))
const v=probe.streams.find(x=>x.codec_type==='video'),duration=Number(probe.format.duration)
await run('ffmpeg',['-v','error','-i',final,'-f','null','-'])
await mkdir(path.join(dir,'qa'),{recursive:true})
const frames=[{name:'overview',at:.8},...clicks.map((a,i)=>({name:`click-${i+1}`,at:a.at+.5})),{name:'end',at:duration-1}]
for(const f of frames)await run('ffmpeg',['-v','error','-y','-ss',String(f.at),'-i',final,'-frames:v','1',path.join(dir,'qa',`${f.name}.jpg`)])
const checks={resolution:v.width===1920&&v.height===1080,codec:v.codec_name==='h264',pixelFormat:v.pix_fmt==='yuv420p',frameRate:v.avg_frame_rate==='30/1',noAudio:probe.streams.every(x=>x.codec_type!=='audio'),duration:duration>=8&&Math.abs(duration-Number(source.format.duration))<.15,clicks:clicks.length>0,allClicksInDuration:clicks.every(a=>a.at<duration)}
await writeFile(path.join(dir,'qa.json'),JSON.stringify({technicalStatus:Object.values(checks).every(Boolean)?'PASS':'FAIL',workflowStatus:data.workflowStatus,endToEndComplete:false,checks,video:{file:final,duration,width:v.width,height:v.height,sourceWidth:source.streams[0].width,sourceHeight:source.streams[0].height,sha256:createHash('sha256').update(await readFile(final)).digest('hex')},clickCount:clicks.length,zoomFactor:1.48,frames,visualReview:'PENDING'},null,2))
console.log('RENDERED',data.id,duration,clicks.length,'clicks',final)
