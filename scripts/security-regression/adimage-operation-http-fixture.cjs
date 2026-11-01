// Boundary fixture: actual streamed HTTP parser/formatter; operation admission is
// supplied by each unit case. Private PostgreSQL tests cover the actual core.
const {load}=require('./load-typescript.cjs')
function connect(mocks,admission){
 const core={
  adImageTargetHash:()=> 'a'.repeat(64), validAdImageDirectives:()=>true,
  recoverAdImageOperation:async()=>({state:'missing'}),
  beginAdImageOperation:admission,
  failAdImageOperation:async()=>{throw Error('unexpected failure settlement')},
  settleAdImageOperation:async()=>{throw Error('unexpected output settlement')},
 }
 mocks['@/lib/adimage/image-operation']=core
 mocks['@/lib/adimage/image-operation-http']=load('src/lib/adimage/image-operation-http.ts',{
  'next/server':{NextResponse:Response},'@/lib/prisma':mocks['@/lib/prisma'],
  './access':mocks['@/lib/adimage/access'],'./storage':mocks['@/lib/adimage/storage']||{},
  './placements':mocks['@/lib/adimage/placements'],'./image-operation':core,
  '@/lib/fetch-timeout':{raceTimeout:()=>{throw Error('unexpected result signing')}},
 },{setTimeout,clearTimeout,TextDecoder})
}
function request(body){return new Request('https://local.test/api/adimage/concepts',{method:'POST',body:JSON.stringify({operationId:'30000000-0000-4000-8000-000000000001',...body})})}
module.exports={connect,request}
