import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const ids = ['banner','seo','interview','persona','hr','kintai','doyalist','doyaslide','cunning','promane','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
const lpFiles = { banner: 'src/app/banner/landing/page.tsx', hr: 'src/app/hr/page.tsx', kintai: 'src/app/kintai/page.tsx', promane: 'src/app/promane/PromaneLp.tsx' }
const samples = ['cat-telecom','cat-marketing','cat-ec','cat-recruit','cat-beauty','cat-food','cat-realestate','cat-education','cat-finance','cat-health','cat-it','cat-other','purpose-sns_ad','purpose-youtube','purpose-display','purpose-webinar','purpose-lp_hero','purpose-email','purpose-campaign','size-1080x1080','size-1200x628','size-1080x1920','size-1280x720','size-1920x1080','size-300x250','size-728x90','size-320x50','size-1920x600','size-1200x800','size-600x200','size-600x300']
let checks = 0
const assert = (condition, message) => { checks += 1; if (!condition) throw new Error(message) }

for (const name of samples) {
  const file = path.join(ROOT, 'public/banner-samples', `${name}.webp`)
  const data = await fs.readFile(file)
  const meta = await sharp(data).metadata()
  assert(meta.width === 1200 && meta.height === 628, `${name}: ${meta.width}x${meta.height}`)
  assert(data.length <= 80 * 1024, `${name}: ${data.length} bytes`)
}

for (const id of ids) {
  const diagram = await fs.readFile(path.join(ROOT, 'src/app', id === 'banner' ? 'banner/landing/diagram.tsx' : `${id}/diagram.tsx`), 'utf8')
  assert(diagram.includes('ServiceFlowDiagram'), `${id}: diagram missing`)
  const lpFile = lpFiles[id] || `src/app/${id}/Lp.tsx`
  const source = await fs.readFile(path.join(ROOT, lpFile), 'utf8')
  assert((source.match(new RegExp(`/${id}/shots/[123]-(?:input|process|output)\\.webp`, 'g')) || []).length === 3, `${id}: screenshots not wired`)
  assert(source.includes('diagram={<ServiceDiagram steps={STEPS} />}'), `${id}: diagram not wired`)
}

for (const file of ['src/app/banner/dashboard/history/page.tsx','src/app/doyaslide/projects/page.tsx','src/app/quote/Tool.tsx','src/app/seo/jobs/[id]/page.tsx']) {
  const source = await fs.readFile(path.join(ROOT, file), 'utf8')
  assert(source.includes('<EmptyState'), `${file}: EmptyState missing`)
}

const svgRefs = []
for (const root of ['src/app/banner/dashboard/create/page.tsx','src/app/api/seo/template/image/category/[category]/route.ts','src/app/api/swipe/question-images/route.ts']) {
  const source = await fs.readFile(path.join(ROOT, root), 'utf8')
  if (/banner-samples\/(?:cat|purpose|size)-[^'" )]+\.svg/.test(source)) svgRefs.push(root)
}
assert(svgRefs.length === 0, `old SVG references: ${svgRefs.join(', ')}`)
process.stdout.write(`round3 verification passed: ${checks} checks\n`)
