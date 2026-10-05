const assert=require('node:assert/strict');const{load,check,results}=require('./load-typescript.cjs');
function fixture(){
 const saved=[];let locked=false;
 const row={id:'s',consentedAt:new Date(),startedAt:new Date(),endedAt:null,status:'live',updatedAt:new Date(),evaluatedAt:null,purgeAfter:null};
 const db={
  $queryRaw:async strings=>{assert.match(strings.join('?'),/FOR NO KEY UPDATE/);locked=true;return[{id:'s'}]},
  mensetsuSession:{findUnique:async()=>{assert.ok(locked);return {...row}},update:async({data})=>{assert.ok(locked);Object.assign(row,data);return {...row}}},
  mensetsuTurn:{findFirst:async()=>{assert.ok(locked);return null},createMany:async({data})=>{assert.ok(locked);saved.push(...data);return{count:data.length}}},
  $transaction:async callback=>{try{return await callback(db)}finally{locked=false}},
 };
 const api=load('src/app/api/mensetsu/live/[token]/turn/route.ts',{
  'next/server':{NextResponse:Response},'@/lib/mensetsu/public':{loadSessionByToken:async()=>({...row})},'@/lib/prisma':{prisma:db},
  '@vercel/functions':{waitUntil:()=>{}},'@/lib/mensetsu/run-evaluation':{runEvaluation:async()=>{throw Error('Unexpected evaluation for live transcript')}},
 });
 return{saved,run:turns=>api.POST({json:async()=>({turns})},{params:Promise.resolve({token:'t'})})};
}
(async()=>{
 const inputs=[[undefined,null],[null,null],['',null],['  ',null],[0,0],['0',0],[1200,1200],['1200',1200],[2147483647,2147483647],[2147483648,null],[-1,null],[1.5,null],[NaN,null],[Infinity,null],[true,null],[false,null],[[],null],[{},null],['bad',null]];
 for(const [value,expected]of inputs)await check('optional metadata '+String(value)+' typeof '+typeof value,async()=>{const f=fixture();const r=await f.run([{speaker:'candidate',text:'Preserved speech',startMs:value,endMs:value,questionOrd:value}]);assert.equal(r.status,200);assert.equal((await r.json()).saved,1);for(const key of ['startMs','endMs','questionOrd'])assert.equal(f.saved[0][key],expected);assert.equal(f.saved[0].text,'Preserved speech')});
 await check('known times before unknown and true zero retained',async()=>{const f=fixture();await f.run([{text:'unknown',startMs:null},{text:'later',startMs:100},{text:'zero',startMs:0},{text:'empty',startMs:''}]);assert.deepEqual(f.saved.map(x=>x.text),['zero','later','unknown','empty']);assert.deepEqual(f.saved.map(x=>x.ord),[0,1,2,3]);});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
