// 実行: npm run test:roles
// 会社の役割（ROLES-2026-10-26.md）の決まりを確かめる。DB には触らない（偽の DB を渡す）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canGrantCompanyRole, canManageCompanyMember, grantableCompanyRoles, hasMinCompanyRole, COMPANY_ROLES, type CompanyRole } from './roles'
import { canCompany, decideCompanyPermission, permissionMatrix, PERMISSIONS } from './permissions'
import { effectiveToolRole, proposeCompanyRole, wouldBeClamped, TOOL_ROLE_TABLES, type ToolId } from './tool-roles'
import { companyRolesRollout, decideCompanyRolesMode } from './rollout'
import { authorizeCompanyAction, buildRoleEvent, resolveCompanyRole, type CompanyRoleDb } from './access'

const ROLES = COMPANY_ROLES as readonly CompanyRole[]

// ---- 勤怠: ユーザーの心配（社員が勤怠を全部直せてしまう）に当たるもの ----

test('メンバーは他人の勤怠を直せない（自分の勤怠も直接は直せない）', () => {
  assert.equal(canCompany('member', 'kintai.attendance.edit.all', { isSelf: false }), false)
  assert.equal(canCompany('member', 'kintai.attendance.edit.all', { isSelf: true }), false)
})

test('メンバーは自分の打刻と申請だけができる。他人の分はできない', () => {
  assert.equal(canCompany('member', 'kintai.clock.self', { isSelf: true }), true)
  assert.equal(canCompany('member', 'kintai.request.create.self', { isSelf: true }), true)
  assert.equal(canCompany('member', 'kintai.clock.self', { isSelf: false }), false)
  assert.equal(canCompany('member', 'kintai.request.create.self', {}), false)
})

test('メンバーは申請を承認できない。就業ルールと社員の登録もできない', () => {
  for (const p of ['kintai.request.approve.department', 'kintai.request.approve.all', 'kintai.workrule.manage', 'kintai.employee.manage', 'kintai.export'] as const) {
    assert.equal(canCompany('member', p, { isSelf: false, sameDepartment: true }), false, p)
  }
})

test('マネージャーは自分の部署の人の申請だけを承認できる。自分の申請と、ほかの部署の申請はできない', () => {
  assert.equal(canCompany('manager', 'kintai.request.approve.department', { isSelf: false, sameDepartment: true }), true)
  assert.equal(canCompany('manager', 'kintai.request.approve.department', { isSelf: false, sameDepartment: false }), false)
  assert.equal(canCompany('manager', 'kintai.request.approve.department', { isSelf: true, sameDepartment: true }), false)
  assert.equal(canCompany('manager', 'kintai.request.approve.all', { isSelf: false }), false)
  assert.equal(canCompany('manager', 'kintai.attendance.edit.all', { isSelf: false, sameDepartment: true }), false)
})

test('管理者は他人の勤怠を直せるが、自分の勤怠は直せない（オーナーだけ自分の分も可）', () => {
  assert.equal(canCompany('admin', 'kintai.attendance.edit.all', { isSelf: false }), true)
  assert.equal(decideCompanyPermission('admin', 'kintai.attendance.edit.all', { isSelf: true }).ok, false)
  assert.equal(canCompany('owner', 'kintai.attendance.edit.all', { isSelf: true }), true)
})

test('ゲストは勤怠で何もできない', () => {
  for (const p of Object.keys(PERMISSIONS).filter((k) => k.startsWith('kintai.'))) {
    assert.equal(canCompany('guest', p, { isSelf: true, sameDepartment: true }), false, p)
  }
})

// ---- 会社・契約 ----

test('契約と支払い・ドヤパワーの追加購入・会社の削除はオーナーだけ', () => {
  for (const p of ['billing.manage', 'power.purchase', 'company.delete', 'company.owner.transfer'] as const) {
    for (const r of ROLES) assert.equal(canCompany(r, p), r === 'owner', `${p} ${r}`)
  }
})

test('見積の確定はマネージャー以上。請求書の発行は初期値でマネージャー以上', () => {
  assert.equal(canCompany('member', 'quote.finalize'), false)
  assert.equal(canCompany('manager', 'quote.finalize'), true)
  assert.equal(canCompany('member', 'invoice.issue'), false)
  assert.equal(canCompany('manager', 'invoice.issue'), true)
})

test('HR: 部下の評価はマネージャーの自分の部署だけ。機微な情報は管理者以上', () => {
  assert.equal(canCompany('manager', 'hr.evaluation.department', { isSelf: false, sameDepartment: true }), true)
  assert.equal(canCompany('manager', 'hr.evaluation.department', { isSelf: true, sameDepartment: true }), false)
  assert.equal(canCompany('manager', 'hr.sensitive.view', {}), false)
  assert.equal(canCompany('admin', 'hr.sensitive.view', {}), true)
})

test('エージェントの実行はメンバー以上（ゲストは不可）', () => {
  assert.equal(canCompany('guest', 'agent.run'), false)
  assert.equal(canCompany('member', 'agent.run'), true)
})

test('知らない役割・知らない操作は、すべて拒否する', () => {
  assert.deepEqual(decideCompanyPermission('ADMIN', 'kintai.clock.self', { isSelf: true }), { ok: false, reason: 'UNKNOWN_ROLE' })
  assert.deepEqual(decideCompanyPermission('owner', 'kintai.anything'), { ok: false, reason: 'UNKNOWN_PERMISSION' })
  assert.equal(canCompany(undefined, 'company.view'), false)
  assert.equal(hasMinCompanyRole('superuser', 'guest'), false)
})

test('できること表は、上の役割ほど広い（請求の担当を除く順番の役割で、下ができることは上もできる）', () => {
  const ladder: CompanyRole[] = ['owner', 'admin', 'manager', 'member', 'guest']
  for (const row of permissionMatrix()) {
    const idx = row.allowed.filter((r) => r !== 'billing').map((r) => ladder.indexOf(r))
    idx.forEach((v, i) => assert.equal(v, i, row.permission))
  }
})

test('請求の担当: 料金と請求を見て、請求書を発行できる。支払いの変更・承認・設定はできない', () => {
  assert.equal(canCompany('billing', 'billing.view'), true)
  assert.equal(canCompany('billing', 'invoice.issue'), true)
  assert.equal(canCompany('billing', 'invoice.void'), true)
  assert.equal(canCompany('billing', 'billing.manage'), false)
  assert.equal(canCompany('billing', 'power.purchase'), false)
  assert.equal(canCompany('billing', 'kintai.request.approve.department', { isSelf: false, sameDepartment: true }), false)
  assert.equal(canCompany('billing', 'kintai.attendance.edit.all', { isSelf: false }), false)
  assert.equal(canCompany('billing', 'kintai.clock.self', { isSelf: true }), true)
  assert.equal(canCompany('billing', 'members.invite'), false)
})

// ---- 役割の変更 ----

test('役割の変更: 自分自身とオーナーは変えられない。管理者は同じ管理者を変えられない', () => {
  assert.equal(canManageCompanyMember({ actor: 'admin', target: 'admin', isSelf: false }), false)
  assert.equal(canManageCompanyMember({ actor: 'admin', target: 'manager', isSelf: false }), true)
  assert.equal(canManageCompanyMember({ actor: 'owner', target: 'admin', isSelf: false }), true)
  assert.equal(canManageCompanyMember({ actor: 'owner', target: 'owner', isSelf: true }), false)
  assert.equal(canManageCompanyMember({ actor: 'admin', target: 'member', isSelf: true }), false)
  assert.equal(canManageCompanyMember({ actor: 'manager', target: 'member', isSelf: false }), false)
})

test('付けられる役割: オーナーは管理者まで、管理者はマネージャーまで。オーナーは誰も付けられない', () => {
  assert.deepEqual(grantableCompanyRoles('owner'), ['admin', 'manager', 'billing', 'member', 'guest'])
  assert.deepEqual(grantableCompanyRoles('admin'), ['manager', 'billing', 'member', 'guest'])
  assert.deepEqual(grantableCompanyRoles('manager'), [])
  for (const r of ROLES) assert.equal(canGrantCompanyRole(r, 'owner'), false, r)
})

// ---- ツールの役割とのつながり ----

test('ツールの中の役割は、会社の役割の上限で下がる（勤怠のシステム管理者でも、会社のメンバーなら一般）', () => {
  assert.deepEqual(effectiveToolRole('kintai', 'system_admin', 'member'), { role: 'employee', clamped: true })
  assert.deepEqual(effectiveToolRole('kintai', 'hr_admin', 'admin'), { role: 'hr_admin', clamped: false })
  assert.deepEqual(effectiveToolRole('kintai', 'system_admin', 'admin'), { role: 'hr_admin', clamped: true })
  assert.deepEqual(effectiveToolRole('kintai', 'system_admin', 'owner'), { role: 'system_admin', clamped: false })
  assert.deepEqual(effectiveToolRole('hr', 'OWNER', 'manager'), { role: 'MANAGER', clamped: true })
  assert.deepEqual(effectiveToolRole('sfa', 'owner', 'guest'), { role: null, clamped: true })
  assert.deepEqual(effectiveToolRole('promane', 'member', 'guest'), { role: 'guest', clamped: true })
  assert.deepEqual(effectiveToolRole('kintai', 'hr_admin', 'billing'), { role: 'employee', clamped: true })
  assert.equal(effectiveToolRole('kintai', 'superuser', 'owner').role, null)
})

test('会社の役割で、ツールの役割が上がることはない', () => {
  for (const tool of Object.keys(TOOL_ROLE_TABLES) as ToolId[]) {
    const order = TOOL_ROLE_TABLES[tool].order
    for (const toolRole of order) {
      for (const r of ROLES) {
        const e = effectiveToolRole(tool, toolRole, r)
        assert.ok(e.role === null || order.indexOf(e.role) <= order.indexOf(toolRole), `${tool} ${toolRole} ${r}`)
      }
    }
  }
})

test('移行の案: いちばん高いツールの役割を写す。ツールの owner は会社の管理者（オーナーにはしない）', () => {
  assert.equal(proposeCompanyRole([]), 'member')
  assert.equal(proposeCompanyRole([{ tool: 'kintai', role: 'employee' }, { tool: 'sfa', role: 'manager' }]), 'manager')
  assert.equal(proposeCompanyRole([{ tool: 'kintai', role: 'system_admin' }]), 'admin')
  assert.equal(proposeCompanyRole([{ tool: 'sfa', role: 'owner' }]), 'admin')
  assert.equal(proposeCompanyRole([{ tool: 'promane', role: 'guest' }]), 'guest')
  assert.equal(proposeCompanyRole([{ tool: 'kintai', role: 'nonsense' }]), 'member')
  assert.deepEqual(wouldBeClamped([{ tool: 'kintai', role: 'hr_admin' }, { tool: 'sfa', role: 'member' }], 'member'), [{ tool: 'kintai', role: 'hr_admin' }])
})

// ---- 旗 ----

test('旗: 既定は off。知らない値も off', () => {
  assert.equal(companyRolesRollout(undefined), 'off')
  assert.equal(companyRolesRollout('on'), 'off')
  assert.equal(companyRolesRollout(' SHADOW '), 'shadow')
  assert.equal(decideCompanyRolesMode({ rollout: 'preview', email: 'a@example.com', allow: ['a@example.com'] }), 'enforce')
  assert.equal(decideCompanyRolesMode({ rollout: 'preview', email: 'b@example.com', allow: ['a@example.com'] }), 'shadow')
  assert.equal(decideCompanyRolesMode({ rollout: 'all', email: null, allow: [] }), 'enforce')
})

// ---- サーバーの判定（偽の DB） ----

function fakeDb(opts: { owned?: Record<string, string>; members?: Record<string, { companyId: string; role: string }> }) {
  const calls = { owned: 0, member: 0 }
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
  }
  return { db, calls }
}

test('持ち主はオーナー、参加しているメンバーは行の役割。知らない値はゲストに倒す', async () => {
  const { db } = fakeDb({ owned: { u1: 'c1' }, members: { u2: { companyId: 'c1', role: 'manager' }, u3: { companyId: 'c1', role: 'owner' } } })
  assert.deepEqual(await resolveCompanyRole('u1', db), { companyId: 'c1', role: 'owner' })
  assert.deepEqual(await resolveCompanyRole('u2', db), { companyId: 'c1', role: 'manager' })
  // 行に owner と書かれていても、持ち主でなければオーナーにしない
  assert.deepEqual(await resolveCompanyRole('u3', db), { companyId: 'c1', role: 'guest' })
  assert.equal(await resolveCompanyRole('nobody', db), null)
})

test('旗が off なら DB を読まずに通す（今の各ツールの判定だけが効く）', async () => {
  const { db, calls } = fakeDb({})
  const r = await authorizeCompanyAction({ userId: 'u', permission: 'kintai.attendance.edit.all', mode: 'off', db })
  assert.equal(r.allowed, true)
  assert.equal(r.checked, false)
  assert.deepEqual(calls, { owned: 0, member: 0 })
})

test('enforce: メンバーが他人の勤怠を直そうとすると止まる。shadow なら通して記録する', async () => {
  const { db } = fakeDb({ members: { u2: { companyId: 'c1', role: 'member' } } })
  const enforce = await authorizeCompanyAction({ userId: 'u2', permission: 'kintai.attendance.edit.all', target: { isSelf: false }, mode: 'enforce', db })
  assert.equal(enforce.allowed, false)
  const denials: unknown[] = []
  const shadow = await authorizeCompanyAction({ userId: 'u2', permission: 'kintai.attendance.edit.all', target: { isSelf: false }, mode: 'shadow', db, onShadowDenial: (d) => denials.push(d) })
  assert.equal(shadow.allowed, true)
  assert.equal(denials.length, 1)
})

test('会社に入っていない人は、enforce で止まる', async () => {
  const { db } = fakeDb({})
  const r = await authorizeCompanyAction({ userId: 'u9', permission: 'tool.use', mode: 'enforce', db })
  assert.equal(r.allowed, false)
})

test('変更の記録: メールは小文字、メモは500文字まで', () => {
  const e = buildRoleEvent({ companyId: 'c', actorUserId: 'a', targetMemberId: 'm', targetEmail: ' A@Example.com ', kind: 'role_changed', fromRole: 'member', toRole: 'manager', note: 'x'.repeat(600) })
  assert.equal(e.targetEmail, 'a@example.com')
  assert.equal(e.note?.length, 500)
})

// ---- 設計書と表がずれていない ----

test('設計書の「できること表」に、すべての操作が載っている', () => {
  const doc = readFileSync(join(process.cwd(), 'docs/architecture/management-agent/ROLES-2026-10-26.md'), 'utf8')
  for (const p of Object.keys(PERMISSIONS)) assert.ok(doc.includes('`' + p + '`'), p)
})

test('判定の関数は、クライアントの部品から読まれていない（サーバーだけで判定する）', () => {
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const src = readFileSync(p, 'utf8')
        if (/^['"]use client['"]/m.test(src) && /company-roles\/access/.test(src)) offenders.push(p)
      }
    }
  }
  walk(join(process.cwd(), 'src'))
  assert.deepEqual(offenders, [])
})
