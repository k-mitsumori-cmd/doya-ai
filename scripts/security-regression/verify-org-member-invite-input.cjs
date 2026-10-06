const assert=require('node:assert/strict')
const {load}=require('./load-typescript.cjs')
;(async()=>{
const statuses=[]
for(const service of ['quote','aishodan']){
let transactions=0,creates=0,mailCalls=0
const tx={$queryRaw:async()=>[{id:'org',role:'owner'}],[service+'Member']:{findFirst:async()=>null,deleteMany:async()=>({count:0}),create:async({data})=>{creates++;return{id:'new-member',...data}}}}
const title=service[0].toUpperCase()+service.slice(1)
const route=load('src/app/api/'+service+'/members/route.ts',{'next/server':{NextResponse:Response},'crypto':{randomBytes:()=>Buffer.from('synthetic random bytes token only')},'@/lib/prisma':{prisma:{$transaction:async fn=>{transactions++;return fn(tx)}}},['@/lib/'+service+'/access']:{['get'+title+'Context']:async()=>({userId:'actor',organizationId:'org',organizationName:'Synthetic organization',role:'owner'}),hasMinRole:()=>true,orgSlugFrom:()=> 'alpha'},'@/lib/email':{sendEmail:async()=>{mailCalls++;return{success:true}}},'@/lib/html-escape':{escapeHtml:x=>x},['@/lib/'+service+'/types']:{ROLE_HIERARCHY:{owner:4,admin:3,manager:2,member:1}}})
for(const email of [['synthetic@example.invalid'],null,123,{},'a'.repeat(255)+'@example.invalid']){
const res=await route.POST({json:async()=>({email,role:'member'})})
console.log(JSON.stringify({service,status:res.status,transactions,creates,syntheticMailStubCalls:mailCalls,scope:'Actual POST route with synthetic Prisma, auth, token and mail stub only. No real email, invite, DB write or provider call.'}))
statuses.push(res.status)
assert.equal(transactions,0);assert.equal(creates,0);assert.equal(mailCalls,0)
}
}
assert.ok(statuses.every(s=>s===400),'Non-string email must be rejected before transaction or mail preparation')
})().catch(e=>{console.error(e);process.exitCode=1})
