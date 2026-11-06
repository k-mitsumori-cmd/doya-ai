// 実行: npx tsx --test src/lib/agent-chat/agent-chat.test.ts
// チャットで仕事を進める仕組みの回帰テスト。AI も DB も呼ばない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAgentChat, agentChatRollout } from './flag'
import { jstTodayYmd, monthLabelOf, yenText } from './today'
import { groundValues, yenCandidates } from './ground'
import { INCOME_SALE_ADD, buildSteps, confirmRows, doneView, resolveFixed, chatOpByKey } from './ops'
import { chatResponse, chatActions } from './handle'
import { INITIAL_STATE, reduce, type ChatEffect, type ChatEvent, type ChatState } from './turn'
import type { ChatApiResponse } from './types'

const SNAP = { client: '株式会社サンプル', title: 'Web 制作費', start: '2026-11-05', subtotal: '1000000', tax: '100000', total: '1100000' }

function run(events: ChatEvent[], from: ChatState = INITIAL_STATE) {
  let state = from
  const effects: ChatEffect[] = []
  for (const ev of events) { const r = reduce(state, ev); state = r.state; effects.push(...r.effects) }
  return { state, effects }
}
const opReply = (values: Record<string, string>, missing = INCOME_SALE_ADD.fields.filter((f) => !values[f.key])): ChatApiResponse =>
  ({ kind: 'op', op: INCOME_SALE_ADD, values, missing, say: '追加します。' })

test('旗: 既定は off。preview と all だけ受け付ける。off は誰にも出さない', () => {
  assert.equal(agentChatRollout(undefined), 'off')
  assert.equal(agentChatRollout('ALL'), 'all')
  assert.equal(agentChatRollout('on'), 'off')
  assert.equal(decideAgentChat({ rollout: 'off', email: 'a@b.jp', allow: ['a@b.jp'] }), false)
  assert.equal(decideAgentChat({ rollout: 'all', email: null, allow: [] }), true)
  assert.equal(decideAgentChat({ rollout: 'preview', email: 'a@b.jp', allow: ['a@b.jp'] }), true)
  assert.equal(decideAgentChat({ rollout: 'preview', email: 'x@b.jp', allow: ['a@b.jp'] }), false)
})

test('日付と金額の表示', () => {
  assert.equal(jstTodayYmd(Date.UTC(2026, 10, 5, 16, 0)), '2026-11-06')
  assert.equal(monthLabelOf('2026-11-05'), '2026年11月')
  assert.equal(monthLabelOf('x'), '')
  assert.equal(yenText(1000000), '¥1,000,000')
  assert.equal(yenText('abc'), '—')
})

test('金額の読み取り: 万・億・カンマ付きを数え、年月日や人数は数えない', () => {
  assert.ok(yenCandidates('今月の売上100万円追加して').has(1_000_000))
  assert.ok(yenCandidates('1億2,000万円').has(120_000_000))
  assert.ok(yenCandidates('1,000,000円').has(1_000_000))
  assert.equal(yenCandidates('2026年11月に3人').size, 0)
})

test('値の確かめ: 文にある値だけ残し、文に無い値・欄に無い名前は捨てる', () => {
  const text = '株式会社サンプルに Web 制作費で100万円の売上を追加して'
  const g = groundValues(text, { amount: '1000000', client: '株式会社サンプル', title: 'Web制作費', extra: 'x' }, INCOME_SALE_ADD.fields)
  assert.deepEqual(g.values, { amount: '1000000', client: '株式会社サンプル', title: 'Web制作費' })
  assert.deepEqual(g.dropped, ['extra'])
  const h = groundValues('売上を追加して', { amount: '500000', client: 'ABC商事' }, INCOME_SALE_ADD.fields)
  assert.deepEqual(h.values, {})
  assert.deepEqual(h.dropped.sort(), ['amount', 'client'])
  assert.deepEqual(groundValues('売上100万円', { amount: '2000000' }, INCOME_SALE_ADD.fields).values, {})
})

test('操作の定義: 決まった値は今日の日付で確定し、AI には決めさせない', () => {
  const fixed = resolveFixed(INCOME_SALE_ADD, '2026-11-05')
  assert.deepEqual(fixed.map((f) => [f.key, f.value]), [['type', 'one_time'], ['status', 'active'], ['start', '2026-11-05']])
  assert.ok(!INCOME_SALE_ADD.fields.some((f) => ['type', 'status', 'start'].includes(f.key)))
  assert.equal(INCOME_SALE_ADD.risk, 'write')
  assert.equal(chatOpByKey('income.sale.add'), INCOME_SALE_ADD)
  assert.equal(chatOpByKey('nope'), undefined)
  const steps = buildSteps(INCOME_SALE_ADD)
  assert.equal(steps[0].id, 'open-tool')
  assert.equal(steps[steps.length - 1].id, 'confirm')
  assert.ok(steps.every((s) => s.status === 'wait'))
})

test('確認カードと完了の表示: 画面の値をそのまま読み、請求書はまだ作っていないと書く', () => {
  const c = confirmRows(INCOME_SALE_ADD, SNAP)
  assert.equal(c.rows.find((r) => r.label === '計上月')?.value, '2026年11月')
  assert.equal(c.rows.find((r) => r.big)?.value, '¥1,000,000')
  assert.equal(c.rows.find((r) => r.label === '消費税')?.value, '¥100,000')
  const d = doneView(INCOME_SALE_ACTION_OP(), SNAP, '/income/contracts/abc')
  assert.match(d.lead, /2026年11月の売上予定に ¥1,000,000（税抜）を追加しました/)
  assert.match(d.lead, /請求書はまだ作っていません/)
  assert.equal(d.next[0].prefill?.amount, '1000000')
  assert.equal(d.next[2].href, '/income/contracts/abc')
})
function INCOME_SALE_ACTION_OP() { return INCOME_SALE_ADD }

test('API の返事: チャットの操作は値を確かめて op で返し、それ以外は今の案内の形', () => {
  const text = '今月の売上100万円追加して'
  const r = chatResponse({ kind: 'action', actionId: 'income.sale.add', values: { amount: '1000000', client: '作り話商事' }, missing: [], reason: '' }, text)
  assert.equal(r.kind, 'op')
  if (r.kind === 'op') {
    assert.deepEqual(r.values, { amount: '1000000' })
    assert.deepEqual(r.missing.map((f) => f.key), ['client', 'title'])
  }
  const other = chatResponse({ kind: 'action', actionId: 'income.invoice.create', values: {}, missing: [], reason: '' }, '請求書を作って')
  assert.equal(other.kind, 'action')
  assert.ok(chatActions().some((a) => a.id === 'income.sale.add'))
  assert.equal(chatActions().filter((a) => a.id === 'income.sale.add').length, 1)
})

test('会話: 足りない値は AI を呼ばずに1つずつ聞き、そろったら画面を進める', () => {
  const a = run([{ t: 'ask', text: '売上100万円追加して' }])
  assert.equal(a.state.phase, 'reading')
  assert.deepEqual(a.effects, [{ k: 'api', text: '売上100万円追加して' }])
  const b = run([{ t: 'reply', res: opReply({ amount: '1000000' }) }], a.state)
  assert.equal(b.state.phase, 'asking')
  assert.equal(b.state.missing[0].key, 'client')
  assert.deepEqual(b.effects, [])
  const bad = run([{ t: 'answer', value: '   ' }], b.state)
  assert.equal(bad.state.phase, 'asking')
  assert.ok(bad.state.askError)
  const c = run([{ t: 'answer', value: '株式会社サンプル' }, { t: 'answer', value: 'Web 制作費' }], b.state)
  assert.equal(c.state.phase, 'working')
  assert.deepEqual(c.state.values, { amount: '1000000', client: '株式会社サンプル', title: 'Web 制作費' })
  assert.equal(c.effects.length, 1)
  assert.equal(c.effects[0].k, 'run')
})

test('決まり: 確認ボタンを押すまで、保存の指示（submit）は返さない', () => {
  const start = run([
    { t: 'ask', text: '株式会社サンプルにWeb制作費で100万円の売上を追加' },
    { t: 'reply', res: opReply({ amount: '1000000', client: '株式会社サンプル', title: 'Web制作費' }, []) },
  ])
  assert.equal(start.state.phase, 'working')
  // 画面を進めている間に approve が来ても、保存しない
  assert.equal(reduce(start.state, { t: 'approve' }).effects.length, 0)
  assert.equal(reduce(start.state, { t: 'approve' }).state.phase, 'working')
  assert.equal(reduce(start.state, { t: 'submitted', ok: true, snap: SNAP, href: '/x' }).state.phase, 'working')
  const ready = run([{ t: 'ready', snap: SNAP }], start.state)
  assert.equal(ready.state.phase, 'confirm')
  assert.deepEqual(ready.effects, [])
  assert.equal(ready.state.confirm?.submitLabel, '登録する')
  // 押したときだけ submit
  const sub = reduce(ready.state, { t: 'approve' })
  assert.deepEqual(sub.effects, [{ k: 'submit' }])
  assert.equal(sub.state.phase, 'submitting')
  // 2回押しても2回目は何も返さない
  assert.deepEqual(reduce(sub.state, { t: 'approve' }).effects, [])
  // どの場面の入口（reply・answer・step・retry）からも submit は出ない
  const all: ChatEvent[] = [{ t: 'ask', text: 'x' }, { t: 'reply', res: opReply({}) }, { t: 'answer', value: '1' }, { t: 'step', id: 'open-tool', status: 'done' }, { t: 'retry' }, { t: 'ready', snap: SNAP }, { t: 'adjust', text: '税込みだった' }, { t: 'reset' }]
  for (const ev of all) assert.ok(!reduce(start.state, ev).effects.some((e) => e.k === 'submit'), ev.t)
})

test('決まり: 完了は、画面の送信が成功を知らせたあとだけ。失敗は内容を出し、確認カードに戻れる', () => {
  const confirm = run([
    { t: 'ask', text: 'x' }, { t: 'reply', res: opReply({ amount: '1000000', client: 'A', title: 'B' }, []) }, { t: 'ready', snap: SNAP },
  ]).state
  const submitting = reduce(confirm, { t: 'approve' }).state
  assert.notEqual(submitting.phase, 'done')
  const failed = reduce(submitting, { t: 'submitted', ok: false, error: '取引先を選んでください' })
  assert.equal(failed.state.phase, 'failed')
  assert.equal(failed.state.error, '取引先を選んでください')
  assert.equal(failed.state.done, null)
  const back = reduce(failed.state, { t: 'retry' })
  assert.equal(back.state.phase, 'confirm')
  assert.deepEqual(back.effects, [])
  const ok = reduce(submitting, { t: 'submitted', ok: true, snap: SNAP, href: '/income/contracts/abc' })
  assert.equal(ok.state.phase, 'done')
  assert.ok(ok.state.steps.every((s) => s.status === 'done'))
  assert.match(ok.state.done?.lead ?? '', /追加しました/)
})

test('会話: 画面を開けなかった・AI が読めなかった・操作でない答え', () => {
  const working = run([{ t: 'ask', text: 'x' }, { t: 'reply', res: opReply({ amount: '1', client: 'A', title: 'B' }, []) }]).state
  const failed = reduce(working, { t: 'run-failed', error: '開けませんでした' })
  assert.equal(failed.state.phase, 'failed')
  const again = reduce(failed.state, { t: 'retry' })
  assert.equal(again.state.phase, 'working')
  assert.equal(again.effects[0].k, 'run')
  assert.ok(again.state.steps.every((s) => s.status === 'wait'))
  const noRes = run([{ t: 'ask', text: 'x' }, { t: 'reply', res: null }])
  assert.equal(noRes.state.phase, 'failed')
  assert.equal(reduce(noRes.state, { t: 'retry' }).state.phase, 'idle')
  const guided = run([{ t: 'ask', text: 'x' }, { t: 'reply', res: { kind: 'unknown', reason: 'r', suggestions: [] } }])
  assert.equal(guided.state.phase, 'guided')
  assert.deepEqual(guided.effects, [{ k: 'api', text: 'x' }]) // ask の分だけ。返事のあとに増えない
  // 読んでいる最中の2つ目の依頼は受け付けない
  assert.deepEqual(reduce(run([{ t: 'ask', text: 'x' }]).state, { t: 'ask', text: 'y' }).effects, [])
})

test('金額の直し: 確認カードのときだけ。換算は現在の画面へ委ね、保存の指示は返さない', () => {
  const confirm = run([
    { t: 'ask', text: 'x' }, { t: 'reply', res: opReply({ amount: '1100000', client: 'A', title: 'B' }, []) },
    { t: 'ready', snap: { ...SNAP, subtotal: '1100000', tax: '110000', total: '1210000' } },
  ]).state
  assert.equal(confirm.snap?.subtotal, '1100000')
  // 金額の指定なし: 現在の画面の値と税率で換算する依頼だけ返す
  const a = reduce(confirm, { t: 'adjust', text: '税込みだった' })
  assert.deepEqual(a.effects, [{ k: 'amend', amount: null, inclusive: true }])
  assert.equal(a.state.phase, 'working')
  assert.ok(!a.effects.some((e) => e.k === 'submit'))
  // 直している間は、押しても保存しない
  assert.deepEqual(reduce(a.state, { t: 'approve' }).effects, [])
  // 直し終わると、確認カードに戻り、ひと言を出す
  const back = reduce(a.state, { t: 'ready', snap: { ...SNAP, subtotal: '1000000' }, message: 'm' })
  assert.equal(back.state.phase, 'confirm')
  assert.equal(back.state.notice, 'm')
  assert.deepEqual(back.effects, [])
  // 新しい金額・税込みの金額
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: '120万円にして' }).effects, [{ k: 'amend', amount: 1_200_000, inclusive: false }])
  assert.equal((reduce(confirm, { t: 'adjust', text: '税込み220万円だった' }).effects[0] as { amount: number }).amount, 2_200_000)
  // 読み取れない直しは、画面を動かさずに案内する
  const none = reduce(confirm, { t: 'adjust', text: 'やっぱり変えたい' })
  assert.deepEqual(none.effects, [])
  assert.equal(none.state.phase, 'confirm')
  assert.ok(none.state.notice)
  // 確認カードのとき以外は何もしない
  assert.deepEqual(reduce(INITIAL_STATE, { t: 'adjust', text: '税込みだった' }).effects, [])
  assert.equal(reduce(a.state, { t: 'adjust', text: '税込みだった' }).state, a.state)
})

test('会話: 答えた言葉は会話に残る（値が飛ぶ元になる）', () => {
  const asked = run([{ t: 'ask', text: 'x' }, { t: 'reply', res: opReply({ amount: '1000000' }) }, { t: 'answer', value: ' 株式会社サンプル ' }]).state
  assert.deepEqual(asked.answers, ['株式会社サンプル'])
})
