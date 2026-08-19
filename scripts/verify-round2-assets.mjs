import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const r2a = ['seo','interview','persona','doyalist','doyaslide','cunning','promane']
const ids = ['banner','seo','interview','persona','hr','kintai','doyalist','doyaslide','cunning','promane','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
let checks = 0
const assert = (ok, message) => { checks++; if (!ok) throw new Error(message) }

for (const id of r2a) {
  for (const [file,w,h,max] of [['hero@2x.webp',3200,2000,Infinity],['hero.webp',1600,1000,300*1024],['card.webp',800,500,120*1024],['og-bg.webp',1200,630,Infinity]]) {
    const p = path.join(ROOT,'public',id,file)
    const data = await fs.readFile(p); const m = await sharp(data).metadata()
    assert(m.width === w && m.height === h, `${id}/${file}: ${m.width}x${m.height}`)
    assert(data.length <= max, `${id}/${file}: ${data.length} bytes`)
  }
}

for (const id of ids) {
  const icon = await fs.readFile(path.join(ROOT,'public',id,'icon.png'))
  const meta = await sharp(icon).metadata()
  const { data, info } = await sharp(icon).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minAlpha = 255; let maxAlpha = 0
  for (let i = 3; i < data.length; i += info.channels) { minAlpha = Math.min(minAlpha, data[i]); maxAlpha = Math.max(maxAlpha, data[i]) }
  assert(meta.width === 512 && meta.height === 512, `${id}: icon dimensions`)
  assert(icon.length <= 80*1024, `${id}: icon ${icon.length} bytes`)
  assert(minAlpha === 0 && maxAlpha >= 250, `${id}: icon alpha ${minAlpha}-${maxAlpha}`)
  const favicon = await fs.readFile(path.join(ROOT,'src/app',id,'icon.png'))
  assert(icon.equals(favicon), `${id}: favicon differs`)
  for (const file of ['1-input.webp','2-process.webp','3-output.webp']) {
    const shot = await fs.readFile(path.join(ROOT,'public',id,'shots',file)); const sm = await sharp(shot).metadata()
    assert(sm.width === 1280 && sm.height === 800, `${id}/${file}: dimensions`)
    assert(shot.length <= 80*1024, `${id}/${file}: ${shot.length} bytes`)
  }
}

for (const file of ['not-generated','zero','no-results','error','forbidden','preparing']) {
  const svg = await fs.readFile(path.join(ROOT,'public/empty',`${file}.svg`),'utf8')
  assert(svg.includes('width="400"') && svg.includes('height="320"') && !svg.includes('<text'), `${file}: invalid SVG`)
}

for (const file of ['noroi-nikki-art.jpg','yurusen-art.jpg','hitorijime-art.jpg']) {
  const meta = await sharp(path.join('/Users/mitsumori_katsuki/Code/games/doyagame-portal-live/img',file)).metadata()
  assert(meta.width === 1536 && meta.height === 1024, `${file}: dimensions`)
}

const emojiTargets = ['src/app/banner/dashboard/create/page.tsx','src/app/seo/jobs/[id]/page.tsx','src/app/banner/dashboard/page.tsx']
const emoji = /\p{Extended_Pictographic}|✓/gu
for (const file of emojiTargets) {
  const source = await fs.readFile(path.join(ROOT,file),'utf8')
  assert(!(source.match(emoji) || []).length, `${file}: emoji remains`)
}

process.stdout.write(`round2 verification passed: ${checks} checks, ${ids.length*3} shots\n`)
