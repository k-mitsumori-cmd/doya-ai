const crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
const authority=load('src/lib/sfa/mutation-authority.ts'),amount=load('src/lib/sfa/amount.ts');
const stage=load('src/lib/sfa/deal-mutation.ts',{'./mutation-authority':authority,'./amount':amount});
const receipt=load('src/lib/sfa/creation-receipt.ts',{'node:crypto':crypto,'./mutation-authority':authority});
const mutation=load('src/lib/sfa/lead-mutation.ts',{'./mutation-authority':authority,'./deal-mutation':stage});
const batch=load('src/lib/sfa/lead-import.ts',{'node:crypto':crypto,'./mutation-authority':authority,'./creation-receipt':receipt});
const stamp=new Date('2026-10-01T00:00:00.000Z'),op='10000000-0000-4000-8000-000000000001';
function fixture(){
 let active=true,fail='',queue=Promise.resolve(),serial=0;let scope={userId:'actor',memberId:'member',organizationId:'org',organizationSlug:'alpha',role:'member'};
 const row={id:'lead',organizationId:'org',isActive:true,status:'new',convertedAccountId:null,name:'Source',corporateNumber:null,contactName:'Contact',email:null,phone:null,note:null,score:null,raw:null,source:'manual',createdAt:stamp,updatedAt:stamp};
 let state={leads:new Map([['lead',structuredClone(row)]]),receipts:new Map()};
 const matches=(r,w)=>Object.entries(w).every(([k,v])=>{if(v instanceof Date)return r[k]instanceof Date&&r[k].getTime()===v.getTime();if(v&&typeof v==='object'){if('in'in v)return v.in.includes(r[k]);if('not'in v)return r[k]!==v.not;}return r[k]===v;});
 const create=data=>{if(fail==='lead-create')throw Error('Synthetic private detail');const r={...structuredClone(row),id:'lead-'+ ++serial,createdAt:new Date(),updatedAt:new Date(),...data};if(state.leads.has(r.id))throw Error('Duplicate synthetic ID');state.leads.set(r.id,r);return structuredClone(r);};
 const db={
  $queryRaw:async(strings,...values)=>strings.join('').includes('sfa_members')?(active?[{id:scope.memberId}]:[]):state.leads.has(values[0])?[{id:values[0]}]:[],
  $executeRaw:async()=>1,
  sfaMember:{findFirst:async args=>args.select?.id?(active?{id:scope.memberId}:null):null},
  sfaLead:{findFirst:async({where})=>structuredClone([...state.leads.values()].find(r=>matches(r,where))||null),findFirstOrThrow:async args=>{const r=await db.sfaLead.findFirst(args);if(!r)throw Error('Missing synthetic row');return r;},count:async({where})=>[...state.leads.values()].filter(r=>matches(r,where)).length,
   create:async({data})=>create(data),createMany:async({data})=>{for(const [i,r]of data.entries()){create(r);if(fail==='partial-batch'&&i===0)throw Error('Synthetic partial batch failure');}return{count:data.length};},
   updateMany:async({where,data})=>{const rows=[...state.leads.values()].filter(r=>matches(r,where));rows.forEach(r=>Object.assign(r,data));return{count:rows.length};},update:async({where,data})=>{const r=state.leads.get(where.id);if(!r)throw Error('Missing');Object.assign(r,data);return structuredClone(r);}},
  systemSetting:{findUnique:async({where})=>structuredClone(state.receipts.get(where.key)||null),create:async({data})=>{if(fail==='receipt'&&data.key.startsWith('sfa-create:')||fail==='batch-result'&&data.key.startsWith('sfa-lead-import:'))throw Error('Synthetic private persistence failure');if(state.receipts.has(data.key))throw Object.assign(Error('Synthetic receipt race'),{code:'P2002',meta:{target:['key']}});state.receipts.set(data.key,structuredClone(data));return data;}},
 };
 db.$transaction=fn=>{const pending=queue.then(async()=>{const before=structuredClone(state);try{return await fn(db);}catch(e){state=before;throw e;}});queue=pending.catch(()=>{});return pending;};
 const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
 const mocks={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>({...scope}),orgSlugFrom:()=> 'alpha'},'@/lib/sfa/format':load('src/lib/sfa/format.ts'),'@/lib/sfa/lead-mutation':mutation,'@/lib/sfa/lead-import':batch,'@/lib/sfa/deal-mutation':stage,'@/lib/sfa/creation-receipt':receipt,'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/limits':limits};
 const routes={list:load('src/app/api/sfa/leads/route.ts',mocks),detail:load('src/app/api/sfa/leads/[id]/route.ts',mocks),batch:load('src/app/api/sfa/leads/import/route.ts',mocks)};
 const call=(kind,method,body={},query='',id='lead')=>routes[kind][method]({url:'https://example.invalid/api/sfa/leads'+query,json:async()=>body},{params:Promise.resolve({id})});
 return{call,state:()=>state,revoke:()=>active=false,fail:kind=>fail=kind,scope:patch=>Object.assign(scope,patch)};
}
module.exports={fixture,op,stamp};
