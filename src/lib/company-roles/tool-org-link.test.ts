// 実行: npm run test:roles
// 管理者が手でツールの組織を会社につなぐ決まり（tool-org-link.ts）。統括の再監査（2026-10-26）の例を含む。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideToolOrgLink } from './tool-org-link'

const base = { actorRole: 'admin' as const, actorIsTopMember: true, topMembersInCompany: [true], linkedCompanyId: null, companyId: 'A' }

test('会社の管理者で、最上位の人が全員自分の会社の人なら、つなぐ', () => {
  assert.deepEqual(decideToolOrgLink(base), { ok: true, action: 'create' })
  assert.deepEqual(decideToolOrgLink({ ...base, actorRole: 'owner', topMembersInCompany: [true, true] }), { ok: true, action: 'create' })
})

test('例A: 別の会社 B の持ち主が作った組織（B の持ち主が最上位にいる）は、A の管理者が最上位にいてもつなげない', () => {
  assert.deepEqual(decideToolOrgLink({ ...base, topMembersInCompany: [true, false] }), { ok: false, status: 409, code: 'FOREIGN_TOP_MEMBER' })
})

test('例B: すでに C1 につながった組織は、最上位を引き継いだ社員が会社 C2 を作っても、C2 にはつなげない', () => {
  assert.deepEqual(decideToolOrgLink({ ...base, actorRole: 'owner', companyId: 'C2', linkedCompanyId: 'C1' }), { ok: false, status: 409, code: 'LINKED_ELSEWHERE' })
})

test('同じ会社にすでにつながっていれば、何もせず成功', () => {
  assert.deepEqual(decideToolOrgLink({ ...base, linkedCompanyId: 'A' }), { ok: true, action: 'none' })
})

test('管理者でない・会社にいない・最上位でない人は、つなげない', () => {
  for (const actorRole of ['manager', 'billing', 'member', 'guest', null] as const) {
    assert.deepEqual(decideToolOrgLink({ ...base, actorRole }), { ok: false, status: 403, code: 'NOT_ALLOWED' }, String(actorRole))
  }
  assert.deepEqual(decideToolOrgLink({ ...base, actorIsTopMember: false }), { ok: false, status: 403, code: 'NOT_TOP_MEMBER' })
})

test('最上位の人がいない組織は、つなげない', () => {
  assert.deepEqual(decideToolOrgLink({ ...base, topMembersInCompany: [] }), { ok: false, status: 409, code: 'FOREIGN_TOP_MEMBER' })
})
