import {spawn} from 'node:child_process'
import {once} from 'node:events'

// Continuous browser compositor stream, with wall-clock frame timing.
export async function recordPage(page,file){
 const client=await page.createCDPSession()
 const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','ultrafast','-crf','16','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',file])
 let stderr='',failure=null,previous=null,frames=0,startedAt=null,pending=Promise.resolve(),queued=0,peakQueuedFrames=0,sourceEvents=0
 encoder.stderr.on('data',b=>stderr+=b)
 encoder.stdin.on('error',e=>failure=e)
 const done=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',c=>c===0?resolve():reject(new Error(stderr)))})
 let readyResolve
 const ready=new Promise(r=>readyResolve=r)
 function enqueue(frame,count){
  if(count<=0)return
  queued+=count
  peakQueuedFrames=Math.max(peakQueuedFrames,queued)
  pending=pending.then(async()=>{for(let i=0;i<count;i++){if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');queued--}})
 }
 const handler=e=>{
  void client.send('Page.screencastFrameAck',{sessionId:e.sessionId})
  sourceEvents++
  if(startedAt===null){startedAt=Date.now();previous=Buffer.from(e.data,'base64');readyResolve();return}
  const target=Math.floor((Date.now()-startedAt)*30/1000)
  enqueue(previous,Math.max(0,target-frames));frames=target
  previous=Buffer.from(e.data,'base64')
 }
 client.on('Page.screencastFrame',handler)
 await client.send('Page.startScreencast',{format:'jpeg',quality:98,maxWidth:3200,maxHeight:1800,everyNthFrame:1})
 await ready
 return {startedAt,async stop(){
  await client.send('Page.stopScreencast')
  client.off('Page.screencastFrame',handler)
  const target=Math.ceil((Date.now()-startedAt)*30/1000)
  enqueue(previous,Math.max(0,target-frames));frames=target
  await pending;encoder.stdin.end();await done;await client.detach()
  if(failure)throw failure
  return {frames,sourceEvents,duration:frames/30,peakQueuedFrames,encodingQueueFullyDrained:true}
 }}
}
