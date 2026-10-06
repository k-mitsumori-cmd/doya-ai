const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { load } = require('./load-typescript.cjs')
const { renderToStaticMarkup } = require('react-dom/server')

const source = fs.readFileSync(path.resolve(__dirname, '../../src/components/UnifiedPricingPlans.tsx'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText
let personalPlan = 'PRO'
let checkoutCount = 0
const service = { id: 'aio', name: 'ドヤAIO', order: 1, dashboardHref: '/aio',
  pricing: { free: { limit: '週1回' }, pro: { limit: '月30回' } }, features: [] }
const empty = () => null
const pageExports = {}
const mocks = {
  'react/jsx-runtime': require('react/jsx-runtime'),
  react: React,
  'next-auth/react': { useSession: () => ({ data: { user: { id: 'synthetic-owner', plan: personalPlan } }, status: 'authenticated' }) },
  'next/link': ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children),
  'next/navigation': { usePathname: () => '/aio/pricing' },
  '@/lib/pricing': { ENTERPRISE_CONTACT_MAILTO: 'mailto:example@example.invalid' },
  '@/components/CheckoutButton': { CheckoutButton: () => { checkoutCount++; return React.createElement('button', null, 'CHECKOUT') } },
  '@/components/TrialCallout': { TrialBadge: empty, TrialNote: empty, useTrialEligible: () => false },
  '@/lib/services': { getServiceById: () => service, getPublicServices: () => [service] },
  '@/lib/plan-utils': { higherPlan: (_a, b) => b, tierFrom: value => value === 'STARTER' ? 'PRO' : value },
  '@/lib/unified-plan': {
    UNIFIED_PRO_PRICE_LABEL: '¥9,980', UNIFIED_PRO_PLAN_ID: 'banner-pro', UNIFIED_PLAN_COPY: {
      freeName: '無料プラン', proName: 'プロプラン', freeTagline: '無料', proNote: '統一プラン',
    } },
}
const billingReader = load('src/lib/billing-response-client.ts', {}, { AbortController })
mocks['@/lib/plan-utils'] = load('src/lib/plan-utils.ts')
mocks['@/hooks/useBillingPlanResync'] = load('src/hooks/useBillingPlanResync.ts', {
  react: React, 'next-auth/react': mocks['next-auth/react'],
  '@/lib/billing-response-client': billingReader, '@/lib/plan-utils': mocks['@/lib/plan-utils'],
}, { AbortController })
vm.runInNewContext(compiled, { exports: pageExports, require: name => {
  if (name in mocks) return mocks[name]
  throw new Error(`Unmocked ${name}`)
} })
const render = props => {
  checkoutCount = 0
  return renderToStaticMarkup(React.createElement(pageExports.UnifiedPricingPlans, { serviceId: 'aio', ...props }))
}

personalPlan = 'PRO'
let html = render({ currentPlan: 'FREE', planSource: 'organization', canPurchase: false })
assert.equal(checkoutCount, 0)
assert.ok(html.includes('組織の現在のプラン'))
assert.ok(html.includes('組織の契約変更はオーナーにご相談ください'))
assert.ok(!html.includes('/api/stripe/portal'))
assert.ok(!html.includes('課金状態を確認してプランを反映する'))

personalPlan = 'FREE'
html = render({ currentPlan: 'PRO', planSource: 'organization', canPurchase: false })
assert.equal(checkoutCount, 0)
assert.ok(html.includes('組織でご利用中のプラン'))

personalPlan = 'PRO'
html = render({ currentPlan: 'FREE', planSource: 'organization', canPurchase: true })
assert.equal(checkoutCount, 1)
assert.ok(html.includes('組織の現在のプラン'))

personalPlan = 'FREE'
html = render({ currentPlan: 'STARTER', planSource: 'organization', canPurchase: true })
assert.equal(checkoutCount, 0)
assert.ok(html.includes('組織でご利用中のプラン'))
personalPlan = 'FREE'
html = render({ currentPlan: 'LIGHT', planSource: 'organization', canPurchase: false })
assert.equal(checkoutCount, 0)
assert.ok(html.includes('組織の現在のプランはライトです'))
assert.ok(!html.includes('組織でご利用中のプラン'))
assert.ok(!html.includes('課金状態を確認してプランを反映する'))
personalPlan = 'LIGHT'
html = render({ currentPlan: 'FREE', canPurchase: true })
assert.equal(checkoutCount, 1)
assert.ok(html.includes('現在ライトプランをご利用中です'))
assert.ok(!html.includes('課金状態を確認してプランを反映する'))
console.log('PASS organization price table uses owner plan and omits member billing controls')
