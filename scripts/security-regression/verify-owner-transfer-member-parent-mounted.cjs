// Actual Shodan/AIO members parent and transfer Panel/hook/client; synthetic member hook and HTTP.
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
  let memberLoad = null, loads = 0, posts = 0, reads = 0
  const fetch = async (url, init = {}) => {
    const query = new URL(String(url), 'https://example.invalid').searchParams
    if (query.get('action') === 'candidates') return Response.json({ actorId: 'actor', service,
      organization: { id: 'orgA', slug: 'selected', name: 'Org A' }, owner: { memberId: 'self', userId: 'actor' },
      candidates: [{ memberId: 'target', userId: 'successor', name: '後任', role: 'member', plan: 'LIGHT' }] })
    if (query.get('action') === 'status') { reads++; return Response.json({ actorId: 'actor', service, organizationId: 'orgA',
      operationId: query.get('operationId'), phase: 'committed', input: { expectedOwnerMemberId: 'self',
        targetMemberId: 'target', targetUserId: 'successor', targetRole: 'member', targetPlan: 'LIGHT' }, createdAt: new Date().toISOString() }) }
    if (init.method === 'POST') { posts++; const body = JSON.parse(init.body); assert.equal(body.action, 'transfer')
      return Response.json({ actorId: 'actor', service, organizationId: 'orgA', operationId: body.operationId,
        phase: 'committed', input: body.input, createdAt: new Date().toISOString() }) }
    throw Error('Unexpected HTTP ' + url)
  }
  global.fetch = fetch
  const Null = () => null, cache = new Map()
  const mocks = {
    react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
    'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor' } } }) },
    'next/navigation': { useParams: () => ({ orgSlug: 'selected' }) },
    [`@/components/${service}/ui`]: { PageHeader: Null },
    '@/components/InviteDeliveryNotice': { InviteDeliveryNotice: Null },
    [`@/lib/${service}/types`]: { ROLE_LABEL: { owner: 'オーナー', admin: '管理者', member: 'メンバー' } },
    '@/lib/use-org-team-members': { useOrgTeamMembers: () => {
      const [role, setRole] = React.useState('owner'), [loading, setLoading] = React.useState(false)
      const [email, setEmail] = React.useState(''), [loaded, setLoaded] = React.useState(true)
      const refreshAfterTransfer = async () => {
        loads++; setLoading(true); setLoaded(false); const held = deferred(); memberLoad = held
        await held.promise; setRole('admin'); setLoading(false); setLoaded(true)
      }
      return { members: [{ id: 'self', role, status: 'ACTIVE', name: 'actor' }], myRole: loaded && !loading ? role : 'member',
        email, role: 'member', loaded, canManage: loaded && !loading, busy: null, unknown: false,
        loading, error: null, notice: null, inviteUrl: null, requiresLogin: false, setEmail, setRole() {},
        canRemove: () => false, invite() {}, remove() {}, load: refreshAfterTransfer, refreshAfterTransfer }
    } },
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports
    const filename = path.join(root, relative), module = new Module(filename); cache.set(relative, module)
    module.require = id => {
      if (id in mocks) return mocks[id]
      if (id === '@/components/org/OwnerTransferPanel') return load('src/components/org/OwnerTransferPanel.tsx')
      if (id === '@/lib/use-owner-transfer') return load('src/lib/use-owner-transfer.ts')
      if (id === '@/lib/owner-transfer-client' || id === './owner-transfer-client') return load('src/lib/owner-transfer-client.ts')
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
  assert(button('この方へ引き継ぐ'))
  await React.act(async () => button('この方へ引き継ぐ').click()); await flush()
  assert.equal(posts, 1); assert.equal(loads, 1, 'actual parent starts one current-role reread')
  assert.equal(document.querySelector('input[type="email"]'), null, 'old owner controls are masked while reread is pending')
  assert.equal(window.localStorage.length, 1, 'receipt handle stays durable')
  await React.act(async () => memberLoad.resolve()); await flush()
  assert.equal(document.querySelector('input[type="email"]').value, 'draft@example.invalid', 'invite draft survives fresh proof')
  assert.equal(document.querySelector('option[value="admin"]'), null, 'owner-only role option is gone')
  assert.equal(button('この方へ引き継ぐ'), undefined, 'fresh admin cannot create a new transfer')
  assert.equal(reads, 1, 'fresh admin scope restores the saved receipt')
  await React.act(async () => button('引継ぎ状況を確認').click()); await flush()
  assert.equal(reads, 2, 'explicit status read is the only additional observation')
  assert.equal(posts, 1); assert.equal(loads, 1, 'receipt replay does not reread roles in a loop')
  await React.act(async () => view.unmount()); dom.window.close()
  console.log(`owner transfer ${service} actual members parent+Panel: pending old-owner mask, draft retained, admin role fresh, handle/status POST1 PASS`)
}
;(async () => { await run('shodan'); await run('aio') })().catch(error => { console.error(error); process.exitCode = 1 })
