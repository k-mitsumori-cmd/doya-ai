const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/',candidate=true,cases=[],observations=[],files=[];
(async()=>{
for(const service of ['aio','shodan','quote','mensetsu','aishodan']){
 const file=`src/app/api/${service}/invite/[token]/route.ts`;files.push(file);
 for(const role of ['admin','manager','member','owner','__UNRECOGNIZED__','','constructor','admin ']){
  const known=['admin','manager','member'].includes(role);
  for(const mode of ['GET','POST','role-change-before-lock']){
   const token='synthetic-invitation-token',initial={id:'invite',organizationId:'org',userId:'pending',role:mode==='role-change-before-lock'?'member':role,status:'PENDING',inviteToken:token,inviteEmail:'synthetic@example.invalid',createdAt:new Date(),organization:{id:'org',name:'Synthetic',slug:'synthetic'}};
   const locked={...initial,role};let writes=0;
   const memberModel=service+'Member';const tx={$queryRaw:async()=>[{id:'org'}],user:{findUnique:async()=>({email:'synthetic@example.invalid'})},[memberModel]:{findUnique:async()=>locked,findFirst:async()=>null,updateMany:async()=>{writes++;return{count:1}},deleteMany:async()=>{writes++;return{count:1}}}};
   const db={[memberModel]:{findUnique:async()=>initial},$transaction:async fn=>fn(tx)};
   const route=load(file,{'next/server':{NextResponse:{json:(data,options={})=>({status:options.status||200,json:async()=>data})}},'next-auth':{getServerSession:async()=>({user:{id:'synthetic',email:'synthetic@example.invalid',name:'Synthetic'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},['@/lib/'+service+'/access']:{resolveUserId:async()=> 'synthetic'}});
   const response=await route[mode==='GET'?'GET':'POST']({}, {params:Promise.resolve({token})});
   const expected=candidate&&!known?(mode==='role-change-before-lock'?409:404):mode!=='GET'&&role==='owner'?409:200;
   assert.equal(response.status,expected,service+' '+JSON.stringify(role)+' '+mode);assert.equal(writes,mode!=='GET'&&expected===200?1:0);
   observations.push({service,role,mode,status:response.status,writes});cases.push(service+' '+JSON.stringify(role)+' '+mode);
  }
 }
}
assert.equal(cases.length,120);files.push('scripts/security-regression/verify-membership-invitation-roles.cjs');const hashes=paths=>Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={checkedAt:new Date().toISOString(),passed:120,cases,observations,sourceHashes:hashes(files),scope:'Actual five invitation handlers; synthetic session, transaction and DB schedules. Tests initial and transaction-time role changes, no emails/network/customer data. Does not establish production invalid-role rows or database isolation.'};
fs.mkdirSync(base,{recursive:true});fs.writeFileSync(base+'membership-invitation-role-integrated-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:120,candidate}));
})().catch(error=>{console.error(error);process.exitCode=1});
