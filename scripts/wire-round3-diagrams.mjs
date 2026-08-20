import fs from 'node:fs/promises'
import path from 'node:path'

const targets = {
  banner: ['src/app/banner/landing/page.tsx', 'ドヤバナーAI', '#00e0ff'], hr: ['src/app/hr/page.tsx', 'ドヤHR', '#009bff'],
  kintai: ['src/app/kintai/page.tsx', 'ドヤ勤怠', '#00e0ff'], sfa: ['src/app/sfa/Lp.tsx', 'ドヤ営業管理', '#009bff'],
  shodan: ['src/app/shodan/Lp.tsx', 'ドヤ商談準備', '#ffd400'], aio: ['src/app/aio/Lp.tsx', 'ドヤAIO', '#00e0ff'],
  mensetsu: ['src/app/mensetsu/Lp.tsx', 'ドヤ面接官', '#ff1e72'], quote: ['src/app/quote/Lp.tsx', 'ドヤ見積もりAI', '#ffd400'],
  aishodan: ['src/app/aishodan/Lp.tsx', 'ドヤAI商談', '#00e0ff'], adimage: ['src/app/adimage/Lp.tsx', 'ドヤ広告画像AI', '#ff1e72'],
  seo: ['src/app/seo/Lp.tsx', 'ドヤSEO', '#00e0ff'], interview: ['src/app/interview/Lp.tsx', 'ドヤインタビュー', '#ff1e72'],
  persona: ['src/app/persona/Lp.tsx', 'ドヤペルソナAI', '#009bff'], doyalist: ['src/app/doyalist/Lp.tsx', 'ドヤリスト', '#ffd400'],
  doyaslide: ['src/app/doyaslide/Lp.tsx', 'ドヤスライド', '#00e0ff'], cunning: ['src/app/cunning/Lp.tsx', 'ドヤカンニング', '#ff1e72'],
  promane: ['src/app/promane/PromaneLp.tsx', 'ドヤプロマネ', '#009bff'],
}

for (const [id, [file, name, accent]] of Object.entries(targets)) {
  const diagramFile = path.join(path.dirname(file), 'diagram.tsx')
  await fs.writeFile(diagramFile, `import { ServiceFlowDiagram, type Step } from '@/components/lp'\n\nexport default function ${id[0].toUpperCase() + id.slice(1)}Diagram({ steps }: { steps: Step[] }) {\n  return <ServiceFlowDiagram serviceName="${name}" steps={steps} accent="${accent}" mood="point" />\n}\n`)
  let source = await fs.readFile(file, 'utf8')
  if (!source.includes("from './diagram'")) {
    const insertAt = source.indexOf('\n', source.indexOf("from './mocks'")) + 1
    source = source.slice(0, insertAt) + `import ServiceDiagram from './diagram'\n` + source.slice(insertAt)
  }
  source = source.replace(/ diagram=\{<ServiceDiagram steps=\{STEPS\} \/>\}/g, '')
  const howItWorks = source.indexOf('<HowItWorks')
  const stepsProp = source.indexOf('steps={STEPS}', howItWorks)
  if (howItWorks < 0 || stepsProp < 0) throw new Error(`${file}: HowItWorks steps prop not found`)
  source = source.slice(0, stepsProp) + 'steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />}' + source.slice(stepsProp + 'steps={STEPS}'.length)
  await fs.writeFile(file, source)
  process.stdout.write(`${name}: diagram wired\n`)
}
