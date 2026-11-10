const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=process.env.DOYA_ADMIN_GOOGLE_BASELINE||root,baseline=process.argv.includes('--baseline'),dep=n=>require(path.join(base,'node_modules',n)),ts=dep('typescript'),jwt=dep('jsonwebtoken'),hashes={},rows=[];
function text(file,old=false){const p=old||!fs.existsSync(path.join(root,file))?path.join(base,file):path.join(root,file),b=fs.readFileSync(p);hashes[file]=crypto.createHash('sha256').update(b).digest('hex');return b.toString()}
function compile(file,imports,extra={},old=false){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(text(file,old),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>{assert(Object.hasOwn(imports,n),'Unexpected import '+n);return imports[n]},console,Date,URL,...extra},{filename:file});return mod.exports}
const policy=compile('src/lib/admin-google-policy.ts',{}),options={syntheticGoogleOptions:true};
const secret='synthetic-admin-google-policy-test-only';const token=jwt.sign({adminUserId:'admin-synthetic',username:'admin',type:'admin'},secret,{expiresIn:'1h'});
let current,googleCalls=0,cookieDeletes=0,cookieToken=token;
const google=compile('src/lib/admin-google-session.server.ts',{'next-auth':{getServerSession:async arg=>{googleCalls++;assert.equal(arg,options);if(current.googleThrows)throw Error('Synthetic session failure');return current.google}},'./auth':{authOptions:options},'./admin-google-policy':policy});
const prisma={adminUser:{findUnique:async q=>{assert.equal(q.where.id,'admin-synthetic');return current.adminMissing?null:{id:'admin-synthetic',username:'admin',email:'admin@synthetic.invalid',name:'Synthetic',isActive:!current.adminInactive}}},adminSession:{findFirst:async q=>{assert.equal(q.where.token,token);assert.equal(q.where.adminUserId,'admin-synthetic');assert(q.where.expiresAt.gt instanceof Date);return current.sessionMissing||current.expired?null:{id:'session-synthetic'}}}};
const core=compile('src/lib/admin-auth.ts',{'bcryptjs':dep('bcryptjs'),'jsonwebtoken':jwt,'node:crypto':require('node:crypto'),'./prisma':{prisma},'./admin-google-session.server':google},{process:{env:{NODE_ENV:'test',ADMIN_JWT_SECRET:secret}}},baseline);
const cookies=async()=>({get:name=>{assert.equal(name,core.COOKIE_NAME);return cookieToken?{value:cookieToken}:undefined},delete:name=>{assert.equal(name,core.COOKIE_NAME);cookieDeletes++}});
const NextResponse={json:(value,init)=>new Response(JSON.stringify(value),{...init,headers:{'content-type':'application/json',...init?.headers}})};
const imports={'next/server':{NextResponse},'next/headers':{cookies},'@/lib/admin-auth':core};
const route=compile('src/app/api/admin/auth/session/route.ts',imports,{},baseline),guard=compile('src/lib/admin-guard.ts',imports,{},true);
async function check(name,fn){try{await fn();rows.push({name,passed:true})}catch(e){rows.push({name,passed:false,error:e.message.slice(0,200)})}}
(async()=>{
for(const [name,email,allowed] of [['lowercase','member@surisuta.jp',true],['uppercase-domain','member@SURISUTA.JP',true],['plus-tag','member+test@surisuta.jp',true],['external-domain','member@example.com',false],['suffix','member@surisuta.jp.example.com',false],['subdomain','member@sub.surisuta.jp',false],['two-at','member@evil@surisuta.jp',false],['leading-space',' member@surisuta.jp',false],['trailing-space','member@surisuta.jp ',false],['missing-local','@surisuta.jp',false],['null',null,false],['object',{email:'member@surisuta.jp'},false]])await check('domain '+name,()=>assert.equal(policy.isAdminGoogleEmail(email),allowed));
const cases=[
{name:'both sessions',google:{user:{email:'member@surisuta.jp'}},valid:true},
{name:'uppercase domain',google:{user:{email:'member@SURISUTA.JP'}},valid:true},
{name:'password only',google:null,valid:false,googleRequired:true},
{name:'external Google',google:{user:{email:'member@example.com'}},valid:false,googleRequired:true},
{name:'Google error',googleThrows:true,valid:false,googleRequired:true},
{name:'Google missing email',google:{user:{}},valid:false,googleRequired:true},
{name:'Google malformed domain',google:{user:{email:'member@evil@surisuta.jp'}},valid:false,googleRequired:true},
{name:'missing admin token',google:{user:{email:'member@surisuta.jp'}},noToken:true,valid:false},
{name:'invalid admin token',google:{user:{email:'member@surisuta.jp'}},invalidToken:true,valid:false},
{name:'deleted admin',google:{user:{email:'member@surisuta.jp'}},adminMissing:true,valid:false},
{name:'inactive admin',google:{user:{email:'member@surisuta.jp'}},adminInactive:true,valid:false},
{name:'missing DB admin session',google:{user:{email:'member@surisuta.jp'}},sessionMissing:true,valid:false},
{name:'expired DB admin session',google:{user:{email:'member@surisuta.jp'}},expired:true,valid:false},
];
for(const spec of cases){current=spec;cookieToken=spec.noToken?null:spec.invalidToken?'bad-token':token;googleCalls=0;
 await check('guard core '+spec.name,async()=>{const result=await core.verifyAdminSession(cookieToken);assert.equal(result.valid,spec.valid);assert.equal(result.googleRequired===true,spec.googleRequired===true);if(!spec.valid)assert(!result.adminUser,'Unauthorized admin details');if(!spec.valid&&!spec.googleRequired)assert.equal(googleCalls,0,'Google read before admin proof')});
 await check('requireAdmin '+spec.name,async()=>{const denied=await guard.requireAdmin();assert.equal(denied===null,spec.valid);if(denied)assert.equal(denied.status,401)});
 cookieDeletes=0;await check('session API '+spec.name,async()=>{const response=await route.GET(new Request('https://synthetic.invalid/api/admin/auth/session'));const body=await response.json();assert.equal(response.status,spec.valid?200:401);assert.equal(body.authenticated,spec.valid);assert.equal(body.googleRequired===true,spec.googleRequired===true);if(!spec.valid)assert(!body.adminUser,'Admin identity leaked before both sessions');if(spec.googleRequired)assert.equal(cookieDeletes,0,'Password cookie lost during Google login');assert.match(response.headers.get('cache-control')||'',/private.*no-store/);assert.match(response.headers.get('vary')||'',/Cookie/)});
}
const report={checkedAt:new Date().toISOString(),baseline,cases:rows.length,failed:rows.filter(x=>!x.passed).length,rows,sourceHashes:hashes,databaseRequests:0,providerRequests:0,productionWrites:0,scope:'Actual domain policy, admin JWT verifier, requireAdmin and session GET compiled with synthetic DB/session provider/cookies; JWT library actual. Not real Google OAuth, real database or browser acceptance.'};
if(process.env.DOYA_ADMIN_GOOGLE_RESULT)fs.writeFileSync(process.env.DOYA_ADMIN_GOOGLE_RESULT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseline,cases:report.cases,failed:report.failed,failures:rows.filter(x=>!x.passed)}));if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
