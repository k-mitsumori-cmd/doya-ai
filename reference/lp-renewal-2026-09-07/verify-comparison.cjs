const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path');
(async()=>{
const base=process.env.DOYA_QA_URL||'http://localhost:3107';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const checks=[];const check=(name,pass)=>checks.push({name,pass:!!pass});
await page.goto(base+'/renewal-comparison/index.html',{waitUntil:'networkidle2'});
check('18 services including top',await page.$$eval('#service option',els=>els.length===18));
await page.select('#service','banner');await page.select('#device','mobile');await page.select('#mode','swipe');
check('Mobile slider mode',await page.$eval('#comparison',e=>e.className==='mobile')&&await page.$eval('#pair',e=>getComputedStyle(e).display==='none'));
await page.$eval('#range',e=>{e.value='25';e.dispatchEvent(new Event('input',{bubbles:true}))});
check('Slider changes image clipping',await page.$eval('#newSwipe',e=>e.style.clipPath.includes('25%')));
await page.select('#mode','full');
check('Full-page before/after images selected',await page.$eval('#before',e=>e.src.endsWith('banner-mobile-full.jpg'))&&await page.$eval('#after',e=>e.src.endsWith('banner-mobile-full.jpg')));
await page.setViewport({width:390,height:844});
check('Comparison fits mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const ids=await page.$$eval('#service option',els=>els.map(e=>e.value));
const bad=[];
for(const id of ids)for(const device of ['desktop','mobile'])for(const phase of ['before','after'])for(const suffix of ['hero.webp','full.jpg']){
 const url=base+'/renewal-comparison/'+phase+'/'+id+'-'+device+'-'+suffix;
 const r=await fetch(url,{method:'HEAD'});if(r.status!==200)bad.push({url,status:r.status});
}
check('All 144 comparison images return HTTP 200',bad.length===0);
const out={base,checkedAt:new Date().toISOString(),checks,bad,passed:checks.filter(c=>c.pass).length,total:checks.length};
fs.writeFileSync(path.join(__dirname,base.includes('localhost')?'comparison-qa-local.json':'comparison-qa-production.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out));await Promise.race([browser.close(), new Promise(resolve => setTimeout(() => { browser.process()?.kill('SIGTERM'); resolve(); }, 8000))]);process.exit(out.passed===out.total?0:1);
})().catch(e=>{console.error(e);process.exitCode=1});
