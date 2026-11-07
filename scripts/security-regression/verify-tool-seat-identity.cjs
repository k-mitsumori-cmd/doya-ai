const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),ts=require(root+'/node_modules/typescript'),bindings={},cache=new Map(),results=[];
function code(file){const data=fs.readFileSync(path.join(root,file));bindings[file]=crypto.createHash('sha256').update(data).digest('hex');return ts.transpileModule(data.toString(),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
function pure(file){if(cache.has(file))return cache.get(file);const box={};cache.set(file,box);vm.runInNewContext(code(file),{exports:box,Date,require:n=>{if(!n.startsWith('.'))throw Error('Unapproved pure dependency '+n);return pure(path.posix.normalize(path.posix.join(path.posix.dirname(file),n))+'.ts')}},{filename:file});return box}
const team=pure('src/lib/pricing-v2/team.ts'),now=new Date('2026-11-07T00:00:00Z'),owner={ownerUserId:'owner',ownerEmail:'owner@example.invalid',now};
const active=(userId,email)=>({userId,email,status:'active'}),invite=(email,invitedAt=now)=>({userId:null,email,status:'invited',invitedAt});
function count(name,members,expected){const actual=team.seatsUsed({...owner,members});assert.equal(actual,expected,name);results.push({name,expected,actual})}
async function route(name,change,expectedStatus,expectedWrites){const at=new Date(),memberRows=[invite('join@example.invalid',at)],current={id:'invite-row',companyId:'company-a',email:'join@example.invalid',status:'invited',invitedAt:at,company:{name:'Synthetic company',userId:'owner'}};
 const fixture={current,members:memberRows,actorId:'joiner',actorEmail:current.email,databaseEmail:current.email,accountExists:true,limit:5},writes=[];change(fixture);
 const tx={user:{findUnique:async()=>fixture.accountExists?{email:fixture.databaseEmail}:null},$queryRaw:async()=>fixture.accountExists?[{email:fixture.databaseEmail}]:[],accountCompanyMember:{findUnique:async()=>fixture.current,findMany:async()=>fixture.members,updateMany:async args=>{writes.push(args);return {count:1}}}},box={};class SeatOperationError extends Error{}
 const imports={'next/server':{NextResponse:{json:(body,init)=>({status:init.status,body})}},'next-auth':{getServerSession:async()=>({user:{id:fixture.actorId,email:fixture.actorEmail}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:tx},'@/lib/pricing-v2/rollout':{isNewPricingEnabledFor:()=>true},'@/lib/pricing-v2/team':team,'@/lib/pricing-v2/team.server':{teamTablesAllowed:()=>true,teamSeatsForCompany:async()=>fixture.limit,teamMembershipCapacity:async()=>({ownerUserId:'owner',ownerEmail:owner.ownerEmail,limit:fixture.limit})},'@/lib/pricing-v2/seat-operation':{SeatOperationError,withSeatAdmission:async(company,work)=>{assert.equal(company,'company-a');if(fixture.beforeGuard)fixture.beforeGuard();return work(tx)}}};
 vm.runInNewContext(code('src/app/api/pricing/members/accept/route.ts'),{exports:box,Date,console:{error:()=>{}},require:n=>{assert(n in imports,n);return imports[n]}},{filename:'members/accept/route.ts'});
 const response=await box.POST({json:async()=>({token:'synthetic-token'})});assert.equal(response.status,expectedStatus,name);assert.equal(writes.length,expectedWrites,name+' writes');if(expectedWrites){assert.equal(writes[0].data.userId,fixture.actorId);assert.equal(writes[0].data.status,'active');assert.equal(writes[0].data.inviteToken,null)}else if(response.body.code==='ALREADY_MEMBER')assert(!('role' in response.body));results.push({name,status:response.status,syntheticWrites:writes.length});
}
(async()=>{
 count('owner is implicit first seat',[],1);
 count('distinct active accounts',[active('a','a@example.invalid'),active('b','b@example.invalid')],3);
 count('same account under different emails counts once',[active('a','old@example.invalid'),active('a','new@example.invalid')],2);
 count('distinct user IDs must not merge by stale email',[active('a','same@example.invalid'),active('b','same@example.invalid')],3);
 count('same ID and email counts once',[active('a','a@example.invalid'),active('a','a@example.invalid')],2);
 count('duplicate normalized invitation counts once',[invite('A@example.invalid'),invite(' a@example.invalid ')],2);
 count('invitation matching identified active email counts once',[active('a','a@example.invalid'),invite('A@example.invalid')],2);
 count('invitation ordering does not change identity count',[invite('A@example.invalid'),active('a','a@example.invalid')],2);
 count('both known emails of same ID cover duplicate invitations',[active('a','old@example.invalid'),active('a','new@example.invalid'),invite('old@example.invalid'),invite('new@example.invalid')],2);
 count('owner user ID excludes old email row',[active('owner','old-owner@example.invalid')],1);
 count('owner known old email does not consume invitation seat',[active('owner','old-owner@example.invalid'),invite('old-owner@example.invalid')],1);
 count('different user with owner stale email still consumes seat',[active('a',owner.ownerEmail)],2);
 count('owner email invitation alone consumes no extra seat',[invite(' OWNER@example.invalid ')],1);
 count('removed member never hides new invitation',[{...active('a','a@example.invalid'),status:'removed'},invite('a@example.invalid')],2);
 count('expired invite no longer reserves seat',[invite('expired@example.invalid',new Date(now.getTime()-7*86400000))],1);
 count('future dated invite is invalid',[invite('future@example.invalid',new Date(now.getTime()+1))],1);
 count('missing dated invitation is invalid',[invite('none@example.invalid',null)],1);
 count('legacy invitation with omitted date preserves reservation',[{email:'legacy@example.invalid',userId:null,status:'invited'}],2);
 count('invalid dates do not reserve seat',[invite('bad@example.invalid','bad-date')],1);
 count('unknown status does not reserve seat',[{...active('a','a@example.invalid'),status:'suspended'}],1);
 count('unidentifiable rows conservatively reserve separate seats',[active(null,'invalid'),active(null,'also-invalid')],3);
 count('identified invalid-email duplicate still counts one ID',[active('a','invalid'),active('a','also-invalid')],2);
 count('expired old email is not a known identity alias',[invite('old@example.invalid',new Date(now.getTime()-8*86400000)),active('a','new@example.invalid')],2);
 await route('ordinary invitation joins within capacity',()=>{},200,1);
 for(const limit of [5,2])await route('already active ID under old email capacity '+limit,f=>{f.limit=limit;f.members.push(active('joiner','old@example.invalid'))},409,0);
 await route('another account membership does not block join',f=>f.members.push(active('other','other@example.invalid')),200,1);
 await route('removed membership can join by valid new invitation',f=>f.members.push({...active('joiner','old@example.invalid'),status:'removed'}),200,1);
 await route('expired invitation stays unusable',f=>f.current.invitedAt=new Date(Date.now()-8*86400000),410,0);
 await route('already consumed invitation stays unusable',f=>f.current.status='active',404,0);
 await route('owner cannot consume own invitation',f=>f.actorId='owner',404,0);
 await route('capacity overflow blocks new account',f=>{f.limit=2;f.members.push(active('other','other@example.invalid'))},409,0);
 await route('valid reserved invitation at exact capacity joins',f=>f.limit=2,200,1);
 await route('old session address cannot claim invite after database email changed',f=>f.databaseEmail='changed@example.invalid',404,0);
 await route('current database address authorizes invite despite stale session address',f=>f.actorEmail='old-session@example.invalid',200,1);
 await route('deleted database account cannot claim invitation',f=>f.accountExists=false,404,0);
 await route('database account without email cannot claim invitation',f=>f.databaseEmail=null,404,0);
 await route('email change before guarded reread leaves invitation unchanged',f=>f.beforeGuard=()=>{f.databaseEmail='changed@example.invalid'},404,0);
 await route('authenticated account ID with valid database email does not need session email',f=>f.actorEmail=undefined,200,1);
 bindings['scripts/security-regression/verify-tool-seat-identity.cjs']=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
 const report={checkedAt:new Date().toISOString(),conditions:results.length,passed:results.length,results,sourceBindings:bindings,realDbOrNetworkOrFinancialWrites:0,scope:'Actual candidate seatsUsed and company acceptance handler in controlled synthetic session/Prisma/guard. No real email-change lifecycle, SQL concurrency, financial operations, customer writes, tool integration or production acceptance.'};const output=path.join(root,'docs/audits/2026-10-06-all-services-recheck/tool-seat-identity-results.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({kind:'tool-seat-identity',conditions:results.length,passed:results.length,sourceFiles:Object.keys(bindings).length,sourceBindings:bindings}));
})().catch(e=>{console.error(e);process.exitCode=1});
