const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');const calc=load('src/lib/kintai/attendance.ts');const day=new Date('2026-09-20T00:00:00+09:00');
const row=(id,type,m,created=0)=>({id,type,timestamp:new Date(+day+m*60000),createdAt:new Date(+day+created)});
const original=[row('a','clock_in',540),row('b','break_start',600),row('c','break_end',630),row('d','clock_out',630)];let cases=0;
function permutations(a){return a.length===0?[[]]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));}
for(const records of permutations(original)){const r=calc.calculateDailyAttendance(records,null,day);assert.equal(r.workMinutes,60);assert.equal(r.breakMinutes,30);assert.equal(+r.clockOut,+day+630*60000);cases++;}
// 作成時刻がIDと逆の場合でも作成順を優先。
const created=[row('x','clock_in',540),row('z','clock_out',600,1),row('a','clock_in',600,2)];const r=calc.calculateDailyAttendance([...created].reverse(),null,day);assert.equal(r.clockOut,null);assert.equal(r.workMinutes,60);cases++;
(async()=>{
 const records=[row('a','clock_in',540),row('b','break_start',600)];let state=[];const now=new Date('2026-09-20T12:00:00+09:00');class FixedDate extends Date{constructor(...a){super(...(a.length?a:[+now]))}}
 const tx={$queryRaw:async()=>[{id:'e'}],kintaiAttendance:{findFirst:async()=>null},kintaiClockRecord:{findMany:async q=>{assert.equal(JSON.stringify(q.orderBy),JSON.stringify([{timestamp:'asc'},{createdAt:'asc'},{id:'asc'}]));return records},create:async({data})=>{state.push({...data,timestamp:new Date(data.timestamp)});return data}}};
 const prisma={$transaction:fn=>fn(tx),kintaiEmployee:{findFirst:async()=>({id:'e'})}};
 const route=load('src/app/api/kintai/clock/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/kintai/access':{getKintaiContext:async()=>({employeeId:'e',organizationId:'o'})},'@/lib/kintai/recalculate':{recalculateDayForEmployee:async()=>{}},'@/lib/service-usage':{recordServiceUsage:async()=>{}}},{Date:FixedDate});
 assert.equal((await route.POST({json:async()=>({type:'clock_out'}),headers:new Headers()})).status,200);assert.equal(state[0].type,'break_end');assert.equal(state[1].type,'clock_out');assert.equal(+state[1].timestamp-(+state[0].timestamp),1);cases++;
 console.log(JSON.stringify({passed:cases}));
})().catch(e=>{console.error(e);process.exitCode=1});
