// 実行: npx tsx --test src/lib/support-chat/support-chat.test.ts
// サポートチャットの決まり（旗・運営へ渡す判定・モックの答え・受付番号・伏せ字・Slack の文面・入力の検査）の回帰テスト。
// DB・ネットワーク・有料の API には触れない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideSupportChat, supportChatRollout } from './flag'
import { answerNeedsStaff, classifyMessage, routeQuestion, severityOf } from './rules'
import { answerQuestion, mockAnswerer, type SupportAnswerer } from './answer'
import { knowledgeEntries, suggestedQuestions, toolIdForPath } from './knowledge'
import { buildTicketSlack, isBusinessHours, makeTicketNo, redactPersonal, replyEtaText, safeUserText } from './ticket'
import { aiDailyLimit, parseAskBody, parseTicketBody } from './request'
import { styleSlackPayload } from '@/lib/slack/notify'

test('旗: 既定は off。preview と all だけを受け付ける', () => {
  assert.equal(supportChatRollout(undefined), 'off')
  assert.equal(supportChatRollout(''), 'off')
  assert.equal(supportChatRollout('on'), 'off')
  assert.equal(supportChatRollout(' Preview '), 'preview')
  assert.equal(supportChatRollout('all'), 'all')
})

test('旗: preview は許可した人だけ、all はメールのある人だけ', () => {
  assert.equal(decideSupportChat({ rollout: 'off', email: 'a@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideSupportChat({ rollout: 'preview', email: 'A@x.jp', allow: ['a@x.jp'] }), true)
  assert.equal(decideSupportChat({ rollout: 'preview', email: 'b@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideSupportChat({ rollout: 'all', email: null, allow: [] }), false)
  assert.equal(decideSupportChat({ rollout: 'all', email: 'b@x.jp', allow: [] }), true)
})

test('判定: クレーム・支払い・不具合・解約・データの削除・個別の相談・不正は運営へ', () => {
  const cases: Array<[string, string]> = [
    ['対応がひどいので責任者を出してください', 'complaint'],
    ['二重に請求されています', 'billing'],
    ['領収書がほしいです', 'billing'],
    ['バナーの生成ができない', 'bug'],
    ['画面が真っ白になります', 'bug'],
    ['解約したいです', 'cancel'],
    ['データを削除してほしい', 'data'],
    ['請求書払いで導入の相談をしたい', 'billing'],
    ['法人契約について担当者と話したい', 'consult'],
    ['身に覚えのないログインがあります', 'security'],
  ]
  for (const [q, cat] of cases) {
    const r = routeQuestion(q)
    assert.equal(r.route, 'staff', q)
    if (r.route === 'staff') assert.equal(r.category, cat, q)
  }
})

test('判定: 使い方と料金の質問は AI が答える。5000文字のような数字を不具合にしない', () => {
  for (const q of ['ドヤ記事作成の使い方を教えてください', '料金プランを教えてください', '5000文字の記事は作れますか']) {
    assert.equal(routeQuestion(q).route, 'answer', q)
  }
  assert.equal(classifyMessage('500エラーが出ます'), 'bug')
})

test('重さ: 不正利用だけ緊急、ほかは要対応', () => {
  assert.equal(severityOf('security'), 'urgent')
  assert.equal(severityOf('complaint'), 'action')
  assert.equal(severityOf('billing'), 'action')
})

test('モック: 料金の質問には料金ページのリンクつきで答える', async () => {
  const r = await answerQuestion(mockAnswerer, { question: '料金はいくらですか', history: [], toolId: null })
  assert.equal(r.kind, 'answer')
  assert.ok(r.sources.some((s) => s.href === '/pricing'))
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(r.text), '絵文字を使わない')
})

test('モック: 今開いているツールの「使い方」は、そのツールの材料で答える', async () => {
  const r = await answerQuestion(mockAnswerer, { question: '使い方を教えてください', history: [], toolId: 'seo' })
  assert.equal(r.kind, 'answer')
  if (r.kind === 'answer') assert.equal(r.matchedId, 'tool:seo')
})

test('モック: 材料に無い質問には無理に答えない', async () => {
  const r = await answerQuestion(mockAnswerer, { question: '明日の天気はどうですか', history: [], toolId: null })
  assert.equal(r.kind, 'unknown')
  assert.equal(r.sources.length, 0)
})

test('モック: 運営へ渡す分類は、AI に聞く前に止める', async () => {
  let called = false
  const spy: SupportAnswerer = { name: 'spy', paid: true, async answer() { called = true; return { kind: 'answer', text: 'x', sources: [{ label: 'a', href: '/' }], matchedId: 'x' } } }
  const r = await answerQuestion(spy, { question: '返金してください', history: [], toolId: null })
  assert.equal(r.kind, 'staff')
  assert.equal(called, false)
})

test('安全の確かめ: AI が返金を約束したら出さない。リンクの無い答えも出さない', async () => {
  const promise: SupportAnswerer = { name: 'p', paid: false, async answer() { return { kind: 'answer', text: '返金いたします', sources: [{ label: 'a', href: '/' }], matchedId: 'x' } } }
  assert.equal((await answerQuestion(promise, { question: '使い方', history: [], toolId: null })).kind, 'staff')
  assert.equal(answerNeedsStaff('解約を受け付けました'), 'cancel')
  assert.equal(answerNeedsStaff('料金ページをご覧ください'), null)
  const nolink: SupportAnswerer = { name: 'n', paid: false, async answer() { return { kind: 'answer', text: 'ok', sources: [], matchedId: 'x' } } }
  assert.equal((await answerQuestion(nolink, { question: '使い方', history: [], toolId: null })).kind, 'unknown')
})

test('安全の確かめ: AI には直近6件だけを渡す', async () => {
  let got = -1
  const spy: SupportAnswerer = { name: 's', paid: false, async answer(i) { got = i.history.length; return { kind: 'unknown', text: '', sources: [] } } }
  const history = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, text: `q${i}` }))
  await answerQuestion(spy, { question: '使い方', history, toolId: null })
  assert.equal(got, 6)
})

test('材料: どれにもリンクがあり、金額を直書きしていない（unified-plan から読む）', () => {
  const entries = knowledgeEntries()
  assert.ok(entries.length > 5)
  for (const e of entries) assert.ok(e.source.href.startsWith('/'), e.id)
  assert.ok(entries.find((e) => e.id === 'plans')?.body.includes('¥9,980'))
})

test('材料: パスからツールを引き、候補はそのツール向けを先に出す', () => {
  assert.equal(toolIdForPath('/seo/articles/1'), 'seo')
  assert.equal(toolIdForPath('/'), null)
  const s = suggestedQuestions('seo')
  assert.ok(s[0].includes('ドヤ記事作成'))
  assert.ok(s.length <= 5)
})

test('受付番号: 日本時間の日付と、紛らわしくない4文字', () => {
  const no = makeTicketNo(Date.UTC(2026, 9, 25, 16, 0), () => 0.5) // 日本時間 10/26 1:00
  assert.match(no, /^DY-261026-[2-9A-HJ-NP-Z]{4}$/)
})

test('営業時間: 平日 10〜18時（日本時間）だけ', () => {
  assert.equal(isBusinessHours(Date.UTC(2026, 9, 26, 1, 0)), true)   // 月 10:00
  assert.equal(isBusinessHours(Date.UTC(2026, 9, 26, 9, 0)), false)  // 月 18:00
  assert.equal(isBusinessHours(Date.UTC(2026, 9, 25, 3, 0)), false)  // 日 12:00
  assert.match(replyEtaText('bug', Date.UTC(2026, 9, 25, 3, 0)), /受付時間外/)
  assert.match(replyEtaText('security'), /すぐに/)
})

test('伏せ字: メール・電話番号・カードらしい数字・トークンを伏せる', () => {
  const s = redactPersonal('連絡は taro@example.com か 090-1234-5678 へ。カード 4242 4242 4242 4242、token=abcdef123')
  assert.ok(!s.includes('taro@example.com'))
  assert.ok(!s.includes('090-1234-5678'))
  assert.ok(!s.includes('4242 4242 4242 4242'))
  assert.ok(!s.includes('abcdef123'))
  assert.ok(s.includes('ta***@example.com'))
})

test('伏せ字: <!channel> やリンクの差し込みを効かせない', () => {
  const s = safeUserText('<!channel> <https://evil.example|押して>', 200)
  assert.ok(!s.includes('<!channel>'))
  assert.ok(!s.includes('<https://'))
})

test('Slack: 共通の見出し・お問い合わせ・重さ。会社・プラン・画面・要約を載せ、メールは伏せる', () => {
  const slack = buildTicketSlack({
    ticketNo: 'DY-261026-ABCD', category: 'complaint', message: '対応がひどい。連絡は taro@example.com',
    transcript: [{ role: 'user', text: '返金してください' }, { role: 'assistant', text: '運営がお答えします' }],
    toolLabel: 'ドヤ記事作成', pagePath: '/seo/new?token=xyz', companyName: 'テスト株式会社', plan: 'PRO',
    userEmail: 'hanako@example.com', contactOk: true, env: { userAgent: 'Mozilla/5.0', viewport: '375x812', recentErrors: ['TypeError: x'] },
  }, Date.UTC(2026, 9, 26, 1, 0))
  const styled = styleSlackPayload({ text: slack.text }, slack.meta) as { text: string }
  assert.match(styled.text.split('\n')[0], /^\*【要対応】ドヤAI｜お問い合わせ：/)
  for (const w of ['DY-261026-ABCD', 'テスト株式会社', 'PRO', 'ドヤ記事作成', '/seo/new', '375x812', 'TypeError']) assert.ok(slack.text.includes(w), w)
  assert.ok(!slack.text.includes('hanako@example.com'))
  assert.ok(!slack.text.includes('taro@example.com'))
  assert.ok(!slack.text.includes('token=xyz'))
  assert.ok(!slack.text.includes('<!channel>'))
  const urgent = buildTicketSlack({ ticketNo: 'DY-1', category: 'security', message: 'x', transcript: [], toolLabel: '-', pagePath: '/', companyName: null, plan: null, userEmail: null, contactOk: false, env: {} })
  assert.equal(urgent.meta.severity, 'urgent')
})

test('入力の検査: 長さ・分類・パスを切りそろえる', () => {
  assert.ok('error' in parseAskBody({ question: '' }))
  assert.ok('error' in parseAskBody({ question: 'あ'.repeat(501) }))
  const ok = parseAskBody({ question: ' 料金 ', path: '//evil.example', history: [{ role: 'system', text: 'x' }, { role: 'user', text: 'a' }] })
  assert.ok(!('error' in ok))
  if (!('error' in ok)) { assert.equal(ok.path, '/'); assert.equal(ok.history.length, 1); assert.equal(ok.question, '料金') }
  assert.ok('error' in parseTicketBody({ category: 'nope', message: 'x' }))
  const t = parseTicketBody({ category: 'bug', message: 'x', env: { recentErrors: Array(9).fill('e') } })
  assert.ok(!('error' in t))
  if (!('error' in t)) { assert.equal(t.env.recentErrors?.length, 5); assert.equal(t.contactOk, true) }
  assert.equal(aiDailyLimit(undefined), 800)
  assert.equal(aiDailyLimit('50'), 50)
  assert.equal(aiDailyLimit('-1'), 800)
})
