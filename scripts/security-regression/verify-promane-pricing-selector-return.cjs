process.env.NODE_ENV = 'test'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')

const sourceRoot = process.env.PROMANE_SELECTOR_SOURCE_ROOT || process.cwd()
const source = path => fs.readFileSync(`${sourceRoot}/${path}`, 'utf8')
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
const redirect = href => { throw Object.assign(Error('NEXT_REDIRECT'), { href }) }
let account = null
let memberships = []
let invites = []
let ownedInvalid = false
let autoSetupCalls = 0
let membershipReads = 0
let inviteReads = 0
let createButtonRenders = 0
let pricingRenders = 0

function load(path, mocks) {
  const code = ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText
  const loaded = { exports: {} }
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports, console, Date, URL, window: global.window,
    require: name => {
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (name === 'react') return React
      if (name in mocks) return mocks[name]
      throw Error(`${path}: unmocked ${name}`)
    },
  }, { filename: path })
  return loaded.exports
}

const entry = load('src/app/(shell)/promane/page.tsx', {
  'next-auth': { getServerSession: async () => account },
  '@/lib/auth': { authOptions: {} },
  'next/navigation': { redirect },
  '@/lib/prisma': { prisma: {
    promaneMember: { findMany: async ({ where }) => {
      membershipReads++
      assert.equal(where.userId, 'u1')
      assert.equal(where.isActive, true)
      assert.deepEqual(Array.from(where.role.in), ['owner', 'admin', 'member', 'guest'])
      return memberships.filter(member => member.isActive !== false && where.role.in.includes(member.role))
    } },
    promaneInvitation: { findMany: async ({ where }) => {
      inviteReads++
      assert.equal(where.email, 'owner@example.test')
      assert.equal(where.acceptedAt, null)
      assert.deepEqual(Array.from(where.role.in), ['admin', 'member', 'guest'])
      return invites
    } },
  } },
  '@/lib/promane/auth': { getOrCreateWorkspace: async id => {
    assert.equal(id, 'u1')
    autoSetupCalls++
    return ownedInvalid ? null : { slug: 'new-workspace' }
  } },
  './PromaneLp': { PromaneLp: () => React.createElement('div', { 'data-testid': 'public-lp' }, 'PUBLIC LP') },
  'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
  'next/link': { default: Link },
  '@/components/promane/ui/button': { Button: ({ children }) => React.createElement('button', null, children) },
  '@/components/promane/ui/badge': { Badge: ({ children }) => React.createElement('span', null, children) },
  '@/components/promane/create-workspace-button': { CreateWorkspaceButton: () => { createButtonRenders++; return React.createElement('button', null, 'CREATE') } },
  '@/lib/ui-next': { isUiNext: async () => false },
  '@/components/SignInReturnLink': { default: ({ fallback, children }) => React.createElement('a', { href: fallback, 'data-signin-return': 'true' }, children) },
}).default
const pricing = load('src/app/(shell)/promane/pricing/page.tsx', {
  '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: ({ serviceId }) => { assert.equal(serviceId, 'promane'); pricingRenders++; return React.createElement('div', { 'data-testid': 'plans' }) } },
  'next/link': { default: Link },
}).default

async function entryCase(label, { signed = true, count = 0, invited = 0, select = false, invalid = false, role = 'member', active = true } = {}) {
  account = signed ? { user: { id: 'u1', email: 'owner@example.test' } } : null
  memberships = Array.from({ length: count }, (_, i) => ({ id: `m${i}`, role, isActive: active, workspace: { id: `w${i}`, name: `Work ${i}`, slug: `work-${i}`, _count: { projects: 0, members: 1 } } }))
  invites = Array.from({ length: invited }, (_, i) => ({ id: `i${i}`, token: `tok${i}`, role: 'member', workspace: { name: `Invite ${i}`, slug: `inv-${i}` }, invitedBy: { name: 'Owner' } }))
  ownedInvalid = invalid
  autoSetupCalls = membershipReads = inviteReads = createButtonRenders = 0
  let html = ''
  let redirected = null
  try { html = renderToStaticMarkup(await entry({ searchParams: Promise.resolve(select ? { select: '1' } : {}) })) }
  catch (error) { assert.equal(error.message, 'NEXT_REDIRECT'); redirected = error.href }
  console.log(`${label}: redirect=${redirected || 'none'}; setup=${autoSetupCalls}; memberRead=${membershipReads}; inviteRead=${inviteReads}; createButton=${createButtonRenders}`)
  return { html, redirected, setup: autoSetupCalls, membershipReads, inviteReads, createButtonRenders }
}

async function guestReturnHelper() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/promane?select=1' })
  global.window = dom.window
  global.document = dom.window.document
  global.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = require('react-dom/client')
  const { act } = React
  const safe = load('src/lib/safe-signin-callback.ts', {})
  const ReturnLink = load('src/components/SignInReturnLink.tsx', {
    'next/navigation': { usePathname: () => '/promane' },
    '@/lib/safe-signin-callback': safe,
  }).default
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(ReturnLink, { fallback: '/promane?select=1' }, 'ログイン')); await new Promise(resolve => setTimeout(resolve, 0)) })
  const anchor = document.querySelector('a')
  anchor.addEventListener('click', event => event.preventDefault())
  anchor.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert.equal(anchor.getAttribute('href'), '/auth/signin?callbackUrl=%2Fpromane%3Fselect%3D1')
  await act(async () => root.unmount())
  delete global.window
  delete global.document
  console.log('actual SignInReturnLink: callback preserves /promane?select=1')
}

;(async () => {
  const zero = await entryCase('explicit-empty', { select: true })
  assert.equal(zero.redirected, null)
  assert.equal(zero.setup, 0)
  assert.equal(zero.createButtonRenders, 0)
  assert.match(zero.html, /参加中のワークスペースがありません/)
  assert.match(zero.html, /href="\/promane"[^>]*>初期設定を開始する/)
  const invalid = await entryCase('explicit-owned-invalid', { select: true, invalid: true })
  assert.equal(invalid.setup, 0)
  assert.equal(invalid.createButtonRenders, 0)
  const unknownRole = await entryCase('explicit-unknown-role', { count: 1, role: 'strange', select: true })
  assert.equal(unknownRole.setup, 0)
  assert.equal(unknownRole.createButtonRenders, 0)
  assert.doesNotMatch(unknownRole.html, /href="\/promane\/work-0"/)
  const inactive = await entryCase('explicit-inactive', { count: 1, active: false, select: true })
  assert.equal(inactive.setup, 0)
  assert.equal(inactive.createButtonRenders, 0)
  const normalZero = await entryCase('normal-first-setup')
  assert.equal(normalZero.redirected, '/promane/new-workspace')
  assert.equal(normalZero.setup, 1)
  const normalInvalid = await entryCase('normal-owned-invalid', { invalid: true })
  assert.equal(normalInvalid.redirected, null)
  assert.match(normalInvalid.html, /ワークスペースにアクセスできません/)
  assert.equal(normalInvalid.setup, 1)
  const one = await entryCase('normal-one', { count: 1 })
  assert.equal(one.redirected, '/promane/work-0')
  assert.equal(one.setup, 0)
  const oneSelected = await entryCase('explicit-one', { count: 1, select: true })
  assert.equal(oneSelected.redirected, null)
  assert.match(oneSelected.html, /href="\/promane\/work-0"/)
  const many = await entryCase('normal-many', { count: 2 })
  assert.equal(many.redirected, null)
  assert.match(many.html, /href="\/promane\/work-1"/)
  const invited = await entryCase('invited-empty', { invited: 1, select: true })
  assert.equal(invited.setup, 0)
  assert.match(invited.html, /href="\/promane\/invite\/tok0"/)
  const guest = await entryCase('normal-guest', { signed: false })
  assert.match(guest.html, /PUBLIC LP/)
  const guestSelected = await entryCase('explicit-guest', { signed: false, select: true })
  assert.doesNotMatch(guestSelected.html, /PUBLIC LP/)
  assert.match(guestSelected.html, /data-signin-return="true"/)
  assert.equal(guestSelected.membershipReads, 0)
  await guestReturnHelper()
  const pricingHtml = renderToStaticMarkup(React.createElement(pricing))
  assert.match(pricingHtml, /href="\/promane\?select=1"[^>]*>ワークスペース選択へ戻る/)
  assert.equal(pricingRenders, 1)
  console.log('Promane pricing selector: 14/14 passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
