// 実行: npm run test:roles
// ツールの役割と会社の役割の上限（tool-roles.ts）、移行の案（migration.ts）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COMPANY_ROLES, type CompanyRole } from './roles'
import { buildMigrationPlan } from './migration'
import { effectiveToolRole, lowerToolRole, proposeCompanyRole, TOOL_ROLE_TABLES, wouldBeClamped, type ToolId } from './tool-roles'

const TOOLS = Object.keys(TOOL_ROLE_TABLES) as ToolId[]
const orderOf = (tool: ToolId) => TOOL_ROLE_TABLES[tool].order

// ツールごとの「会社の役割 → 上限」の期待（表を明示する）
const CEILING: Record<ToolId, Record<CompanyRole, string | null>> = {
  kintai: { owner: 'system_admin', admin: 'hr_admin', manager: 'manager', billing: 'employee', member: 'employee', guest: null },
  hr: { owner: 'OWNER', admin: 'ADMIN', manager: 'MANAGER', billing: 'MEMBER', member: 'MEMBER', guest: null },
  promane: { owner: 'owner', admin: 'admin', manager: 'member', billing: 'member', member: 'member', guest: 'guest' },
  expense: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  income: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'admin', member: 'member', guest: null },
  quote: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  sfa: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  shodan: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  aio: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  mensetsu: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  aishodan: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
}

test('全ツール × ツールの全役割 × 会社の全役割: 結果は上限どおりで、ツールの役割より上がらない', () => {
  let n = 0
  for (const tool of TOOLS) {
    const order = orderOf(tool)
    for (const toolRole of order) {
      for (const company of COMPANY_ROLES) {
        const cap = CEILING[tool][company]
        const e = effectiveToolRole(tool, toolRole, company)
        const tag = `${tool}/${toolRole}/${company}`
        if (cap === null) {
          assert.deepEqual(e, { role: null, clamped: true }, tag)
        } else if (order.indexOf(toolRole) > order.indexOf(cap)) {
          assert.deepEqual(e, { role: cap, clamped: true }, tag)
        } else {
          assert.deepEqual(e, { role: toolRole, clamped: false }, tag)
        }
        // 上がらない
        if (e.role !== null) assert.ok(order.indexOf(e.role) <= order.indexOf(toolRole), `上がった ${tag}`)
        n++
      }
    }
  }
  assert.ok(n > 200)
})

test('ゲストは、ゲストの役割があるツール（プロマネ）でだけ guest になる。ほかのツールは使えない（null）', () => {
  for (const tool of TOOLS) {
    const role = orderOf(tool)[orderOf(tool).length - 1]
    const e = effectiveToolRole(tool, role, 'guest')
    if (tool === 'promane') assert.deepEqual(e, { role: 'guest', clamped: true })
    else assert.deepEqual(e, { role: null, clamped: true }, tool)
  }
  assert.deepEqual(effectiveToolRole('promane', 'guest', 'guest'), { role: 'guest', clamped: false })
})

test('請求の担当は、収入だけ上限が管理者。ほかのツールはメンバー相当', () => {
  assert.equal(effectiveToolRole('income', 'owner', 'billing').role, 'admin')
  assert.equal(effectiveToolRole('income', 'admin', 'billing').role, 'admin')
  assert.equal(effectiveToolRole('income', 'manager', 'billing').clamped, false)
  for (const tool of TOOLS.filter((t) => t !== 'income')) {
    const order = orderOf(tool)
    const top = order[order.length - 1]
    const member = tool === 'kintai' ? 'employee' : tool === 'hr' ? 'MEMBER' : 'member'
    assert.equal(effectiveToolRole(tool, top, 'billing').role, member, tool)
  }
})

test('オーナーはどのツールでも下がらない', () => {
  for (const tool of TOOLS) for (const r of orderOf(tool)) assert.deepEqual(effectiveToolRole(tool, r, 'owner'), { role: r, clamped: false }, `${tool}/${r}`)
})

test('effectiveToolRole: 知らないツールの役割（null・数値・別のツールの表記・大文字小文字違い）は使えない（clamped は false）', () => {
  for (const bad of [null, undefined, 3, {}, '', 'superadmin', 'ADMIN', 'hr_admin']) {
    assert.deepEqual(effectiveToolRole('expense', bad, 'owner'), { role: null, clamped: false }, String(bad))
  }
  assert.deepEqual(effectiveToolRole('kintai', 'admin', 'owner'), { role: null, clamped: false })
})

test('lowerToolRole: 低いほうを返す。同じなら同じ値', () => {
  assert.equal(lowerToolRole('kintai', 'system_admin', 'employee'), 'employee')
  assert.equal(lowerToolRole('kintai', 'employee', 'system_admin'), 'employee')
  assert.equal(lowerToolRole('kintai', 'hr_admin', 'hr_admin'), 'hr_admin')
  assert.equal(lowerToolRole('hr', 'OWNER', 'MANAGER'), 'MANAGER')
  assert.equal(lowerToolRole('promane', 'admin', 'guest'), 'guest')
})

test('lowerToolRole: どちらかが知らない値・文字列でないなら null', () => {
  assert.equal(lowerToolRole('kintai', 'unknown', 'employee'), null)
  assert.equal(lowerToolRole('kintai', 'employee', 'unknown'), null)
  assert.equal(lowerToolRole('kintai', null, 'employee'), null)
  assert.equal(lowerToolRole('kintai', 'employee', undefined), null)
  assert.equal(lowerToolRole('hr', 'member', 'MEMBER'), null)
})

test('proposeCompanyRole: 何も無ければ member。いちばん高い写し先になる', () => {
  assert.equal(proposeCompanyRole([]), 'member')
  assert.equal(proposeCompanyRole([{ tool: 'expense', role: 'member' }]), 'member')
  assert.equal(proposeCompanyRole([{ tool: 'expense', role: 'member' }, { tool: 'sfa', role: 'manager' }]), 'manager')
  assert.equal(proposeCompanyRole([{ tool: 'kintai', role: 'hr_admin' }, { tool: 'sfa', role: 'manager' }]), 'admin')
  assert.equal(proposeCompanyRole([{ tool: 'promane', role: 'guest' }]), 'guest')
  assert.equal(proposeCompanyRole([{ tool: 'promane', role: 'guest' }, { tool: 'aio', role: 'member' }]), 'member')
})

test('proposeCompanyRole: ツールの owner は会社の admin に写す（会社のオーナーにはならない）', () => {
  for (const tool of TOOLS) {
    const top = orderOf(tool)[orderOf(tool).length - 1]
    assert.notEqual(proposeCompanyRole([{ tool, role: top }]), 'owner', tool)
  }
  assert.equal(proposeCompanyRole([{ tool: 'sfa', role: 'owner' }]), 'admin')
  assert.equal(proposeCompanyRole([{ tool: 'kintai', role: 'system_admin' }]), 'admin')
})

test('proposeCompanyRole: 知らない役割・知らないツールは数えない', () => {
  assert.equal(proposeCompanyRole([{ tool: 'sfa', role: 'wizard' }]), 'member')
  assert.equal(proposeCompanyRole([{ tool: 'nope' as ToolId, role: 'admin' }]), 'member')
  assert.equal(proposeCompanyRole([{ tool: 'nope' as ToolId, role: 'admin' }, { tool: 'sfa', role: 'manager' }]), 'manager')
})

test('wouldBeClamped: 下がるツールの行だけを返す', () => {
  const ms = [{ tool: 'kintai' as ToolId, role: 'system_admin' }, { tool: 'expense' as ToolId, role: 'member' }, { tool: 'sfa' as ToolId, role: 'admin' }]
  assert.deepEqual(wouldBeClamped(ms, 'owner'), [])
  assert.deepEqual(wouldBeClamped(ms, 'admin').map((m) => m.tool), ['kintai'])
  assert.deepEqual(wouldBeClamped(ms, 'member').map((m) => m.tool), ['kintai', 'sfa'])
  assert.deepEqual(wouldBeClamped(ms, 'guest').map((m) => m.tool), ['kintai', 'expense', 'sfa'])
  assert.deepEqual(wouldBeClamped([], 'guest'), [])
})

test('buildMigrationPlan: 会員ごとに、今の役割・案・下がるツールを出す', () => {
  const plan = buildMigrationPlan({
    members: [
      { id: 'm1', email: 'a@x.jp', userId: 'u1', role: 'member' },
      { id: 'm2', email: 'b@x.jp', userId: 'u2', role: 'admin' },
    ],
    memberships: [
      { userId: 'u1', tool: 'kintai', role: 'hr_admin' },
      { userId: 'u1', tool: 'expense', role: 'member' },
      { userId: 'u2', tool: 'sfa', role: 'member' },
      { userId: 'u3', tool: 'sfa', role: 'owner' },
    ],
  })
  assert.equal(plan.length, 2)
  assert.equal(plan[0].memberId, 'm1')
  assert.equal(plan[0].current, 'member')
  assert.equal(plan[0].proposed, 'admin')
  assert.deepEqual(plan[0].clampedNow.map((m) => m.tool), ['kintai'])
  assert.deepEqual(plan[0].clampedProposed, [])
  assert.equal(plan[1].proposed, 'member')
  assert.deepEqual(plan[1].clampedNow, [])
  assert.deepEqual(plan[1].clampedProposed, [])
})

test('buildMigrationPlan: userId が null の人は、ツールの役割を持たない扱い（案は member）', () => {
  const [row] = buildMigrationPlan({
    members: [{ id: 'm1', email: 'a@x.jp', userId: null, role: 'manager' }],
    memberships: [{ userId: 'u1', tool: 'sfa', role: 'owner' }],
  })
  assert.equal(row.current, 'manager')
  assert.equal(row.proposed, 'member')
  assert.deepEqual(row.clampedNow, [])
})

test('buildMigrationPlan: 行の役割が知らない値の人は、ゲストとして扱う（owner と書かれた行も guest）', () => {
  const plan = buildMigrationPlan({
    members: [
      { id: 'm1', email: 'a@x.jp', userId: 'u1', role: 'wizard' },
      { id: 'm2', email: 'b@x.jp', userId: 'u1', role: 'owner' },
    ],
    memberships: [{ userId: 'u1', tool: 'expense', role: 'member' }],
  })
  for (const row of plan) {
    assert.equal(row.current, 'guest')
    assert.deepEqual(row.clampedNow.map((m) => m.tool), ['expense'])
    assert.equal(row.proposed, 'member')
    assert.deepEqual(row.clampedProposed, [])
  }
})

test('buildMigrationPlan: 会員が空なら案も空', () => {
  assert.deepEqual(buildMigrationPlan({ members: [], memberships: [{ userId: 'u', tool: 'sfa', role: 'owner' }] }), [])
})
