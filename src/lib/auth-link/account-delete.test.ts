import test from 'node:test'
import assert from 'node:assert/strict'
import { anonymizedEmail, deleteAccount, type DeleteRepo, type DeletionFacts } from './account-delete'

const now = new Date('2026-11-18T00:00:00Z')
function repo(facts: Partial<DeletionFacts> & { plan?: string; stripeSubscriptionId?: string | null } = {}) {
  const calls: string[] = []
  const r: DeleteRepo = {
    getDeletionFacts: async () => ({
      user: facts.user === null ? null : (facts.user ?? { id: 'u1', plan: facts.plan ?? 'FREE', deletedAt: null, stripeSubscriptionId: facts.stripeSubscriptionId ?? null }),
      nagusameLive: facts.nagusameLive ?? false,
      liveSubscriptions: facts.liveSubscriptions ?? 0,
      ownsCompanyWithOtherMembers: facts.ownsCompanyWithOtherMembers ?? false,
    }),
    anonymize: async (id) => { calls.push(id) },
  }
  return { r, calls }
}

test('確認文字列が DELETE でなければ 400 で、何も消さない', async () => {
  for (const confirm of [undefined, '', 'delete', 'YES', 1, null]) {
    const { r, calls } = repo()
    assert.deepEqual(await deleteAccount(r, { userId: 'u1', confirm, now }), { status: 400, body: { code: 'CONFIRMATION_REQUIRED' } })
    assert.equal(calls.length, 0)
  }
})

test('有料のプラン、または有効な契約の行があれば 409 ACTIVE_SUBSCRIPTION。解約はここではせず、何も消さない', async () => {
  for (const f of [{ plan: 'PRO' }, { plan: 'BUSINESS' }, { liveSubscriptions: 1 }, { stripeSubscriptionId: 'sub_x' }, { nagusameLive: true }]) {
    const { r, calls } = repo(f)
    const res = await deleteAccount(r, { userId: 'u1', confirm: 'DELETE', now })
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'ACTIVE_SUBSCRIPTION')
    assert.match(String(res.body.message), /Web/)
    assert.equal(calls.length, 0)
  }
})

test('会社の持ち主で、ほかに参加中のメンバーがいれば 409 COMPANY_HAS_MEMBERS', async () => {
  const { r, calls } = repo({ ownsCompanyWithOtherMembers: true })
  const res = await deleteAccount(r, { userId: 'u1', confirm: 'DELETE', now })
  assert.deepEqual([res.status, res.body.code], [409, 'COMPANY_HAS_MEMBERS'])
  assert.equal(calls.length, 0)
})

test('無料で、メンバーもいなければ、匿名化する。2回めは何もせず 200', async () => {
  const { r, calls } = repo()
  assert.deepEqual(await deleteAccount(r, { userId: 'u1', confirm: 'DELETE', now }), { status: 200, body: { deleted: true } })
  assert.deepEqual(calls, ['u1'])
  const done = repo({ user: { id: 'u1', plan: 'FREE', deletedAt: now, stripeSubscriptionId: null } })
  assert.equal((await deleteAccount(done.r, { userId: 'u1', confirm: 'DELETE', now })).status, 200)
  assert.equal(done.calls.length, 0)
})

test('ユーザーがいなければ 404', async () => {
  assert.equal((await deleteAccount(repo({ user: null }).r, { userId: 'x', confirm: 'DELETE', now })).status, 404)
})

test('匿名化のメールは、ユーザーごとに一意で、復元できず、実在しないドメイン', () => {
  assert.equal(anonymizedEmail('abc'), 'deleted-abc@deleted.invalid')
  assert.notEqual(anonymizedEmail('a'), anonymizedEmail('b'))
  assert.equal(anonymizedEmail('abc').includes('@example'), false)
})

test('匿名化の中身（偽の Prisma で、呼ばれた操作を確かめる）: ログイン手段・セッション・端末・待ちを消す。招待中を取り消す。User は残して匿名化する', async () => {
  const { createPrismaDeleteRepo } = await import('./account-delete.server')
  const calls: Array<[string, any]> = []
  const tx = new Proxy({}, {
    get: (_t, model: string) => new Proxy({}, {
      get: (_m, op: string) => async (arg: any) => {
        calls.push([`${model}.${op}`, arg])
        if (model === 'accountCompany' && op === 'findUnique') return { id: 'c1' }
        return { count: 1 }
      },
    }),
  })
  const prisma = { $transaction: async (fn: (t: unknown) => Promise<void>) => fn(tx) } as any
  await createPrismaDeleteRepo(prisma).anonymize('u1', now)
  const names = calls.map((c) => c[0])
  for (const n of ['session.deleteMany', 'account.deleteMany', 'appDevice.deleteMany', 'accountLinkRequest.deleteMany', 'dripEnrollment.updateMany', 'accountCompanyMember.updateMany', 'user.update']) assert.ok(names.includes(n), n)
  const invited = calls.find((c) => c[0] === 'accountCompanyMember.deleteMany')!
  assert.deepEqual(invited[1], { where: { companyId: 'c1', status: 'invited' } })
  const upd = calls.find((c) => c[0] === 'user.update')!
  assert.deepEqual(upd[1], { where: { id: 'u1' }, data: { email: 'deleted-u1@deleted.invalid', name: null, image: null, emailNormalized: null, emailVerified: null, deletedAt: now, anonymizedAt: now } })
  assert.equal(names.includes('user.delete'), false)
  assert.equal(names.includes('accountCompany.delete'), false)
})

test('匿名化: ツール別のメンバー表（外部キーの無い userId 列を含む）を、表ごとに無効にする。物理削除はしない', async () => {
  const { createPrismaDeleteRepo } = await import('./account-delete.server')
  const calls: Array<[string, any]> = []
  const tx = new Proxy({}, {
    get: (_t, model: string) => new Proxy({}, {
      get: (_m, op: string) => async (arg: any) => { calls.push([`${model}.${op}`, arg]); return model === 'accountCompany' ? { id: 'c1' } : { count: 1 } },
    }),
  })
  const prisma = { $transaction: async (fn: (t: unknown) => Promise<void>) => fn(tx) } as any
  await createPrismaDeleteRepo(prisma).anonymize('u1', now)
  const tables = ['hrOrganizationMember', 'kintaiMember', 'sfaMember', 'shodanMember', 'aioMember', 'mensetsuMember', 'quoteMember', 'aishodanMember', 'incomeMember', 'expenseMember']
  for (const t of tables) {
    const c = calls.find((x) => x[0] === `${t}.updateMany`)
    assert.ok(c, t)
    assert.deepEqual(c![1], { where: { userId: 'u1', NOT: { status: 'INACTIVE' } }, data: { status: 'INACTIVE' } }, t)
    assert.equal(calls.some((x) => x[0] === `${t}.delete` || x[0] === `${t}.deleteMany`), false, `${t} は消さない`)
  }
  const pm = calls.find((x) => x[0] === 'promaneMember.updateMany')!
  assert.deepEqual(pm[1], { where: { userId: 'u1', isActive: true }, data: { isActive: false } })
  // 同じトランザクションの中で、User の匿名化より前に行う（途中で失敗したら全部戻る）
  const names = calls.map((x) => x[0])
  assert.ok(names.indexOf('expenseMember.updateMany') < names.indexOf('user.update'))
})

test('匿名化: メンバー表の更新が1つ失敗したら、匿名化も完了しない（トランザクションごと失敗）', async () => {
  const { createPrismaDeleteRepo } = await import('./account-delete.server')
  const calls: string[] = []
  const tx = new Proxy({}, {
    get: (_t, model: string) => new Proxy({}, {
      get: (_m, op: string) => async () => { calls.push(`${model}.${op}`); if (model === 'aioMember') throw new Error('boom'); return { count: 0 } },
    }),
  })
  const prisma = { $transaction: async (fn: (t: unknown) => Promise<void>) => fn(tx) } as any
  await assert.rejects(createPrismaDeleteRepo(prisma).anonymize('u1', now))
  assert.equal(calls.includes('user.update'), false)
})
