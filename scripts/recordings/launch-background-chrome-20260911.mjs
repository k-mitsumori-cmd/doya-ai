import puppeteer from 'puppeteer-core'
const browser=await puppeteer.launch({
 executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 userDataDir:'/Users/mitsumori_katsuki/.codex/browser-profiles/doyamarke-filming-background-0911',
 headless:false,defaultViewport:null,
 args:['--remote-debugging-port=55510','--profile-directory=Default','--window-size=1440,901','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],
})
const page=(await browser.pages())[0]||await browser.newPage()
await page.goto('https://doya-ai.vercel.app/banner/dashboard',{waitUntil:'domcontentloaded'})
console.log('DEDICATED_CHROME_READY port=55510 pid='+browser.process().pid)
await new Promise(resolve=>browser.on('disconnected',resolve))
