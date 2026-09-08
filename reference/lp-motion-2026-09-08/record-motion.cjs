const p=require('puppeteer-core'),fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const base=process.env.DOYA_QA_URL||'https://doya-ai.surisuta.jp';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'doya-motion-record-'));
const out=path.resolve(__dirname,'../../public/renewal-comparison/motion');
(async()=>{fs.mkdirSync(out,{recursive:true});const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});const page=await b.newPage();const records=[];
for(const id of ['top','banner'])for(const [device,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewport({width,height});await page.goto(base+(id==='top'?'/':'/'+id),{waitUntil:'networkidle2'});
  if(!await page.$('[data-fv-motion="2026-09-08"]'))throw Error('Motion release missing');
  await page.evaluate(()=>document.fonts.ready);await page.reload({waitUntil:'domcontentloaded'});
  const name=`${id}-${device}.webm`;const recorder=await page.screencast({path:path.join(temp,name),fps:30,quality:30,scale:device==='desktop'?.8:1,ffmpegPath:'/opt/homebrew/bin/ffmpeg'});
  await new Promise(r=>setTimeout(r,14000));await recorder.stop();execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-i',path.join(temp,name),'-c','copy',path.join(out,name)],{stdio:'ignore'});records.push({id,device,viewport:[width,height],url:page.url(),file:name,bytes:fs.statSync(path.join(out,name)).size});console.log(name,records.at(-1).bytes);
}fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({base,capturedAt:new Date().toISOString(),kind:'Actual unauthenticated LP browser recording, no audio',records},null,2));await b.close();fs.rmSync(temp,{recursive:true});})().catch(e=>{console.error(e);process.exit(1)});
