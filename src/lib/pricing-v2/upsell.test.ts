import test from 'node:test'
import assert from 'node:assert/strict'
import { decideUpsell, isLowPower, upsellFrequencyKey, type UpsellInput } from './upsell'
import { decideStarter, starterEmailHash, STARTER_POWER } from './starter'
import { createDoyaPowerLedger } from '../doya-power/ledger'
import { createMemoryDb } from '../doya-power/memory-db'
import { DAILY_RECOVERY_AMOUNT, DAILY_RECOVERY_CAP } from '../doya-power/rules'

const base: UpsellInput = { kind: 'free', isOwner: true, trigger: 'insufficient', seats: null, canBuyPack: true, canCheckoutTeam: true, required: 30 }

// ---------- 足りない・少ない・尽きたときの導線 ----------

test('フリー: 主は「チームに上げる」。回復の時刻も伝える。追加購入は出さない', () => {
  const v = decideUpsell({ ...base, recoveryLabel: '10月27日 0:00' })
  assert.equal(v.primary.kind, 'link')
  assert.equal(v.primary.label, 'チームに上げる')
  assert.ok(v.primary.kind === 'link' && v.primary.href === '/pricing#team')
  assert.match(v.body, /10月27日 0:00 に回復/)
  assert.ok([v.primary, ...v.secondary].every((a) => a.kind !== 'buy_pack'))
  assert.match(v.title, /30 要ります/)
})

test('フリー: チームの申し込みが準備できていなければ、料金プランを見るに案内する', () => {
  const v = decideUpsell({ ...base, canCheckoutTeam: false })
  assert.equal(v.primary.label, '料金プランを見る')
})

test('チーム: 主は「追加で買う」（1パック）。人数を増やす案内。人数が多ければ個別見積も', () => {
  const small = decideUpsell({ ...base, kind: 'team', seats: 5 })
  assert.deepEqual(small.primary.kind === 'buy_pack' && small.primary.packs, 1)
  assert.deepEqual(small.secondary.map((a) => a.label), ['人数を増やす'])
  const big = decideUpsell({ ...base, kind: 'team', seats: 45 })
  assert.deepEqual(big.secondary.map((a) => a.label), ['人数を増やす', '個別見積を相談する'])
})

test('追加購入が準備できていなければ「準備中」（押せない）', () => {
  const v = decideUpsell({ ...base, kind: 'team', seats: 5, canBuyPack: false })
  assert.equal(v.primary.kind, 'disabled')
  assert.match(v.primary.label, /準備中/)
})

test('据え置き: 主は「追加で買う」。チームへ移る相談には、戻れないことの確かめが付く', () => {
  const v = decideUpsell({ ...base, kind: 'legacy' })
  assert.equal(v.primary.kind, 'buy_pack')
  const move = v.secondary[0]!
  assert.ok(move.kind === 'link' && move.confirm)
  assert.match(move.kind === 'link' ? move.confirm!.title : '', /戻れません/)
})

test('会社の持ち主でないメンバーには、買う・上げるを出さず、持ち主への相談を案内する', () => {
  for (const kind of ['free', 'team', 'legacy'] as const) {
    const v = decideUpsell({ ...base, kind, isOwner: false })
    assert.match(v.body, /持ち主の方/)
    assert.ok([v.primary, ...v.secondary].every((a) => a.kind !== 'buy_pack'))
  }
})

test('場面ごとの見出し: 足りない・使い切り・残り少ない', () => {
  assert.match(decideUpsell({ ...base, trigger: 'empty' }).title, /使い切りました/)
  assert.match(decideUpsell({ ...base, trigger: 'low' }).title, /残り少なく/)
})

test('残りが2割を切ったら「少ない」。0 は別（使い切り）', () => {
  assert.ok(isLowPower(19, 100))
  assert.ok(!isLowPower(20, 100))
  assert.ok(!isLowPower(0, 100))
  assert.ok(!isLowPower(5, 0))
})

test('やさしい知らせは、少ないは月1回・使い切りは1日1回（日本時間）', () => {
  const a = new Date('2026-10-31T14:59:00Z') // 10/31 23:59 JST
  const b = new Date('2026-10-31T15:00:00Z') // 11/1 0:00 JST
  assert.equal(upsellFrequencyKey('low', a), 'doya-upsell:low:2026-10')
  assert.equal(upsellFrequencyKey('low', b), 'doya-upsell:low:2026-11')
  assert.equal(upsellFrequencyKey('empty', a), 'doya-upsell:empty:2026-10-31')
  assert.equal(upsellFrequencyKey('empty', b), 'doya-upsell:empty:2026-11-01')
})

// ---------- はじめの付与（最初の100） ----------

const ok = { ledgerAllowed: true, tablesAllowed: true, hasCompany: true, isOwner: true, email: 'a@example.com', verified: true, claimed: false }

test('はじめの付与: 旗が off・会社が無い・持ち主でない・確認の済んでいない人・受け取り済みには付けない', () => {
  assert.deepEqual(decideStarter(ok), { ok: true })
  assert.deepEqual(decideStarter({ ...ok, ledgerAllowed: false }), { ok: false, reason: 'flag_off' })
  assert.deepEqual(decideStarter({ ...ok, tablesAllowed: false }), { ok: false, reason: 'flag_off' })
  assert.deepEqual(decideStarter({ ...ok, hasCompany: false }), { ok: false, reason: 'no_company' })
  assert.deepEqual(decideStarter({ ...ok, isOwner: false }), { ok: false, reason: 'not_owner' })
  assert.deepEqual(decideStarter({ ...ok, verified: false }), { ok: false, reason: 'not_verified' })
  assert.deepEqual(decideStarter({ ...ok, email: null }), { ok: false, reason: 'no_email' })
  assert.deepEqual(decideStarter({ ...ok, claimed: true }), { ok: false, reason: 'already_claimed' })
})

test('メールの要約は、大文字・小文字と前後の空白をそろえる（作り直しでも同じ人と分かる）。メールそのものは含まない', () => {
  const h = starterEmailHash('  Taro@Example.com ')
  assert.equal(h, starterEmailHash('taro@example.com'))
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.ok(!h.includes('taro'))
  assert.notEqual(h, starterEmailHash('jiro@example.com'))
})

test('新しい会社は ちょうど 100 から始まり、使った分が1日10ずつ回復する（上限100）。同じ会社に二度は付かない（種類 starter）', async () => {
  let t = new Date('2026-10-26T03:00:00.000Z')
  const clock = () => new Date(t.getTime())
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_new', userId: 'u_new', name: '新しい会社' })
  const ledger = createDoyaPowerLedger(mem.db, { now: clock })
  const first = await ledger.grant('co_new', 'starter', STARTER_POWER, null, { sourceKey: 'starter', note: 'starter' })
  // 回復の上限で削られず、いつも 100 付く。その回は回復を足さないので、ちょうど 100
  assert.equal(first.ok && first.granted, STARTER_POWER)
  assert.equal((await ledger.balance('co_new'))!.total, DAILY_RECOVERY_CAP)
  const b0 = (await ledger.balance('co_new'))!
  assert.equal(b0.byKind.starter, 100)
  assert.equal(b0.nextRecoveryAt, null, '100 あるあいだは回復しない')
  const again = await ledger.grant('co_new', 'starter', STARTER_POWER, null, { sourceKey: 'starter', note: 'starter' })
  assert.equal(again.ok && again.duplicated, true)
  assert.equal((await ledger.balance('co_new'))!.total, 100)
  // 次の日も、100 あるので回復しない
  t = new Date('2026-10-26T15:00:00.000Z') // 10/27 0:00 JST
  assert.equal((await ledger.balance('co_new'))!.total, 100)
  // 30 使う → 次の日（日本時間）に 10 回復
  const c = await ledger.consume('co_new', 30, 'op-1')
  assert.equal(c.ok, true)
  t = new Date('2026-10-27T15:00:00.000Z') // 10/28 0:00 JST
  assert.equal((await ledger.balance('co_new'))!.total, 70 + DAILY_RECOVERY_AMOUNT)
})

// ---------- プランの設定の一覧 ----------
import { PLAN_MATRIX, planRow } from './plan-matrix'

test('プランの一覧: フリーは回復あり・追加購入なし。有料は回復なし・繰り越し1か月・追加購入あり。最初は全員100', () => {
  assert.deepEqual(PLAN_MATRIX.map((r) => r.id), ['free', 'team', 'enterprise', 'legacy'])
  const free = planRow('free')
  assert.equal(free.dailyRecovery, 10)
  assert.equal(free.recoveryCap, 100)
  assert.equal(free.pack, null)
  for (const id of ['team', 'enterprise', 'legacy'] as const) {
    const r = planRow(id)
    assert.equal(r.dailyRecovery, 0)
    assert.equal(r.carryoverMonths, 1)
    assert.deepEqual(r.pack, { points: 1000, price: 5980, months: 6 })
  }
  for (const r of PLAN_MATRIX) assert.equal(r.starter, 100)
  assert.equal(planRow('legacy').monthly, '1,500')
})

// ---------- 知らせのシートに渡す形（UI リニューアルとの分担） ----------
import { powerOutView, POWER_OUT_HREF } from './power-out'

const info = { kind: 'free' as const, isOwner: true, seats: null, canBuyPack: true, canCheckoutTeam: true }

test('知らせの中身: 足りない・0・2割未満のときだけ。行き先はすべて href・最大3つ', () => {
  assert.equal(powerOutView({ ...info, remaining: 50, limit: 100 }), null)
  assert.equal(powerOutView({ ...info, remaining: 19, limit: 100 })?.trigger, 'low')
  assert.equal(powerOutView({ ...info, remaining: 0, limit: 100 })?.trigger, 'empty')
  const v = powerOutView({ ...info, remaining: 5, limit: 100, required: 30, nextRecoveryAt: '2026-10-26T15:00:00.000Z' })!
  assert.equal(v.trigger, 'insufficient')
  assert.deepEqual(v.actions[0], { label: 'チームに上げる', href: POWER_OUT_HREF.team })
  assert.match(v.body, /10月27日 0:00 に回復/)
  for (const k of ['free', 'team', 'legacy'] as const) {
    const w = powerOutView({ ...info, kind: k, seats: 45, remaining: 0, limit: 100 })!
    assert.ok(w.actions.length >= 1 && w.actions.length <= 3)
    assert.ok(w.actions.every((a) => typeof a.href === 'string' && a.href.length > 0))
  }
})

test('知らせの中身: チームと据え置きの主は「追加で買う」（料金ページの追加購入へ）。据え置きの移行は「戻れない」の説明へ', () => {
  const team = powerOutView({ ...info, kind: 'team', seats: 5, remaining: 0, limit: 3000 })!
  assert.deepEqual(team.actions[0], { label: '追加で買う', href: POWER_OUT_HREF.pack })
  const legacy = powerOutView({ ...info, kind: 'legacy', remaining: 0, limit: 1500 })!
  assert.deepEqual(legacy.actions.map((a) => a.href), [POWER_OUT_HREF.pack, POWER_OUT_HREF.legacyMove])
})

test('知らせの中身: 追加購入が準備中なら出さず、押せるものが無ければ料金ページを主にする', () => {
  const legacy = powerOutView({ ...info, kind: 'legacy', canBuyPack: false, remaining: 0, limit: 1500 })!
  assert.equal(legacy.actions[0]!.href, POWER_OUT_HREF.legacyMove)
  const team = powerOutView({ ...info, kind: 'team', seats: 5, canBuyPack: false, remaining: 0, limit: 3000 })!
  assert.deepEqual(team.actions.map((a) => a.href), [POWER_OUT_HREF.manage])
})

// ---------- 画面から読むファイルは node: を使わない（2026-10-26 UI リニューアルの依頼） ----------
import { readFileSync } from 'node:fs'
import { STARTER_WELCOME as WELCOME_FROM_STARTER, STARTER_POWER as POWER_FROM_STARTER } from './starter'
import { STARTER_WELCOME, STARTER_POWER as POWER_FROM_WELCOME } from './starter-welcome'

test('ようこその知らせの文と量は starter-welcome.ts にあり、node: を使わない。starter.ts からも同じ値が読める', () => {
  const src = readFileSync(new URL('./starter-welcome.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /from ['"]node:/)
  assert.equal(WELCOME_FROM_STARTER, STARTER_WELCOME)
  assert.equal(POWER_FROM_STARTER, POWER_FROM_WELCOME)
  assert.equal(STARTER_WELCOME.action.href, '/home/doya-power')
})
