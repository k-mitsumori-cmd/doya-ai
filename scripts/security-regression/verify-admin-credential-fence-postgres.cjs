const root=process.env.DOYA_ADMIN_CREDENTIAL_SOURCE_ROOT||require('node:path').resolve(__dirname,'../..');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{AsyncLocalStorage}=require('node:async_hooks');const{PrismaClient}=require(root+'/node_modules/@prisma/client'),ts=require(root+'/node_modules/typescript'),jwt=require(root+'/node_modules/jsonwebtoken'),bcrypt=require(root+'/node_modules/bcryptjs');const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),u=new URL(cfg.DATABASE_URL);assert(u.hostname==='localhost'&&u.searchParams.get('host').startsWith('/tmp/doya-seat-models-'));const db=new PrismaClient({datasources:{db:{url:cfg.DATABASE_URL}}}),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),bindings={},als=new AsyncLocalStorage(),groups=[],cookieTokens=[];let captchaRequired=false,completed=false,errorCalls=0;const env={NODE_ENV:'production',ADMIN_JWT_SECRET:'synthetic-admin-fixture-secret-not-production'},realNow=Date.now,epoch=Math.floor(Date.now()/1000)*1000;Date.now=()=>epoch;
function load(file,mocks){const src=fs.readFileSync(root+'/'+file,'utf8');bindings[file]=hash(src);const exports={};vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unbound '+n)},Date,URL,Request,Response,Headers,Buffer,process:{env},console:{log(){},warn(){},error(){errorCalls++}}},{filename:file});return exports;}
const auth=load('src/lib/admin-auth.ts',{'bcryptjs':bcrypt,'jsonwebtoken':jwt,'node:crypto':crypto,'./prisma':{prisma:db}});const OTPAuth=require(root+'/node_modules/otpauth');const totp=load('src/lib/totp.ts',{'otpauth':OTPAuth});class NextResponse extends Response{}NextResponse.json=Response.json;const route=load('src/app/api/admin/auth/login/route.ts',{'next/server':{NextResponse},'next/headers':{cookies:async()=>({set:(name,token,options)=>{const store=als.getStore();assert(store);store.push({name,token,options});}})},'@/lib/admin-auth':auth,'@/lib/prisma':{prisma:db},'@/lib/totp':totp,'@/lib/turnstile':{isTurnstileRequired:()=>captchaRequired,verifyTurnstileToken:async token=>({success:token==='synthetic-valid'})}});
async function check(name,fn){credentialFixtureIp='192.0.2.'+(20+groups.length);currentCredentialCase=name;await fn();groups.push({name,passed:true});}async function login(body){const jar=[];const r=await als.run(jar,()=>route.POST(new Request('https://fixture.invalid/api/admin/auth/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':credentialFixtureIp,'user-agent':'synthetic-admin-regression'},body:JSON.stringify(body)})));const response=await r.json();for(const c of jar){assert(c.options.httpOnly&&c.options.secure&&c.options.sameSite==='strict'&&c.options.path==='/'&&c.options.maxAge===86400);assert.equal(c.name,auth.COOKIE_NAME);cookieTokens.push(c.token);}return{status:r.status,response,jar};}

let credentialFixtureIp="192.0.2.20",currentCredentialCase=null,failure=null;
const tokenFor=function(secret){return new OTPAuth.TOTP({algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)}).generate({timestamp:epoch});};
const makeTarget=async function(label,extra={}){
 const password='Test9!'+crypto.randomBytes(20).toString('hex'),identifier='synthetic-'+label+'-'+crypto.randomUUID()+'@example.invalid';
 const admin=await db.adminUser.create({data:{username:identifier,email:identifier,name:'Synthetic admin',passwordHash:await auth.hashPassword(password),isActive:true,...extra}});
 const body={identifier,password,turnstileToken:'synthetic-valid',...(admin.totpEnabled&&admin.totpSecret?{totpToken:tokenFor(admin.totpSecret)}:{})};
 return{admin,password,body};
};
const waitLocks=async function(n){
 const start=realNow();
 while(realNow()-start<6000){
  const[r]=await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%AdminUser%' AND pid<>pg_backend_pid()");
  if(Number(r.count)>=n)return;
  await new Promise(r=>setTimeout(r,25));
 }
 throw Object.assign(new Error('Private lock order not established'),{code:'PRIVATE_LOCK_ORDER'});
};
const ordered=async function(target,write,{order='write-first',revoke=false}={}){
 let holder,writer,pending,release,acquire;
 const acquired=new Promise(r=>acquire=r),held=new Promise(r=>release=r);
 try{
  holder=db.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT id FROM "AdminUser" WHERE id=$1 FOR UPDATE',target.admin.id);acquire();await held;},{maxWait:5000,timeout:15000});
  await acquired;
  const mutate=()=>db.$transaction(async tx=>{
   await tx.$queryRawUnsafe('SELECT id FROM "AdminUser" WHERE id=$1 FOR UPDATE',target.admin.id);
   const result=await write(tx,target);
   const removed=revoke?await tx.adminSession.deleteMany({where:{adminUserId:target.admin.id}}):{count:0};
   return{result,removed:removed.count};
  },{maxWait:5000,timeout:15000});
  if(order==='write-first'){writer=mutate();await waitLocks(1);pending=login(target.body);}
  else{pending=login(target.body);await waitLocks(1);writer=mutate();}
  await waitLocks(2);release();await holder;
  const[change,response]=await Promise.all([writer,pending]);return{change,response};
 }finally{if(release)release();await Promise.allSettled([holder,writer,pending].filter(Boolean));}
};
(async function(){
 let other,otherCookie,otherBefore;
 try{
  captchaRequired=true;
  other=await makeTarget('other');
  const seedOther=await login(other.body);assert.equal(seedOther.status,200);otherCookie=seedOther.jar[0].token;
  otherBefore=hash(JSON.stringify(await db.adminUser.findUniqueOrThrow({where:{id:other.admin.id}})));
  await check('reset first rejects a preverified old-password request without issuing a cookie',async()=>{
   const t=await makeTarget('reset-first'),initial=await login(t.body);assert.equal(initial.status,200);
   const initialCookie=initial.jar[0].token,newPassword='New9!'+crypto.randomBytes(20).toString('hex'),newHash=await auth.hashPassword(newPassword);
   const r=await ordered(t,tx=>tx.adminUser.update({where:{id:t.admin.id},data:{passwordHash:newHash}}),{revoke:true});
   assert.equal(r.change.removed,1);assert.equal(r.response.status,401);assert.equal(r.response.jar.length,0);
   assert(!(await auth.verifyAdminSession(initialCookie)).valid);
   const old=await login(t.body),fresh=await login({...t.body,password:newPassword});
   assert.equal(old.status,401);assert.equal(fresh.status,200);assert((await auth.verifyAdminSession(fresh.jar[0].token)).valid);
  });
  await check('login first is invalidated by the following reset and new credentials still work',async()=>{
   const t=await makeTarget('login-first'),newPassword='Next9!'+crypto.randomBytes(20).toString('hex'),newHash=await auth.hashPassword(newPassword);
   const r=await ordered(t,tx=>tx.adminUser.update({where:{id:t.admin.id},data:{passwordHash:newHash}}),{order:'login-first',revoke:true});
   assert.equal(r.response.status,200);assert.equal(r.response.jar.length,1);assert.equal(r.change.removed,1);
   assert(!(await auth.verifyAdminSession(r.response.jar[0].token)).valid);
   const fresh=await login({...t.body,password:newPassword});assert.equal(fresh.status,200);
  });
  await check('enabling TOTP while an old password lookup waits requires a fresh challenge',async()=>{
   const secret=totp.generateSecret(),t=await makeTarget('totp-enable',{totpEnabled:false,totpSecret:secret});
   const r=await ordered(t,tx=>tx.adminUser.update({where:{id:t.admin.id},data:{totpEnabled:true}}));
   assert.equal(r.response.status,401);assert.equal(r.response.jar.length,0);
   const missing=await login(t.body);assert.equal(missing.status,401);assert.equal(missing.response.requires2FA,true);
   const fresh=await login({...t.body,totpToken:tokenFor(secret)});assert.equal(fresh.status,200);
   assert((await db.adminUser.findUniqueOrThrow({where:{id:t.admin.id}})).totpEnabled);
  });
  await check('rotating a TOTP secret rejects a preverified old factor and accepts the new factor',async()=>{
   const secret=totp.generateSecret(),t=await makeTarget('totp-rotate',{totpEnabled:true,totpSecret:secret});
   let nextSecret=totp.generateSecret();for(let i=0;totp.verifyToken(nextSecret,t.body.totpToken)&&i<32;i++)nextSecret=totp.generateSecret();
   assert(!totp.verifyToken(nextSecret,t.body.totpToken));
   const r=await ordered(t,tx=>tx.adminUser.update({where:{id:t.admin.id},data:{totpSecret:nextSecret}}));
   assert.equal(r.response.status,401);assert.equal(r.response.jar.length,0);
   const old=await login(t.body),fresh=await login({...t.body,totpToken:tokenFor(nextSecret)});
   assert.equal(old.status,401);assert.equal(fresh.status,200);
   const saved=await db.adminUser.findUniqueOrThrow({where:{id:t.admin.id}});assert(saved.totpEnabled);assert.equal(saved.totpSecret,nextSecret);
  });
  await check('unrelated profile and updatedAt changes do not reject an otherwise valid login',async()=>{
   const t=await makeTarget('profile');
   const r=await ordered(t,tx=>tx.adminUser.update({where:{id:t.admin.id},data:{name:'Changed synthetic profile'}}));
   assert.equal(r.response.status,200);assert.equal(r.response.jar.length,1);assert((await auth.verifyAdminSession(r.response.jar[0].token)).valid);
  });
  await check('deactivating the administrator while login waits is an authentication denial',async()=>{
   const t=await makeTarget('inactive');
   const r=await ordered(t,tx=>tx.adminUser.update({where:{id:t.admin.id},data:{isActive:false}}));
   assert.equal(r.response.status,401);assert.equal(r.response.jar.length,0);assert.equal(await db.adminSession.count({where:{adminUserId:t.admin.id}}),0);
  });
  await check('deleting the administrator while login waits does not issue a cookie or cause a foreign-key error',async()=>{
   const t=await makeTarget('deleted');
   const r=await ordered(t,tx=>tx.adminUser.delete({where:{id:t.admin.id}}));
   assert.equal(r.response.status,401);assert.equal(r.response.jar.length,0);
  });
  await check('a missing validated snapshot cannot create a session',async()=>{
   const t=await makeTarget('missing-snapshot');let code;
   try{await auth.createAdminSession(t.admin.id,auth.generateToken(t.admin.id,t.admin.username),'192.0.2.90','synthetic-missing-snapshot');}catch(e){code=e.code;}
   assert.equal(code,'ADMIN_AUTH_STATE_CHANGED');assert.equal(await db.adminSession.count({where:{adminUserId:t.admin.id}}),0);
   assert.equal((await db.adminUser.findUniqueOrThrow({where:{id:t.admin.id}})).lastLoginAt,null);
  });
  await check('other administrators retain their credential state and established session',async()=>{
   const after=await db.adminUser.findUniqueOrThrow({where:{id:other.admin.id}});
   assert.equal(hash(JSON.stringify(after)),otherBefore);assert((await auth.verifyAdminSession(otherCookie)).valid);
   assert.equal(await db.adminSession.count({where:{adminUserId:other.admin.id}}),1);
  });
  await check('unchanged enabled TOTP still rejects an invalid code and accepts the real current code',async()=>{
   const secret=totp.generateSecret(),t=await makeTarget('current-totp',{totpEnabled:true,totpSecret:secret});
   const bad=['000000','111111','222222','333333'].find(x=>!totp.verifyToken(secret,x));assert(bad);
   const failed=await login({...t.body,totpToken:bad}),valid=await login(t.body);
   assert.equal(failed.status,401);assert.equal(failed.jar.length,0);assert.equal(valid.status,200);assert((await auth.verifyAdminSession(valid.jar[0].token)).valid);
   assert.equal(await db.adminSession.count({where:{adminUserId:t.admin.id}}),1);
  });
  assert.equal(groups.length,10);assert.equal(errorCalls,0);completed=true;
 }catch(e){failure={case:currentCredentialCase,code:typeof e.code==='string'?e.code:'ASSERTION',name:e.name};process.exitCode=1;}
 finally{
  Date.now=realNow;await db.$disconnect();
  const report={checkedAt:new Date().toISOString(),completed,count:groups.length,groups,failure,sourceHashes:bindings,actualLoginPostBcryptJwtTotpAndPrisma:true,privatePostgresRowLockOrdering:true,syntheticCredentialWriter:true,syntheticCookiesAndCaptchaBoundary:true,clockControlled:true,realHttpServer:false,errorLogCalls:errorCalls,issuedCookieCount:cookieTokens.length,distinctIssuedCookies:new Set(cookieTokens).size,productionWrites:0,providerRequests:0,realMailSends:0,wholeAuditComplete:false,scope:'Actual admin auth/login/TOTP with private SQL, real crypto and row-lock queue order. Credential writer is a private fixture; owner-operated reset core is independently checked locally. No production credential change or real admin positive login acceptance.'};
  fs.writeFileSync(process.env.DOYA_SEAT_EVIDENCE_DIR+'/admin-credential-fence-results.json',JSON.stringify(report,null,2)+String.fromCharCode(10));
  console.log(JSON.stringify({completed,count:groups.length,errorLogCalls:errorCalls,failedCase:failure?.case||null}));
 }
})();
