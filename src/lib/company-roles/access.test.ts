// 実行: npm run test:roles
// 会社の役割の入口（access.ts）。DB は偽物を渡す。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCompanyCeiling, authorizeCompanyAction, loadRolePolicy, resolveCompanyRole, type CompanyRoleDb, type ShadowDenial } from './access'
import { DEFAULT_ROLE_POLICY } from './policy'
import type { CompanyRolesMode } from './rollout'

function fakeDb(opts: { owned?: Record<string, string>; members?: Record<string, { companyId: string; role: string }>; policy?: Record<string, unknown>; withPolicy?: boolean; orgs?: Record<string, { companyId: string; ownerUserId: string }> }) {
  const calls = { owned: 0, member: 0, policy: 0 }
  const db: CompanyRoleDb = {
    async findOwnedCompany(userId) {
      calls.owned++
      const id = opts.owned?.[userId]
      return id ? { id } : null
    },
    async findActiveMembership(userId) {
      calls.member++
      return opts.members?.[userId] ?? null
    },
    // ツールの組織 → 会社（既定: o1 は会社 c1 の組織で、持ち主は u1）
    async findCompanyOfToolOrg(_tool, organizationId) {
      calls.member++
      return (opts.orgs ?? { o1: { companyId: 'c1', ownerUserId: 'u1' } })[organizationId] ?? null
    },
    async findMembershipIn(userId, companyId) {
      const m = opts.members?.[userId]
      return m && m.companyId === companyId ? { role: m.role } : null
    },
  }
  if (opts.withPolicy !== false && opts.policy) {
    db.findPolicy = async (companyId) => {
      calls.policy++
      return opts.policy?.[companyId] ?? null
    }
  }
  return { db, calls }
}

test('resolveCompanyRole: 持ち主はオーナー（行は読まない）', async () => {
  const { db, calls } = fakeDb({ owned: { u1: 'c1' }, members: { u1: { companyId: 'c2', role: 'member' } } })
  assert.deepEqual(await resolveCompanyRole('u1', db), { companyId: 'c1', role: 'owner' })
  assert.equal(calls.member, 0)
})

test('resolveCompanyRole: 参加している人は行の役割。5 つの役割がそのまま返る', async () => {
  for (const role of ['admin', 'manager', 'billing', 'member', 'guest']) {
    const { db } = fakeDb({ members: { u2: { companyId: 'c1', role } } })
    assert.deepEqual(await resolveCompanyRole('u2', db), { companyId: 'c1', role })
  }
})

test('resolveCompanyRole: 行の owner はゲストに倒す。知らない値もゲスト', async () => {
  for (const role of ['owner', 'wizard', '', 'ADMIN']) {
    const { db } = fakeDb({ members: { u2: { companyId: 'c1', role } } })
    assert.deepEqual(await resolveCompanyRole('u2', db), { companyId: 'c1', role: 'guest' }, role)
  }
})

test('resolveCompanyRole: 会社に入っていない人・空の userId は null', async () => {
  const { db, calls } = fakeDb({})
  assert.equal(await resolveCompanyRole('nobody', db), null)
  assert.equal(await resolveCompanyRole('', db), null)
  assert.equal(calls.owned, 1)
})

test('loadRolePolicy: findPolicy が無ければ既定。あれば正規化して使う（知らない値は既定に戻る）', async () => {
  assert.deepEqual(await loadRolePolicy('c1', fakeDb({}).db), DEFAULT_ROLE_POLICY)
  const { db } = fakeDb({ policy: { c1: { invoiceIssueMin: 'admin', hrSelfFinalize: 'nope', extra: 1 } } })
  assert.deepEqual(await loadRolePolicy('c1', db), { ...DEFAULT_ROLE_POLICY, invoiceIssueMin: 'admin' })
  assert.deepEqual(await loadRolePolicy('c-unknown', db), DEFAULT_ROLE_POLICY)
})

test('authorizeCompanyAction: off は DB を一度も読まず、通す', async () => {
  const { db, calls } = fakeDb({ owned: { u1: 'c1' } })
  const r = await authorizeCompanyAction({ userId: 'u1', permission: 'billing.manage', mode: 'off', db })
  assert.deepEqual(r, { checked: false, allowed: true, mode: 'off' })
  assert.deepEqual(calls, { owned: 0, member: 0, policy: 0 })
})

test('authorizeCompanyAction: shadow は通して、止めるはずだったことを記録する', async () => {
  const { db } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  const seen: ShadowDenial[] = []
  const r = await authorizeCompanyAction({ userId: 'u2', permission: 'billing.manage', mode: 'shadow', db, onShadowDenial: (d) => seen.push(d) })
  assert.equal(r.allowed, true)
  assert.equal(r.checked && r.decision.ok, false)
  assert.deepEqual(seen, [{ userId: 'u2', permission: 'billing.manage', companyId: 'c1', role: 'member', reason: 'ROLE_TOO_LOW' }])
})

test('authorizeCompanyAction: shadow でも、通る操作は記録しない', async () => {
  const { db } = fakeDb({ owned: { u1: 'c1' } })
  const seen: ShadowDenial[] = []
  const r = await authorizeCompanyAction({ userId: 'u1', permission: 'billing.manage', mode: 'shadow', db, onShadowDenial: (d) => seen.push(d) })
  assert.equal(r.allowed, true)
  assert.equal(seen.length, 0)
})

test('authorizeCompanyAction: enforce は判定どおりに止める', async () => {
  const { db } = fakeDb({ owned: { u1: 'c1' }, members: { u2: { companyId: 'c1', role: 'member' }, u3: { companyId: 'c1', role: 'manager' } } })
  const owner = await authorizeCompanyAction({ userId: 'u1', permission: 'billing.manage', mode: 'enforce', db })
  const member = await authorizeCompanyAction({ userId: 'u2', permission: 'billing.manage', mode: 'enforce', db })
  assert.equal(owner.allowed, true)
  assert.equal(member.allowed, false)
  const target = { isSelf: false, sameDepartment: false }
  const other = await authorizeCompanyAction({ userId: 'u3', permission: 'kintai.request.approve.department', target, mode: 'enforce', db })
  assert.equal(other.allowed, false)
  assert.equal(other.checked && !other.decision.ok && other.decision.reason, 'NOT_DEPARTMENT')
})

test('authorizeCompanyAction: scope なしで会社に入っていない人は、enforce で止まる（NO_COMPANY）。shadow は通して記録する', async () => {
  const { db } = fakeDb({})
  const r = await authorizeCompanyAction({ userId: 'x', permission: 'company.view', mode: 'enforce', db })
  assert.equal(r.allowed, false)
  assert.deepEqual(r.checked && r.decision, { ok: false, reason: 'NO_COMPANY' })
  const seen: ShadowDenial[] = []
  const s2 = await authorizeCompanyAction({ userId: 'x', permission: 'company.view', mode: 'shadow', db, onShadowDenial: (d) => seen.push(d) })
  assert.equal(s2.allowed, true)
  assert.equal(seen.length, 1)
})

test('authorizeCompanyAction: scope ありで、組織が会社に属していないなら止めない（1人で使う人。監査の重大2）', async () => {
  const { db } = fakeDb({ orgs: {} })
  for (const mode of ['shadow', 'enforce'] as CompanyRolesMode[]) {
    const r = await authorizeCompanyAction({ userId: 'x', permission: 'invoice.issue', mode, db, scope: { tool: 'income', organizationId: 'solo' } })
    assert.equal(r.allowed, true, mode)
  }
})

test('authorizeCompanyAction: scope があれば、組織が属する会社で判定する（自分で作った別の会社の持ち主でも、ほかの会社の組織ではその会社の役割）', async () => {
  // u6 は会社 c1 のゲスト。自分で会社 c9 を作った（持ち主）
  const { db } = fakeDb({ owned: { u6: 'c9' }, members: { u6: { companyId: 'c1', role: 'guest' } }, orgs: { o1: { companyId: 'c1', ownerUserId: 'u1' }, o9: { companyId: 'c9', ownerUserId: 'u6' } } })
  const inC1 = await authorizeCompanyAction({ userId: 'u6', permission: 'invoice.issue', mode: 'enforce', db, scope: { tool: 'income', organizationId: 'o1' } })
  assert.equal(inC1.allowed, false)
  assert.deepEqual(inC1.checked && inC1.context, { companyId: 'c1', role: 'guest' })
  const inC9 = await authorizeCompanyAction({ userId: 'u6', permission: 'invoice.issue', mode: 'enforce', db, scope: { tool: 'income', organizationId: 'o9' } })
  assert.equal(inC9.allowed, true)
  // 会社に属していない組織では止めない
  const free = await authorizeCompanyAction({ userId: 'u6', permission: 'invoice.issue', mode: 'enforce', db, scope: { tool: 'income', organizationId: 'nobody-org' } })
  assert.equal(free.allowed, true)
})

test('authorizeCompanyAction: policy を DB から読んで使う（請求書の発行をマネージャーからはずす）', async () => {
  const members = { u3: { companyId: 'c1', role: 'manager' }, u4: { companyId: 'c1', role: 'billing' }, u5: { companyId: 'c2', role: 'manager' } }
  const { db, calls } = fakeDb({ members, policy: { c1: { invoiceIssueMin: 'admin' } } })
  const run = (userId: string) => authorizeCompanyAction({ userId, permission: 'invoice.issue', mode: 'enforce', db })
  assert.equal((await run('u3')).allowed, false, 'c1 のマネージャーは policy で止まる')
  assert.equal((await run('u4')).allowed, true, '請求の担当はいつもできる')
  assert.equal((await run('u5')).allowed, true, 'c2 は policy 無し（既定）なのでマネージャーはできる')
  assert.equal(calls.policy, 3)
})

test('authorizeCompanyAction: policy の JSON が壊れていても、既定に戻して判定する', async () => {
  const { db } = fakeDb({ members: { u3: { companyId: 'c1', role: 'manager' } }, policy: { c1: 'broken' } })
  const r = await authorizeCompanyAction({ userId: 'u3', permission: 'invoice.issue', mode: 'enforce', db })
  assert.equal(r.allowed, true)
})

test('applyCompanyCeiling: off はそのまま返し、DB を読まない', async () => {
  const { db, calls } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u2', toolRole: 'system_admin', mode: 'off', db }), 'system_admin')
  assert.deepEqual(calls, { owned: 0, member: 0, policy: 0 })
})

test('applyCompanyCeiling: 会社に属していない組織の人は、どのモードでもそのまま', async () => {
  const { db } = fakeDb({ orgs: {} })
  for (const mode of ['shadow', 'enforce'] as CompanyRolesMode[]) {
    assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'x', toolRole: 'system_admin', mode, db }), 'system_admin', mode)
  }
})

test('applyCompanyCeiling: shadow は下がるはずだったことを記録して、そのまま返す', async () => {
  const { db } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  const seen: unknown[] = []
  const r = await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u2', toolRole: 'system_admin', mode: 'shadow', db, onShadowClamp: (d) => seen.push(d) })
  assert.equal(r, 'system_admin')
  assert.deepEqual(seen, [{ userId: 'u2', tool: 'kintai', toolRole: 'system_admin', companyRole: 'member', effective: 'employee' }])
})

test('applyCompanyCeiling: shadow でも、下がらないなら記録しない', async () => {
  const { db } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  const seen: unknown[] = []
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u2', toolRole: 'employee', mode: 'shadow', db, onShadowClamp: (d) => seen.push(d) }), 'employee')
  assert.equal(seen.length, 0)
})

test('applyCompanyCeiling: enforce は下げる。ゲストはプロマネ以外で null。オーナーは下がらない', async () => {
  const { db } = fakeDb({
    owned: { u1: 'c1' },
    members: { u2: { companyId: 'c1', role: 'member' }, u6: { companyId: 'c1', role: 'guest' }, u7: { companyId: 'c1', role: 'admin' }, u8: { companyId: 'c1', role: 'billing' } },
  })
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u2', toolRole: 'system_admin', mode: 'enforce', db }), 'employee')
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u7', toolRole: 'system_admin', mode: 'enforce', db }), 'hr_admin')
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'expense', userId: 'u6', toolRole: 'member', mode: 'enforce', db }), null)
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'promane', userId: 'u6', toolRole: 'admin', mode: 'enforce', db }), 'guest')
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u1', toolRole: 'system_admin', mode: 'enforce', db }), 'system_admin')
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'income', userId: 'u8', toolRole: 'owner', mode: 'enforce', db }), 'admin')
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'expense', userId: 'u8', toolRole: 'admin', mode: 'enforce', db }), 'member')
})

test('applyCompanyCeiling: ツールの役割が知らない値なら、enforce で null（使えない）', async () => {
  const { db } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u2', toolRole: 'bogus', mode: 'enforce', db }), null)
})

test('applyCompanyCeiling: 自分で会社を作っても、ほかの会社の組織では上限が当たる（監査の重大1）', async () => {
  const { db } = fakeDb({ owned: { u6: 'c9' }, members: { u6: { companyId: 'c1', role: 'guest' } }, orgs: { o1: { companyId: 'c1', ownerUserId: 'u1' }, o9: { companyId: 'c9', ownerUserId: 'u6' } } })
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'u6', toolRole: 'system_admin', mode: 'enforce', db }), null)
  assert.equal(await applyCompanyCeiling({ organizationId: 'o9', tool: 'kintai', userId: 'u6', toolRole: 'system_admin', mode: 'enforce', db }), 'system_admin')
})

test('applyCompanyCeiling: 会社のメンバーでない人（ツールだけに招かれた人）は、メンバーの上限', async () => {
  const { db } = fakeDb({})
  assert.equal(await applyCompanyCeiling({ organizationId: 'o1', tool: 'kintai', userId: 'outsider', toolRole: 'hr_admin', mode: 'enforce', db }), 'employee')
})

test('applyCompanyCeiling: 会社に属していない組織では、上限を当てない', async () => {
  const { db } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  assert.equal(await applyCompanyCeiling({ organizationId: 'own-org', tool: 'kintai', userId: 'u2', toolRole: 'system_admin', mode: 'enforce', db }), 'system_admin')
})
