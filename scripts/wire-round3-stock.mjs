import fs from 'node:fs/promises'

const targets = {
  banner: 'src/app/banner/landing/page.tsx', hr: 'src/app/hr/page.tsx', kintai: 'src/app/kintai/page.tsx',
  sfa: 'src/app/sfa/Lp.tsx', shodan: 'src/app/shodan/Lp.tsx', aio: 'src/app/aio/Lp.tsx',
  mensetsu: 'src/app/mensetsu/Lp.tsx', quote: 'src/app/quote/Lp.tsx', aishodan: 'src/app/aishodan/Lp.tsx',
  adimage: 'src/app/adimage/Lp.tsx', seo: 'src/app/seo/Lp.tsx', interview: 'src/app/interview/Lp.tsx',
  persona: 'src/app/persona/Lp.tsx', doyalist: 'src/app/doyalist/Lp.tsx', doyaslide: 'src/app/doyaslide/Lp.tsx',
  cunning: 'src/app/cunning/Lp.tsx', promane: 'src/app/promane/PromaneLp.tsx',
}

for (const [service, file] of Object.entries(targets)) {
  let source = await fs.readFile(file, 'utf8')
  const start = source.indexOf('const ROWS: ShowcaseRow[] = [')
  const end = source.indexOf('\n]', start)
  if (start < 0 || end < 0) throw new Error(`${file}: ROWS not found`)
  let rows = source.slice(start, end + 2)
  if (rows.includes(`/${service}/shots/`)) continue
  let index = 0
  rows = rows.replace(/visual: (<MockWindow[^\n]+?<\/MockWindow>)/g, (full, visual, offset) => {
    const preceding = rows.slice(0, offset)
    const titles = [...preceding.matchAll(/title: '([^']+)'/g)]
    const title = titles.at(-1)?.[1] || `機能画面 ${index + 1}`
    const slug = ['input', 'process', 'output'][index]
    index += 1
    return `visual: ${visual}, image: { src: '/${service}/shots/${index}-${slug}.webp', alt: '${title}の画面' }`
  })
  if (index !== 3) throw new Error(`${file}: expected 3 rows, found ${index}`)
  await fs.writeFile(file, source.slice(0, start) + rows + source.slice(end + 2))
  process.stdout.write(`${service}: wired ${index} shots\n`)
}
