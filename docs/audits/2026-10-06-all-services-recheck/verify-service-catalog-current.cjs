const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
(async()=>{
 const origin='https://doya-ai.surisuta.jp',base='docs/audits/2026-10-06-all-services-recheck/';
 const services=load('src/lib/services.ts',{'./unified-plan':{UNIFIED_PRO_PRICE:9980}});
 const expected=['banner','seo','interview','persona','hr','kintai','doyalist','promane','doyaslide','cunning','sfa','shodan','aio','mensetsu','quote','aishodan','adimage'].sort();
 const publicServices=services.getPublicServices(),active=services.getActiveServices();
 assert.deepEqual([...publicServices.map(x=>x.id)].sort(),expected);assert.deepEqual([...active.map(x=>x.id)].sort(),expected);
 assert.equal(new Set(services.SERVICES.map(x=>x.id)).size,services.SERVICES.length);
 for(const id of services.RETIRED_SERVICE_IDS){assert(!services.isServiceAvailable(id));assert(!publicServices.some(s=>s.id===id));assert(!active.some(s=>s.id===id))}
 const sitemap=load('src/app/sitemap.ts',{'@/lib/services':services,'@/lib/seo':{SITE_CONFIG:{url:origin}}}).default();
 const llms=load('src/app/llms.txt/route.ts',{'@/lib/services':services,'@/lib/seo':{SITE_CONFIG:{url:origin}}}).GET();
 const localLLMS=await llms.text();const sourceEntries=[];
 for(const service of publicServices){assert(sitemap.some(x=>x.url===origin+service.href));assert(localLLMS.includes(`](${origin}${service.href})`));sourceEntries.push({id:service.id,href:service.href,available:services.isServiceAvailable(service.id),localSitemap:true,localLlms:true})}
 for(const id of services.RETIRED_SERVICE_IDS){assert(!sitemap.some(x=>new URL(x.url).pathname.split('/')[1]===id));assert(!localLLMS.includes(`](${origin}/${id})`))}
 const live=[];for(const path of ['/','/sitemap.xml','/llms.txt']){const response=await fetch(origin+path,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200,path);const text=await response.text();assert(Buffer.byteLength(text)<2*1024*1024);live.push({path,status:response.status,text})}
 const liveEntries=sourceEntries.map(entry=>({id:entry.id,homeLink:live[0].text.includes(`href="${entry.href}"`),sitemap:live[1].text.includes(`<loc>${origin}${entry.href}</loc>`),llms:live[2].text.includes(`](${origin}${entry.href})`)}));
 assert(liveEntries.every(x=>x.homeLink&&x.sitemap&&x.llms));
 const files=['src/lib/services.ts','src/app/sitemap.ts','src/app/llms.txt/route.ts','src/components/lp/renewal/Renewal.tsx'];const result={checkedAt:new Date().toISOString(),passed:true,activeCount:active.length,publicCount:publicServices.length,retiredCount:services.RETIRED_SERVICE_IDS.size,sourceEntries,liveEntries,publicEndpoints:live.map(({path,status})=>({path,status})),sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual service catalog/sitemap/llms handlers plus anonymous read-only home/sitemap/llms. Proves source lists agree with17 service public links and exclude retired IDs locally. Does not prove retired generation API rejection or authenticated navigation/operation.'};
 fs.writeFileSync(base+'service-catalog-current.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,activeCount:result.activeCount,publicCount:result.publicCount,retiredCount:result.retiredCount,liveEntries}));
})().catch(error=>{console.error(error);process.exitCode=1});
