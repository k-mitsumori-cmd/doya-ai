const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const mutation=load('src/lib/sfa/mutation-authority.ts');
const policy=load('src/lib/sfa/record-policy.ts',{'./mutation-authority':mutation});
const ctx=role=>({userId:'user-self',memberId:'self',organizationId:'org-a',organizationSlug:'org-a',role});
const fields={account:'ownerMemberId',contact:'ownerMemberId',lead:'assigneeMemberId',deal:'assigneeMemberId',task:'assigneeMemberId',activity:'memberId'};
let assertions=0;
function matches(row,where){return Object.entries(where).every(([key,value])=>key==='AND'?[].concat(value).every(w=>matches(row,w)):key==='OR'?value.some(w=>matches(row,w)):value&&typeof value==='object'&&'in'in value?value.in.includes(row[key]):row[key]===value)}
function fixture(options={}){
 const events=[],actor={id:'self',organizationId:'org-a',userId:'user-self',role:options.role||'manager',status:options.revoked?'INACTIVE':'ACTIVE'};
 const members=[actor,{id:'peer',organizationId:'org-a',userId:'user-peer',role:'member',status:'ACTIVE'},{id:'inactive',organizationId:'org-a',role:'member',status:'INACTIVE'},{id:'other',organizationId:'org-a',role:'member',status:'ACTIVE'},{id:'foreign',organizationId:'org-b',role:'owner',status:'ACTIVE'}];
 const edges=options.noTeam?[]:[{organizationId:'org-a',teamId:'team-a',memberId:'self'},{organizationId:'org-a',teamId:'team-a',memberId:'peer'},{organizationId:'org-a',teamId:'team-a',memberId:'inactive'},{organizationId:'org-a',teamId:'team-b',memberId:'other'},{organizationId:'org-b',teamId:'team-a',memberId:'foreign'}];
 const tx={
  $queryRaw:async(strings,...values)=>{const sql=strings.join('?');events.push({sql,values});if(sql.includes('FROM sfa_organizations'))return options.missingOrg?[]:[{id:'org-a'}];return members.filter(m=>m.id===values[0]&&m.organizationId===values[1]).map(({id})=>({id}))},
  sfaMember:{findFirst:async({where,select})=>{const row=members.find(m=>m.id===where.id&&m.organizationId===where.organizationId&&(!where.userId||m.userId===where.userId)&&m.status===where.status&&where.role.in.includes(m.role));return row?Object.fromEntries(Object.keys(select).map(k=>[k,row[k]])):null}},
  sfaTeamMember:{findMany:async({where,select})=>{events.push({teamQuery:where});return edges.filter(e=>e.organizationId===where.organizationId&&(!where.memberId||e.memberId===where.memberId)&&(!where.teamId||where.teamId.in.includes(e.teamId))&&(!where.member||members.some(m=>m.id===e.memberId&&m.organizationId===where.member.organizationId&&m.status===where.member.status&&where.member.role.in.includes(m.role)))).map(e=>Object.fromEntries(Object.keys(select).map(k=>[k,e[k]])))}},
  sfaOrganization:{update:async args=>{events.push({touch:args});return {id:'org-a'}}},
 };
 const db={$transaction:async(run,settings)=>{events.push({transaction:settings});return run(tx)}};
 const api=load('src/lib/sfa/record-authority.ts',{'@/lib/prisma':{prisma:db},'@/lib/company-roles/access.server':{ceilToolRole:async input=>{assert.equal(input.toolRole,actor.role);if(options.ceilingError)throw Error('synthetic ceiling unavailable');return options.denied?null:options.ceiling||input.toolRole}},'./mutation-authority':mutation,'./record-policy':policy},{Date});
 return {api,tx,events,members};
}
(async()=>{
 for(const role of ['member','manager','admin','owner'])for(const kind of Object.keys(fields))for(const owner of ['self','peer','other',null])for(const shared of [false,true])for(const write of [false,true]){
  const scope=policy.makeSfaRecordScope(ctx(role),['peer']);const row={organizationId:'org-a',isActive:true,[fields[kind]]:owner,isShared:shared};
  const expected=['admin','owner'].includes(role)||owner==='self'||role==='manager'&&owner==='peer'||!write&&kind==='account'&&shared;
  assert.equal(policy.canAccessSfaRecord(scope,kind,row,write),expected);assert.equal(matches(row,policy.sfaRecordWhere(scope,kind,write)),expected);
  assert.equal(policy.canAccessSfaRecord(scope,kind,{...row,organizationId:'org-b'},write),false);assert.equal(matches({...row,organizationId:'org-b'},policy.sfaRecordWhere(scope,kind,write)),false);
  assert.equal(matches(row,policy.sfaRecordWhere(scope,kind,write,{organizationId:'org-b'})),false);assertions+=5;
 }
 for(const role of ['unknown','ADMIN','__proto__',undefined,null,{}])assert.throws(()=>policy.makeSfaRecordScope({...ctx('member'),role}),e=>e.status===403);
 for(const id of ['',null,{},1,'x'.repeat(129)])assert.throws(()=>policy.makeSfaRecordScope({...ctx('member'),memberId:id}),e=>e.status===403);
 const immutable=policy.makeSfaRecordScope(ctx('member'),['peer']);assert(Object.isFrozen(immutable)&&Object.isFrozen(immutable.actor)&&Object.isFrozen(immutable.memberIds));assert.deepEqual(Array.from(immutable.memberIds),['self']);assert.equal(policy.scopeAllowsSfaAssignment(immutable,'peer'),false);
 for(const kind of ['account','contact','lead','deal'])assert.equal(policy.canAccessSfaRecord(policy.makeSfaRecordScope(ctx('owner')),kind,{organizationId:'org-a',isActive:false}),false);
 const manager=fixture();const scope=await manager.api.lockSfaRecordScope(manager.tx,ctx('owner'));assert.equal(scope.actor.role,'manager');assert.deepEqual(Array.from(scope.memberIds).sort(),['peer','self']);assert.match(manager.events[0].sql,/sfa_organizations.*FOR SHARE/);assert.match(manager.events[1].sql,/sfa_members/);
 const noTeam=fixture({noTeam:true});assert.deepEqual(Array.from((await noTeam.api.lockSfaRecordScope(noTeam.tx,ctx('manager'))).memberIds),['self']);
 for(const role of ['member','admin','owner']){const f=fixture({role});const s=await f.api.lockSfaRecordScope(f.tx,ctx('owner'));assert.equal(f.events.filter(e=>e.teamQuery).length,0);assert.equal(s.organizationWide,['admin','owner'].includes(role));}
 for(const option of [{revoked:true},{missingOrg:true},{denied:true}]){const f=fixture(option);await assert.rejects(f.api.lockSfaRecordScope(f.tx,ctx('owner')),e=>e.status===403)}
 const lowered=fixture({role:'owner',ceiling:'member'});const low=await lowered.api.lockSfaRecordScope(lowered.tx,ctx('owner'));assert.equal(low.organizationWide,false);assert.equal(low.actor.role,'member');
 const ceilingError=fixture({ceilingError:true});await assert.rejects(ceilingError.api.lockSfaRecordScope(ceilingError.tx,ctx('manager')),/synthetic ceiling unavailable/);
 const owner=fixture({role:'owner'});await owner.api.withSfaScopeManagement(ctx('owner'),async(_tx,s)=>{assert.equal(s.actor.role,'owner');assert(owner.events.some(e=>e.touch));owner.events.push({mutated:true})});assert.match(owner.events.find(e=>e.sql).sql,/FOR UPDATE/);assert(owner.events.findIndex(e=>e.touch)<owner.events.findIndex(e=>e.mutated));
 const deniedManager=fixture();await assert.rejects(deniedManager.api.withSfaScopeManagement(ctx('manager'),async()=>{throw Error('forbidden callback ran')}),e=>e.status===403);assert(!deniedManager.events.some(e=>e.touch));
 const read=fixture({role:'member'});await read.api.withSfaRecordRead(ctx('owner'),async(_tx,s)=>{assert.equal(s.actor.role,'member');assert(!s.organizationWide)});assert.equal(read.events[0].transaction.isolationLevel,'ReadCommitted');
 assert.equal(await manager.api.lockSfaAssignee(manager.tx,scope,'peer'),'peer');for(const id of ['other','inactive','foreign'])await assert.rejects(manager.api.lockSfaAssignee(manager.tx,scope,id),e=>e.status===403);
 const member=fixture({role:'member'});const memberScope=await member.api.lockSfaRecordScope(member.tx,ctx('member'));await assert.rejects(member.api.lockSfaAssignee(member.tx,memberScope,null),e=>e.status===403);assert.equal(await owner.api.lockSfaAssignee(owner.tx,policy.makeSfaRecordScope(ctx('owner')),null),null);await assert.rejects(owner.api.lockSfaAssignee(owner.tx,policy.makeSfaRecordScope(ctx('owner')),'foreign'),e=>e.status===403);
 console.log(JSON.stringify({passedGroups:16,policyAndQueryAssertions:assertions,scope:'Actual pure policy and actor/team/assignment authority with synthetic transactional adapters. No provider, production data or migration. SQL constraints and MVCC races require separate native PostgreSQL checks; routes/UI are not wired by this test.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
