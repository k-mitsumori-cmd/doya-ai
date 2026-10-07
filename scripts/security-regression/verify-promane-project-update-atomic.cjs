const {projectDependencies,adaptProjectPrisma,businessActions}=require('./promane-project-operation-fixture.cjs');
const assert=require('node:assert/strict'),{load,check,results}=require('./load-typescript.cjs');
function fixture({member=true,missing=false,repeated=false}={}){let attempts=0,updates=0;const prisma={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');attempts++;return fn({promaneMember:{findFirst:async()=>member?{id:'m'}:null},promaneProject:{findFirst:async({where})=>{assert.equal(where.workspaceId,'w');return missing?null:{startDate:new Date('2026-09-01'),endDate:new Date(attempts===1?'2026-09-30':'2026-09-10'),updatedAt:new Date('2026-09-01T01:00:00Z')}},update:async()=>{updates++;throw{code:'P2034'}}}})}};const actions=load('src/lib/promane/actions-projects.ts',{...projectDependencies,'./time-input':load('src/lib/promane/time-input.ts'),'@/lib/prisma':{prisma:adaptProjectPrisma(prisma)},'@/lib/promane/auth':{requirePromaneAuthAction:async()=>({userId:'u'}),requireWritableWorkspace:async()=>({id:'w'})},'@/lib/promane/limits':{},'next/cache':{revalidatePath(){}}});return{run:()=>businessActions(actions,'u').updateProject('w','p',repeated?{name:'P',expectedUpdatedAt:'2026-09-01T01:00:00.000Z'}:{startDate:'2026-09-20',expectedUpdatedAt:'2026-09-01T01:00:00.000Z'}),state:()=>({attempts,updates})}}
function versionFixture({current='2026-09-01T01:00:00.000Z',writeError}={}) {
  let writes=0;
  const prisma={$transaction:async(fn)=>fn({
    promaneMember:{findFirst:async()=>({id:'m'})},
    promaneProject:{
      findFirst:async()=>({startDate:null,endDate:null,updatedAt:new Date(current)}),
      update:async({where,data})=>{
        writes++;
        assert.equal(where.workspaceId,'w');
        assert.equal(where.updatedAt.toISOString(),'2026-09-01T01:00:00.000Z');
        assert(data.updatedAt.getTime()>where.updatedAt.getTime());
        if(writeError)throw{code:writeError};
        return data;
      },
    },
  })};
  const actions=load('src/lib/promane/actions-projects.ts',{
    ...projectDependencies,
    './time-input':load('src/lib/promane/time-input.ts'),
    '@/lib/prisma':{prisma:adaptProjectPrisma(prisma)},
    '@/lib/promane/auth':{requirePromaneAuthAction:async()=>({userId:'u'}),requireWritableWorkspace:async()=>({id:'w'})},
    '@/lib/promane/limits':{},
    'next/cache':{revalidatePath(){}},
  });
  return{update:(expectedUpdatedAt)=>businessActions(actions,'u').updateProject('ws','p',{name:'new',expectedUpdatedAt}),writes:()=>writes};
}

(async()=>{
  await check('retry re-reads latest dates and rejects newly invalid range',async()=>{const f=fixture();await assert.rejects(f.run(),/終了日は開始日以降/);assert.deepEqual(f.state(),{attempts:2,updates:1})});
  await check('missing project or lost membership cannot update',async()=>{for(const options of [{missing:true},{member:false}]){const f=fixture(options);await assert.rejects(f.run());assert.deepEqual(f.state(),{attempts:1,updates:0})}});
  await check('update conflict retry is bounded and actionable',async()=>{const f=fixture({repeated:true});await assert.rejects(f.run(),/同時に案件/);assert.deepEqual(f.state(),{attempts:3,updates:3})});
  await check('stale editor and missing version cannot overwrite a newer project',async()=>{
    const f=versionFixture({current:'2026-09-01T02:00:00.000Z'});
    const denied=await f.update('2026-09-01T01:00:00.000Z');assert.equal(denied.code,'STALE_PROJECT');assert.match(denied.error,/最新版を開き直してください/);
    for(const token of [undefined,'invalid'])await assert.rejects(f.update(token),/更新情報がありません/);
    assert.equal(f.writes(),0);
  });
  await check('conditional update failure reports the same conflict',async()=>{
    const f=versionFixture({writeError:'P2025'});
    const denied=await f.update('2026-09-01T01:00:00.000Z');assert.equal(denied.code,'STALE_PROJECT');assert.match(denied.error,/最新版を開き直してください/);
    assert.equal(f.writes(),1);
  });
  await check('matching version permits a write and advances the version',async()=>{
    const f=versionFixture();
    await f.update('2026-09-01T01:00:00.000Z');
    assert.equal(f.writes(),1);
  });
  console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
