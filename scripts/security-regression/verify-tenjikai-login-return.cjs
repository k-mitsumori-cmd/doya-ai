// Actual LP render and login callback; synthetic navigation/service metadata/LP chrome only.
process.env.NODE_ENV = 'test'
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
let current
const anchor = ({ ctaHref, children }) => React.createElement('div', null,
  ctaHref ? React.createElement('a', { href: ctaHref }, 'ログイン') : null, children)
function load(file) {
  const exports = {}
  const mocks = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': {
      usePathname: () => current.pathname,
      useSearchParams: () => new URLSearchParams(current.search),
    },
    '@/components/lp': Object.fromEntries(['LpShell', 'ProductHero', 'FeatureShowcase', 'HowItWorks', 'UseCases', 'FaqSection', 'CtaBand'].map(key => [key, anchor])),
    '@/lib/services': { getServiceById: () => ({ name: 'ドヤ展示会', pricing: { free: { limit: '合成枠' }, pro: { limit: '合成枠' } } }) },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, URLSearchParams, require(name) {
    if (name in mocks) return mocks[name]
    if (name === '@/lib/tenjikai/login-return') return load('src/lib/tenjikai/login-return.ts')
    throw Error('Unmocked ' + name)
  } }, { filename: file })
  return exports
}
const cases = [
  ['/tenjikai', '/tenjikai'],
  ['/tenjikai?project=P', '/tenjikai?project=P'],
  ['/tenjikai/docs?project=P', '/tenjikai/docs?project=P'],
  ['/tenjikai/budget?project=%E6%97%A5%E6%9C%AC%E8%AA%9E%2F%3F%26', '/tenjikai/budget?project=%E6%97%A5%E6%9C%AC%E8%AA%9E%2F%3F%26'],
  ['/tenjikai/overview?project=P&project=Q', '/tenjikai/overview?project=P&project=Q'],
  ['/tenjikai/docs?project=', '/tenjikai/docs?project='],
]
for (const [input, expected] of cases) test('actual LP preserves return: ' + input, () => {
  current = new URL(input, 'https://example.invalid')
  const Lp = load('src/app/(shell)/tenjikai/Lp.tsx').default
  const html = renderToStaticMarkup(React.createElement(Lp))
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&'), 'https://example.invalid'))
  assert.equal(links.length, 3, 'header, hero and footer CTAs')
  for (const url of links) {
    assert.equal(url.origin, 'https://example.invalid')
    assert.equal(url.pathname, '/auth/signin')
    assert.equal(url.searchParams.get('callbackUrl'), expected)
  }
})
test('callback helper cannot return another service or external origin', () => {
  const helper = load('src/lib/tenjikai/login-return.ts').tenjikaiLoginHref
  for (const pathname of ['https://evil.invalid', '//evil.invalid', '/asklink', '/tenjikai/../asklink', '/tenjikai-unrelated']) {
    const url = new URL(helper(pathname, new URLSearchParams()), 'https://example.invalid')
    assert.equal(url.searchParams.get('callbackUrl'), '/tenjikai')
  }
})
