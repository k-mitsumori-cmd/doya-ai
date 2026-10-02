const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/aio/pricing/page.tsx'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText
let context = null
let billing = null
let contextReads = 0
let priceProps = null
const pageExports = {}
const mocks = {
  'react/jsx-runtime': require('react/jsx-runtime'),
  'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
  '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: props => { priceProps = props; return React.createElement('div', { 'data-pricing': true }) } },
  '@/components/aio/ui': { DoyaKun: () => null },
  '@/lib/aio/access': { getAioContext: async () => { contextReads++; return context } },
  '@/lib/aio/billing': { getAioBilling: async () => billing },
  '@/lib/prisma': { prisma: {} },
}
vm.runInNewContext(compiled, { exports: pageExports, require: name => {
  if (name in mocks) return mocks[name]
  throw new Error(`Unmocked ${name}`)
} })

async function render(org) {
  priceProps = null
  const element = await pageExports.default({ searchParams: Promise.resolve(org === undefined ? {} : { org }) })
  return renderToStaticMarkup(element)
}

;(async () => {
  const publicHtml = await render()
  assert.equal(contextReads, 0)
  assert.equal(priceProps.planSource, 'account')
  assert.equal(priceProps.canPurchase, true)
  assert.ok(publicHtml.includes('料金プラン'))

  context = { organizationId: 'org', role: 'member' }
  billing = { plan: 'FREE' }
  const memberHtml = await render('workspace')
  assert.equal(priceProps.currentPlan, 'FREE')
  assert.equal(priceProps.planSource, 'organization')
  assert.equal(priceProps.canPurchase, false)
  assert.ok(memberHtml.includes('ご自身のプランを購入しても、この組織の利用枠は増えません'))
  assert.ok(memberHtml.includes('href="/aio/workspace"'))

  billing = { plan: 'PRO' }
  await render('workspace')
  assert.equal(priceProps.currentPlan, 'PRO')
  assert.equal(priceProps.canPurchase, false)

  context = { organizationId: 'org', role: 'owner' }
  billing = { plan: 'FREE' }
  const ownerHtml = await render('workspace')
  assert.equal(priceProps.canPurchase, true)
  assert.equal(priceProps.currentPlan, 'FREE')
  assert.ok(!ownerHtml.includes('ご自身のプランを購入しても'))

  context = null
  const foreignHtml = await render('foreign')
  assert.equal(priceProps, null)
  assert.ok(foreignHtml.includes('契約情報を確認できません'))

  const emptyHtml = await render('')
  assert.equal(priceProps, null)
  assert.ok(emptyHtml.includes('契約情報を確認できません'))

  context = { organizationId: 'org', role: 'member' }
  billing = null
  const unavailableHtml = await render('workspace')
  assert.equal(priceProps, null)
  assert.ok(unavailableHtml.includes('契約情報を確認できません'))
  console.log('PASS AIO pricing keeps organization billing context and blocks member purchase path')
})().catch(error => { console.error(error); process.exitCode = 1 })
