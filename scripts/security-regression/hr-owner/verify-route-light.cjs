// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require(require('node:path').join(TEST_DEPS_ROOT, 'node_modules/typescript'))
const root=TEST_SOURCE_ROOT
const state={validLifecycleUser:v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v),validLifecycleUuid:v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v),validLifecycleDigest:v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),LifecycleError:class LifecycleError extends Error{constructor(code,status=409){super(code);this.code=code;this.status=status}}}
function load(file,mocks={}){const p=path.join(root,file);const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const exports={};vm.runInNewContext(code,{exports,require:n=>{if(n in mocks)return mocks[n];if(n==='node:crypto')return require(n);throw Error('Unmocked '+n)},URL,Request,Response,Headers,Buffer,Date,Set,Map,Error,console,process:{env:{}}},{filename:file});return exports}
const types=load('src/lib/hr/owner-transfer/types.ts',{'node:crypto':require('node:crypto'),'@/lib/account-lifecycle/state':state})
const selection=load('src/lib/hr/organization-selection.ts')
const privateApi={privateApiJson:(body,init={})=>Response.json(body,{...init,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}})}
let actor='A',calls=[];const store={ownerTransferCandidates:async(...args)=>{calls.push(['candidates',...args]);return {actorId:'A',service:'hr',organization:{id:'orgA',slug:'x'.repeat(161),name:'Org'},owner:{memberId:'mA',userId:'A'},candidates:[],nextCursor:null}},ownerTransferStatus:async id=>{calls.push(['status',id]);return {actorId:'A',service:'hr',organizationId:'orgA',operationId:id.operationId,phase:'missing',input:null,createdAt:null}},cancelOwnerTransfer:async id=>{calls.push(['cancel',id]);return {actorId:'A',service:'hr',organizationId:'orgA',operationId:id.operationId,phase:'canceled',input:null,createdAt:new Date().toISOString()}},transferOwner:async(...args)=>{calls.push(['transfer',...args]);return {actorId:'A',service:'hr',organizationId:'orgA',operationId:args[0].operationId,phase:'committed',input:args[1],createdAt:new Date().toISOString()}}}
const route=load('src/app/api/hr/organization/transfer-owner/route.ts',{'next-auth':{getServerSession:async()=>({user:{id:actor}})},'@/lib/auth':{authOptions:{}},'@/lib/account-lifecycle/state':state,'@/lib/hr/organization-selection':selection,'@/lib/private-api-response':privateApi,'@/lib/hr/owner-transfer/store':store,'@/lib/hr/owner-transfer/types':types})
const op='123e4567-e89b-42d3-a456-426614174000';const headers=new Headers({'X-HR-Selected-Actor':'A','X-HR-Selected-Organization':'orgA','X-HR-Organization-Id':'orgA'})
const req=(url,body,h=headers)=>({url:'https://example.invalid'+url,headers:h,text:async()=>JSON.stringify(body)})
;(async()=>{
 let r=await route.POST(req('/api/hr/organization/transfer-owner',{targetMemberId:'mB'}));assert.equal(r.status,400);assert.equal(calls.length,0)
 r=await route.GET(req('/api/hr/organization/transfer-owner?action=candidates&expectedActor=A&orgId=orgA&cursor=m050'));assert.equal(r.status,200);assert.equal(calls.at(-1)[4],'m050')
 const input={expectedOwnerMemberId:'mA',targetMemberId:'mB',targetUserId:'B',targetRole:'ADMIN',targetPlan:'PRO'}
 r=await route.POST(req('/api/hr/organization/transfer-owner',{action:'transfer',expectedActor:'A',orgId:'orgA',operationId:op,input}));assert.equal(r.status,200);assert.equal(calls.at(-1)[0],'transfer');assert.equal(calls.at(-1).length,3)
 r=await route.GET(req('/api/hr/organization/transfer-owner?action=status&expectedActor=A&orgId=orgA&operationId='+op));assert.equal(r.status,200)
 r=await route.POST(req('/api/hr/organization/transfer-owner',{action:'cancel',expectedActor:'A',orgId:'orgA',operationId:op}));assert.equal(r.status,200)
 const wrong=new Headers(headers);wrong.set('X-HR-Selected-Organization','orgB');r=await route.GET(req('/api/hr/organization/transfer-owner?action=status&expectedActor=A&orgId=orgA&operationId='+op,null,wrong));assert.equal(r.status,403);assert.equal(calls.length,4)
 r=await route.GET(req('/api/hr/organization/transfer-owner?action=status&expectedActor=A&orgId=orgA&operationId='+op,null,new Headers()));assert.equal(r.status,403)
 console.log(JSON.stringify({passed:7,calls:calls.map(x=>x[0]),longSlug:true,oldBodyRejected:true}))
})().catch(e=>{console.error(e);process.exitCode=1})
