const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {load} = require('../../../scripts/security-regression/load-typescript.cjs');
const base = 'docs/audits/2026-10-06-all-services-recheck/';
const fixture = base + 'verify-adimage-operation-postgres.cjs';
const prefix = fs.readFileSync(fixture, 'utf8').split('async function makeBudget()')[0].replace("'AdImageFeedback']", "'AdImageFeedback','PromaneWorkspace','PromaneMember','PromaneProject','PromaneTask']");
const {db,setupDb} = new Function('require','__dirname',prefix + '\nreturn {db,setupDb};')(createRequire(path.resolve(fixture)), path.dirname(path.resolve(fixture)));
const timeInput = load('src/lib/promane/time-input.ts');
const input = load('src/lib/promane/task-input.ts', {'./time-input':timeInput});
const helper = load('src/lib/promane/task-creation.ts', {'node:crypto':crypto});
let userId='staff', workspaceId='workspace';
const action = load('src/lib/promane/actions-tasks.ts', {
  '@/lib/prisma': {prisma:db}, './time-input':timeInput, './task-input':input, './task-creation':helper,
  '@/lib/promane/auth': {
    requirePromaneAuthAction: async () => { if (!userId) throw Error('Unauthenticated'); return {userId}; },
    requireWritableWorkspace: async () => ({id:workspaceId}),
  }, 'next/cache': {revalidatePath(){}},
});
const op='10000000-0000-4000-8000-000000000001';
const body={operationId:op,expectedUserId:'staff',projectId:'project',title:'Synthetic task',description:'Synthetic private text',startDate:'2026-09-01',dueDate:'2026-09-30'};
const create=(extra={})=>action.createTask('synthetic',{...body,...extra});
const recover=(cancel=false,project='project',operation=op)=>action.recoverTaskCreation('synthetic',project,operation,cancel,userId);
async function reset(){
  userId='staff'; workspaceId='workspace';
  await db.promaneTask.deleteMany();await db.promaneProject.deleteMany();await db.promaneMember.deleteMany();await db.promaneWorkspace.deleteMany();await db.systemSetting.deleteMany();
  for(const id of ['workspace','other-workspace'])await db.promaneWorkspace.create({data:{id,slug:id,userId:'owner',name:'Synthetic'}});
  for(const [id,wid]of [['project','workspace'],['project-b','workspace'],['foreign-project','other-workspace']])await db.promaneProject.create({data:{id,workspaceId:wid,name:'Synthetic'}});
  for(const [id,uid,wid]of [['member','staff','workspace'],['coworker','coworker','workspace'],['foreign-member','staff','other-workspace']])await db.promaneMember.create({data:{id,userId:uid,workspaceId:wid,displayName:'Synthetic'}});
}
const cases=[];
async function check(name,fn){await reset();await fn();cases.push(name);console.log('PASS '+name);}
(async()=>{try{
  await setupDb();
  await db.$executeRawUnsafe('ALTER TABLE promane_tasks ADD FOREIGN KEY ("projectId") REFERENCES promane_projects(id) ON DELETE CASCADE');
  await db.$executeRawUnsafe('ALTER TABLE promane_tasks ADD FOREIGN KEY ("assigneeId") REFERENCES promane_members(id) ON DELETE SET NULL');
  await db.$executeRawUnsafe('ALTER TABLE promane_tasks ADD FOREIGN KEY ("parentId") REFERENCES promane_tasks(id) ON DELETE SET NULL');
  await check('same operation replay returns one committed task',async()=>{const a=await create(),b=await create();assert.equal(a.id,b.id);assert.equal(await db.promaneTask.count(),1)});
  await check('concurrent same operation commits exactly one task',async()=>{const [a,b]=await Promise.all([create(),create()]);assert.equal(a.id,b.id);assert.equal(await db.promaneTask.count(),1)});
  await check('distinct operations preserve intentionally identical tasks',async()=>{const a=await create(),b=await create({operationId:'20000000-0000-4000-8000-000000000002'});assert.notEqual(a.id,b.id);assert.equal(await db.promaneTask.count(),2)});
  await check('changed input on replay is rejected',async()=>{await create();await assert.rejects(create({title:'Changed'}),/入力が変わ/);assert.equal((await db.promaneTask.findFirst()).title,body.title)});
  await check('read missing neither creates task nor receipt',async()=>{assert.equal((await recover()).state,'missing');assert.equal(await db.promaneTask.count(),0);assert.equal(await db.systemSetting.count(),0)});
  await check('explicit cancel fences delayed original save',async()=>{assert.equal((await recover(true)).state,'cancelled');await assert.rejects(create(),/取り消/);assert.equal(await db.promaneTask.count(),0)});
  await check('cancel saved recovers task without removing it',async()=>{const a=await create(),r=await recover(true);assert.equal(r.state,'found');assert.equal(r.entry.id,a.id);assert.equal(await db.promaneTask.count(),1)});
  await check('deleted task is unavailable and never resurrected',async()=>{await create();await db.promaneTask.deleteMany();assert.equal((await recover()).state,'unavailable');await assert.rejects(create(),/開けません/);assert.equal(await db.promaneTask.count(),0)});
  await check('receipt isolated between projects in same workspace',async()=>{await create();assert.equal((await recover(false,'project-b')).state,'missing');await create({projectId:'project-b'});assert.equal(await db.promaneTask.count(),2)});
  await check('receipt isolated between users and workspaces',async()=>{await create();userId='coworker';assert.equal((await recover()).state,'missing');userId='staff';workspaceId='other-workspace';assert.equal((await recover(false,'foreign-project')).state,'missing')});
  await check('inactive actors cannot create recover or cancel',async()=>{await db.promaneMember.update({where:{id:'member'},data:{isActive:false}});await assert.rejects(create(),/変更権限/);await assert.rejects(recover(),/変更権限/);await assert.rejects(recover(true),/変更権限/);assert.equal(await db.systemSetting.count(),0)});
  await check('viewer actors cannot create recover or cancel',async()=>{await db.promaneMember.update({where:{id:'member'},data:{role:'guest'}});await assert.rejects(create(),/変更権限/);await assert.rejects(recover(),/変更権限/);await assert.rejects(recover(true),/変更権限/)});
  await check('anonymous denied before operation access',async()=>{userId=null;await assert.rejects(create(),/Unauthenticated/);await assert.rejects(recover(),/Unauthenticated/);assert.equal(await db.systemSetting.count(),0)});
  await check('foreign project assignee and parent cannot be linked',async()=>{await assert.rejects(create({projectId:'foreign-project'}),/プロジェクト/);await assert.rejects(create({assigneeId:'foreign-member'}),/担当者/);const parent=await db.promaneTask.create({data:{projectId:'project-b',title:'Other'}});await assert.rejects(create({parentId:parent.id}),/親タスク/);assert.equal(await db.systemSetting.count(),0)});
  await check('input type text and actual calendar boundaries reject before writes',async()=>{for(const patch of [{title:''},{title:'x'.repeat(201)},{description:{}},{description:'x'.repeat(5001)},{priority:'critical'},{status:'archived'},{projectId:23},{assigneeId:{}},{parentId:[]},{startDate:'2026-02-30'},{startDate:'2026-10-01'},{operationId:'bad'}])await assert.rejects(create(patch));assert.equal(await db.promaneTask.count(),0);assert.equal(await db.systemSetting.count(),0)});
  await check('exact text date and linked fields preserved',async()=>{const parent=await db.promaneTask.create({data:{projectId:'project',title:'Parent'}});const a=await create({title:'題'.repeat(200),description:'説'.repeat(5000),assigneeId:'member',parentId:parent.id});assert.equal(a.title.length,200);assert.equal(a.description.length,5000);assert.equal(a.startDate.toISOString(),'2026-09-01T00:00:00.000Z');assert.equal(a.assigneeId,'member');assert.equal(a.parentId,parent.id)});
  await check('receipt insert failure rolls back task atomically',async()=>{await db.$executeRawUnsafe(`CREATE FUNCTION reject_task_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic receipt failure'; END $$`);await db.$executeRawUnsafe('CREATE TRIGGER reject_task_receipt BEFORE INSERT ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION reject_task_receipt()');try{await assert.rejects(create());assert.equal(await db.promaneTask.count(),0);assert.equal(await db.systemSetting.count(),0)}finally{await db.$executeRawUnsafe('DROP TRIGGER reject_task_receipt ON "SystemSetting"');await db.$executeRawUnsafe('DROP FUNCTION reject_task_receipt()')}});
  await check('corrupt receipt blocks without replacing saved task',async()=>{await create();const receipt=await db.systemSetting.findFirst();await db.systemSetting.update({where:{key:receipt.key},data:{value:'bad-json'}});await assert.rejects(create(),/保存記録/);await assert.rejects(recover(),/保存記録/);assert.equal(await db.promaneTask.count(),1)});
  await check('concurrent cancellation and create settle to one terminal state',async()=>{await Promise.allSettled([create(),recover(true)]);const r=await recover();assert(['found','cancelled'].includes(r.state));assert.equal(await db.promaneTask.count(),r.state==='found'?1:0);assert.equal(await db.systemSetting.count(),1)});
  await check('stale browser actor cannot save recover or cancel under changed authenticated account',async()=>{userId='coworker';await assert.rejects(create(),/利用者が変わ/);await assert.rejects(action.recoverTaskCreation('synthetic','project',op,false,'staff'),/利用者が変わ/);await assert.rejects(action.recoverTaskCreation('synthetic','project',op,true,'staff'),/利用者が変わ/);assert.equal(await db.promaneTask.count(),0);assert.equal(await db.systemSetting.count(),0)});
  await check('task sort order continues existing lane',async()=>{await db.promaneTask.create({data:{projectId:'project',title:'Prior',order:9,status:'todo'}});const a=await create();assert.equal(a.order,10);assert.equal(a.status,'todo');assert.equal(a.priority,'medium')});
  const files=['src/lib/promane/actions-tasks.ts','src/lib/promane/task-input.ts','src/lib/promane/task-creation.ts'];
  const report={checkedAt:new Date().toISOString(),expected:21,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual task actions/helper/input with isolated Unix-socket PostgreSQL, task project/assignee/parent foreign keys, synthetic auth and data. No production/customer/provider writes; not real Next browser action transport.'};
  fs.writeFileSync(base+'promane-task-creation-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await db.$disconnect()}})().catch(error=>{console.error(error);process.exitCode=1});
