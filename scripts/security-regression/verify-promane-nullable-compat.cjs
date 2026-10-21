process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto')
const assert = require('node:assert/strict'), React = require('react'), ts = require('typescript')
const { JSDOM } = require('jsdom')
const rootPath = path.resolve(__dirname, '../..'), sources = new Map(), cases = [], failures = []
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/promane/workspace' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client'), { renderToStaticMarkup } = require('react-dom/server')
const tick = () => new Promise(resolve => setImmediate(resolve)), wrap = ({ children }) => React.createElement('div', null, children), no = () => null
const redirect = url => { throw Object.assign(Error('redirect'), { url }) }
function loader(mocks = {}) {
  const cache = new Map()
  return function load(relative) {
    const file = path.resolve(rootPath, relative)
    if (cache.has(file)) return cache.get(file)
    const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, path.relative(rootPath, file))
    const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : file, 'utf8')
    sources.set(path.relative(rootPath, file), crypto.createHash('sha256').update(source).digest('hex'))
    const exports = {}; cache.set(file, exports)
    // Nullable actor cases reject before any transaction; retirement guard behavior has its own private-PG fixture.
    const defaults = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), crypto: { __esModule: true, default: crypto }, 'node:crypto': crypto, '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } }, '@/lib/account-lifecycle/store': { lockLifecycleUsers: async () => { throw Error('Unexpected actor lock') }, assertRetirementMembershipWritable: async () => { throw Error('Unexpected retirement guard') } }, 'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect, useRouter: () => ({ refresh() {} }) }, 'next/server': { NextResponse: Response }, 'next/link': { __esModule: true, default: ({ children, href }) => React.createElement('a', { href }, children) }, 'next/image': { __esModule: true, default: no }, 'lucide-react': new Proxy({}, { get: () => no }), sonner: { toast: { success() {}, error() {} } }, '@/lib/auth': { authOptions: {} }, '@/lib/ui-next': { isUiNext: async () => true }, './PromaneLp': { PromaneLp: () => React.createElement('p', null, 'public-lp') }, '@/components/promane/confirm-dialog': { useConfirm: () => ({ confirm: async () => true, ConfirmDialog: no }) } }
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: name => {
      if (name in mocks) return mocks[name]
      if (name in defaults) return defaults[name]
      if (name.startsWith('@/components/promane/')) return new Proxy({ __esModule: true, default: wrap }, { get: (value, key) => key in value ? value[key] : wrap })
      const stem = name.startsWith('@/') ? path.join(rootPath, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)
      const found = [stem + '.ts', stem + '.tsx'].find(fs.existsSync); assert(found, 'Unmocked ' + name); return load(found)
    }, URL, Request, Response, Headers, Buffer, Date, console, window, document, setTimeout, clearTimeout, AbortController, fetch: () => { throw Error('No external calls allowed') } }, { filename: file })
    return exports
  }
}
async function check(name, test) { try { await test(); cases.push(name) } catch (error) { failures.push({ name, message: error.message }) } }
function authFixture(id) {
  let reads = 0
  const db = { promaneWorkspace: { findFirst: async () => { reads++; return null } }, promaneMember: { findUnique: async () => { reads++; return null } }, $transaction: async () => { reads++; throw Error('unexpected transaction') } }
  return { api: loader({ 'next-auth': { getServerSession: async () => ({ user: { id } }) }, '@/lib/prisma': { prisma: db } })('src/lib/promane/auth.ts'), reads: () => reads }
}
function actionFixture(member, assigned = 'retired') {
  let writes = 0
  const tx = { $queryRaw: async () => [{ id: 'actor' }], $executeRaw: async () => 0,
    systemSetting: { findUnique: async () => null, create: async ({ data }) => data },
    promaneMember: { findFirst: async ({ where }) => where.userId ? { id: 'actor', userId: 'actor', isActive: true } : where.id !== member.id || where.isActive && !member.isActive ? null : member },
    promaneProject: { findFirst: async () => ({ id: 'project' }) },
    promaneTask: { findFirst: async () => ({ id: 'task', projectId: 'project', assigneeId: assigned, startDate: null, dueDate: null }), aggregate: async () => ({ _max: { order: 0 } }), create: async ({ data }) => { writes++; return { id: 'new-task', ...data } }, update: async ({ data }) => { writes++; return { id: 'task', ...data } } },
    promaneTimeEntry: { create: async ({ data }) => { writes++; return { id: 'entry', ...data } } } }
  const db = { $transaction: async work => work(tx) }
  const load = loader({ '@/lib/prisma': { prisma: db }, '@/lib/promane/auth': { requirePromaneAuthAction: async () => ({ userId: 'actor' }), requireWritableWorkspace: async () => ({ id: 'workspace', slug: 'workspace' }) } })
  const task = load('src/lib/promane/actions-tasks.ts'), time = load('src/lib/promane/actions-time-entries.ts')
  const intent = { operationId: '10000000-0000-4000-8000-000000000001', expectedUserId: 'actor', workspaceId: 'workspace' }
  return { writes: () => writes, createTask: id => task.createTask('workspace', { ...intent, projectId: 'project', title: 'Synthetic', assigneeId: id }), updateTask: id => task.updateTask('workspace', 'task', { assigneeId: id, title: 'Preserved task' }), createTime: () => time.createTimeEntry('workspace', { ...intent, memberId: member.id, duration: 60, date: '2026-10-20' }) }
}
const privateHeaders = response => { assert.equal(response.headers.get('Cache-Control'), 'private, no-store'); assert(response.headers.get('Vary').split(/,\s*/).includes('Cookie')) }
const session = { user: { id: 'actor', email: 'synthetic@example.invalid' } }
function inviteFixture({ inviter = null, accepted = false, expired = false, sessionValue = session } = {}) {
  const invitation = { id: 'invitation', token: 'synthetic-token', workspaceId: 'workspace', invitedById: inviter ? 'sender' : null, invitedBy: inviter, role: 'member', email: 'synthetic@example.invalid', acceptedAt: accepted ? new Date() : null, expiresAt: new Date(Date.now() + (expired ? -60000 : 60000)), createdAt: new Date(), workspace: { id: 'workspace', slug: 'workspace', name: 'Synthetic workspace', userId: 'new-owner' } }
  let memberWrites = 0, inviteWrites = 0
  const tx = { promaneInvitation: { findUnique: async () => invitation, findMany: async () => [invitation], update: async () => { inviteWrites++ } }, promaneMember: { findUnique: async () => null, count: async () => 1, create: async () => { memberWrites++ } } }
  const db = { ...tx, $transaction: async work => work(tx) }
  const load = loader({ 'next-auth': { getServerSession: async () => sessionValue }, '@/lib/prisma': { prisma: db }, '@/lib/promane/limits': { getUserPromaneLimits: async id => { assert.equal(id, 'new-owner'); return { maxMembersPerWorkspace: 3 } } } })
  return { api: load('src/app/api/promane/invite/[token]/route.ts'), lists: load('src/app/api/promane/invitations/route.ts'), admission: load('src/lib/promane/invite-admission.ts'), state: () => ({ memberWrites, inviteWrites }) }
}
;(async () => {
  for (const id of [undefined, null, '', '   ']) {
    for (const operation of ['page-auth', 'action-auth', 'lookup', 'current-member', 'create-workspace', 'write-fixed-id']) await check('unresolved actor ' + String(id) + ' rejected before ' + operation, async () => {
      const f = authFixture(id)
      if (operation === 'page-auth') await assert.rejects(f.api.requirePromaneAuth(), error => error.url === '/auth/signin?callbackUrl=/promane')
      if (operation === 'action-auth') await assert.rejects(f.api.requirePromaneAuthAction())
      if (operation === 'lookup') assert.equal(await f.api.getWorkspaceBySlug('workspace', id), null)
      if (operation === 'current-member') assert.equal(await f.api.getCurrentMember('workspace', id), null)
      if (operation === 'create-workspace') await assert.rejects(f.api.getOrCreateWorkspace(id))
      if (operation === 'write-fixed-id') await assert.rejects(f.api.requireWritableWorkspace('workspace', id, false, 'workspace'))
      assert.equal(f.reads(), 0)
    })
  }
  await check('normal authenticated actor preserves auth session and action ID', async () => { const f = authFixture('actor'); assert.equal((await f.api.requirePromaneAuth()).user.id, 'actor'); assert.equal((await f.api.requirePromaneAuthAction()).userId, 'actor') })
  for (const active of [false, true]) await check('null member cannot receive task/time even active=' + active, async () => {
    const f = actionFixture({ id: 'retired', userId: null, isActive: active, hourlyRate: 2500 }, 'previous')
    await assert.rejects(f.createTask('retired')); await assert.rejects(f.createTime()); await assert.rejects(f.updateTask('retired')); assert.equal(f.writes(), 0)
  })
  await check('unchanged historic assignee remains while task fields are edited', async () => { const f = actionFixture({ id: 'retired', userId: null, isActive: false, hourlyRate: 2500 }); const row = await f.updateTask('retired'); assert.equal(row.assigneeId, 'retired'); assert.equal(f.writes(), 1) })
  await check('live assignment/time and clearing historic assignment remain available', async () => { const f = actionFixture({ id: 'live', userId: 'peer', isActive: true, hourlyRate: 2500 }); await f.createTask('live'); const time = await f.createTime(); assert.equal(time.hourlyRateSnapshot, 2500); await f.updateTask('live'); await f.updateTask(null); assert.equal(f.writes(), 4) })
  await check('inactive live member is not newly assigned', async () => { const f = actionFixture({ id: 'inactive', userId: 'peer', isActive: false }); await assert.rejects(f.updateTask('inactive')); assert.equal(f.writes(), 0) })
  for (const kind of ['members', 'entry', 'detail']) await check(kind + ' actual server view supports nullable history without removing aggregate', async () => {
    const retired = { id: 'retired', userId: null, role: 'member', isActive: true, displayName: 'Historical member', hourlyRate: 1000, user: null, timeEntries: [{ id: 'entry', projectId: 'project', taskId: 'task', duration: 60, hourlyRateSnapshot: 2000 }] }
    const live = { id: 'live', userId: 'peer', isActive: true, role: 'member', displayName: 'Live member', hourlyRate: 3000, user: { email: 'synthetic@example.invalid' }, timeEntries: [] }
    let reads = 0; const captured = []
    const db = { promaneMember: { findMany: async () => { reads++; return kind === 'entry' ? [{ ...live, userId: 'actor', workspace: { id: 'workspace', slug: 'workspace', name: 'Synthetic workspace', _count: { projects: 1, members: 2 } } }] : [retired, live] } }, promaneInvitation: { findMany: async () => [{ id: 'invite', token: 'synthetic', invitedBy: null, role: 'member', workspace: { name: 'Synthetic' } }] }, promaneTimeEntry: { groupBy: async () => [{ memberId: 'retired', _sum: { duration: 60 } }] }, promaneProject: { findFirst: async () => ({ id: 'project', name: 'Synthetic project', contractAmount: 5000, client: null, startDate: null, endDate: null, expenses: [], tasks: [{ id: 'task', title: 'Synthetic task', status: 'todo', order: 0, assigneeId: 'retired', assignee: retired, timeEntries: [], startDate: null, dueDate: null }] }) } }
    const collector = label => props => { captured.push({ label, ...props }); return null }
    const load = loader({ 'next-auth': { getServerSession: async () => session }, '@/lib/prisma': { prisma: db }, '@/lib/promane/auth': { requirePromaneAuth: async () => session, getWorkspaceBySlug: async () => ({ id: 'workspace', members: [{ id: 'actor', userId: 'actor', role: 'owner' }] }) }, '@/components/promane/member-list': { MemberList: collector('members') }, '@/components/promane/task-create-form': { TaskCreateForm: collector('candidate') }, '@/components/promane/kanban-board': { KanbanBoard: collector('candidate') }, '@/components/promane/gantt-chart': { GanttChart: collector('candidate') }, '@/components/promane/finance-tab': { FinanceTab: collector('finance') } })
    const file = kind === 'entry' ? 'src/app/(shell)/promane/page.tsx' : 'src/app/(shell)/promane/[workspaceSlug]/' + (kind === 'members' ? 'members/page.tsx' : 'projects/[projectId]/page.tsx')
    const view = await load(file).default({ params: Promise.resolve({ workspaceSlug: 'workspace', projectId: 'project' }), searchParams: Promise.resolve({ select: '1' }) })
    const html = renderToStaticMarkup(view)
    if (kind === 'entry') assert(html.includes('退会済みの招待者'))
    if (kind === 'members') { const member = captured[0].members.find(x => x.id === 'retired'); assert.equal(member.email, null); assert.equal(member.totalMinutes, 60) }
    if (kind === 'detail') { for (const item of captured.filter(x => x.label === 'candidate')) assert.deepEqual(item.members.map(x => x.id), ['live']); const finance = captured.find(x => x.label === 'finance'); assert.equal(finance.laborCost, 2000); assert.equal(finance.members.length, 2); assert.equal(finance.totalMinutes, 60) }
    assert(reads > 0)
  })
  await check('entry missing actor shows public landing before membership read', async () => {
    let reads = 0; const load = loader({ 'next-auth': { getServerSession: async () => ({ user: {} }) }, '@/lib/prisma': { prisma: { promaneMember: { findMany: async () => { reads++; return [] } } } }, '@/lib/promane/auth': {} })
    const html = renderToStaticMarkup(await load('src/app/(shell)/promane/page.tsx').default({})); assert(html.includes('public-lp')); assert.equal(reads, 0)
  })
  for (const inviter of [null, { name: 'Synthetic sender', email: 'sender@example.invalid' }]) await check('token/list readers preserve organization invite with inviter=' + (inviter ? 'live' : 'null'), async () => {
    const f = inviteFixture({ inviter }), ctx = { params: Promise.resolve({ token: 'synthetic-token' }) }
    const response = await f.api.GET(new Request('https://example.invalid/api/promane/invite/synthetic-token'), ctx); assert.equal(response.status, 200); privateHeaders(response); const data = await response.json(); assert.equal(data.invitation.invitedByName, inviter?.name ?? null)
    const received = await f.lists.GET({ nextUrl: new URL('https://example.invalid/api/promane/invitations') }); assert.equal(received.status, 200); privateHeaders(received); assert.equal((await received.json()).invitations[0].invitedByEmail, inviter?.email ?? null)
    assert.deepEqual(f.state(), { memberWrites: 0, inviteWrites: 0 })
  })
  await check('owner transferred organization invite remains acceptable after inviter retirement', async () => {
    const f = inviteFixture(), response = await f.api.POST(new Request('https://example.invalid/api/promane/invite/synthetic-token', { method: 'POST' }), { params: Promise.resolve({ token: 'synthetic-token' }) })
    assert.equal(response.status, 200); privateHeaders(response); assert.equal((await response.json()).workspaceSlug, 'workspace'); assert.deepEqual(f.state(), { memberWrites: 1, inviteWrites: 1 })
  })
  for (const condition of ['expired', 'accepted', 'unauthenticated']) await check('invite ' + condition + ' rejection preserves status and private headers', async () => {
    const f = inviteFixture(condition === 'unauthenticated' ? { sessionValue: null } : { [condition]: true }), ctx = { params: Promise.resolve({ token: 'synthetic-token' }) }
    const response = await f.api.POST(new Request('https://example.invalid/api/promane/invite/synthetic-token', { method: 'POST' }), ctx); assert.equal(response.status, condition === 'unauthenticated' ? 401 : 410); privateHeaders(response); assert.deepEqual(f.state(), { memberWrites: 0, inviteWrites: 0 })
  })
  for (const endpoint of ['token', 'list']) for (const status of [400, 403, 500]) await check(endpoint + ' rejection ' + status + ' keeps private headers and no writes', async () => {
    const db = { promaneInvitation: { findUnique: async () => { throw Error('Synthetic outage') } }, promaneMember: { findUnique: async () => null } }
    const load = loader({ 'next-auth': { getServerSession: async () => session }, '@/lib/prisma': { prisma: db } })
    let response
    if (endpoint === 'list') response = await load('src/app/api/promane/invitations/route.ts').GET({ nextUrl: new URL('https://example.invalid/api/promane/invitations?' + (status === 400 ? 'type=unknown' : status === 403 ? 'type=sent&workspaceId=workspace' : 'type=received')) })
    else if (status === 403) { const f = inviteFixture({ sessionValue: { user: { id: 'actor', email: 'different@example.invalid' } } }); response = await f.api.POST(new Request('https://example.invalid/api/promane/invite/token'), { params: Promise.resolve({ token: 'token' }) }); assert.deepEqual(f.state(), { memberWrites: 0, inviteWrites: 0 }) }
    else response = await load('src/app/api/promane/invite/[token]/route.ts').GET(new Request('https://example.invalid/api/promane/invite/token'), { params: Promise.resolve({ token: status === 400 ? '' : 'token' }) })
    assert.equal(response.status, status); privateHeaders(response); assert((await response.json()).error)
  })
  await check('actual task edit mounts a disabled historic option and preserves unchanged assignment', async () => {
    const calls = [], load = loader({ '@/lib/promane/actions-tasks': { updateTask: async (...args) => calls.push(args), deleteTask: async () => {} } })
    const Component = load('src/components/promane/task-edit-modal.tsx').TaskEditModal, holder = document.createElement('div'); document.body.append(holder); const root = createRoot(holder)
    const task = { id: 'task', title: 'Synthetic', description: null, status: 'todo', priority: 'medium', assigneeId: 'retired', startDate: null, dueDate: null }
    try { await React.act(async () => root.render(React.createElement(Component, { workspaceSlug: 'workspace', open: true, onClose() {}, task, members: [{ id: 'live', displayName: 'Live member' }] }))); const select = holder.querySelector('select'), old = select.querySelector('[value="retired"]'); assert(old?.disabled); assert.equal(select.value, 'retired')
      // Presentation Button is replaced with a native button for the same actual handler.
      const props = []
      const buttonLoad = loader({ '@/lib/promane/actions-tasks': { updateTask: async (...args) => calls.push(args), deleteTask: async () => {} }, '@/components/promane/ui/button': { Button: value => { props.push(value); return React.createElement('button', { onClick: value.onClick }, value.children) } } })
      const ButtonComponent = buttonLoad('src/components/promane/task-edit-modal.tsx').TaskEditModal
      await React.act(async () => root.render(React.createElement(ButtonComponent, { workspaceSlug: 'workspace', open: true, onClose() {}, task, members: [{ id: 'live', displayName: 'Live member' }] })))
      await React.act(async () => { [...holder.querySelectorAll('button')].find(x => x.textContent.includes('保存')).click(); for (let i = 0; i < 5; i++) await tick() }); assert.equal(calls[0][2].assigneeId, 'retired')
    } finally { await React.act(async () => root.unmount()); holder.remove() }
  })
  console.log(JSON.stringify({ passed: cases.length, failed: failures.length, cases, failures, sourceHashes: Object.fromEntries(sources), scope: 'Actual TS/TSX with synthetic nullable rows; no schema/client generation, PG, browser, HTTP, external API, retirement enabling or production migration. Existing retirement guard unchanged.' }, null, 2)); dom.window.close(); if (failures.length) process.exitCode = 1
})().catch(error => { console.error(error); process.exitCode = 1 })
