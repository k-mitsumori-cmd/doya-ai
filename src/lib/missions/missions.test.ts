// 実行: npx tsx --test src/lib/missions/missions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMeaningfulAction, notCountedReason, type MissionAction } from './actions'
import { formatMinutes, monthlyAchievements, OUTSOURCE_RATES } from './achievements'
import { jstDateKey, jstMonthKey, jstMonthRange } from './jst'
import {
  applyAwards, dailyMissionState, decideAward, missionsForDay, monthTotal, projectAwards, questStates,
  DAILY_MISSION_REWARD, MONTHLY_CAP, ONBOARDING_QUESTS, type AwardEntry, type QuestFacts,
} from './rules'
import { sampleMissionsInput } from './sample'
import { buildMissionsView } from './view'

// 2026-10-19 10:00 JST
const NOW = Date.parse('2026-10-19T01:00:00Z')

const quote = (over: Partial<Extract<MissionAction, { kind: 'quote_issued' }>> = {}): MissionAction => ({
  kind: 'quote_issued', id: 'q', at: '2026-10-19T00:30:00Z', title: 'サイト保守', clientCompany: '東和商事',
  totalExclTax: 100_000, lines: [{ itemName: '保守', qty: 1, unitPrice: 100_000 }], ...over,
})
const activity = (over: Partial<Extract<MissionAction, { kind: 'activity_logged' }>> = {}): MissionAction => ({
  kind: 'activity_logged', id: 'a', at: '2026-10-19T00:30:00Z', type: 'meeting', subject: '定例',
  body: '次回までに見積の改訂版を送る。担当は山田さん。', aiGenerated: false, ...over,
})
const noFacts = (over: Partial<QuestFacts> = {}): QuestFacts => ({ company: null, acceptedInvites: [], actions: [], ...over })

// ---- 日本時間 ----

test('日付と月は日本時間で区切る', () => {
  assert.equal(jstDateKey('2026-10-18T14:59:59Z'), '2026-10-18')
  assert.equal(jstDateKey('2026-10-18T15:00:00Z'), '2026-10-19')
  assert.equal(jstMonthKey('2026-09-30T15:00:00Z'), '2026-10')
  assert.equal(jstDateKey('x'), null)
  const r = jstMonthRange(NOW)
  assert.equal(r.start.toISOString(), '2026-09-30T15:00:00.000Z')
  assert.equal(r.end.toISOString(), '2026-10-31T15:00:00.000Z')
})

// ---- 意味のある操作 ----

test('中身のある見積は数える。空の見積は数えない', () => {
  assert.equal(isMeaningfulAction(quote()), true)
  assert.match(notCountedReason(quote({ title: '無題' }))!, /件名/)
  assert.match(notCountedReason(quote({ clientCompany: ' ' }))!, /宛先/)
  assert.match(notCountedReason(quote({ lines: [{ itemName: '保守', qty: 1, unitPrice: 0 }] }))!, /品目/)
  assert.match(notCountedReason(quote({ lines: [] }))!, /品目/)
  assert.match(notCountedReason(quote({ totalExclTax: 0 }))!, /0円/)
})

test('記録は本文のあるものだけ。AI が作った記録・同じ文字の繰り返しは数えない', () => {
  assert.equal(isMeaningfulAction(activity()), true)
  assert.match(notCountedReason(activity({ aiGenerated: true }))!, /AI/)
  assert.match(notCountedReason(activity({ subject: '電話', body: 'OK' }))!, /短すぎ/)
  assert.match(notCountedReason(activity({ subject: '', body: 'あああああああああああああああああああああああ' }))!, /短すぎ/)
  assert.match(notCountedReason(activity({ type: 'unknown' }))!, /種類/)
})

test('商談は名前・金額・完了予定日があるものだけ', () => {
  const deal = (o: object): MissionAction => ({ kind: 'deal_saved', id: 'd', at: '2026-10-19T00:00:00Z', name: '採用LP', amount: 500_000, expectedCloseDate: '2026-11-30T00:00:00Z', ...o })
  assert.equal(isMeaningfulAction(deal({})), true)
  assert.equal(isMeaningfulAction(deal({ amount: 0 })), false)
  assert.equal(isMeaningfulAction(deal({ expectedCloseDate: null })), false)
  assert.equal(isMeaningfulAction(deal({ name: 'test' })), false)
})

// ---- 今日のミッション ----

test('今日の最初の数える操作で達成。数えなかった操作は理由つきで返す', () => {
  const s = dailyMissionState([
    quote({ id: 'empty', title: '', at: '2026-10-19T00:10:00Z' }),
    activity({ id: 'ok', at: '2026-10-19T00:20:00Z' }),
    quote({ id: 'ok2', at: '2026-10-19T00:40:00Z' }),
    activity({ id: 'yesterday', at: '2026-10-18T14:00:00Z' }), // JST 10/18 23:00
  ], NOW)
  assert.equal(s.dateKey, '2026-10-19')
  assert.equal(s.done, true)
  assert.equal(s.doneBy?.actionId, 'ok')
  assert.equal(s.doneBy?.missionId, 'log_activity')
  assert.deepEqual(s.notCounted.map((x) => x.id), ['empty'])
  assert.equal(s.missions.filter((m) => m.done).length, 2)
})

test('前の日の操作だけなら、今日は未達成', () => {
  const s = dailyMissionState([activity({ at: '2026-10-18T14:59:00Z' })], NOW)
  assert.equal(s.done, false)
})

test('候補の並びは日ごとに回るが、同じ日なら同じ', () => {
  assert.deepEqual(missionsForDay('2026-10-19').map((m) => m.id), missionsForDay('2026-10-19').map((m) => m.id))
  assert.notEqual(missionsForDay('2026-10-19')[0].id, missionsForDay('2026-10-20')[0].id)
})

// ---- クエスト ----

test('会社情報は、会社名と業種かサイトがあれば達成。招待は参加した人だけ', () => {
  const at = '2026-10-01T00:00:00Z'
  const q = (f: QuestFacts) => Object.fromEntries(questStates(f).map((x) => [x.id, x.done]))
  assert.deepEqual(q(noFacts()), { company_profile: false, invite_member: false, first_quote: false, first_activity: false })
  assert.equal(q(noFacts({ company: { name: 'A社', industry: null, websiteUrl: null, at } })).company_profile, false)
  assert.equal(q(noFacts({ company: { name: 'A社', industry: '製造', websiteUrl: null, at } })).company_profile, true)
  assert.equal(q(noFacts({ acceptedInvites: [{ at }] })).invite_member, true)
  assert.equal(q(noFacts({ actions: [quote({ totalExclTax: 0 })] })).first_quote, false)
  assert.equal(q(noFacts({ actions: [quote()] })).first_quote, true)
})

test('クエストの報酬は 会社情報 +50・招待 +100', () => {
  const r = Object.fromEntries(ONBOARDING_QUESTS.map((q) => [q.id, q.reward]))
  assert.equal(r.company_profile, 50)
  assert.equal(r.invite_member, 100)
})

// ---- 付与してよいか ----

test('今日のミッションは日本時間の1日1回まで', () => {
  const first = decideAward({ type: 'daily', action: activity() }, [], NOW)
  assert.deepEqual(first, { ok: true, key: 'daily:2026-10-19', amount: DAILY_MISSION_REWARD, clamped: false })
  const ledger: AwardEntry[] = [{ key: 'daily:2026-10-19', amount: DAILY_MISSION_REWARD, at: new Date(NOW).toISOString() }]
  const second = decideAward({ type: 'daily', action: quote() }, ledger, NOW)
  assert.equal(second.ok, false)
  assert.equal(!second.ok && second.reason, 'already_awarded')
  // 次の日（JST）はまた受け取れる
  const nextDay = Date.parse('2026-10-19T15:30:00Z')
  assert.equal(decideAward({ type: 'daily', action: activity({ at: '2026-10-19T15:10:00Z' }) }, ledger, nextDay).ok, true)
})

test('数えない操作・前の日の操作では付与しない', () => {
  const d = decideAward({ type: 'daily', action: quote({ lines: [] }) }, [], NOW)
  assert.equal(!d.ok && d.reason, 'not_counted')
  const old = decideAward({ type: 'daily', action: activity({ at: '2026-10-17T01:00:00Z' }) }, [], NOW)
  assert.equal(!old.ok && old.reason, 'invalid')
})

test('クエストは達成していなければ付与せず、会社ごとに1回だけ', () => {
  const f = noFacts({ acceptedInvites: [{ at: '2026-10-02T00:00:00Z' }] })
  assert.equal(decideAward({ type: 'quest', questId: 'company_profile', facts: f }, [], NOW).ok, false)
  const ok = decideAward({ type: 'quest', questId: 'invite_member', facts: f }, [], NOW)
  assert.deepEqual(ok, { ok: true, key: 'quest:invite_member', amount: 100, clamped: false })
  // 前の月にもらっていても、もう一度はもらえない
  const again = decideAward({ type: 'quest', questId: 'invite_member', facts: f }, [{ key: 'quest:invite_member', amount: 100, at: '2026-08-01T00:00:00Z' }], NOW)
  assert.equal(!again.ok && again.reason, 'already_awarded')
})

test('月の上限を超えない。残りが少なければ減らし、0なら付与しない', () => {
  const ledger: AwardEntry[] = [{ key: 'bonus:x', amount: 195, at: '2026-10-05T00:00:00Z' }]
  const d = decideAward({ type: 'quest', questId: 'invite_member', facts: noFacts({ acceptedInvites: [{ at: '2026-10-02T00:00:00Z' }] }) }, ledger, NOW)
  assert.deepEqual(d, { ok: true, key: 'quest:invite_member', amount: 5, clamped: true })
  const full: AwardEntry[] = [{ key: 'bonus:x', amount: 200, at: '2026-10-05T00:00:00Z' }]
  const none = decideAward({ type: 'daily', action: activity() }, full, NOW)
  assert.equal(!none.ok && none.reason, 'monthly_cap')
  // 先月の分は今月の上限に数えない
  const lastMonth: AwardEntry[] = [{ key: 'bonus:y', amount: 200, at: '2026-09-30T14:00:00Z' }] // JST 9/30 23:00
  assert.equal(decideAward({ type: 'daily', action: activity() }, lastMonth, NOW).ok, true)
})

test('ボーナスは正の整数だけ', () => {
  assert.equal(decideAward({ type: 'bonus', id: 'b', amount: 0 }, [], NOW).ok, false)
  assert.equal(decideAward({ type: 'bonus', id: 'b', amount: 1.5 }, [], NOW).ok, false)
  assert.equal(decideAward({ type: 'bonus', id: '', amount: 10 }, [], NOW).ok, false)
})

test('クエスト・ミッション・ボーナスを全部合わせても、どの月も上限を超えない', () => {
  const facts: QuestFacts = {
    company: { name: 'A社', industry: '製造', websiteUrl: null, at: '2026-10-01T00:00:00Z' },
    acceptedInvites: [{ at: '2026-10-01T01:00:00Z' }],
    actions: [quote({ at: '2026-10-01T02:00:00Z' }), activity({ at: '2026-10-01T03:00:00Z' })],
  }
  const reqs = [
    ...ONBOARDING_QUESTS.map((q) => ({ req: { type: 'quest' as const, questId: q.id, facts }, at: '2026-10-01T05:00:00Z' })),
    ...Array.from({ length: 31 }, (_, i) => {
      const at = new Date(Date.parse('2026-10-01T03:00:00Z') + i * 86400_000).toISOString()
      return { req: { type: 'daily' as const, action: activity({ id: `a${i}`, at }) }, at }
    }),
    { req: { type: 'bonus' as const, id: 'campaign', amount: 150 }, at: '2026-10-20T00:00:00Z' },
    { req: { type: 'bonus' as const, id: 'nov', amount: 150 }, at: '2026-11-02T00:00:00Z' },
  ]
  const ledger = applyAwards(reqs)
  for (const m of ['2026-10', '2026-11']) assert.ok(monthTotal(ledger, m) <= MONTHLY_CAP, `${m}: ${monthTotal(ledger, m)}`)
  assert.equal(monthTotal(ledger, '2026-10'), MONTHLY_CAP)
  // 同じ key は1つだけ
  assert.equal(new Set(ledger.map((e) => e.key)).size, ledger.length)
})

test('記録からの見込み: 今月の分だけを数え、上限の中に収まる', () => {
  const p = projectAwards(noFacts({ actions: [activity({ at: '2026-10-18T01:00:00Z' }), activity({ id: 'b', at: '2026-10-18T02:00:00Z' }), activity({ id: 'c', at: '2026-09-10T01:00:00Z' })] }), NOW)
  // 10/18 の日次 10 + 最初の記録のクエスト（9/10 に達成なので先月）→ 今月は 10
  assert.equal(p.thisMonth, 10)
  assert.ok(p.thisMonth <= p.cap)
})

// ---- 今月のドヤ実績 ----

test('換算は 数 × 単価。0件の行も残し、合計を出す', () => {
  const a = monthlyAchievements('2026-10', { seo_article: 2, quote: 3, banner: -1 })
  assert.equal(a.lines.length, Object.keys(OUTSOURCE_RATES).length)
  assert.equal(a.totalCount, 5)
  assert.equal(a.totalYen, 2 * OUTSOURCE_RATES.seo_article.yenPerUnit + 3 * OUTSOURCE_RATES.quote.yenPerUnit)
  assert.equal(a.totalMinutes, 2 * 420 + 3 * 30)
  assert.equal(a.lines.find((l) => l.kind === 'banner')!.count, 0)
})

test('時間の表示', () => {
  assert.equal(formatMinutes(30), '30分')
  assert.equal(formatMinutes(120), '2時間')
  assert.equal(formatMinutes(930), '15時間30分')
})

test('見本のデータで画面の中身を組み立てられる（今日は空の見積と AI の記録だけなので未達成）', () => {
  const v = buildMissionsView(sampleMissionsInput(NOW), NOW)
  assert.equal(v.daily.done, false)
  assert.equal(v.daily.notCounted.length, 2)
  assert.equal(v.quests.find((q) => q.id === 'company_profile')?.done, true)
  assert.ok(v.power.thisMonth <= v.power.cap)
  assert.ok(v.achievements.totalYen > 0)
})
