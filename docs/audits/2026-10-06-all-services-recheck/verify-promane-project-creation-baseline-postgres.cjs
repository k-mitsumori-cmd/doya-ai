const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {load} = require('../../../scripts/security-regression/load-typescript.cjs');
const base = 'docs/audits/2026-10-06-all-services-recheck/';
const fixture = base + 'verify-adimage-operation-postgres.cjs';
const prefix = fs.readFileSync(fixture, 'utf8').split('async function makeBudget()')[0].replace("'AdImageFeedback']", "'AdImageFeedback','PromaneWorkspace','PromaneMember','PromaneProject']");
const {db,setupDb} = new Function('require','__dirname',prefix + '\nreturn {db,setupDb};')(createRequire(path.resolve(fixture)), path.dirname(path.resolve(fixture)));
const action = load('src/lib/promane/actions-projects.ts', {
  '@/lib/prisma': {prisma:db}, '@/lib/promane/auth': {
    requirePromaneAuthAction: async () => ({userId:'synthetic-user'}),
    requireWritableWorkspace: async () => ({id:'synthetic-workspace',userId:'synthetic-user'}),
  }, '@/lib/promane/limits':{getUserPromaneLimits:async()=>({maxProjects:-1}),countUserProjects:async()=>{throw Error('Unlimited fixture must not count')}}, 'next/cache': {revalidatePath(){}}, './time-input': load('src/lib/promane/time-input.ts'),
});
(async () => {
  const cases = [];
  try {
    await setupDb();
    await db.promaneWorkspace.create({data:{id:'synthetic-workspace',slug:'synthetic',userId:'synthetic-user',name:'Synthetic'}});
    await db.promaneMember.create({data:{id:'synthetic-member',workspaceId:'synthetic-workspace',userId:'synthetic-user',displayName:'Synthetic'}});
    const input = {name:'Synthetic retry project',status:'draft',billingType:'fixed'};
    const a = await action.createProject('synthetic',input), b = await action.createProject('synthetic',input);
    assert.notEqual(a.id,b.id); assert.equal(await db.promaneProject.count(),2);
    cases.push({finding:'resending identical action after losing acknowledgement creates another persisted row',rows:2});
    const before = await db.promaneProject.count();
    const pair = await Promise.all([action.createProject('synthetic',input),action.createProject('synthetic',input)]);
    assert.notEqual(pair[0].id,pair[1].id); assert.equal(await db.promaneProject.count(),before+2);
    cases.push({finding:'concurrent identical actions commit two rows despite Serializable transaction retries',additionalRows:2});
    const files = ['src/lib/promane/actions-projects.ts','src/components/promane/project-form.tsx'];
    const report = {checkedAt:new Date().toISOString(),expected:2,passed:cases.length,cases,
      sourceHashes:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
      scope:'Actual createProject action and actual isolated Unix-socket PostgreSQL transactions; synthetic auth/workspace/member and unlimited plan entitlement. No production/customer writes. Identical input may intentionally mean separate projects; missing operation identity prevents distinguishing retry from a new intended project. Fixture tables have scalar constraints, not full production foreign-key topology.'};
    fs.writeFileSync(base+'promane-project-creation-baseline-postgres-results.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report));
  } finally {await db.$disconnect();}
})().catch(error=>{console.error(error);process.exitCode=1;});
