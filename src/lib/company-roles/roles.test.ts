// 実行: npm run test:roles
// 役割の変更の決まり（roles.ts）。仕様: ROLES-2026-10-26.md §2
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canGrantCompanyRole, canManageCompanyMember, COMPANY_ROLES, decideRoleChange, grantableCompanyRoles, hasMinCompanyRole, lostAbilities, MEMBER_ROW_ROLES, type CompanyRole, type MemberRowRole } from './roles'

type Expected = { ok: true; from: MemberRowRole; to: MemberRowRole } | { ok: false; status: number; code: string }

// 期待の決まり（独立に書いた表）
//  1. 求める役割がメンバーの行に入れる5つ以外 → 400 INVALID_ROLE（オーナーを付ける要求も含む）
//  2. 相手の status が active / invited 以外 → 409 NOT_ACTIVE
//  3. 自分自身・オーナー・manager 以下の actor → 403 NOT_ALLOWED。admin は自分より下の相手（manager / billing / member / guest）だけ。owner は誰でも
//  4. admin が admin を付けようとする → 403 CANNOT_GRANT（admin は自分より下の役割にだけ。owner は 5 つ全部）
//  5. 今と同じ → 400 NO_CHANGE
function expected(actor: CompanyRole, target: MemberRowRole, requested: unknown, isSelf: boolean, status: string): Expected {
  if (!(MEMBER_ROW_ROLES as readonly unknown[]).includes(requested)) return { ok: false, status: 400, code: 'INVALID_ROLE' }
  if (status !== 'active' && status !== 'invited') return { ok: false, status: 409, code: 'NOT_ACTIVE' }
  if (isSelf) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const lowerThanAdmin = ['manager', 'billing', 'member', 'guest'].includes(target)
  const mayManage = actor === 'owner' || (actor === 'admin' && lowerThanAdmin)
  if (!mayManage) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const mayGrant = actor === 'owner' || (actor === 'admin' && requested !== 'admin')
  if (!mayGrant) return { ok: false, status: 403, code: 'CANNOT_GRANT' }
  if (target === requested) return { ok: false, status: 400, code: 'NO_CHANGE' }
  return { ok: true, from: target, to: requested as MemberRowRole }
}

test('decideRoleChange の全組み合わせ: actor 6 × 相手 5 × 求める役割 5 + 知らない値 × 自分か × status 3', () => {
  const requests: unknown[] = [...MEMBER_ROW_ROLES, 'owner', 'superuser', '', null, undefined, 3]
  let n = 0
  for (const actor of COMPANY_ROLES) {
    for (const target of MEMBER_ROW_ROLES) {
      for (const requested of requests) {
        for (const isSelf of [false, true]) {
          for (const status of ['active', 'invited', 'removed']) {
            const got = decideRoleChange({ actor, isSelf, targetRole: target, targetStatus: status, requested })
            assert.deepEqual(got, expected(actor, target, requested, isSelf, status), `${actor}/${target}->${String(requested)}/self=${isSelf}/${status}`)
            n++
          }
        }
      }
    }
  }
  assert.equal(n, 6 * 5 * 11 * 2 * 3)
})

test('decideRoleChange: status が active / invited 以外はすべて NOT_ACTIVE（空・大文字・removed・left）', () => {
  for (const status of ['', 'ACTIVE', 'removed', 'left', 'pending']) {
    assert.deepEqual(decideRoleChange({ actor: 'owner', isSelf: false, targetRole: 'member', targetStatus: status, requested: 'manager' }), { ok: false, status: 409, code: 'NOT_ACTIVE' }, status)
  }
})

test('decideRoleChange: 行の役割が知らない値（owner と書かれた行を含む）なら、ゲストとして扱う', () => {
  for (const row of ['owner', 'wizard', '', null, 7]) {
    assert.deepEqual(decideRoleChange({ actor: 'owner', isSelf: false, targetRole: row, targetStatus: 'active', requested: 'member' }), { ok: true, from: 'guest', to: 'member' }, String(row))
    assert.deepEqual(decideRoleChange({ actor: 'owner', isSelf: false, targetRole: row, targetStatus: 'active', requested: 'guest' }), { ok: false, status: 400, code: 'NO_CHANGE' }, String(row))
  }
})

test('decideRoleChange: 管理者は同じ管理者の役割を変えられない（自分より下の人だけ）', () => {
  assert.deepEqual(decideRoleChange({ actor: 'admin', isSelf: false, targetRole: 'admin', targetStatus: 'active', requested: 'member' }), { ok: false, status: 403, code: 'NOT_ALLOWED' })
  assert.deepEqual(decideRoleChange({ actor: 'admin', isSelf: false, targetRole: 'member', targetStatus: 'active', requested: 'admin' }), { ok: false, status: 403, code: 'CANNOT_GRANT' })
  assert.deepEqual(decideRoleChange({ actor: 'admin', isSelf: false, targetRole: 'member', targetStatus: 'invited', requested: 'billing' }), { ok: true, from: 'member', to: 'billing' })
})

test('decideRoleChange: マネージャー以下は誰の役割も変えられない', () => {
  for (const actor of ['manager', 'billing', 'member', 'guest'] as CompanyRole[]) {
    for (const target of MEMBER_ROW_ROLES) {
      const r = decideRoleChange({ actor, isSelf: false, targetRole: target, targetStatus: 'active', requested: 'member' })
      assert.equal(r.ok, false, `${actor}/${target}`)
      if (!r.ok) assert.equal(r.status, 403)
    }
  }
})

test('canManageCompanyMember / canGrantCompanyRole / grantableCompanyRoles の全組み合わせ', () => {
  for (const actor of COMPANY_ROLES) {
    for (const target of COMPANY_ROLES) {
      for (const isSelf of [false, true]) {
        const want = !isSelf && target !== 'owner' && (actor === 'owner' || (actor === 'admin' && ['manager', 'billing', 'member', 'guest'].includes(target)))
        assert.equal(canManageCompanyMember({ actor, target, isSelf }), want, `${actor}/${target}/${isSelf}`)
      }
      const grant = target !== 'owner' && (actor === 'owner' || (actor === 'admin' && target !== 'admin'))
      assert.equal(canGrantCompanyRole(actor, target), grant, `grant ${actor}/${target}`)
    }
  }
  assert.deepEqual(grantableCompanyRoles('owner'), ['admin', 'manager', 'billing', 'member', 'guest'])
  assert.deepEqual(grantableCompanyRoles('admin'), ['manager', 'billing', 'member', 'guest'])
  for (const r of ['manager', 'billing', 'member', 'guest'] as CompanyRole[]) assert.deepEqual(grantableCompanyRoles(r), [], r)
})

test('hasMinCompanyRole: 請求の担当はメンバーと同じ順番。知らない値は常に false', () => {
  assert.equal(hasMinCompanyRole('billing', 'member'), true)
  assert.equal(hasMinCompanyRole('member', 'billing'), true)
  assert.equal(hasMinCompanyRole('billing', 'manager'), false)
  assert.equal(hasMinCompanyRole('guest', 'member'), false)
  assert.equal(hasMinCompanyRole('owner', 'owner'), true)
  for (const bad of ['root', null, undefined, 1, '']) assert.equal(hasMinCompanyRole(bad, 'guest'), false)
})

test('lostAbilities: 管理者から下げると、設定と役割の変更ができなくなる旨が出る', () => {
  const lost = lostAbilities('admin', 'member')
  assert.equal(lost.some((s) => s.includes('設定')), true)
  assert.equal(lost.some((s) => s.includes('招待') || s.includes('役割の変更')), true)
  assert.equal(lost.some((s) => s.includes('承認')), true)
})

test('lostAbilities: マネージャーからメンバーに下げると、承認ができなくなる旨だけが出る', () => {
  const lost = lostAbilities('manager', 'member')
  assert.equal(lost.length, 1)
  assert.match(lost[0], /承認/)
})

test('lostAbilities: 請求の担当から下げると、料金と請求の旨が出る。承認の旨は出ない', () => {
  const lost = lostAbilities('billing', 'member')
  assert.equal(lost.length, 1)
  assert.match(lost[0], /料金と請求/)
  assert.equal(lostAbilities('billing', 'guest').some((s) => s.includes('見るだけ')), true)
})

test('lostAbilities: ゲストに下げると、書き込みができなくなる旨が出る。ゲストからゲスト・上げる場合は何も出ない', () => {
  assert.equal(lostAbilities('member', 'guest').some((s) => s.includes('見るだけ')), true)
  assert.deepEqual(lostAbilities('guest', 'guest'), [])
  assert.deepEqual(lostAbilities('member', 'manager'), [])
  assert.deepEqual(lostAbilities('member', 'admin'), [])
  assert.deepEqual(lostAbilities('admin', 'admin'), [])
  assert.deepEqual(lostAbilities('admin', 'owner'), [])
})

test('lostAbilities: 管理者からゲストなら、設定・承認・見るだけの3種類が出る', () => {
  assert.equal(lostAbilities('admin', 'guest').length, 4) // 設定、招待と役割の変更、承認、見るだけ
})
