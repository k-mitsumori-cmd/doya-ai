// Actual public ResourcePack SSR and static HTML anchors. Filesystem-only targets;
// no browser navigation, customer data, service execution, or publishing.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const assert = require('node:assert/strict'), { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), { renderToStaticMarkup } = req('react-dom/server'), { JSDOM } = req('jsdom'), ts = req('typescript')
const { load } = req(path.join(root, 'scripts/security-regression/load-typescript.cjs'))
const plan = load('src/lib/unified-plan.ts'), services = load('src/lib/services.ts', { './unified-plan': plan })
const no = () => null
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { __esModule: true, default: no }, 'next/image': { __esModule: true, default: no },
  'lucide-react': new Proxy({}, { get: () => no }), '@/lib/services': services, '@/lib/unified-plan': plan,
  './ProductPreview': { ProductPreview: no }, './HeroMotion': { MotionContext: React.createContext(null), ServiceMotion: no },
  './OperationDemo': { DEMOS: {} }, './ServiceCinematicHero': { ServiceCinematicHero: no },
  './cinematic-scenes': { CINEMATIC_SCENES: {} }, './OpeningCurtain': { OpeningCurtain: no, OPENING_COPY: {} },
}
const file = path.join(root, 'src/components/lp/renewal/Renewal.tsx'), mod = new Module(file)
mod.filename = file; mod.require = id => id.endsWith('.css') ? {} : mocks[id] || req(id)
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, file)
const { ResourcePack, RenewalContext } = mod.exports
const names = ['overview', 'getting-started', 'checklist']
const original = ['banner','seo','interview','persona','hr','kintai','doyalist','doyaslide','cunning',
  'promane','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
const unlisted = ['tenjikai','shanai','income','expense']
const docs = new Map()
for (const name of names) {
  const target = path.join(root, 'public/resources/doya-ai', `${name}.html`)
  const dom = new JSDOM(fs.readFileSync(target, 'utf8'))
  const document = dom.window.document
  const ids = [...document.querySelectorAll('main section[id]')].map(section => section.id)
  assert.deepEqual(ids, [...original, 'asklink', 'popup'], `${name} original sections must retain order and new anchors must be unique`)
  const nav = [...document.querySelectorAll('header nav a[href^="#"]')].map(a => a.getAttribute('href').slice(1))
  assert.deepEqual(nav, ids, `${name} every local navigation anchor must resolve exactly once`)
  for (const hidden of unlisted) assert.equal(document.getElementById(hidden), null)
  for (const id of ['asklink', 'popup']) {
    const section = document.getElementById(id)
    assert.equal(document.querySelectorAll(`main section[id="${id}"]`).length, 1)
    assert.match(section.querySelector('h2').textContent, id === 'asklink' ? /質問リンク/ : /ポップアップ/)
    assert.ok(section.textContent.length > 65, `${name}#${id} needs actual service-specific content`)
    assert.equal(section.querySelector('.button').getAttribute('href'), `/${id}`)
  }
  const css = document.querySelector('style').textContent
  assert.equal(createHash('sha256').update(css).digest('hex'), 'b143e06092b953ffebae4f5fdc84602951f52bfc35d047a2d4aefb1b9ee48d5d', 'responsive and print CSS is unchanged')
  docs.set(name, dom)
}
let checked = 0
for (const svc of services.getPublicServices()) {
  const html = renderToStaticMarkup(React.createElement(RenewalContext.Provider, { value: svc.name }, React.createElement(ResourcePack)))
  const links = new JSDOM(html)
  const anchors = [...links.window.document.querySelectorAll('a.doya-resource')]
  assert.equal(anchors.length, 3)
  for (const anchor of anchors) {
    const url = new URL(anchor.getAttribute('href'), 'https://example.invalid')
    const name = path.basename(url.pathname, '.html')
    assert.ok(docs.has(name), `${svc.id} unexpected document ${name}`)
    assert.equal(decodeURIComponent(url.hash.slice(1)), svc.id)
    assert.equal(docs.get(name).window.document.querySelectorAll(`main section[id="${svc.id}"]`).length, 1,
      `${svc.id} ${name} public href must resolve to exactly one section`)
    checked++
  }
  links.window.close()
}
for (const dom of docs.values()) dom.window.close()
assert.equal(checked, 54)
console.log(`PASS actual ResourcePack ${checked} public hrefs resolve once; 3 document navs, original 17 sections, 4 unlisted exclusions and responsive/print CSS preserved`)
