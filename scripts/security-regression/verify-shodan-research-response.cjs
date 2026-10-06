const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs'),{createOrgClient}=require('./org-client-test-loader.cjs'),research=require('./shodan-research-fixture.cjs');const {isCompanyResearch}=load('src/lib/shodan/research-response.ts'),checks=[];
(async()=>{
const valid=research();let providerResult=valid;assert.equal(isCompanyResearch(valid),true);checks.push('Complete current required fields accepted');
const bad=[null,{}, {companyName:'Only'}, {...valid,url:'javascript:alert(1)'},{...valid,url:'https://name:pass@example.invalid'}, {...valid,marketing:[]},{...valid,marketing:{...valid.marketing,summary:{}}},{...valid,marketing:{...valid.marketing,snsChannels:[{}]}},{...valid,marketing:{...valid.marketing,runsAds:'yes'}},{...valid,ownedMedia:null},{...valid,ownedMedia:{...valid.ownedMedia,mediaUrls:[{}]}},{...valid,ownedMedia:{...valid.ownedMedia,articleCountEstimate:-1}},{...valid,ownedMedia:{...valid.ownedMedia,updateFrequency:'false'}},{...valid,companyName:{}},{...valid,industry:[]},{...valid,employeeCount:-1},{...valid,employeeCount:0.5},{...valid,employeeCountSource:'guess'},{...valid,ogImage:'data:text/html,foo'},{...valid,services:[{}]},{...valid,crawledUrls:[{}]},{...valid,sourceStatus:null},{...valid,sourceStatus:{homepage:'ok'}},{...valid,pressReleases:[{}]},{...valid,ownedMedia:{...valid.ownedMedia,updateFrequency:['high']}},{...valid,ownedMedia:{...valid.ownedMedia,siteScale:['large']}},{...valid,employeeCountSource:['website']},{...valid,sourceStatus:{homepage:['ok'],gbizinfo:'skipped',prtimes:'skipped'}},{...valid,sourceStatus:{homepage:'ok',gbizinfo:['ok'],prtimes:'skipped'}}];
for(const value of bad){assert.equal(isCompanyResearch(value),false);const {client}=createOrgClient('shodan',{fetch:()=>Response.json({id:'prep-a',status:'researched',research:value})});await assert.rejects(client.shodanSend('/api/shodan/preparations','alpha','POST',{url:'https://example.invalid'}),e=>e.code==='RESPONSE_UNCONFIRMED');checks.push('Malformed research rejected by actual validator and client #'+checks.length)}
const tx={$queryRaw:async()=>[{id:'org-a'}],shodanPreparation:{count:async()=>0,create:async({data})=>({id:'prep-a',...data})}},writes=[];
const api=load('src/app/api/shodan/preparations/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{$transaction:fn=>fn(tx),shodanPreparation:{update:async args=>writes.push(args)}}},'@/lib/shodan/access':{getShodanContext:async()=>({organizationId:'org-a',organizationSlug:'alpha',userId:'actor-a',memberId:'member-a',role:'owner'}),orgSlugFrom:()=> 'alpha'},'@/lib/shodan/research-response':{isCompanyResearch},'@/lib/shodan/research':{researchCompany:async()=>providerResult},'@/lib/shodan/types':load('src/lib/shodan/types.ts'),'@/lib/plan-limit':{jstStartOfMonthUtc:()=>new Date('2026-10-01T00:00:00.000Z')},'@/lib/shodan/billing':{getShodanBilling:async()=>({plan:'FREE',ownerUserId:'actor-a'})},'@/lib/unified-plan':{isPaidPlan:()=>false}});
const {client}=createOrgClient('shodan',{fetch:(_u,init)=>api.POST({json:async()=>JSON.parse(init.body)})});const result=await client.shodanSend('/api/shodan/preparations','alpha','POST',{url:'https://example.invalid'});assert.equal(result.status,'researched');assert.equal(writes.length,1);assert.equal(writes[0].where.id,'prep-a');checks.push('Actual preparations POST success is accepted by actual client contract with synthetic context/DB/research');
for (const value of bad) {
 providerResult=value;writes.length=0;
 const response=await api.POST({json:async()=>({url:'https://example.invalid'})});
 assert.equal(response.status,500);
 const body=await response.json();assert.equal(body.status,'failed');
 assert.equal(writes.length,1);assert.equal(writes[0].data.status,'failed');
 assert.equal(Object.hasOwn(writes[0].data,'research'),false);
 assert.equal(Object.hasOwn(writes[0].data,'targetName'),false);
 checks.push('Actual POST rejects malformed provider result without success persistence #'+checks.length);
}
providerResult={...valid,companyName:null,description:null,sourceStatus:{homepage:'failed',gbizinfo:'skipped',prtimes:'skipped'}};writes.length=0;
const noFacts=await api.POST({json:async()=>({url:'https://example.invalid'})});assert.equal(noFacts.status,500);assert.equal(writes[0].data.status,'failed');checks.push('Structurally valid but unavailable homepage with no facts remains a failed preparation');
let homepage='';
const engine=load('src/lib/shodan/research.ts',{
 '@/lib/net/safe-fetch':{safeFetchText:async url=>url==='https://example.invalid/'?homepage:null,htmlToText:x=>x},
 '@/lib/doyalist/collect/web-scraper':{scrapeCompanyWebsite:async()=>({companyName:'Example company',description:'Company description',services:['Consulting']})},
 '@/lib/doyalist/collect/gbizinfo':{searchGbizInfo:async()=>({status:200,companies:[]})},
});
for(const [image,expected] of [['/image.png','https://example.invalid/image.png'],['https://cdn.example.invalid/image.png','https://cdn.example.invalid/image.png'],['data:image/png;base64,AA==',null],['javascript:alert(1)',null],['https://name:pass@example.invalid/image.png',null],['http://[invalid',null]]) {
 homepage='<title>Example company</title><meta property="og:image" content="'+image+'">';
 const built=await engine.researchCompany('https://example.invalid/');
 assert.equal(built.ogImage,expected);assert.equal(built.companyName,'Example company');assert.equal(isCompanyResearch(built),true);
 providerResult=built;writes.length=0;
 const response=await api.POST({json:async()=>({url:'https://example.invalid/'})});
 assert.equal(response.status,200);assert.equal(writes[0].data.status,'researched');
 checks.push('Actual research builder retains usable company facts and normalizes optional image: '+image);
}
console.log(JSON.stringify({passed:checks.length,checks,scope:'Actual research validator/client contracts and actual POST handler; synthetic Prisma, auth, billing, research only. No live provider, DB, uploads or email; DB locking and production generation not established.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
