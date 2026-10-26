// 実行: npm run test:roles
// 役割 × 操作 × 対象 の全部の組み合わせの「期待の表」。表はコードから作らず、設計の意図としてここに明示する。
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §3
// 対象: self = 自分の分 / dept = 同じ部署の他人 / other = ほかの部署の他人
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideCompanyPermission, PERMISSIONS, type CompanyPermission } from './permissions'
import { DEFAULT_ROLE_POLICY, type CompanyRolePolicy } from './policy'
import { COMPANY_ROLES, type CompanyRole } from './roles'

type Target = 'self' | 'dept' | 'other'
const TARGETS: Record<Target, { isSelf: boolean; sameDepartment: boolean }> = {
  self: { isSelf: true, sameDepartment: true },
  dept: { isSelf: false, sameDepartment: true },
  other: { isSelf: false, sameDepartment: false },
}

const G: CompanyRole = 'guest'
const M: CompanyRole = 'member'
const B: CompanyRole = 'billing'
const MG: CompanyRole = 'manager'
const A: CompanyRole = 'admin'
const O: CompanyRole = 'owner'

const NONE: CompanyRole[] = []
const EVERYONE = [G, M, B, MG, A, O]
const MEMBER_UP = [M, B, MG, A, O] // メンバー以上（請求の担当は順番ではメンバーと同じ）
const MANAGER_UP = [MG, A, O]
const ADMIN_UP = [A, O]
const OWNER_ONLY = [O]

// [操作, 自分の分, 同じ部署の他人, ほかの部署の他人] で通る役割（既定の policy）
const EXPECTED: Array<[CompanyPermission, CompanyRole[], CompanyRole[], CompanyRole[]]> = [
  // 会社・契約
  ['company.view', EVERYONE, EVERYONE, EVERYONE],
  ['company.settings.edit', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['company.delete', OWNER_ONLY, OWNER_ONLY, OWNER_ONLY],
  ['company.owner.transfer', OWNER_ONLY, OWNER_ONLY, OWNER_ONLY],
  ['members.view', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['members.invite', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['members.role.change', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['members.remove', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['members.role_events.view', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['billing.view', [B, A, O], [B, A, O], [B, A, O]],
  ['billing.manage', OWNER_ONLY, OWNER_ONLY, OWNER_ONLY],
  ['power.purchase', OWNER_ONLY, OWNER_ONLY, OWNER_ONLY],
  ['power.history.view', [B, A, O], [B, A, O], [B, A, O]],

  // 勤怠
  ['kintai.clock.self', MEMBER_UP, NONE, NONE],
  ['kintai.request.create.self', MEMBER_UP, NONE, NONE],
  ['kintai.attendance.view.self', MEMBER_UP, NONE, NONE],
  ['kintai.attendance.view.department', MANAGER_UP, MANAGER_UP, NONE],
  ['kintai.attendance.view.all', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['kintai.request.approve.department', OWNER_ONLY, MANAGER_UP, NONE],
  ['kintai.request.approve.all', OWNER_ONLY, ADMIN_UP, ADMIN_UP],
  ['kintai.attendance.edit.all', OWNER_ONLY, ADMIN_UP, ADMIN_UP],
  ['kintai.workrule.manage', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['kintai.employee.manage', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['kintai.export', ADMIN_UP, ADMIN_UP, ADMIN_UP],

  // 経費・支出
  ['expense.create.self', MEMBER_UP, NONE, NONE],
  ['expense.view.department', MANAGER_UP, MANAGER_UP, NONE],
  ['expense.view.all', [B, A, O], [B, A, O], [B, A, O]],
  ['expense.approve.department', OWNER_ONLY, MANAGER_UP, NONE],
  ['expense.approve.all', OWNER_ONLY, ADMIN_UP, ADMIN_UP],
  ['expense.edit.all', OWNER_ONLY, ADMIN_UP, ADMIN_UP],
  ['expense.settings', ADMIN_UP, ADMIN_UP, ADMIN_UP],

  // 請求・収入（既定: 発行はマネージャー以上と請求の担当、契約の金額はマネージャー以上）
  ['invoice.view', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['invoice.draft', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['invoice.issue', [B, MG, A, O], [B, MG, A, O], [B, MG, A, O]],
  ['invoice.void', [B, A, O], [B, A, O], [B, A, O]],
  ['income.contract.edit', MANAGER_UP, MANAGER_UP, MANAGER_UP],

  // 見積（既定: 確定はマネージャー以上。自分で作った見積は自分で確定できない。オーナーは可）
  ['quote.view', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['quote.draft', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['quote.finalize', OWNER_ONLY, MANAGER_UP, MANAGER_UP],
  ['quote.settings', ADMIN_UP, ADMIN_UP, ADMIN_UP],

  // HR（既定: 自分が評価される側の確定はオーナーだけ）
  ['hr.evaluation.self', MEMBER_UP, NONE, NONE],
  ['hr.evaluation.department', OWNER_ONLY, MANAGER_UP, NONE],
  ['hr.evaluation.finalize', OWNER_ONLY, ADMIN_UP, ADMIN_UP],
  ['hr.sensitive.view', ADMIN_UP, ADMIN_UP, ADMIN_UP],
  ['hr.settings', ADMIN_UP, ADMIN_UP, ADMIN_UP],

  // エージェント
  ['agent.run', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['agent.approve.self', MEMBER_UP, NONE, NONE],
  ['agent.settings', ADMIN_UP, ADMIN_UP, ADMIN_UP],

  // ほかのツールの共通
  ['tool.view', EVERYONE, EVERYONE, EVERYONE],
  ['tool.use', MEMBER_UP, MEMBER_UP, MEMBER_UP],
  ['tool.settings', ADMIN_UP, ADMIN_UP, ADMIN_UP],
]

const ok = (role: CompanyRole, p: CompanyPermission, t: Target, policy: CompanyRolePolicy = DEFAULT_ROLE_POLICY) => decideCompanyPermission(role, p, TARGETS[t], policy).ok

test('期待の表は、PERMISSIONS のすべての操作を、1回ずつ含む（操作を足したら表も足す）', () => {
  const inTable = EXPECTED.map((r) => r[0]).sort()
  assert.deepEqual(inTable, Object.keys(PERMISSIONS).sort())
})

test('役割 6 × 操作すべて × 対象 3 の全組み合わせが、期待の表どおり（既定の policy）', () => {
  let count = 0
  for (const [permission, self, dept, other] of EXPECTED) {
    const byTarget: Record<Target, CompanyRole[]> = { self, dept, other }
    for (const t of ['self', 'dept', 'other'] as Target[]) {
      for (const role of COMPANY_ROLES) {
        assert.equal(ok(role, permission, t), byTarget[t].includes(role), `${permission} / ${role} / ${t}`)
        count++
      }
    }
  }
  assert.equal(count, Object.keys(PERMISSIONS).length * 6 * 3)
})

// ---- 会社ごとの切り替え（独立した計算で期待を出す。表の既定とは別に、全選択肢の組み合わせを確かめる） ----

const RANK: Record<CompanyRole, number> = { guest: 0, member: 1, billing: 1, manager: 2, admin: 3, owner: 4 }
const POLICIES: CompanyRolePolicy[] = []
for (const invoiceIssueMin of ['manager', 'admin'] as const)
  for (const contractEditMin of ['member', 'manager', 'admin'] as const)
    for (const quoteFinalizeMin of ['manager', 'admin'] as const)
      for (const quoteSelfFinalize of ['allow', 'deny'] as const)
        for (const hrSelfFinalize of ['nobody', 'owner_only', 'owner_and_admin'] as const)
          POLICIES.push({ invoiceIssueMin, contractEditMin, quoteFinalizeMin, quoteSelfFinalize, hrSelfFinalize })

test('policy の全選択肢の組み合わせ（72 通り）× 役割 × 対象で、切り替えの 4 つの操作が決まりどおり', () => {
  assert.equal(POLICIES.length, 2 * 3 * 2 * 2 * 3)
  for (const policy of POLICIES) {
    for (const role of COMPANY_ROLES) {
      for (const t of ['self', 'dept', 'other'] as Target[]) {
        const tag = `${JSON.stringify(policy)} / ${role} / ${t}`
        // 請求書の発行: 請求の担当はいつもできる。ほかは min 以上
        assert.equal(ok(role, 'invoice.issue', t, policy), role === 'billing' || RANK[role] >= RANK[policy.invoiceIssueMin], `invoice.issue ${tag}`)
        // 契約: 請求の担当は順番ではメンバーと同じ。member の選択肢なら通り、それ以上の選択肢なら通らない
        const contractOk = role === 'billing' ? policy.contractEditMin === 'member' : RANK[role] >= RANK[policy.contractEditMin]
        assert.equal(ok(role, 'income.contract.edit', t, policy), contractOk, `income.contract.edit ${tag}`)
        // 見積の確定: min 以上。deny なら自分の分はオーナーだけ（請求の担当は min がマネージャー以上なので元から通らない）
        const quoteRank = role !== 'billing' && RANK[role] >= RANK[policy.quoteFinalizeMin]
        const quoteOk = quoteRank && (t !== 'self' || policy.quoteSelfFinalize === 'allow' ? true : role === 'owner' ? true : false)
        assert.equal(ok(role, 'quote.finalize', t, policy), quoteOk, `quote.finalize ${tag}`)
        // HR の評価の確定: 管理者以上。自分の分は policy.hrSelfFinalize で決まる
        let hrOk = role === 'admin' || role === 'owner'
        if (hrOk && t === 'self') hrOk = role === 'owner' ? policy.hrSelfFinalize !== 'nobody' : policy.hrSelfFinalize === 'owner_and_admin'
        assert.equal(ok(role, 'hr.evaluation.finalize', t, policy), hrOk, `hr.evaluation.finalize ${tag}`)
      }
    }
  }
})

test('quoteSelfFinalize が allow なら、見積を作った人も自分で確定できる（deny でもオーナーは可）', () => {
  const allow = { ...DEFAULT_ROLE_POLICY, quoteSelfFinalize: 'allow' as const }
  const deny = { ...DEFAULT_ROLE_POLICY, quoteSelfFinalize: 'deny' as const }
  for (const r of [MG, A, O] as CompanyRole[]) assert.equal(ok(r, 'quote.finalize', 'self', allow), true, r)
  assert.equal(ok(MG, 'quote.finalize', 'self', deny), false)
  assert.equal(ok(A, 'quote.finalize', 'self', deny), false)
  assert.equal(ok(O, 'quote.finalize', 'self', deny), true)
})

test('hrSelfFinalize: admin は owner_and_admin のときだけ、自分の分の評価を確定できる', () => {
  for (const v of ['nobody', 'owner_only', 'owner_and_admin'] as const) {
    const p = { ...DEFAULT_ROLE_POLICY, hrSelfFinalize: v }
    assert.equal(ok(A, 'hr.evaluation.finalize', 'self', p), v === 'owner_and_admin', `admin ${v}`)
    assert.equal(ok(O, 'hr.evaluation.finalize', 'self', p), v !== 'nobody', `owner ${v}`)
    assert.equal(ok(A, 'hr.evaluation.finalize', 'dept', p), true)
  }
})

// ---- ユーザーが心配している点（名前のわかるテスト） ----

test('勤怠: メンバーは他人の勤怠を直せない', () => {
  for (const t of ['dept', 'other'] as Target[]) assert.equal(ok(M, 'kintai.attendance.edit.all', t), false, t)
  assert.equal(ok(M, 'kintai.attendance.edit.all', 'self'), false)
})

test('勤怠: メンバーは他人の申請を承認できない（部署の分も全体の分も）', () => {
  for (const t of ['self', 'dept', 'other'] as Target[]) {
    assert.equal(ok(M, 'kintai.request.approve.department', t), false, `dept ${t}`)
    assert.equal(ok(M, 'kintai.request.approve.all', t), false, `all ${t}`)
  }
})

test('勤怠: マネージャーはほかの部署の申請を承認できない。自分の部署なら承認できる', () => {
  assert.equal(ok(MG, 'kintai.request.approve.department', 'other'), false)
  assert.equal(ok(MG, 'kintai.request.approve.department', 'dept'), true)
  assert.equal(ok(MG, 'kintai.request.approve.all', 'other'), false)
  assert.equal(ok(MG, 'kintai.attendance.view.department', 'other'), false)
})

test('勤怠: マネージャーは自分の申請を、自分で承認できない', () => {
  assert.equal(ok(MG, 'kintai.request.approve.department', 'self'), false)
})

test('請求の担当は支払い方法・契約の変更ができない', () => {
  assert.equal(ok(B, 'billing.manage', 'self'), false)
  assert.equal(ok(B, 'company.delete', 'self'), false)
  assert.equal(ok(B, 'members.role.change', 'dept'), false)
})

test('請求の担当はドヤパワーの購入ができない（履歴は見られる）', () => {
  assert.equal(ok(B, 'power.purchase', 'self'), false)
  assert.equal(ok(B, 'power.history.view', 'self'), true)
})

test('請求の担当は料金と請求を見て、請求書を発行・取り消せるが、見積の確定はできない', () => {
  assert.equal(ok(B, 'billing.view', 'self'), true)
  assert.equal(ok(B, 'invoice.issue', 'self'), true)
  assert.equal(ok(B, 'invoice.void', 'self'), true)
  assert.equal(ok(B, 'quote.finalize', 'dept'), false)
})

test('請求の担当は、勤怠の承認・他人の勤怠の閲覧・HR の機微な情報を扱えない', () => {
  assert.equal(ok(B, 'kintai.request.approve.department', 'dept'), false)
  assert.equal(ok(B, 'kintai.attendance.view.all', 'dept'), false)
  assert.equal(ok(B, 'hr.sensitive.view', 'dept'), false)
})

test('ゲストは見るだけ（会社とツールを見られる以外、何もできない）', () => {
  for (const p of Object.keys(PERMISSIONS) as CompanyPermission[]) {
    for (const t of ['self', 'dept', 'other'] as Target[]) assert.equal(ok(G, p, t), p === 'company.view' || p === 'tool.view', `${p} ${t}`)
  }
})

test('知らない役割・知らない操作は、どんな対象でも拒否される', () => {
  for (const t of ['self', 'dept', 'other'] as Target[]) {
    assert.deepEqual(decideCompanyPermission('superuser', 'company.view', TARGETS[t]), { ok: false, reason: 'UNKNOWN_ROLE' })
    assert.deepEqual(decideCompanyPermission('owner', 'company.explode', TARGETS[t]), { ok: false, reason: 'UNKNOWN_PERMISSION' })
  }
})
