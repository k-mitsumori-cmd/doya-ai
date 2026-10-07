// Business-rule fixtures only. Actual locking, receipts, races and rollback use private PostgreSQL suites.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
const timeCreation=load('src/lib/promane/time-entry-creation.ts',{'node:crypto':crypto});
const expenseCreation=load('src/lib/promane/expense-creation.ts',{'node:crypto':crypto});
const operationId='10000000-0000-4000-8000-000000000001';
function adaptTimePrisma(prisma){
  const receipts=new Map();
  const adapt=tx=>({...tx,
    $queryRaw:async(strings,...values)=>{assert(strings.join('?').includes('FOR UPDATE'));assert(strings.join('?').includes('promane_members'));const actor=await tx.promaneMember.findFirst({where:{workspaceId:values[0],userId:values[1],isActive:true,role:{in:['owner','admin','member']}},select:{id:true}});return actor?[actor]:[]},
    $executeRaw:async()=>0,
    systemSetting:{findUnique:async({where})=>receipts.has(where.key)?{value:receipts.get(where.key)}:null,create:async({data})=>{assert(!receipts.has(data.key));receipts.set(data.key,data.value);return data}},
    promaneExpense:tx.promaneExpense?{...tx.promaneExpense,create:tx.promaneExpense.create?async args=>({id:'synthetic-expense',...await tx.promaneExpense.create(args)}):undefined}:undefined,
    promaneTimeEntry:tx.promaneTimeEntry?{...tx.promaneTimeEntry,create:tx.promaneTimeEntry.create?async args=>({id:'synthetic-time',...await tx.promaneTimeEntry.create(args)}):undefined}:undefined,
  });
  return {...prisma,$transaction:async(fn,options)=>{const before=new Map(receipts);try{return await prisma.$transaction(tx=>fn(adapt(tx)),options)}catch(e){receipts.clear();for(const[k,v]of before)receipts.set(k,v);throw e}}};
}
module.exports={timeCreation,expenseCreation,adaptTimePrisma,operationId};
