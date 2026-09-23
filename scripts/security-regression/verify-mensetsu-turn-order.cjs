const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const expectedOrder=[{startMs:{sort:'asc',nulls:'last'}},{ord:'asc'},{id:'asc'}];
const sourceTurns=[{id:'later',ord:0,startMs:5000,text:'Later answer'},{id:'early',ord:1,startMs:1000,text:'Early question'},{id:'unknown',ord:2,startMs:null,text:'Unknown time'}];
function ordered(rows){return [...rows].sort((a,b)=>(a.startMs??Infinity)-(b.startMs??Infinity)||a.ord-b.ord||a.id.localeCompare(b.id));}
function fixture(kind,rows){
 let observed;
 const session={id:'s',status:'completed',startedAt:new Date(),endedAt:new Date(),evaluatedAt:new Date(),organization:{id:'o',name:'Synthetic'},template:{criteria:[],questions:[],level:'mid'},scores:[],turns:[]};
 const read=async args=>{assert.deepEqual(JSON.parse(JSON.stringify(args.include.turns.orderBy)),expectedOrder);return {...session,turns:ordered(rows)}};
 const prisma={mensetsuSession:{findUnique:read,findFirst:read,update:async()=>session},mensetsuAnswerSample:{findMany:async()=>[]},mensetsuScore:{deleteMany:async()=>{},createMany:async()=>{}},$transaction:async tasks=>Promise.all(tasks)};
 const mocks={'@/lib/prisma':{prisma},'next/server':{NextResponse:Response},'./types':{LEVEL_LABELS:{}},'@/lib/mensetsu/types':{LEVEL_LABELS:{}},'@/lib/mensetsu/access':{getMensetsuContext:async()=>({organizationId:'o'}),orgSlugFrom:()=> 'o'},'@/lib/mensetsu/evaluate':{weightedAverage:()=>0},'./evaluate':{evaluateSession:async data=>{observed=data.turns.map(t=>t.text);return{scores:[],verdict:'hold'}}},'@/lib/mensetsu/pdf':{generateReportPdf:async data=>{observed=data.turns.map(t=>t.text);return Buffer.from('synthetic pdf')}}};
 const file=kind==='evaluation'?'src/lib/mensetsu/run-evaluation.ts':`src/app/api/mensetsu/sessions/[id]/${kind==='pdf'?'pdf/':''}route.ts`;
 const api=load(file,mocks);
 return{async run(){if(kind==='evaluation')assert.equal((await api.runEvaluation('s')).ok,true);else{const res=await api.GET({url:'https://synthetic.invalid/?transcript=1'},{params:Promise.resolve({id:'s'})});assert.equal(res.status,200);if(kind==='detail')observed=(await res.json()).session.turns.map(t=>t.text);}return observed;}};
}
(async()=>{
 for(const kind of ['evaluation','detail','pdf']){
  for(const rows of [sourceTurns,[...sourceTurns].reverse(),[sourceTurns[1],sourceTurns[2],sourceTurns[0]]])await check(kind+' delayed batch permutation '+rows.map(r=>r.id),async()=>assert.deepEqual(await fixture(kind,rows).run(),['Early question','Later answer','Unknown time']));
  await check(kind+' equal timestamp stable order',async()=>{const rows=[{id:'b',ord:1,startMs:0,text:'b'},{id:'a',ord:1,startMs:0,text:'a'},{id:'z',ord:0,startMs:0,text:'first'}];assert.deepEqual(await fixture(kind,rows).run(),['first','a','b'])});
  await check(kind+' unknown times retain ord',async()=>{const rows=[{id:'b',ord:2,startMs:null,text:'b'},{id:'a',ord:1,startMs:null,text:'a'}];assert.deepEqual(await fixture(kind,rows).run(),['a','b'])});
 }
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
