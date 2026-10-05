// 未修正の現象を再現する診断。成功は不具合の再現を意味する。CIには含めない。
const assert = require('node:assert/strict')
const { load } = require(require('node:path').resolve(__dirname, '../../../scripts/security-regression/load-typescript.cjs'))
function fixture(fetch) {
 const refs=[], callbacks=[], effects=[], events={}, beacons=[]
 const hook=load('src/lib/mensetsu/useRealtimeInterview.ts', {
  react:{ useRef:v=>{const r={current:v};refs.push(r);return r},useState:v=>[v,()=>{}],useCallback:fn=>{callbacks.push(fn);return fn},useEffect:fn=>effects.push(fn)},
  '@/lib/realtime/hallucination':{isLikelyHallucination:()=>false}
 },{fetch,setTimeout,clearTimeout,Blob,window:{addEventListener:(name,fn)=>events[name]=fn,removeEventListener(){}},navigator:{sendBeacon:(url,body)=>{beacons.push({url,body});return true}}})
 const api=hook.useRealtimeInterview({token:'synthetic',recordAudio:false})
 refs[6].current=Date.now()-1000
 return {api,refs,flush:callbacks[0],effects,events,beacons,enqueue:n=>{refs[7].current.push(...Array.from({length:n},(_,i)=>({speaker:'candidate',text:`Answer ${i}`,at:Date.now()})))}}
}
;(async()=>{
 let calls=[]
 let f=fixture(async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>({saved:50})}})
 f.enqueue(51);await f.api.end()
 assert.equal(f.refs[7].current.length,1)
 assert.equal(calls.at(-1).url.endsWith('/end'),true)
 console.log('CONFIRMED: end posted with 1 of 51 answers still unsent')
 let resolve
 calls=[]
 f=fixture(async(url,options)=>{calls.push(url);if(url.endsWith('/turn')) return await new Promise(r=>resolve=r);return {ok:true,status:200}})
 f.enqueue(1);const inFlight=f.flush();await f.api.end()
 assert.equal(calls.at(-1).endsWith('/end'),true)
 resolve({ok:true,status:200,json:async()=>({saved:1})});await inFlight
 console.log('CONFIRMED: end posted before an existing answer upload resolved')
 calls=[]
 f=fixture(async(url)=>{calls.push(url);return {ok:false,status:503}})
 f.enqueue(1);await f.api.end()
 assert.equal(f.refs[7].current.length,1)
 assert.equal(calls.at(-1).endsWith('/end'),true)
 console.log('CONFIRMED: failed final upload remains only in memory after end')
 f=fixture(async()=>{throw Error('unused')});f.enqueue(1)
 f.effects.at(-1)();f.events.pagehide({persisted:false})
 assert.equal(f.beacons.length,1)
 assert.deepEqual(JSON.parse(await f.beacons[0].body.text()),{aborted:true})
 console.log('CONFIRMED: pagehide sends end without its pending answer')
})().catch(e=>{console.error(e);process.exitCode=1})
