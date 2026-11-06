// 実行: npx tsx --test src/lib/agent-chat/agent-chat.test.ts
// チャットで仕事を進める仕組みの回帰テスト。AI も DB も呼ばない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAgentChat, agentChatRollout } from './flag'
import { jstTodayYmd, monthLabelOf, yenText } from './today'
import { groundValues, yenCandidates } from './ground'
import { CHAT_OPS, EXPENSE_ADD, INCOME_INVOICE_DRAFT, INCOME_SALE_ADD, buildSteps, confirmRows, doneView, leadText, resolveFixed, chatOpByKey } from './ops'
import { chatResponse, chatActions } from './handle'
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

test('金額の直し: 確認カードのときだけ。税込みは画面の今の値から計算し、直したあとも保存の指示は返さない', () => {
  const confirm = run([
    { t: 'ask', text: 'x' }, { t: 'reply', res: opReply({ amount: '1100000', client: 'A', title: 'B' }, []) },
    { t: 'ready', snap: { ...SNAP, subtotal: '1100000', tax: '110000', total: '1210000' } },
  ]).state
  assert.equal(confirm.snap?.subtotal, '1100000')
  // 税込みだった → 税抜 1,000,000
  const a = reduce(confirm, { t: 'adjust', text: '税込みだった' })
  assert.deepEqual(a.effects, [{ k: 'amend', amount: 1_000_000, message: '税込みの ¥1,100,000 を、税抜の ¥1,000,000 に直しました。' }])
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
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: '120万円にして' }).effects, [{ k: 'amend', amount: 1_200_000, message: '税抜の ¥1,200,000 に直しました。' }])
  assert.equal((reduce(confirm, { t: 'adjust', text: '税込み220万円だった' }).effects[0] as { amount: number }).amount, 2_000_000)
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
const opRes = (op: ChatOp, values: Record<string, string>): ChatApiResponse => ({ kind: 'op', op, values, missing: op.fields.filter((f) => !values[f.key]), say: '進めます。' })
const toConfirm = (op: ChatOp, values: Record<string, string>, snap: AgentFormSnapshot) =>
  run([{ t: 'ask', text: '依頼' }, { t: 'reply', res: opRes(op, values) }, { t: 'ready', snap }]).state

test('段階2の操作の定義: 保存は確認カードの対象で、確定・送付・削除は入れない。日付や種類は AI に読ませない', () => {
  assert.deepEqual(CHAT_OPS.map((o) => o.key), ['income.sale.add', 'income.invoice.draft', 'expense.contract.add'])
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
  assert.deepEqual(a.effects, [{ k: 'amend', amount: 5000, message: '¥5,000 を税込みとして入れ直しました。', set: { taxIncluded: 'true' } }])
  assert.equal(a.state.phase, 'working')
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: '税抜だった' }).effects, [{ k: 'amend', amount: 5000, message: '¥5,000 を税抜として入れ直しました。', set: { taxIncluded: 'false' } }])
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: '6,000円にして' }).effects, [{ k: 'amend', amount: 6000, message: '金額を ¥6,000 に直しました。' }])
  assert.deepEqual(reduce(confirm, { t: 'adjust', text: 'やっぱり変えたい' }).effects, [])
  const inv = toConfirm(INCOME_INVOICE_DRAFT, STAGE2[0].values, INV_SNAP)
  assert.deepEqual(reduce(inv, { t: 'adjust', text: '税込みだった' }).effects, [{ k: 'amend', amount: 272727, message: '税込みの ¥300,000 を、税抜の ¥272,727 に直しました。' }])
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
