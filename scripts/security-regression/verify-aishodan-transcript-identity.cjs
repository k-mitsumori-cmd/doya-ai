const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
const source=load('src/lib/realtime/transcript-source.ts')
const tick=()=>new Promise(r=>setImmediate(r))
function fixture({connect=false,hallucination=false}={}){
 const refs=[],callbacks=[],calls=[];let dc
 class Peer {addTrack(){}createDataChannel(){dc={readyState:'connecting',send(){},addEventListener(){},close(){}};return dc}async createOffer(){return{sdp:'synthetic-sdp'}}async setLocalDescription(){}async setRemoteDescription(){}close(){}}
 const hook=load('src/lib/aishodan/useRealtimeMeeting.ts',{
  react:{useRef:v=>{const r={current:v};refs.push(r);return r},useState:v=>[v,()=>{}],useEffect(){},useCallback:fn=>{callbacks.push(fn);return fn}},
  '@/lib/realtime/hallucination':{isLikelyHallucination:()=>hallucination},'@/lib/realtime/transcript-source':source,
 },{RTCPeerConnection:Peer,Audio:class{},setTimeout,clearTimeout,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},fetch:async(url,options)=>{
  if(url.startsWith('https://api.openai.com/'))return{ok:true,text:async()=>'synthetic-sdp'}
  const body=JSON.parse(options.body);if(url.endsWith('/token'))return{ok:true,json:async()=>({clientSecret:'synthetic-not-valid',model:'synthetic'})}
  calls.push(body);return{ok:true,status:200,json:async()=>({saved:body.turns.length})}
 }})
 const api=hook.useRealtimeMeeting({roomToken:'synthetic-room',sessionId:'synthetic-session'})
 if(!connect)refs[8].current={readyState:'open',send(){}}
 refs[13].current=Date.now()-1000
 return {api,refs,calls,push:callbacks[2],flush:callbacks[1],saved:()=>calls.flatMap(c=>c.turns),emit:ev=>dc.onmessage({data:JSON.stringify(ev)})}
}
;(async()=>{
 await check('two intentional identical typed replies are preserved',async()=>{const f=fixture();assert.equal(f.api.sendText('はい'),true);assert.equal(f.api.sendText('はい'),true);await tick();assert.deepEqual(f.saved().map(t=>t.text),['はい','はい'])})
 await check('separate audio items with same words are preserved',async()=>{const f=fixture();f.push('guest','はい','item-a:0');f.push('guest','はい','item-b:0');await f.flush();assert.equal(f.saved().length,2)})
 await check('same audio content delivered twice is stored once',async()=>{const f=fixture();f.push('ai','Question','item-a:0');f.push('ai','Question','item-a:0');await f.flush();assert.equal(f.saved().length,1)})
 await check('distinct parts of one audio item remain distinct',async()=>{const f=fixture();f.push('ai','Question','item-a:0');f.push('ai','Question','item-a:1');await f.flush();assert.equal(f.saved().length,2)})
 await check('unknown identity does not justify deleting a repeated answer',async()=>{const f=fixture();f.push('guest','はい');f.push('guest','はい');await f.flush();assert.equal(f.saved().length,2)})
 await check('speaker identity and captured phase are preserved',async()=>{const f=fixture();f.refs[6].current='hearing';f.push('ai','Question','item:0');f.refs[6].current='closing';f.push('guest','Answer','item:0');await f.flush();assert.deepEqual(f.saved().map(t=>[t.speaker,t.phase]),[['ai','hearing'],['guest','closing']])})
 await check('empty notification does not suppress later valid transcript for same item',async()=>{const f=fixture();f.push('ai','  ','item:0');f.push('ai','Question','item:0');await f.flush();assert.deepEqual(f.saved().map(t=>t.text),['Question'])})
 await check('hallucination filter remains active before identity is recorded',async()=>{const f=fixture({hallucination:true});f.push('guest','Synthetic noise','item:0');await f.flush();assert.equal(f.saved().length,0)})
 await check('actual event handlers deduplicate fallback while preserving repeated guest answers',async()=>{
  const f=fixture({connect:true});await f.api.start()
  f.emit({type:'response.output_audio_transcript.done',item_id:'question-a',content_index:0,transcript:'Question'})
  f.emit({type:'response.done',response:{output:[{id:'question-a',content:[{transcript:'Question'}]}]}})
  f.emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-a',content_index:0,transcript:'はい'})
  f.emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-b',content_index:0,transcript:'はい'})
  f.emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-a',content_index:0,transcript:'はい'})
  f.emit({type:'response.audio_transcript.done',item_id:'question-b',content_index:0,transcript:'Question'})
  f.emit({type:'response.done',response:{output:[{id:'question-b',content:[{transcript:'Question'}]}]}})
  f.emit({type:'response.output_audio_transcript.done',item_id:'question-b',content_index:1,transcript:'Question'})
  await f.flush();await tick();assert.deepEqual(f.saved().map(t=>t.text),['Question','はい','はい','Question','Question'])
 })
 await check('malformed explicit indices cannot merge independent answers into part zero',async()=>{
  const f=fixture({connect:true});await f.api.start()
  f.emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-a',content_index:0,transcript:'はい'})
  for(const index of [-1,1.5,'0',true])f.emit({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-a',content_index:index,transcript:'はい'})
  await f.flush();assert.equal(f.saved().length,5)
 })
 await check('legacy missing index still deduplicates matching first content part',async()=>{const f=fixture({connect:true});await f.api.start();f.emit({type:'response.audio_transcript.done',item_id:'question',transcript:'Question'});f.emit({type:'response.done',response:{output:[{id:'question',content:[{transcript:'Question'}]}]}});await f.flush();await tick();assert.equal(f.saved().length,1)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
