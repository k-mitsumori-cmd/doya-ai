const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/kintai/pricing' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const { act } = React
const sourceRoot = process.env.KINTAI_PRICING_SOURCE_ROOT || process.cwd()
let reply = null
let identity = 'u1'
let sessionStatus = 'authenticated'
let pricingRenders = 0
let reads = 0
let clicked = null
const source = fs.readFileSync(`${sourceRoot}/src/app/(shell)/kintai/pricing/page.tsx`, 'utf8')
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
} }).outputText
const moduleRef = { exports: {} }
vm.runInNewContext(code, {
  module: moduleRef, exports: moduleRef.exports, console, Error,
  require: name => {
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
    if (name === 'next/link') return { default: ({ href, children, onClick, ...props }) => React.createElement('a', {
      href, ...props, onClick: event => { event.preventDefault(); clicked = href; onClick?.(event) },
    }, children) }
    if (name === 'next-auth/react') return { useSession: () => ({ status: sessionStatus, data: sessionStatus === 'authenticated' ? { user: { id: identity } } : null }) }
    if (name === '@/components/UnifiedPricingPlans') return { UnifiedPricingPlans: () => { pricingRenders++; return React.createElement('div', { 'data-testid': 'plans' }) } }
    throw Error(`unmocked ${name}`)
  },
  fetch: async (url, init) => { assert.equal(url, '/api/kintai/usage'); assert.equal(init.cache, 'no-store'); reads++; return reply },
}, { filename: 'kintai/pricing/page.tsx' })
const Page = moduleRef.exports.default

async function renderCase(label, currentReply, status = 'authenticated') {
  reply = currentReply
  sessionStatus = status
  identity = `u-${label}`
  reads = pricingRenders = 0
  clicked = null
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(Page)); await new Promise(resolve => setTimeout(resolve, 0)) })
  const link = [...document.querySelectorAll('a')].find(a => a.textContent.includes('勤怠ダッシュボードに戻る'))
  assert.ok(link, `${label}: visible dashboard return independent of plan state`)
  assert.equal(link.getAttribute('href'), '/kintai/dashboard')
  await act(async () => { link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
  assert.equal(clicked, '/kintai/dashboard')
  await act(async () => root.unmount())
  console.log(`${label}: dashboard return; reads=${reads}; plans=${pricingRenders}`)
  return { reads, pricingRenders }
}

;(async () => {
  const ok = body => ({ ok: true, json: async () => body })
  const loading = await renderCase('loading', new Promise(() => {}), 'loading')
  assert.equal(loading.reads, 0)
  const failed = await renderCase('failed', { ok: false })
  assert.equal(failed.pricingRenders, 0)
  const free = await renderCase('free', ok({ organizationId: null }))
  assert.equal(free.pricingRenders, 1)
  const nonOwner = await renderCase('non-owner', ok({ organizationId: 'orgA', plan: 'FREE', canManageBilling: false }))
  assert.equal(nonOwner.pricingRenders, 0)
  const owner = await renderCase('owner', ok({ organizationId: 'orgA', plan: 'PRO', canManageBilling: true }))
  assert.equal(owner.pricingRenders, 1)
  console.log('Kintai pricing return: 5/5 passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
