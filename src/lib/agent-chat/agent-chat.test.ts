// 実行: npx tsx --test src/lib/agent-chat/agent-chat.test.ts
// チャットで仕事を進める仕組みの回帰テスト。AI も DB も呼ばない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAgentChat, agentChatRollout } from './flag'
import { jstTodayYmd, monthLabelOf, yenText } from './today'
import { groundValues, yenCandidates } from './ground'
import { CHAT_OPS, EXPENSE_ADD, EXPENSE_ONEOFF_ADD, INCOME_INVOICE_DRAFT, INCOME_SALE_ADD, KINTAI_LEAVE_REQUEST, KINTAI_OVERTIME_REQUEST, PROMANE_CLIENT_ADD, PROMANE_PROJECT_ADD, answerProblem, buildSteps, confirmRows, doneView, leadText, resolveFixed, chatOpByKey } from './ops'
import { chatResponse, chatActions } from './handle'
import { durationText, parseDuration } from './duration'
import { createSaveLock, draftKey, judgeReview, onOpScreen } from './review'
import { INITIAL_STATE, reduce, type ChatEffect, type ChatEvent, type ChatState } from './turn'
import type { AgentFormSnapshot, ChatApiResponse, ChatOp } from './types'

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
  // ⚠️ undefined を渡すと本物の環境変数を読む。本番で旗に値を入れるとビルドが落ちるので、値を明示して渡す（2026-11-08）
  assert.equal(agentChatRollout(''), 'off')
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

// ======== 段階2: 請求書の下書き・支出の登録 ========
const INV_SNAP: AgentFormSnapshot = { client: '株式会社サンプル', title: '11月分 制作費', issue: '2026-11-06', due: '', subtotal: '300000', tax: '30000', total: '330000' }
const EXP_SNAP: AgentFormSnapshot = { vendor: 'Notion Labs', title: 'Notion ビジネスプラン', category: 'SaaS', cycle: '毎月', start: '2026-11-06', amount: '5000', taxIncluded: 'false', currency: 'JPY' }
const STAGE2: { op: ChatOp; values: Record<string, string>; snap: AgentFormSnapshot }[] = [
  { op: INCOME_INVOICE_DRAFT, values: { amount: '300000', client: '株式会社サンプル', title: '11月分 制作費' }, snap: INV_SNAP },
  { op: EXPENSE_ADD, values: { amount: '5000', vendor: 'Notion Labs', title: 'Notion ビジネスプラン' }, snap: EXP_SNAP },
]
const opRes = (op: ChatOp, values: Record<string, string>): ChatApiResponse => ({ kind: 'op', op, values, missing: op.fields.filter((f) => f.required && !values[f.key]), say: '進めます。' })
const toConfirm = (op: ChatOp, values: Record<string, string>, snap: AgentFormSnapshot) =>
  run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }, { t: 'ready', snap }]).state

test('段階2の操作の定義: 保存は確認カードの対象で、確定・送付・削除は入れない。日付や種類は AI に読ませない', () => {
  assert.deepEqual(CHAT_OPS.map((o) => o.key), ['income.sale.add', 'income.invoice.draft', 'expense.contract.add', 'promane.project.add', 'kintai.request.leave', 'kintai.request.overtime', 'promane.client.add', 'expense.schedule.add'])
  assert.equal(new Set(CHAT_OPS.map((o) => o.key)).size, CHAT_OPS.length)
  for (const { op } of STAGE2) {
    assert.equal(op.risk, 'write')
    assert.ok(op.fields.every((f) => f.required), `${op.key}: 読み取る欄は、画面が必須にしているものだけ`)
    assert.ok(!op.fields.some((f) => ['due', 'issue', 'start', 'type', 'status', 'category', 'cycle'].includes(f.key)), `${op.key}: 日付・種類・カテゴリは AI に読ませない`)
    assert.ok(!/確定|送付|送信|削除/.test(op.submitLabel + op.confirmTitle), op.key)
    assert.ok(!/(確定|送付|送信)する/.test(op.description), `${op.key}: 説明に確定・送付をする、と書かない`)
    assert.equal(buildSteps(op).at(-1)?.id, 'confirm')
  }
  assert.equal(buildSteps(INCOME_INVOICE_DRAFT).at(-1)?.label, '確認して下書きを保存する')
  assert.equal(chatOpByKey('expense.contract.add'), EXPENSE_ADD)
  // 今の案内の同じ仕事は AI の選択肢から外れ、同じ仕事が2つ並ばない
  const ids = chatActions().map((a) => a.id)
  assert.ok(ids.includes('income.invoice.draft') && ids.includes('expense.contract.add'))
  assert.ok(!ids.includes('income.invoice.create') && !ids.includes('expense.contract.create'))
  assert.equal(new Set(ids).size, ids.length)
})

test('段階2: API の返事は、依頼の文で確かめた値だけを残す（作り話の取引先・金額は捨てる）', () => {
  const inv = chatResponse({ kind: 'action', actionId: 'income.invoice.draft', values: { amount: '300000', client: '作り話商事', title: '11月分 制作費' }, missing: [], reason: '' }, '株式会社サンプルに11月分 制作費30万円の請求書を作って')
  assert.equal(inv.kind, 'op')
  if (inv.kind === 'op') {
    assert.deepEqual(inv.values, { amount: '300000', title: '11月分 制作費' })
    assert.deepEqual(inv.missing.map((f) => f.key), ['client'])
    assert.match(inv.say, /¥300,000 の請求書の下書き/)
  }
  const exp = chatResponse({ kind: 'action', actionId: 'expense.contract.add', values: { amount: '9999', vendor: 'Notion Labs', title: 'Notion' }, missing: [], reason: '' }, 'Notion Labsに Notion を月5,000円で登録して')
  assert.equal(exp.kind, 'op')
  if (exp.kind === 'op') {
    assert.deepEqual(exp.values, { vendor: 'Notion Labs', title: 'Notion' })
    assert.deepEqual(exp.missing.map((f) => f.key), ['amount'])
  }
  // 日付の言葉があっても、期日・開始日の欄は読まない（欄に無い名前は捨てる）
  const due = chatResponse({ kind: 'action', actionId: 'income.invoice.draft', values: { amount: '300000', client: '株式会社サンプル', title: '制作費', due: '2026-11-30' }, missing: [], reason: '' }, '株式会社サンプルに制作費30万円の請求書を11月末期日で作って')
  assert.ok(due.kind === 'op' && !('due' in due.values))
})

test('段階2の決まり: 確認の前に保存しない（どの場面でも submit は確認カードのときだけ）', () => {
  for (const { op, values, snap } of STAGE2) {
    const working = run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }]).state
    assert.equal(working.phase, 'working', op.key)
    assert.equal(reduce(working, { t: 'approve' }).effects.length, 0)
    assert.equal(reduce(working, { t: 'submitted', ok: true, snap, href: '/x' }).state.phase, 'working')
    const all: ChatEvent[] = [{ t: 'ask', text: 'x' }, { t: 'reply', res: opRes(op, {}) }, { t: 'answer', value: '1' }, { t: 'step', id: 'open-tool', status: 'done' }, { t: 'retry' }, { t: 'ready', snap }, { t: 'adjust', text: '税込みだった' }, { t: 'changed', snap }, { t: 'reset' }]
    for (const ev of all) assert.ok(!reduce(working, ev).effects.some((e) => e.k === 'submit'), `${op.key}: ${ev.t}`)
    // 聞き返しの間も保存しない
    const asking = run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, {}) }]).state
    assert.equal(asking.phase, 'asking')
    assert.equal(reduce(asking, { t: 'approve' }).effects.length, 0)
    // 確認カードで直しても、保存の指示は返さない
    const confirm = toConfirm(op, values, snap)
    assert.equal(confirm.phase, 'confirm')
    assert.ok(!reduce(confirm, { t: 'adjust', text: '税込みだった' }).effects.some((e) => e.k === 'submit'))
  }
})

test('段階2の決まり: 確認で押すと保存は1件だけ（2回押しても増えない）', () => {
  for (const { op, values, snap } of STAGE2) {
    const confirm = toConfirm(op, values, snap)
    const first = reduce(confirm, { t: 'approve' })
    assert.deepEqual(first.effects, [{ k: 'submit' }], op.key)
    assert.equal(first.state.phase, 'submitting')
    assert.deepEqual(reduce(first.state, { t: 'approve' }).effects, [])
    // 成功の知らせが来たあとに押しても、保存しない
    const done = reduce(first.state, { t: 'submitted', ok: true, snap, href: '/x/contracts/abc' })
    assert.equal(done.state.phase, 'done')
    assert.deepEqual(reduce(done.state, { t: 'approve' }).effects, [])
    // 成功の知らせが二重に来ても、状態は変わらない
    assert.equal(reduce(done.state, { t: 'submitted', ok: true, snap, href: '/x' }).state, done.state)
  }
})

test('段階2の決まり: 失敗したら完了を出さず、内容を出して確認カードに戻れる', () => {
  for (const { op, values, snap } of STAGE2) {
    const submitting = reduce(toConfirm(op, values, snap), { t: 'approve' }).state
    const failed = reduce(submitting, { t: 'submitted', ok: false, error: '権限がありません。管理者に依頼してください。' })
    assert.equal(failed.state.phase, 'failed', op.key)
    assert.equal(failed.state.error, '権限がありません。管理者に依頼してください。')
    assert.equal(failed.state.done, null)
    assert.ok(failed.state.steps.some((s) => s.status !== 'done'), '失敗では、作業の一覧を全部済みにしない')
    assert.ok(!failed.effects.some((e) => e.k === 'submit'))
    const back = reduce(failed.state, { t: 'retry' })
    assert.equal(back.state.phase, 'confirm')
    // 権限などで画面を開く前に止まったときも、完了を出さない
    const working = run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }]).state
    const blocked = reduce(working, { t: 'run-failed', error: '支出の登録には、担当者以上の権限が必要です。' })
    assert.equal(blocked.state.phase, 'failed')
    assert.equal(blocked.state.done, null)
  }
})

test('段階2: 確認カードのあとに画面が変わっていたら、保存せずに確認カードを出し直す', () => {
  const confirm = toConfirm(EXPENSE_ADD, STAGE2[1].values, EXP_SNAP)
  const submitting = reduce(confirm, { t: 'approve' }).state
  const changed = reduce(submitting, { t: 'changed', snap: { ...EXP_SNAP, category: '外注費' } })
  assert.equal(changed.state.phase, 'confirm')
  assert.deepEqual(changed.effects, [])
  assert.equal(changed.state.confirm?.rows.find((r) => r.label === 'カテゴリ')?.value, '外注費')
  assert.match(changed.state.notice ?? '', /保存せずに/)
  assert.equal(changed.state.done, null)
  // 確認カードの間・完了のあとには効かない
  assert.equal(reduce(confirm, { t: 'changed', snap: EXP_SNAP }).state, confirm)
})

test('支出の「税込みだった」: 金額は割らず、画面の税込みの切り替えを入れる（請求書は今までどおり税抜に直す）', () => {
  const confirm = toConfirm(EXPENSE_ADD, STAGE2[1].values, EXP_SNAP)
  const a = reduce(confirm, { t: 'adjust', text: '税込みだった' })
  assert.deepEqual(a.effects, [{ k: 'amend-flag', amount: 5000, message: '¥5,000 を税込みとして入れ直しました。', set: { taxIncluded: 'true' } }])
  assert.equal(a.state.phase, 'working')
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: '税抜だった' }).effects, [{ k: 'amend-flag', amount: 5000, message: '¥5,000 を税抜として入れ直しました。', set: { taxIncluded: 'false' } }])
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: '6,000円にして' }).effects, [{ k: 'amend-flag', amount: 6000, message: '金額を ¥6,000 に直しました。' }])
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: 'やっぱり変えたい' }).effects, [])
  const inv = toConfirm(INCOME_INVOICE_DRAFT, STAGE2[0].values, INV_SNAP)
  assert.deepEqual(reduce(inv, { t: 'adjust', text: '税込みだった' }).effects, [{ k: 'amend', amount: null, inclusive: true }])
})

test('段階2の表示: 確認カードは画面の値をそのまま読み、下書き・確定と送付はまだ、を正しく書く', () => {
  const ic = confirmRows(INCOME_INVOICE_DRAFT, INV_SNAP)
  assert.equal(ic.rows.find((r) => r.big)?.value, '¥300,000')
  assert.equal(ic.rows.find((r) => r.label === '支払期日')?.value, '取引先の支払条件で決まります')
  assert.equal(confirmRows(INCOME_INVOICE_DRAFT, { ...INV_SNAP, due: '2026-11-30' }).rows.find((r) => r.label === '支払期日')?.value, '2026-11-30')
  assert.match(ic.note, /下書きまで/)
  assert.match(ic.note, /確定と送付はまだ行いません/)
  const ec = confirmRows(EXPENSE_ADD, EXP_SNAP)
  assert.equal(ec.rows.find((r) => r.big)?.label, '金額（税抜）')
  assert.equal(confirmRows(EXPENSE_ADD, { ...EXP_SNAP, taxIncluded: 'true' }).rows.find((r) => r.big)?.label, '金額（税込）')
  assert.deepEqual(ec.rows.filter((r) => ['カテゴリ', '支払の周期', '開始日'].includes(r.label)).map((r) => r.value), ['SaaS', '毎月', '2026-11-06'])
  const id = doneView(INCOME_INVOICE_DRAFT, INV_SNAP, '/income/invoices/inv1')
  assert.match(id.lead, /請求書の下書きを保存しました/)
  assert.match(id.lead, /確定と送付はまだ行っていません/)
  assert.equal(id.next[0].href, '/income/invoices/inv1')
  const ed = doneView(EXPENSE_ADD, EXP_SNAP, '/expense/acme/contracts/c1')
  assert.match(ed.lead, /「Notion ビジネスプラン」の支出を登録しました/)
  assert.equal(ed.next.find((n) => n.id === 'forecast')?.href, '/expense/acme/forecast')
  assert.match(leadText(EXPENSE_ADD, { amount: '5000' }), /¥5,000 の支出を登録します/)
})

// ======== 段階3: 案件の作成・休暇の申請、失敗の種類 ========
const PRJ_SNAP: AgentFormSnapshot = { name: 'Web サイト制作', client: '', status: '下書き', billing: '一括', amount: '2000000', start: '', end: '' }
const LEAVE_SNAP: AgentFormSnapshot = { typeLabel: '休暇', leaveLabel: '有給休暇', start: '2026-11-10', end: '2026-11-11', reason: '私用のため' }
const STAGE3: { op: ChatOp; values: Record<string, string>; snap: AgentFormSnapshot }[] = [
  { op: PROMANE_PROJECT_ADD, values: { name: 'Web サイト制作', amount: '2000000' }, snap: PRJ_SNAP },
  { op: KINTAI_LEAVE_REQUEST, values: { start: '2026-11-10', end: '2026-11-11', reason: '私用のため' }, snap: LEAVE_SNAP },
]

test('段階3の操作の定義: 保存は確認カードの対象。承認・確定・送信は入れない。画面の初期値は AI に読ませない', () => {
  for (const { op } of STAGE3) {
    assert.equal(op.risk, 'write')
    assert.ok(op.fields.every((f) => f.required), `${op.key}: 読み取る欄は、画面が必須にしているものだけ`)
    assert.ok(!op.fields.some((f) => ['status', 'billing', 'billingType', 'leaveType', 'type', 'client', 'clientId'].includes(f.key)), `${op.key}: 種類・状態・顧客は AI に読ませない`)
    assert.ok(!/承認する|確定|送信|削除/.test(op.submitLabel + op.confirmTitle), op.key)
    assert.equal(op.taxAdjust, 'none')
    assert.equal(buildSteps(op).at(-1)?.id, 'confirm')
  }
  assert.deepEqual(KINTAI_LEAVE_REQUEST.fixed.map((f) => [f.key, f.value]), [['type', 'leave'], ['leaveType', 'paid']])
  assert.match(KINTAI_LEAVE_REQUEST.description, /承認はしない/)
  const ids = chatActions().map((a) => a.id)
  assert.ok(ids.includes('promane.project.add') && ids.includes('kintai.request.leave'))
  assert.equal(new Set(ids).size, ids.length)
})

test('段階3: API の返事は、依頼の文で確かめた値だけを残す（作り話の案件名・文に無い理由は捨てる）', () => {
  const prj = chatResponse({ kind: 'action', actionId: 'promane.project.add', values: { name: '作り話プロジェクト', amount: '2000000' }, missing: [], reason: '' }, 'Web サイト制作 契約金額200万円で案件を作って')
  assert.ok(prj.kind === 'op')
  if (prj.kind === 'op') { assert.deepEqual(prj.values, { amount: '2000000' }); assert.deepEqual(prj.missing.map((f) => f.key), ['name']) }
  const lv = chatResponse({ kind: 'action', actionId: 'kintai.request.leave', values: { start: '2026-11-10', end: '2026-11-11', reason: '家族の用事のため' }, missing: [], reason: '' }, '11月10日から11月11日まで有給休暇を申請して')
  assert.ok(lv.kind === 'op')
  if (lv.kind === 'op') { assert.deepEqual(lv.values, { start: '2026-11-10', end: '2026-11-11' }); assert.deepEqual(lv.missing.map((f) => f.key), ['reason']) }
  // 日付の言葉が無い依頼では、日付を読まない（聞き返す）
  const nod = chatResponse({ kind: 'action', actionId: 'kintai.request.leave', values: { start: '2026-11-10', end: '2026-11-11', reason: '私用のため' }, missing: [], reason: '' }, '私用のため有給休暇を申請して')
  assert.ok(nod.kind === 'op' && !('start' in nod.values) && nod.missing.map((f) => f.key).join() === 'start,end')
})

test('段階3の決まり: 確認の前に保存しない・確認で1件だけ・失敗で完了を出さない・直しても保存しない', () => {
  for (const { op, values, snap } of STAGE3) {
    const working = run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }]).state
    assert.equal(working.phase, 'working', op.key)
    assert.equal(reduce(working, { t: 'approve' }).effects.length, 0)
    const all: ChatEvent[] = [{ t: 'ask', text: 'x' }, { t: 'reply', res: opRes(op, {}) }, { t: 'answer', value: '1' }, { t: 'step', id: 'open-tool', status: 'done' }, { t: 'retry' }, { t: 'ready', snap }, { t: 'adjust', text: '税込みだった' }, { t: 'changed', snap }, { t: 'submitted', ok: true, snap, href: '/x' }, { t: 'reset' }]
    for (const ev of all) assert.ok(!reduce(working, ev).effects.some((e) => e.k === 'submit'), `${op.key}: ${ev.t}`)
    const confirm = toConfirm(op, values, snap)
    assert.equal(confirm.phase, 'confirm')
    // 確認カードでの直しは、画面の欄で直してもらう。保存の指示も、画面を動かす指示も返さない
    const adj = reduce(confirm, { t: 'adjust', text: '税込みだった' })
    assert.deepEqual(adj.effects, [])
    assert.ok(adj.state.notice)
    const first = reduce(confirm, { t: 'approve' })
    assert.deepEqual(first.effects, [{ k: 'submit' }])
    assert.deepEqual(reduce(first.state, { t: 'approve' }).effects, [])
    const done = reduce(first.state, { t: 'submitted', ok: true, snap, href: '/x/y/abc' })
    assert.equal(done.state.phase, 'done')
    assert.deepEqual(reduce(done.state, { t: 'approve' }).effects, [])
    const failed = reduce(first.state, { t: 'submitted', ok: false, error: '申請できませんでした。' })
    assert.equal(failed.state.phase, 'failed')
    assert.equal(failed.state.done, null)
    // 確認カードのあとに画面が変わっていたら、保存せずに確認カードを出し直す
    const changed = reduce(first.state, { t: 'changed', snap: { ...snap, reason: '別の理由', name: '別の案件' } })
    assert.equal(changed.state.phase, 'confirm')
    assert.deepEqual(changed.effects, [])
  }
})

test('段階3の表示: 確認カードは画面の値をそのまま読み、承認・タスク・請求はまだ、を正しく書く', () => {
  const pc = confirmRows(PROMANE_PROJECT_ADD, PRJ_SNAP)
  assert.equal(pc.rows.find((r) => r.big)?.value, '¥2,000,000')
  assert.equal(pc.rows.find((r) => r.label === '顧客')?.value, 'なし')
  assert.ok(!pc.rows.some((r) => r.label === '開始日'))
  assert.equal(confirmRows(PROMANE_PROJECT_ADD, { ...PRJ_SNAP, start: '2026-12-01' }).rows.find((r) => r.label === '開始日')?.value, '2026-12-01')
  assert.match(pc.note, /画面の初期値/)
  const lc = confirmRows(KINTAI_LEAVE_REQUEST, LEAVE_SNAP)
  assert.equal(lc.rows.find((r) => r.big)?.value, '2026年11月10日から2026年11月11日（2日間）')
  assert.equal(confirmRows(KINTAI_LEAVE_REQUEST, { ...LEAVE_SNAP, end: '2026-11-09' }).rows.find((r) => r.big)?.value, '2026年11月10日から2026年11月9日')
  assert.match(lc.note, /承認はされません/)
  const pd = doneView(PROMANE_PROJECT_ADD, PRJ_SNAP, '/promane/acme/projects/p1')
  assert.match(pd.lead, /案件を作りました/)
  assert.match(pd.lead, /タスクや請求は、まだ作っていません/)
  assert.equal(pd.next.find((n) => n.id === 'project-list')?.href, '/promane/acme/projects')
  const ld = doneView(KINTAI_LEAVE_REQUEST, LEAVE_SNAP, '/kintai/requests')
  assert.match(ld.lead, /承認は、管理者が行います/)
  assert.match(leadText(KINTAI_LEAVE_REQUEST, { start: '2026-11-10', end: '2026-11-11' }), /2026年11月10日から2026年11月11日の有給休暇/)
  assert.match(leadText(PROMANE_PROJECT_ADD, { name: 'Web' }), /「Web」の案件/)
})

test('失敗の種類: 権限がない・ツールを始めていない失敗は、もう一度やっても同じになるので、やり直しを受け付けない', () => {
  for (const { op, values, snap } of [...STAGE2, ...STAGE3]) {
    const working = run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }]).state
    for (const kind of ['blocked', 'not-started'] as const) {
      const f = reduce(working, { t: 'run-failed', error: '理由', kind })
      assert.equal(f.state.phase, 'failed', `${op.key}/${kind}`)
      assert.equal(f.state.errorKind, kind)
      // やり直し（もう一度やる）は何も起こさない。同じ失敗を繰り返さない
      const r = reduce(f.state, { t: 'retry' })
      assert.equal(r.state, f.state)
      assert.deepEqual(r.effects, [])
    }
    // 理由の種類が付かない失敗は、今までどおりやり直せる
    const other = reduce(working, { t: 'run-failed', error: '画面に値を入れられませんでした。' })
    assert.equal(other.state.errorKind, 'other')
    assert.equal(reduce(other.state, { t: 'retry' }).state.phase, 'working')
    // 保存のときのサーバーの 403（権限がない）は、確認カードに戻らない
    const submitting = reduce(toConfirm(op, values, snap), { t: 'approve' }).state
    const denied = reduce(submitting, { t: 'submitted', ok: false, error: '権限がありません。', kind: 'blocked' })
    assert.equal(denied.state.phase, 'failed')
    assert.equal(denied.state.errorKind, 'blocked')
    assert.equal(reduce(denied.state, { t: 'retry' }).state, denied.state)
    assert.equal(denied.state.done, null)
    // やめる、は使える。次の依頼のときは、種類を持ち越さない
    assert.equal(reduce(denied.state, { t: 'reset' }).state.errorKind, 'other')
    // 保存の失敗（種類なし）は、今までどおり確認カードに戻れる
    const plain = reduce(submitting, { t: 'submitted', ok: false, error: '通信に失敗しました。' })
    assert.equal(reduce(plain.state, { t: 'retry' }).state.phase, 'confirm')
  }
})

// ======== 段階4: 残業の申請・顧客の追加・単発の支出、ワークスペースの選択 ========
const OT_SNAP: AgentFormSnapshot = { typeLabel: '残業', leaveLabel: '有給休暇', start: '', end: '', date: '2026-11-05', hours: '2', minutes: '30', reason: '納期対応のため' }
const CLI_SNAP: AgentFormSnapshot = { name: '株式会社サンプル', contactName: '', email: '', phone: '' }
const ONE_SNAP: AgentFormSnapshot = { title: '会議室の利用料', amount: '8000', category: 'その他', payDate: '2026-11-06', taxRate: '10%', taxIncluded: 'false', withholding: 'false' }
const STAGE4: { op: ChatOp; values: Record<string, string>; snap: AgentFormSnapshot }[] = [
  { op: KINTAI_OVERTIME_REQUEST, values: { date: '2026-11-05', duration: '2時間30分', reason: '納期対応のため' }, snap: OT_SNAP },
  { op: PROMANE_CLIENT_ADD, values: { name: '株式会社サンプル' }, snap: CLI_SNAP },
  { op: EXPENSE_ONEOFF_ADD, values: { amount: '8000', title: '会議室の利用料' }, snap: ONE_SNAP },
]

test('時間の言い方: 2時間30分・半・分だけ・小数を読み、単位が無い数字や範囲外は読まない。分は時間に繰り上げる', () => {
  assert.deepEqual(parseDuration('2時間30分'), { hours: 2, minutes: 30 })
  assert.deepEqual(parseDuration('２時間３０分'), { hours: 2, minutes: 30 })
  assert.deepEqual(parseDuration('2時間半'), { hours: 2, minutes: 30 })
  assert.deepEqual(parseDuration('1時間'), { hours: 1, minutes: 0 })
  assert.deepEqual(parseDuration('45分'), { hours: 0, minutes: 45 })
  assert.deepEqual(parseDuration('90分'), { hours: 1, minutes: 30 })
  assert.deepEqual(parseDuration('1.5時間'), { hours: 1, minutes: 30 })
  assert.deepEqual(parseDuration('24時間'), { hours: 24, minutes: 0 })
  for (const bad of ['', '2', '少し', '25時間', '0分', '2時間30分と15', null, undefined]) assert.equal(parseDuration(bad as string), null, String(bad))
  assert.equal(durationText('2', '30'), '2時間30分')
  assert.equal(durationText('', '45'), '45分')
  assert.equal(durationText('1', ''), '1時間')
  assert.equal(durationText('', ''), '')
})

test('段階4の操作の定義: 保存は確認カードの対象。承認・削除・送信は入れない。種類は固定し、書かれていない任意の項目は AI に補わせない', () => {
  for (const { op } of STAGE4) {
    assert.equal(op.risk, 'write')
    assert.ok(op.fields.some((f) => f.required), op.key)
    assert.ok(!/承認する|確定|送信|送付|削除/.test(op.submitLabel + op.confirmTitle), op.key)
    assert.equal(buildSteps(op).at(-1)?.id, 'confirm')
    assert.ok(op.fields.every((f) => !f.required || f.ask), `${op.key}: 必須の欄には、聞き返しの文がある`)
  }
  assert.deepEqual(KINTAI_OVERTIME_REQUEST.fixed.map((f) => [f.key, f.value]), [['type', 'overtime']])
  assert.equal(KINTAI_OVERTIME_REQUEST.formKey, KINTAI_LEAVE_REQUEST.formKey, '休暇と同じ画面（同じフォーム）を動かす')
  assert.match(KINTAI_OVERTIME_REQUEST.description, /承認はしない/)
  assert.deepEqual(PROMANE_CLIENT_ADD.fields.filter((f) => f.required).map((f) => f.key), ['name'])
  assert.ok(!PROMANE_CLIENT_ADD.fields.some((f) => ['address', 'note'].includes(f.key)), '住所とメモは入れない')
  assert.deepEqual(EXPENSE_ONEOFF_ADD.fields.filter((f) => f.required).map((f) => f.key), ['amount', 'title'])
  assert.ok(!EXPENSE_ONEOFF_ADD.fields.some((f) => ['category', 'taxRate', 'withholding', 'taxIncluded'].includes(f.key)), 'カテゴリ・税率・源泉は AI に読ませない')
  assert.equal(EXPENSE_ONEOFF_ADD.taxAdjust, 'flag')
  assert.equal(PROMANE_CLIENT_ADD.taxAdjust, 'none')
  const ids = chatActions().map((a) => a.id)
  assert.ok(['kintai.request.overtime', 'promane.client.add', 'expense.schedule.add'].every((k) => ids.includes(k)))
  assert.equal(new Set(ids).size, ids.length)
  // 画面の作業の一覧: 書かれていない任意の項目は出さない（入れていない欄を、済みと見せない）
  assert.deepEqual(buildSteps(PROMANE_CLIENT_ADD, { name: '株式会社サンプル' }).map((s) => s.id), ['open-tool', 'open-form', 'fill:name', 'confirm'])
  assert.deepEqual(buildSteps(PROMANE_CLIENT_ADD, { name: '株式会社サンプル', email: 'a@sample.co.jp' }).map((s) => s.id), ['open-tool', 'open-form', 'fill:name', 'fill:email', 'confirm'])
  assert.equal(buildSteps(PROMANE_CLIENT_ADD).filter((s) => s.id.startsWith('fill:')).length, 4)
})

test('段階4: API の返事は、依頼の文で確かめた値だけを残す（作り話の時間・メール・日付は捨てる）', () => {
  const ot = chatResponse({ kind: 'action', actionId: 'kintai.request.overtime', values: { date: '2026-11-05', duration: '3時間', reason: '納期対応のため' }, missing: [], reason: '' }, '昨日2時間30分残業したので申請して')
  assert.ok(ot.kind === 'op')
  if (ot.kind === 'op') { assert.deepEqual(ot.values, { date: '2026-11-05' }); assert.deepEqual(ot.missing.map((f) => f.key), ['duration', 'reason']) }
  const ot2 = chatResponse({ kind: 'action', actionId: 'kintai.request.overtime', values: { date: '2026-11-05', duration: '2時間30分', reason: '納期対応のため' }, missing: [], reason: '' }, '昨日2時間30分、納期対応のため残業したので申請して')
  assert.ok(ot2.kind === 'op' && ot2.missing.length === 0 && ot2.values.duration === '2時間30分')
  if (ot2.kind === 'op') assert.match(ot2.say, /2026年11月5日の残業（2時間30分）を申請します/)
  const noDate = chatResponse({ kind: 'action', actionId: 'kintai.request.overtime', values: { date: '2026-11-05', duration: '1時間', reason: '対応' }, missing: [], reason: '' }, '1時間 対応で残業の申請をして')
  assert.ok(noDate.kind === 'op' && !('date' in noDate.values) && noDate.missing.map((f) => f.key).join() === 'date')
  const cli = chatResponse({ kind: 'action', actionId: 'promane.client.add', values: { name: '株式会社サンプル', email: 'made-up@example.com', phone: '03-0000-0000', contactName: '山田太郎' }, missing: [], reason: '' }, '株式会社サンプルを顧客に追加して。担当は山田太郎')
  assert.ok(cli.kind === 'op')
  if (cli.kind === 'op') { assert.deepEqual(cli.values, { name: '株式会社サンプル', contactName: '山田太郎' }); assert.deepEqual(cli.missing, []); assert.match(cli.say, /「株式会社サンプル」を顧客に追加します/) }
  const noName = chatResponse({ kind: 'action', actionId: 'promane.client.add', values: { name: '作り話商事' }, missing: [], reason: '' }, '顧客を追加して')
  assert.ok(noName.kind === 'op' && noName.missing.map((f) => f.key).join() === 'name')
  const one = chatResponse({ kind: 'action', actionId: 'expense.schedule.add', values: { amount: '8000', title: '会議室の利用料', payDate: '2026-11-20' }, missing: [], reason: '' }, '会議室の利用料 8,000円を単発の支出に追加して')
  assert.ok(one.kind === 'op')
  if (one.kind === 'op') { assert.deepEqual(one.values, { amount: '8000', title: '会議室の利用料' }); assert.deepEqual(one.missing, []); assert.match(one.say, /¥8,000 の単発の支出を追加します/) }
  const one2 = chatResponse({ kind: 'action', actionId: 'expense.schedule.add', values: { amount: '8000', title: '会議室の利用料', payDate: '2026-11-20' }, missing: [], reason: '' }, '会議室の利用料 8,000円を11月20日払いで単発の支出に追加して')
  assert.ok(one2.kind === 'op' && one2.values.payDate === '2026-11-20')
})

test('段階4の決まり: 確認の前に保存しない・確認で1件だけ・失敗で完了を出さない・画面が変わったら出し直す', () => {
  for (const { op, values, snap } of STAGE4) {
    const working = run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }]).state
    assert.equal(working.phase, 'working', op.key)
    assert.equal(reduce(working, { t: 'approve' }).effects.length, 0)
    const all: ChatEvent[] = [{ t: 'ask', text: 'x' }, { t: 'reply', res: opRes(op, {}) }, { t: 'answer', value: '1' }, { t: 'step', id: 'open-tool', status: 'done' }, { t: 'retry' }, { t: 'ready', snap }, { t: 'adjust', text: '税込みだった' }, { t: 'changed', snap }, { t: 'submitted', ok: true, snap, href: '/x' }, { t: 'choose', id: 'a' }, { t: 'reset' }]
    for (const ev of all) assert.ok(!reduce(working, ev).effects.some((e) => e.k === 'submit'), `${op.key}: ${ev.t}`)
    const confirm = toConfirm(op, values, snap)
    assert.equal(confirm.phase, 'confirm')
    const first = reduce(confirm, { t: 'approve' })
    assert.deepEqual(first.effects, [{ k: 'submit' }], '確認で保存の指示は1つだけ')
    assert.deepEqual(reduce(first.state, { t: 'approve' }).effects, [], '2回押しても増えない')
    const done = reduce(first.state, { t: 'submitted', ok: true, snap, href: '/x/y' })
    assert.equal(done.state.phase, 'done')
    assert.deepEqual(reduce(done.state, { t: 'approve' }).effects, [])
    assert.equal(reduce(done.state, { t: 'submitted', ok: true, snap, href: '/x' }).state, done.state, '成功の知らせが二重に来ても変わらない')
    const failed = reduce(first.state, { t: 'submitted', ok: false, error: '申請できませんでした。' })
    assert.equal(failed.state.phase, 'failed')
    assert.equal(failed.state.done, null)
    assert.ok(failed.state.steps.some((s) => s.status !== 'done'), '失敗では、作業の一覧を全部済みにしない')
    assert.equal(reduce(failed.state, { t: 'retry' }).state.phase, 'confirm')
    const changed = reduce(first.state, { t: 'changed', snap: { ...snap, reason: '別の理由', name: '別の会社', title: '別の内容' } })
    assert.equal(changed.state.phase, 'confirm')
    assert.deepEqual(changed.effects, [])
    assert.match(changed.state.notice ?? '', /保存せずに/)
    // 権限で止まる: 値を入れる前（run-failed blocked）も、保存のときの 403 も、やり直しを受け付けず、完了を出さない
    const blocked = reduce(working, { t: 'run-failed', error: '権限がありません。', kind: 'blocked' })
    assert.equal(blocked.state.phase, 'failed')
    assert.equal(blocked.state.errorKind, 'blocked')
    assert.equal(blocked.state.done, null)
    assert.equal(reduce(blocked.state, { t: 'retry' }).state, blocked.state)
    const denied = reduce(first.state, { t: 'submitted', ok: false, error: '権限がありません。', kind: 'blocked' })
    assert.equal(denied.state.errorKind, 'blocked')
    assert.equal(reduce(denied.state, { t: 'retry' }).state, denied.state)
  }
})

test('段階4: 直し方は操作ごとに違う（支出は税込みの切り替え、残業と顧客は画面の欄で直す）', () => {
  const one = toConfirm(EXPENSE_ONEOFF_ADD, STAGE4[2].values, ONE_SNAP)
  assert.deepEqual(reduce(one, { t: 'adjust', text: '税込みだった' }).effects, [{ k: 'amend-flag', amount: 8000, message: '¥8,000 を税込みとして入れ直しました。', set: { taxIncluded: 'true' } }])
  assert.deepEqual(reduce(one, { t: 'adjust', text: '9,000円にして' }).effects, [{ k: 'amend-flag', amount: 9000, message: '金額を ¥9,000 に直しました。' }])
  for (const { op, values, snap } of STAGE4.slice(0, 2)) {
    const adj = reduce(toConfirm(op, values, snap), { t: 'adjust', text: '税込みだった' })
    assert.deepEqual(adj.effects, [], op.key)
    assert.ok(adj.state.notice)
  }
})

test('聞き返しの答え: 残業の時間は読める言い方だけ受け付け、読めなければ案内して聞き直す', () => {
  assert.ok(answerProblem(KINTAI_OVERTIME_REQUEST, 'duration', '多め'))
  assert.equal(answerProblem(KINTAI_OVERTIME_REQUEST, 'duration', '1時間30分'), null)
  assert.equal(answerProblem(KINTAI_OVERTIME_REQUEST, 'reason', 'なんでも'), null)
  assert.equal(answerProblem(PROMANE_CLIENT_ADD, 'duration', '多め'), null)
  const asking = run([{ t: 'ask', text: '残業を申請して' }, { t: 'reply', res: opRes(KINTAI_OVERTIME_REQUEST, { date: '2026-11-05', reason: '納期対応のため' }) }]).state
  assert.equal(asking.phase, 'asking')
  assert.equal(asking.missing[0].key, 'duration')
  const bad = reduce(asking, { t: 'answer', value: '多め' })
  assert.equal(bad.state.phase, 'asking')
  assert.match(bad.state.askError ?? '', /時間の形が合いません/)
  assert.equal(bad.state.answers.length, 0, '形の合わない答えは、会話に残さない')
  const ok = reduce(asking, { t: 'answer', value: '1時間30分' })
  assert.equal(ok.state.phase, 'working')
  assert.equal(ok.state.values.duration, '1時間30分')
  assert.equal(ok.effects[0].k, 'run')
})

test('段階4の表示: 確認カードは画面の値をそのまま読み、承認・案件・支払済みはまだ、を正しく書く', () => {
  const oc = confirmRows(KINTAI_OVERTIME_REQUEST, OT_SNAP)
  assert.equal(oc.rows.find((r) => r.big)?.value, '2時間30分')
  assert.equal(oc.rows.find((r) => r.label === '対象日')?.value, '2026年11月5日')
  assert.equal(oc.rows.find((r) => r.label === '申請の種類')?.value, '残業')
  assert.equal(confirmRows(KINTAI_OVERTIME_REQUEST, { ...OT_SNAP, hours: '', minutes: '45' }).rows.find((r) => r.big)?.value, '45分')
  assert.equal(confirmRows(KINTAI_OVERTIME_REQUEST, { ...OT_SNAP, hours: '', minutes: '' }).rows.find((r) => r.big)?.value, '未入力')
  assert.match(oc.note, /承認はされません/)
  const od = doneView(KINTAI_OVERTIME_REQUEST, OT_SNAP, '/kintai/requests')
  assert.match(od.lead, /2026年11月5日の分（2時間30分）です/)
  assert.match(od.lead, /承認は、管理者が行います/)
  assert.equal(od.next[0].href, '/kintai/requests')
  const cc = confirmRows(PROMANE_CLIENT_ADD, CLI_SNAP)
  assert.equal(cc.rows.find((r) => r.big)?.value, '株式会社サンプル')
  assert.deepEqual(cc.rows.filter((r) => ['担当者名', 'メール', '電話'].includes(r.label)).map((r) => r.value), ['入れていません', '入れていません', '入れていません'])
  assert.equal(confirmRows(PROMANE_CLIENT_ADD, { ...CLI_SNAP, email: 'a@sample.co.jp' }).rows.find((r) => r.label === 'メール')?.value, 'a@sample.co.jp')
  assert.match(cc.note, /案件には紐づけません/)
  const cd = doneView(PROMANE_CLIENT_ADD, CLI_SNAP, '/promane/acme/clients')
  assert.match(cd.lead, /「株式会社サンプル」を顧客に追加しました/)
  assert.match(cd.lead, /案件には、まだ紐づけていません/)
  assert.equal(cd.next.find((n) => n.id === 'project-new')?.href, '/promane/acme/projects/new')
  const ec = confirmRows(EXPENSE_ONEOFF_ADD, ONE_SNAP)
  assert.equal(ec.rows.find((r) => r.big)?.label, '金額（税抜）')
  assert.equal(confirmRows(EXPENSE_ONEOFF_ADD, { ...ONE_SNAP, taxIncluded: 'true' }).rows.find((r) => r.big)?.label, '金額（税込）')
  assert.deepEqual(ec.rows.filter((r) => ['カテゴリ', '支払日', '税率', '源泉徴収'].includes(r.label)).map((r) => r.value), ['その他', '2026年11月6日', '10%', '対象にしない'])
  assert.match(ec.note, /画面の初期値/)
  const ed = doneView(EXPENSE_ONEOFF_ADD, ONE_SNAP, '/expense/acme/payables?month=2026-11')
  assert.match(ed.lead, /「会議室の利用料」を支払予定に追加しました/)
  assert.match(ed.lead, /支払済み）には、まだしていません/)
  assert.equal(ed.next.find((n) => n.id === 'forecast')?.href, '/expense/acme/forecast')
  assert.match(leadText(KINTAI_OVERTIME_REQUEST, {}), /残業を申請します/)
  assert.match(leadText(PROMANE_CLIENT_ADD, {}), /顧客を追加します/)
})

test('選択肢: 画面が選択肢を出したら止まり、本人が選ぶまで保存にも次の画面にも進まない。出していない選択肢は受け付けない', () => {
  const opts = [{ id: 'acme', label: 'アクメ株式会社' }, { id: 'beta', label: 'ベータ商事' }]
  const working = run([{ t: 'ask', text: '案件を作って' }, { t: 'reply', res: opRes(PROMANE_PROJECT_ADD, { name: 'Web サイト制作', amount: '2000000' }) }]).state
  assert.equal(working.phase, 'working')
  const ch = reduce(working, { t: 'choices', prompt: 'どのワークスペースで進めますか？', options: opts })
  assert.equal(ch.state.phase, 'choosing')
  assert.deepEqual(ch.effects, [])
  assert.deepEqual(ch.state.choose?.options, opts)
  // 選ぶまで、何を送っても保存・実行の指示を返さない（新しい依頼も受け付けない）
  for (const ev of [{ t: 'approve' }, { t: 'ask', text: 'x' }, { t: 'answer', value: 'a' }, { t: 'ready', snap: PRJ_SNAP }, { t: 'adjust', text: 'x' }, { t: 'submitted', ok: true, snap: PRJ_SNAP, href: '/x' }, { t: 'retry' }] as ChatEvent[]) {
    const r = reduce(ch.state, ev)
    assert.equal(r.state, ch.state, ev.t)
    assert.deepEqual(r.effects, [], ev.t)
  }
  // 出していない選択肢は受け付けない
  const wrong = reduce(ch.state, { t: 'choose', id: 'other-org' })
  assert.equal(wrong.state, ch.state)
  assert.deepEqual(wrong.effects, [])
  // 選ぶと、作業に戻り、選んだ id だけを画面へ渡す。選んだ言葉は会話に残る
  const picked = reduce(ch.state, { t: 'choose', id: 'beta' })
  assert.equal(picked.state.phase, 'working')
  assert.equal(picked.state.choose, null)
  assert.deepEqual(picked.effects, [{ k: 'choose', id: 'beta' }])
  assert.deepEqual(picked.state.answers, ['ベータ商事'])
  assert.ok(!picked.effects.some((e) => e.k === 'submit'))
  // 選んだあとの二重の選択は何も起こさない
  assert.deepEqual(reduce(picked.state, { t: 'choose', id: 'acme' }).effects, [])
  // 作業中でないとき・選択肢が空のときは出さない
  assert.equal(reduce(INITIAL_STATE, { t: 'choices', prompt: 'x', options: opts }).state, INITIAL_STATE)
  assert.equal(reduce(working, { t: 'choices', prompt: 'x', options: [] }).state, working)
  // やめると、選択肢は消える
  assert.equal(reduce(ch.state, { t: 'reset' }).state.choose, null)
  assert.equal(reduce(ch.state, { t: 'reset' }).state.phase, 'idle')
  // 選んだあとは、そのまま確認カードまで進める（保存は確認ボタンのあとだけ）
  const ready = reduce(picked.state, { t: 'ready', snap: PRJ_SNAP })
  assert.equal(ready.state.phase, 'confirm')
  assert.deepEqual(reduce(ready.state, { t: 'approve' }).effects, [{ k: 'submit' }])
})

test('確認と保存の間: 全部の操作で、フォームの画面を正しく判定する（?to= の入口ではなく、運ばれた先で見る）', () => {
  const screens: Record<string, string> = {
    [INCOME_SALE_ADD.key]: '/income/contracts/new', [INCOME_INVOICE_DRAFT.key]: '/income/invoices/new',
    [EXPENSE_ADD.key]: '/expense/org/contracts/new', [PROMANE_PROJECT_ADD.key]: '/promane/ws/projects/new',
    [KINTAI_LEAVE_REQUEST.key]: '/kintai/requests/new', [KINTAI_OVERTIME_REQUEST.key]: '/kintai/requests/new',
    [PROMANE_CLIENT_ADD.key]: '/promane/ws/clients', [EXPENSE_ONEOFF_ADD.key]: '/expense/org/payables',
  }
  assert.equal(Object.keys(screens).length, CHAT_OPS.length)
  for (const op of CHAT_OPS) {
    assert.equal(onOpScreen(op, screens[op.key]), true, op.key)
    assert.equal(onOpScreen(op, '/somewhere-else'), false, op.key)
  }
})

test('確認と保存の間: 差の種類ごとに判定する', () => {
  const form = {}
  const base = { receipt: { form, draft: draftKey({ a: 1 }) }, form, onScreen: true, ready: true, blocked: false, shown: { x: '1' }, snap: { x: '1' }, draft: draftKey({ a: 1 }) }
  assert.equal(judgeReview(base), 'same')
  assert.equal(judgeReview({ ...base, snap: { x: '2' } }), 'shown')
  assert.equal(judgeReview({ ...base, draft: draftKey({ a: 2 }) }), 'hidden')
  assert.equal(judgeReview({ ...base, ready: false }), 'busy')
  assert.equal(judgeReview({ ...base, blocked: true }), 'blocked')
  assert.equal(judgeReview({ ...base, form: {} }), 'form')
  assert.equal(judgeReview({ ...base, form: undefined }), 'form')
  assert.equal(judgeReview({ ...base, receipt: null }), 'form')
  assert.equal(judgeReview({ ...base, draft: null }), 'form')
  assert.equal(judgeReview({ ...base, onScreen: false }), 'screen')
})

test('確認と保存の間: どの差でも保存の指示を返さない。別のフォームなら、確認カードを消して入力からやり直す', () => {
  for (const { op, values, snap } of [...STAGE2, ...STAGE3, ...STAGE4]) {
    const submitting = reduce(toConfirm(op, values, snap), { t: 'approve' }).state
    const hidden = reduce(submitting, { t: 'changed', snap, hidden: true })
    assert.equal(hidden.state.phase, 'confirm', op.key)
    assert.match(hidden.state.notice ?? '', /出ていない欄/)
    const busy = reduce(submitting, { t: 'not-ready' })
    assert.equal(busy.state.phase, 'confirm')
    const invalid = reduce(submitting, { t: 'confirmation-invalid', why: 'form' })
    assert.equal(invalid.state.phase, 'failed')
    assert.equal(invalid.state.confirm, null)
    for (const r of [hidden, busy, invalid]) assert.deepEqual(r.effects, [])
    const again = reduce(invalid.state, { t: 'retry' })
    assert.equal(again.state.phase, 'working')
    assert.ok(!again.effects.some((e) => e.k === 'submit'))
    // 保存していない場面では効かない
    const confirm = toConfirm(op, values, snap)
    assert.equal(reduce(confirm, { t: 'not-ready' }).state, confirm)
    assert.equal(reduce(confirm, { t: 'confirmation-invalid', why: 'screen' }).state, confirm)
  }
})

test('保存の鍵: 同時に1件だけ受け付け、失敗のあとは再び受け付け、成功で閉じたあとは受け付けない', async () => {
  const lock = createSaveLock()
  let calls = 0
  let release = () => {}
  const held = new Promise<void>((r) => { release = r })
  const first = lock.run(async () => { calls++; await held; return { ok: true as const } })
  assert.equal(lock.busy(), true)
  const second = await lock.run(async () => { calls++; return { ok: true as const } })
  assert.equal(second.ok, false)
  release(); await first
  assert.equal(calls, 1)
  assert.equal(lock.busy(), false)
  await assert.rejects(lock.run(async () => { throw new Error('通信の失敗') }))
  assert.equal(lock.busy(), false)
  lock.close()
  assert.equal(lock.busy(), true)
  assert.equal((await lock.run(async () => { calls++; return { ok: true as const } })).ok, false)
  assert.equal(calls, 1)
})

test('操作に当たらないとき、AI の理由の文を画面に渡さない（内部の言葉を出さない）', () => {
  const res = chatResponse({ kind: 'unknown', reason: 'どの操作にも当たらないので unknown にしました', suggestions: [{ label: '売上を見る', href: '/income/revenue' }] } as never, '利益率ってどう計算するの？')
  assert.equal(res.kind, 'unknown')
  assert.equal((res as { reason?: string }).reason, '')
})
