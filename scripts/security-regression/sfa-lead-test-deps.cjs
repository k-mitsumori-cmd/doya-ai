// Small legacy input/pagination fixtures. Actual authority/replay/rollback and
// PostgreSQL scheduling are verified separately, without these default models.
const crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
function leadDeps(db={}){
 const deps=require('./sfa-deal-test-deps.cjs').dealDeps(db);
 if(db.sfaLead?.findUnique&&!db.sfaLead.findFirst)db.sfaLead.findFirst=async({where})=>{const row=await db.sfaLead.findUnique({where:{id:where.id}});return row&&row.organizationId===where.organizationId&&row.isActive!==false?row:null;};
 if(db.sfaLead?.findFirst&&!db.sfaLead.findFirstOrThrow)db.sfaLead.findFirstOrThrow=async args=>{const row=await db.sfaLead.findFirst(args);if(!row)throw Error('Synthetic missing lead');return row;};
 if(!db.systemSetting){const records=new Map();db.systemSetting={findUnique:async({where})=>records.get(where.key)||null,create:async({data})=>{records.set(data.key,{...data});return data;}};}
 return{...deps,
  '@/lib/sfa/lead-mutation':load('src/lib/sfa/lead-mutation.ts',{'./deal-mutation':deps['@/lib/sfa/deal-mutation'],'./mutation-authority':deps['@/lib/sfa/mutation-authority']}),
  '@/lib/sfa/lead-import':load('src/lib/sfa/lead-import.ts',{'node:crypto':crypto,'./mutation-authority':deps['@/lib/sfa/mutation-authority'],'./creation-receipt':deps['@/lib/sfa/creation-receipt']}),
  '@/lib/sfa/limits':load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}}),
 };
}
module.exports={leadDeps};
