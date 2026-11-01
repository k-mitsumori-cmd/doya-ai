// Business-rule adapters only. Real receipts/locks/rollback/races use the private PostgreSQL action suite.
const crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
const {adaptTimePrisma}=require('./promane-time-creation-fixture.cjs');
const input=load('src/lib/promane/time-input.ts');
const projectDependencies={
  '@/lib/promane/time-input':input,
  './project-input':load('src/lib/promane/project-input.ts',{'@/lib/promane/time-input':input}),
  './project-operation':load('src/lib/promane/project-operation.ts',{'node:crypto':crypto}),
};
function adaptProjectPrisma(prisma){
  const wrapped={...prisma,$transaction:async(fn,options)=>prisma.$transaction(tx=>fn({...tx,promaneProject:tx.promaneProject?{...tx.promaneProject,
    create:tx.promaneProject.create?async args=>({id:'synthetic-project',updatedAt:new Date('2026-09-01T01:00:00.000Z'),...await tx.promaneProject.create(args)}):undefined,
    update:tx.promaneProject.update?async args=>({id:args.where.id,updatedAt:args.data.updatedAt,...await tx.promaneProject.update(args)}):undefined,
  }:undefined}),options)};
  return adaptTimePrisma(wrapped);
}
function businessActions(actions,userId,expectedUpdatedAt){
  const unwrap=async work=>{const result=await work;return result.state==='saved'||result.state==='superseded'?result.entry:result};
  return {...actions,
    createProject:(slug,data)=>unwrap(actions.createProject(slug,{...data,operationId:crypto.randomUUID(),expectedUserId:userId})),
    updateProject:(slug,id,data)=>unwrap(actions.updateProject(slug,id,{...data,...(expectedUpdatedAt?{expectedUpdatedAt:expectedUpdatedAt()}:{}),operationId:crypto.randomUUID(),expectedUserId:userId})),
  };
}
module.exports={projectDependencies,adaptProjectPrisma,businessActions};
