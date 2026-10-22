// Actual Shodan/AIO parent, member hook/guard/read transport and owner-transfer Panel; synthetic HTTP only.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
async function run(service) {
  const dom = new JSDOM('<main id="root"></main>', { url: `https://example.invalid/${service}/selected/members` })
  global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator
  global.crypto = require('node:crypto').webcrypto; global.IS_REACT_ACT_ENVIRONMENT = true
  window.confirm = () => true; window.navigator.locks = { request: async (_name, _options, work) => work() }
  let role = 'owner', memberReads = 0, memberDeletes = 0, transferPosts = 0, statusReads = 0, committed = false
  const oldRead = deferred(), transferResponse = deferred()
  const memberBody = currentRole => ({ members: [
    { id: 'self', name: 'actor', role: currentRole, status: 'ACTIVE', inviteEmail: null, acceptedAt: null },
    { id: 'target', name: '後任', role: currentRole === 'owner' ? 'member' : 'owner', status: 'ACTIVE', inviteEmail: null, acceptedAt: null },
    { id: 'peer', name: 'peer', role: 'member', status: 'ACTIVE', inviteEmail: null, acceptedAt: null },
  ], myMemberId: 'self', myRole: currentRole })
  global.fetch = async (url, init = {}) => {
    const u = new URL(String(url), 'https://example.invalid')
    if (u.pathname === `/api/${service}/members` && (!init.method || init.method === 'GET')) {
      memberReads++
      if (memberReads === 2) return oldRead.promise
      return Response.json(memberBody(role))
    }
    if (u.pathname === `/api/${service}/members/peer` && init.method === 'DELETE') {
      memberDeletes++; return Response.json({ ok: true, memberId: 'peer' })
    }
    if (u.pathname === `/api/${service}/owner-transfer` && u.searchParams.get('action') === 'candidates')
      return Response.json({ actorId: 'actor', service, organization: { id: 'orgA', slug: 'selected', name: 'Org A' },
        owner: { memberId: 'self', userId: 'actor' }, candidates: [{ memberId: 'target', userId: 'successor', name: '後任', role: 'member', plan: 'LIGHT' }] })
    if (u.pathname === `/api/${service}/owner-transfer` && u.searchParams.get('action') === 'status') {
      statusReads++
      return Response.json({ actorId: 'actor', service, organizationId: 'orgA', operationId: u.searchParams.get('operationId'),
        phase: committed ? 'committed' : 'missing', input: committed ? { expectedOwnerMemberId: 'self', targetMemberId: 'target',
          targetUserId: 'successor', targetRole: 'member', targetPlan: 'LIGHT' } : null, createdAt: committed ? new Date().toISOString() : null })
    }
    if (u.pathname === `/api/${service}/owner-transfer` && init.method === 'POST') {
      transferPosts++; return transferResponse.promise
    }
    throw Error('Unexpected HTTP ' + url)
  }
  const Null = () => null, cache = new Map()
  const mocks = {
    react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
    'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor' } } }) },
    'next/navigation': { useParams: () => ({ orgSlug: 'selected' }) },
    [`@/components/${service}/ui`]: { PageHeader: Null },
    '@/components/InviteDeliveryNotice': { InviteDeliveryNotice: Null },
    [`@/lib/${service}/types`]: { ROLE_LABEL: { owner: 'オーナー', admin: '管理者', member: 'メンバー' } },
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports
    const filename = path.join(root, relative), module = new Module(filename); cache.set(relative, module)
    module.require = id => {
      if (id in mocks) return mocks[id]
      if (id.startsWith('@/lib/')) return load('src/lib/' + id.slice('@/lib/'.length) + '.ts')
      if (id === '@/components/org/OwnerTransferPanel') return load('src/components/org/OwnerTransferPanel.tsx')
      if (id === './owner-transfer-client') return load('src/lib/owner-transfer-client.ts')
      throw Error('Unmocked ' + id)
    }
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
    return module.exports
  }
  const Page = load(`src/app/(shell)/${service}/[orgSlug]/members/page.tsx`).default
  const view = createRoot(document.getElementById('root'))
  const flush = async () => { for (let i = 0; i < 5; i++) await React.act(async () => { await new Promise(setImmediate) }) }
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.includes(text))
  await React.act(async () => view.render(React.createElement(Page))); await flush()
  const email = document.querySelector('input[type="email"]'); assert(email)
  await React.act(async () => email[Object.keys(email).find(key => key.startsWith('__reactProps'))].onChange({ target: { value: 'draft@example.invalid' } }))
  await React.act(async () => button('この方へ引き継ぐ').click()); await flush()
  assert.equal(transferPosts, 1); assert.equal(window.localStorage.length, 1)
  const peerDelete = [...document.querySelectorAll('button[title="削除"]')].find(node => node.parentElement.textContent.includes('peer'))
  assert(peerDelete)
  await React.act(async () => peerDelete.click()); await flush()
  assert.equal(memberDeletes, 1); assert.equal(memberReads, 2)
  role = 'admin'; committed = true
  await React.act(async () => transferResponse.resolve(Response.json({ actorId: 'actor', service, organizationId: 'orgA',
    operationId: JSON.parse(window.localStorage.getItem(window.localStorage.key(0))).operationId, phase: 'committed',
    input: { expectedOwnerMemberId: 'self', targetMemberId: 'target', targetUserId: 'successor', targetRole: 'member', targetPlan: 'LIGHT' }, createdAt: new Date().toISOString() })))
  await flush()
  assert(button('引継ぎ状況を確認'))
  await React.act(async () => button('引継ぎ状況を確認').click()); await flush()
  assert(statusReads >= 1)
  assert.equal(memberReads, 2, 'committed observation arrives while old member GET is in flight')
  assert.equal(document.querySelector('input[type="email"]'), null, 'old owner controls remain hidden while fresh role is unconfirmed')
  await React.act(async () => oldRead.resolve(Response.json(memberBody('owner')))); await flush()
  assert.equal(memberReads, 3, 'commit must queue a new member read after old request settles')
  assert.equal(document.querySelector('input[type="email"]').value, 'draft@example.invalid')
  assert.equal(document.querySelector('option[value="admin"]'), null)
  assert.equal(transferPosts, 1)
  await React.act(async () => view.unmount()); dom.window.close()
  console.log(`owner transfer ${service} actual member-hook read race: old GET ignored, fresh admin read, draft retained, POST1 PASS`)
}
;(async () => { await run('shodan'); await run('aio') })().catch(error => { console.error(error); process.exitCode = 1 })
