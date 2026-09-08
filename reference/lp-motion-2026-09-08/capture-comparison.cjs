const fs=require('fs'),path=require('path'),crypto=require('crypto'),p=require('puppeteer-core');
const root=process.argv[2],base=process.env.DOYA_QA_URL||'https://doya-ai.surisuta.jp';
if(!root)throw Error('Pass the existing comparison artifact root');
const dest=path.join(root,'after'),resume=process.argv.includes('--resume');if(fs.existsSync(dest)&&!resume)throw Error('Preserve the existing after directory before capturing');fs.mkdirSync(dest,{recursive:true});
const refined={hr:'従業員を登録',promane:'案件を登録',persona:'商材の条件を入力',quote:'サービスURLを入力',mensetsu:'企業URLを入力',aishodan:'商材を登録',adimage:'商品URLを入力'};
const old=JSON.parse(fs.readFileSync(path.join(root,'before/manifest.json')));
const ids='top banner seo interview persona hr kintai doyalist promane doyaslide cunning sfa shodan aio mensetsu quote aishodan adimage'.split(' ');
const started=new Date().toISOString(),entries=[];let cursor=0;const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await Promise.all(Array.from({length:1},async()=>{
 const browser=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage();
 try{while(cursor<ids.length){const id=ids[cursor++];for(const [device,w,h]of [['desktop',1440,1000],['mobile',390,844]]){
  const stem=`${id}-${device}`,rec={service:id,name:old.entries.find(e=>e.service===id).name,device,viewport:[w,h],requested_url:base+(id==='top'?'/':'/'+id),captured_at:new Date().toISOString()};
  if(resume&&fs.existsSync(path.join(dest,stem+'-record.json'))){const previous=JSON.parse(fs.readFileSync(path.join(dest,stem+'-record.json')));if(previous.status==='captured'&&(!refined[id]||previous.copy_refined)){entries.push(previous);continue;}}
  try{
   await page.setViewport({width:w,height:h});await page.bringToFront();let response;for(let attempt=0;attempt<3;attempt++){response=await page.goto(rec.requested_url,{waitUntil:'networkidle2',timeout:90000});if([200,304].includes(response.status()))break;await wait(3000*(attempt+1));}if(![200,304].includes(response.status()))throw Error('HTTP '+response.status());
   await page.waitForSelector('[data-fv-motion="2026-09-08"]',{timeout:15000});await page.evaluate(()=>document.fonts.ready);if(refined[id]){const first=await page.$eval('.doya-motion-steps button',e=>e.innerText);if(!first.includes(refined[id]))throw Error('Copy refinement not deployed');rec.copy_refined=true;}await page.$$eval('.doya-renewal img',els=>els.filter(i=>!i.closest('dialog')).forEach(i=>i.loading='eager'));await wait(1800);
   await page.evaluate(()=>Promise.race([Promise.all([...document.querySelectorAll('.doya-scene-bears,.doya-output-frame.is-active img,.doya-hero-bear,.doya-header-brand img')].map(i=>i.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('Hero image decode timeout')),12000))]));
   await page.click('.doya-motion-toggle[aria-pressed="false"]');await wait(100);
   const info=await page.evaluate(()=>({url:location.href,title:document.title,width:innerWidth,height:innerHeight,pageHeight:document.documentElement.scrollHeight,pageWidth:document.documentElement.scrollWidth,renewal:!!document.querySelector('[data-renewal]'),quality:!!document.querySelector('.doya-mobile-menu'),motion:document.querySelector('[data-fv-motion]')?.getAttribute('data-fv-motion'),frame:document.querySelector('[data-scene]')?.getAttribute('data-frame'),h1Count:document.querySelectorAll('h1').length,headingSize:getComputedStyle(document.querySelector('h1')).fontSize,consultationHref:document.querySelector('.doya-consult-toggle')?.href,text:document.body.innerText}));
   if(info.pageWidth!==w||info.h1Count!==1||!info.quality)throw Error('Layout validation failed');
   Object.assign(rec,{url:info.url,title:info.title,motion_state:'Paused using the page control after entrance and hero image decode',motion_frame:info.frame});fs.writeFileSync(path.join(dest,stem+'-page.json'),JSON.stringify(info,null,2));
   await page.screenshot({path:path.join(dest,stem+'-hero.png')});
   await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=650){scrollTo(0,y);await new Promise(r=>setTimeout(r,100));}scrollTo(0,0);});
   await page.waitForFunction(()=>[...document.querySelectorAll('.doya-renewal img')].filter(i=>!i.closest('dialog')).every(i=>i.complete&&i.naturalWidth>0),{timeout:20000});await wait(300);
   await page.screenshot({path:path.join(dest,stem+'-full.png'),fullPage:true});
   rec.files=['hero','full'].map(kind=>{const name=`${stem}-${kind}.png`,data=fs.readFileSync(path.join(dest,name));return {name,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length}});rec.status='captured';
  }catch(e){rec.status='error';rec.error=e.message;}
  entries.push(rec);fs.writeFileSync(path.join(dest,stem+'-record.json'),JSON.stringify(rec,null,2));console.log(stem,rec.status,rec.error||'');
 }} }finally{await browser.close();}
}));const manifest={phase:'after',started_at:started,finished_at:new Date().toISOString(),base_url:base,viewports:{desktop:[1440,1000],mobile:[390,844]},authentication:'not logged in',faq_state:'closed',fixed_elements:'preserved',entries};fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));console.log('TOTAL',entries.length,'ERRORS',entries.filter(e=>e.status!=='captured').length);if(entries.length!==36||entries.some(e=>e.status!=='captured'))process.exitCode=1;})().catch(e=>{console.error(e);process.exit(1)});
