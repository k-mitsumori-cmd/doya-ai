const fs=require('fs'),path=require('path');
const base=process.env.DOYA_QA_URL||'http://localhost:3107';
const ids=['','banner','seo','interview','persona','hr','kintai','doyalist','promane','doyaslide','cunning','sfa','shodan','aio','mensetsu','quote','aishodan','adimage'];
(async()=>{
 const results=[];
 for(const id of ids){
  const response=await fetch(base+'/'+id);const html=await response.text();
  const record={id:id||'top',status:response.status,renewal:html.includes('data-renewal="2026-09"'),h1Count:(html.match(/<h1[ >]/g)||[]).length,canonical:(html.match(/<link rel="canonical" href="([^"]+)/)||[])[1],noindex:/name="robots" content="[^"]*noindex/.test(html)};
  record.pass=record.status===200&&record.renewal&&record.h1Count===1&&!record.noindex&&record.canonical==='https://doya-ai.surisuta.jp'+(id?'/'+id:'');
  results.push(record);
 }
 const out={base,checkedAt:new Date().toISOString(),results,passed:results.filter(r=>r.pass).length,total:results.length};
 fs.writeFileSync(path.join(__dirname,base.includes('localhost')?'local-route-check.json':'production-route-check.json'),JSON.stringify(out,null,2));
 console.log(JSON.stringify(out));process.exitCode=out.passed===out.total?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
