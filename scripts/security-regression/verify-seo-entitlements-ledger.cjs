const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('./load-typescript.cjs');
const unified=load('src/lib/unified-plan.ts');
const pricing=load('src/lib/pricing.ts',{'./unified-plan':unified});
const access=load('src/lib/seoAccess.ts',{'next/server':{},'@/lib/pricing':pricing});
const source='src/app/api/seo/entitlements/route.ts';const results=[];
function fixture({plan='FREE',guest=false,used=3,failure=null,guestCookie=false}={}){
 let usageCalls=0;const db={seoArticle:{count:async()=>0}};
 const api=load(source,{
  'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>{if(failure==='auth')throw Error('PRIVATE_AUTH_SECRET');return guest?null:{user:{id:'synthetic',plan,firstLoginAt:new Date().toISOString()}}}},
  '@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{if(failure==='schema')throw Error('PRIVATE_SCHEMA_SECRET')}},
  '@/lib/seoAccess':access,'@/lib/seo-article-admission':{getSeoArticleMonthlyUsage:async()=>{usageCalls++;if(failure==='usage')throw Error('PRIVATE_DATABASE_SECRET');return used}},
 });return{api,req:{cookies:{get:()=>guestCookie?{value:'synthetic-guest'}:undefined}},usage:()=>usageCalls};
}
(async()=>{
 const cases=[['guest without cookie',{guest:true}],['guest with existing cookie',{guest:true,guestCookie:true}],['FREE exhausted',{used:3}],['LIGHT partly used',{plan:'LIGHT',used:4}],['PRO partly used',{plan:'PRO',used:4}],['ENTERPRISE partly used',{plan:'ENTERPRISE',used:4}],['schema unavailable',{failure:'schema'}],['authentication unavailable',{failure:'auth'}],['usage unavailable',{failure:'usage'}]];
 for(const [name,options] of cases){try{const f=fixture(options),response=await f.api.GET(f.req),body=await response.json();assert.equal(response.status,options.failure?503:200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok((response.headers.get('vary')||'').toLowerCase().split(',').map(x=>x.trim()).includes('cookie'));assert.equal(JSON.stringify(body).includes('PRIVATE_'),false);
  if(options.failure)assert.equal(body.success,false);else{assert.equal(body.trial.active,false);assert.equal(body.isLoggedIn,!options.guest);const limit=options.guest?0:access.seoMonthlyArticleLimit(options.plan||'FREE');assert.equal(body.limits.articlesPerMonth,limit);assert.equal(body.usage.articlesThisMonth,options.guest?0:options.used??3);assert.equal(body.remaining.articles,options.guest?0:Math.max(0,limit-(options.used??3)));assert.equal(f.usage(),options.guest?0:1)}results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
 assert.equal(results.length,9);const report={checkedAt:new Date().toISOString(),expected:9,passed:results.filter(x=>x.passed).length,cases:results,source,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(process.env.DOYA_TEST_BASELINE&&fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,source))?path.join(process.env.DOYA_TEST_BASELINE,source):source)).digest('hex'),scope:'Actual entitlement route, pricing and access helpers with synthetic auth/usage/schema boundaries. Checks private cache policy on guest/FREE/LIGHT/PRO/ENTERPRISE success and503 schema/auth/usage paths, plus existing ledger response/outage/recent-login invariants. No production/customer writes.'};
 const b=path.resolve('docs/audits/2026-10-06-all-services-recheck');fs.mkdirSync(b,{recursive:true});fs.writeFileSync(path.join(b,'seo-entitlements-cache-'+(process.env.DOYA_TEST_BASELINE?'overlay':'integrated')+'-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.passed===9?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
