// 未修正の録音追跡漏れを再現する診断。成功は不具合の再現を意味する。CIには含めない。
const assert=require('node:assert/strict')
const {load}=require('../../../scripts/security-regression/load-typescript.cjs')
;(async()=>{
 const row={id:'synthetic-session',consentedAt:new Date(),startedAt:new Date(),status:'completed',purgeAfter:new Date(Date.now()-1000),recordingPath:null,candidateName:'Synthetic',candidateEmail:null,consentIp:null,organization:{recordAudio:true}}
 let objectExists=true,storageDeletes=0,turns=1
 const db={
  $executeRaw:async()=>0,
  mensetsuSession:{
   updateMany:async()=>({count:0}),
   findMany:async({where})=>where.purgeAfter?[{id:row.id,recordingPath:row.recordingPath}]:[],
   update:async({data})=>Object.assign(row,data),
   count:async()=>row.candidateName||row.candidateEmail||row.consentIp?1:0,
  },
  mensetsuTurn:{deleteMany:async()=>{const count=turns;turns=0;return{count}}},mensetsuScore:{updateMany:async()=>({count:0})}
 }
 const storage={recordingExists:async()=>objectExists,createSignedUploadUrl:async()=>{throw Error('not used')},deleteRecording:async()=>{storageDeletes++;objectExists=false}}
 const common={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/mensetsu/storage':storage}
 const recording=load('src/app/api/mensetsu/live/[token]/recording/route.ts',{...common,'@/lib/mensetsu/public':{loadSessionByToken:async()=>row,assertUsable:()=>({ok:true})}})
 const registered=await recording.PATCH({}, {params:Promise.resolve({token:'synthetic-token'})})
 assert.equal(registered.status,409);assert.equal(row.recordingPath,null)
 const purge=load('src/app/api/cron/mensetsu-purge/route.ts',{...common,'@/lib/mensetsu/types':{EVALUATION_STALE_MS:360000}},{process:{env:{CRON_SECRET:'synthetic-secret'}}})
 const response=await purge.GET({headers:new Headers({authorization:'Bearer synthetic-secret'})})
 const result=await response.json()
 assert.equal(result.purgedSessions,1);assert.equal(result.remaining,0);assert.equal(storageDeletes,0);assert.equal(objectExists,true)
 console.log('CONFIRMED: expired upload registration is rejected, but purge reports no remaining work while untracked audio object survives')
})().catch(e=>{console.error(e);process.exitCode=1})
