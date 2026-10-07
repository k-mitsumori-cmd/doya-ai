const crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
const authority=load('src/lib/sfa/mutation-authority.ts'),amount=load('src/lib/sfa/amount.ts');
const deal=load('src/lib/sfa/deal-mutation.ts',{'./mutation-authority':authority,'./amount':amount});
const lead=load('src/lib/sfa/lead-mutation.ts',{'./mutation-authority':authority,'./deal-mutation':deal});
const receipt=load('src/lib/sfa/creation-receipt.ts',{'node:crypto':crypto,'./mutation-authority':authority});
const parser=load('src/lib/sfa/lead-score-result.ts');
const op='20000000-0000-4000-8000-000000000001',stamp='2026-10-01T00:00:00.000Z';
function fixture(){let active=true,authenticated=true,scope={userId:'actor',memberId:'member',organizationId:'org',organizationSlug:'alpha',role:'member'},queue=Promise.resolve(),calls=0,serial=0,fail='',provider;
 let state={lead:{id:'lead',organizationId:'org',isActive:true,name:'Synthetic',status:'new',score:null,note:'Original',raw:{},source:'manual',updatedAt:new Date(stamp)},records:new Map(),generations:[]};
 const matches=(r,w)=>Object.entries(w).every(([k,v])=>v instanceof Date?r[k]instanceof Date&&r[k].getTime()===v.getTime():r[k]===v);
 const db={
 $queryRaw:async(strings,...values)=>strings.join('').includes('sfa_members')?(active?[{id:scope.memberId}]:[]):state.lead&&state.lead.id===values[0]&&state.lead.organizationId===values[1]?[{id:values[0]}]:[],
 $executeRaw:async()=>1,
 sfaMember:{findFirst:async args=>args.select?.id?(active?{id:scope.memberId}:null):{userId:'billing-owner'}},user:{findUnique:async()=>({plan:'FREE'})},
 sfaLead:{findFirst:async({where})=>state.lead&&matches(state.lead,where)?structuredClone(state.lead):null,updateMany:async({where,data})=>{if(!state.lead||!matches(state.lead,where))return{count:0};Object.assign(state.lead,data);return{count:1};}},
 systemSetting:{findUnique:async({where})=>structuredClone(state.records.get(where.key)||null),create:async({data})=>{if(fail==='receipt-create')throw Error('Synthetic private failure');if(state.records.has(data.key))throw Object.assign(Error('Race'),{code:'P2002',meta:{target:['key']}});state.records.set(data.key,structuredClone(data));return data;},update:async({where,data})=>{if(fail==='settle-receipt'&&JSON.parse(data.value).phase==='complete'||fail==='cleanup'&&JSON.parse(data.value).phase==='failed')throw Error('Synthetic private persistence');const r=state.records.get(where.key);if(!r)throw Error('Missing');Object.assign(r,data);return r;}},
 generation:{count:async({where})=>state.generations.filter(r=>r.serviceId===where.serviceId&&where.outputType.in.includes(r.outputType)&&r.metadata.organizationId===where.metadata.equals&&r.createdAt>=where.createdAt.gte).length,
 create:async({data})=>{if(fail==='reservation')throw Error('Synthetic private reservation failure');const r={...data,id:'reservation-'+ ++serial,createdAt:new Date()};state.generations.push(r);return{id:r.id};},
 updateMany:async({where,data})=>{if(fail==='settlement')throw Error('Synthetic private quota persistence');const rows=state.generations.filter(r=>matches(r,where));rows.forEach(r=>Object.assign(r,data));return{count:rows.length};},
 deleteMany:async({where})=>{const before=state.generations.length;state.generations=state.generations.filter(r=>!(r.serviceId===where.serviceId&&r.outputType===where.outputType&&(!where.id||r.id===where.id)&&(!where.metadata||r.metadata.organizationId===where.metadata.equals)&&(!where.createdAt||r.createdAt<where.createdAt.lt)));return{count:before-state.generations.length};}},
 };
 db.$transaction=fn=>{const p=queue.then(async()=>{const before=structuredClone(state);try{return await fn(db);}catch(e){state=before;throw e;}});queue=p.catch(()=>{});return p;};
 const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
 const quota=load('src/lib/sfa/ai-limit.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-limit':{jstStartOfMonthUtc:()=>{const now=new Date();return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));}},'./limits':limits});
 const operations=load('src/lib/sfa/score-operation.ts',{'node:crypto':crypto,'./mutation-authority':authority,'./creation-receipt':receipt,'./limits':limits,'./lead-mutation':lead,'./deal-mutation':deal,'./ai-limit':quota,'./lead-score-result':parser});
 const route=load('src/app/api/sfa/ai/score/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>authenticated?({...scope}):null,orgSlugFrom:()=> 'alpha'},'@/lib/sfa/ai':{scoreLead:async input=>{calls++;return provider?provider(input):{score:70,reason:'Synthetic reason',nextAction:'Synthetic action'};}},'@/lib/sfa/ai-limit':quota,'@/lib/sfa/limits':limits,'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/score-operation':operations});
 const call=(method='POST',body={leadId:'lead',operationId:op,expectedUpdatedAt:stamp},query='?leadId=lead&operationId='+op)=>route[method]({url:'https://example.invalid/api/sfa/ai/score'+query,json:async()=>body});
 return{call,state:()=>state,calls:()=>calls,revoke:()=>active=false,signOut:()=>authenticated=false,scope:patch=>Object.assign(scope,patch),provider:fn=>provider=fn,fail:kind=>fail=kind};
}
module.exports={fixture,op,stamp};
