const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {load} = require('../../../scripts/security-regression/load-typescript.cjs');
const base = 'docs/audits/2026-10-06-all-services-recheck/';
const fixture = base + 'verify-adimage-operation-postgres.cjs';
const prefix = fs.readFileSync(fixture, 'utf8').split('async function makeBudget()')[0].replace("'AdImageFeedback']", "'AdImageFeedback','PromaneWorkspace','PromaneMember','PromaneProject']");
const {db,setupDb} = new Function('require','__dirname',prefix + '\nreturn {db,setupDb};')(createRequire(path.resolve(fixture)), path.dirname(path.resolve(fixture)));
const limits=load('src/lib/promane/limits.ts',{'@/lib/prisma':{prisma:db},'@/lib/plan-utils':load('src/lib/plan-utils.ts')});
let actor='owner',workspace='workspace';
const action=load('src/lib/promane/actions-projects.ts',{'@/lib/prisma':{prisma:db},'./time-input':load('src/lib/promane/time-input.ts'),'@/lib/promane/limits':limits,'next/cache':{revalidatePath(){}},'@/lib/promane/auth':{requirePromaneAuthAction:async()=>({userId:actor}),requireWritableWorkspace:async()=>({id:workspace,userId:'owner'})}});
async function reset(plan='FREE'){
 actor='owner';workspace='workspace';await db.promaneProject.deleteMany();await db.promaneMember.deleteMany();await db.promaneWorkspace.deleteMany();await db.$executeRawUnsafe('TRUNCATE "User"');
 for(const [id,p]of [['owner',plan],['staff','PRO'],['other','PRO']])await db.$executeRawUnsafe('INSERT INTO "User" (id,plan) VALUES ($1,$2)',id,p);
 for(const [id,uid]of [['workspace','owner'],['second','owner'],['unrelated','other']])await db.promaneWorkspace.create({data:{id,slug:id,userId:uid,name:'Synthetic'}});
 for(const [id,uid,wid]of [['owner-member','owner','workspace'],['staff-member','staff','workspace'],['second-member','owner','second']])await db.promaneMember.create({data:{id,userId:uid,workspaceId:wid,displayName:'Synthetic'}});
}
const create=()=>action.createProject('synthetic',{name:'Synthetic project'});
const cases=[];async function check(name,fn){await reset();await fn();cases.push(name);console.log('PASS '+name)}
(async()=>{try{await setupDb();
 await check('FREE final slot concurrent actions admit one new project and deny other',async()=>{for(let i=0;i<2;i++)await db.promaneProject.create({data:{workspaceId:'workspace',name:'Existing'}});const pair=await Promise.all([create(),create()]);assert.equal(pair.filter(r=>'id'in r).length,1);assert.equal(pair.filter(r=>r.code==='LIMIT').length,1);assert.equal(await limits.countUserProjects('owner',db),3)});
 await check('FREE retry of successfully filled final slot is misreported as LIMIT rather than recovering original',async()=>{for(let i=0;i<2;i++)await db.promaneProject.create({data:{workspaceId:'workspace',name:'Existing'}});const first=await create(),retry=await create();assert(first.id);assert.equal(retry.code,'LIMIT');assert.equal(await limits.countUserProjects('owner',db),3)});
 await check('owner limits count all owned workspaces and ignore unrelated owner projects',async()=>{for(let i=0;i<2;i++)await db.promaneProject.create({data:{workspaceId:'second',name:'Owner other workspace'}});for(let i=0;i<5;i++)await db.promaneProject.create({data:{workspaceId:'unrelated',name:'Unrelated'}});assert((await create()).id);assert.equal((await create()).code,'LIMIT');assert.equal(await limits.countUserProjects('owner',db),3)});
 await check('invited PRO staff cannot bypass FREE contract owner cap and is guided to owner',async()=>{for(let i=0;i<3;i++)await db.promaneProject.create({data:{workspaceId:'workspace',name:'Existing'}});actor='staff';const denied=await create();assert.equal(denied.code,'LIMIT');assert.equal(denied.canManageBilling,false);assert.match(denied.error,/契約者/);assert.equal(await limits.countUserProjects('owner',db),3)});
 await check('contract owner at cap receives billing-manager guidance',async()=>{for(let i=0;i<3;i++)await db.promaneProject.create({data:{workspaceId:'workspace',name:'Existing'}});const denied=await create();assert.equal(denied.canManageBilling,true);assert.match(denied.error,/プラン/)});
 await check('PRO owner preserves unlimited creation through real entitlement reader',async()=>{await db.$executeRawUnsafe('UPDATE "User" SET plan=$1 WHERE id=$2','PRO','owner');for(let i=0;i<5;i++)assert((await create()).id);assert.equal(await limits.countUserProjects('owner',db),5)});
 const files=['src/lib/promane/actions-projects.ts','src/lib/promane/limits.ts','src/lib/plan-utils.ts'];const report={checkedAt:new Date().toISOString(),expected:6,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual project create action, actual limit reader and plan normalization with isolated Unix-socket PostgreSQL and synthetic User.plan rows. Synthetic auth/workspace resolver. No production/customer writes, provider calls or real Next browser transport. Current limit behavior preserved; final-slot retry ambiguity confirmed.'};fs.writeFileSync(base+'promane-project-limit-boundary-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
