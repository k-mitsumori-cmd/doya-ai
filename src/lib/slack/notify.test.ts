// Slack 通知の文面の組み立てを確かめる。実際の Slack には送らない（fetch はモック）。
// 実行: npx tsx --test src/lib/slack/notify.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  stripEmoji, extractTitle, slackHeading, styleSlackPayload, inferSlackMeta,
  postSlack, resetSlackDedupe, type SlackMeta,
} from './notify'
import { voicePayload, withSlackVoice } from '../slack-voice'

const EMOJI = /\p{Extended_Pictographic}|(^|\s):[a-z_]+:(\s|$)/u
type P = { text: string; blocks?: Array<Record<string, any>> }

test('絵文字を外し、URL・時刻・コード・評価の星は残す', () => {
  assert.equal(stripEmoji('📊 *[日次レポート]* 2026/10/25'), '*[日次レポート]* 2026/10/25')
  assert.equal(stripEmoji(':tada: *【ドヤAI】無料会員が登録しました*'), '*【ドヤAI】無料会員が登録しました*')
  assert.equal(stripEmoji('- エラー: なし ✅'), '- エラー: なし')
  assert.equal(stripEmoji('👍🏻 いいね'), 'いいね')
  assert.equal(stripEmoji('平均 ★4.5 → 前日比'), '平均 ★4.5 → 前日比')
  assert.equal(stripEmoji('10:30:00 <https://a.example/x:y:z|開く> `:code:`'), '10:30:00 <https://a.example/x:y:z|開く> `:code:`')
})

test('旧来の見出しから件名だけを取り出す', () => {
  assert.equal(extractTitle('*【ドヤAI・要対応】処理中にエラーが発生しました*'), '処理中にエラーが発生しました')
  assert.equal(extractTitle('【アクセスレポート】2026-10-25 朝'), 'アクセスレポート 2026-10-25 朝')
  assert.equal(extractTitle('【テスト】【利用されました】バナー'), '【テスト】利用されました バナー')
  assert.equal(extractTitle('【要対応・エラー】弊社、限界につき。', '弊社、限界につき。'), '')
  assert.equal(extractTitle('*【要対応】ドヤAI｜エラー：処理が止まりました*'), '処理が止まりました')
})

test('見出しは【重さ】アプリ名｜種類：件名 の形', () => {
  assert.equal(slackHeading({ app: 'ドヤAI', kind: 'billing', severity: 'urgent' }, '支払いに失敗しました'), '【緊急】ドヤAI｜売上・課金：支払いに失敗しました')
  assert.equal(slackHeading({ app: '呪い日記', kind: 'report', severity: 'info' }, ''), '【お知らせ】呪い日記｜定期レポート')
})

test('イベント通知: 絵文字が消え、見出しがそろう', () => {
  const out = voicePayload({ text: ':tada: *【ドヤAI】無料会員が登録しました（入金はありません）*\n発生時刻：2026/10/25 9:00:00（日本時間）\n- ユーザー: 山田 (a@example.com)' },
    { app: 'ドヤAI', kind: 'usage', severity: 'info' }) as P
  assert.equal(out.text.split('\n')[0], '*【お知らせ】ドヤAI｜利用状況：無料会員が登録しました（入金はありません）*')
  assert.match(out.text, /発生時刻：2026\/10\/25 9:00:00/)
  assert.doesNotMatch(out.text, EMOJI)
  assert.doesNotMatch(out.text, /<!channel>/)
})

test('緊急は @channel を付け、二重には付けない', () => {
  const meta: SlackMeta = { app: 'ドヤAI', kind: 'billing', severity: 'urgent' }
  const once = styleSlackPayload({ text: '<!channel>\n:warning: *【ドヤAI】支払いに失敗しました*\n発生時刻：x' }, meta)
  assert.equal(once.text, '<!channel>\n*【緊急】ドヤAI｜売上・課金：支払いに失敗しました*\n発生時刻：x')
  // 何度かけても同じ
  assert.deepEqual(styleSlackPayload(once, meta), once)
  // 明示すれば要対応でも呼べる（解約）
  const cancel = styleSlackPayload({ text: '*【ドヤAI】解約*' }, { app: 'ドヤAI', kind: 'billing', severity: 'action', mention: true })
  assert.equal(cancel.text, '<!channel>\n*【要対応】ドヤAI｜売上・課金：解約*')
})

test('Block Kit: header を統一見出しに置き換え、絵文字を外す', () => {
  const out = styleSlackPayload({
    text: '【ドヤAI・要対応・重大】エラー急増を検知: 直近5分で20件',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '【ドヤAI・要対応・重大】エラー急増を検知', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: '🚨 直近5分で 20 件' } },
    ],
  }, { app: 'ドヤAI', kind: 'error', severity: 'urgent' }) as P
  assert.equal(out.blocks![0]!.text.text, '<!channel>')
  assert.deepEqual(out.blocks![1], { type: 'header', text: { type: 'plain_text', text: '【緊急】ドヤAI｜エラー：エラー急増を検知', emoji: false } })
  assert.equal(out.blocks![2]!.text.text, '直近5分で 20 件')
  assert.equal(out.blocks!.filter((b) => b.type === 'header').length, 1)
})

test('Block Kit: header が無ければ足し、本文の旧見出しは重ねない', () => {
  const out = styleSlackPayload({
    text: 'AI商談の判定が確定しました',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*AI商談の判定が確定しました*（株式会社A）\n商材: B' } }],
  }, { app: 'AI商談', kind: 'usage', severity: 'info' }) as P
  assert.equal(out.blocks![0]!.type, 'header')
  assert.equal(out.blocks![0]!.text.text, '【お知らせ】AI商談｜利用状況：AI商談の判定が確定しました')
  assert.equal(out.blocks!.length, 2)
})

test('お問い合わせは利用者の文章の絵文字を残す（見出しからは外す）', () => {
  const out = styleSlackPayload({
    text: 'ドヤプロマネへのご意見（バグ報告）',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*メッセージ:*\n```とても便利です🙏```' } }, { type: 'section', text: { type: 'plain_text', text: '助かります😊' } }],
  }, { app: 'ドヤプロマネ', kind: 'inquiry', severity: 'action' }) as P
  assert.equal(out.blocks![0]!.text.text, '【要対応】ドヤプロマネ｜お問い合わせ：ドヤプロマネへのご意見（バグ報告）')
  assert.match(JSON.stringify(out.blocks), /😊/)
})

test('定期レポート: 見出しがそろい、本文の数字は残る', () => {
  const text = ['*日次レポート 2026/10/25*', '', '過去24時間の登録と利用の数字をお知らせします。', '', '*ユーザー*', '- 新規登録: 3人', '- 総ユーザー数: 120人'].join('\n')
  const out = voicePayload({ text }, { app: 'ドヤAI', kind: 'report', severity: 'info' }) as P
  assert.equal(out.text.split('\n')[0], '*【お知らせ】ドヤAI｜定期レポート：日次レポート 2026/10/25*')
  assert.match(out.text, /新規登録: 3人/)
  assert.match(out.text, /総ユーザー数: 120人/)
})

test('メタ情報なしでも旧来の見出しから種類と重さを推定する', () => {
  assert.deepEqual(inferSlackMeta({ text: '【呪い日記】アプリ内購入が完了しました' }), { app: '呪い日記', kind: 'billing', severity: 'info' })
  assert.deepEqual(inferSlackMeta({ text: '【ドヤAI・要確認】費用の増え方を確認してください' }), { app: 'ドヤAI', kind: 'usage', severity: 'action' })
  assert.deepEqual(inferSlackMeta({ text: '【旅行ツール】今日の集客チェック' }, '旅行ツール'), { app: '旅行ツール', kind: 'usage', severity: 'info' })
  assert.deepEqual(inferSlackMeta({ text: '【推しにマイル】本日のダウンロード報告' }), { app: '推しにマイル', kind: 'report', severity: 'info' })
  assert.equal(inferSlackMeta({ text: '<!channel>\n*【緊急】ドヤAI｜売上・課金：x*' }).severity, 'urgent')
})

test('運用通知（withSlackVoice）も見出しがそろう', () => {
  const out = withSlackVoice('【旅行ツール】今日の集客チェック\n対象：10/24', { app: '旅行ツール' })
  assert.equal(out.split('\n')[0], '*【お知らせ】旅行ツール｜利用状況：今日の集客チェック*')
})

function mockFetch(status = 200) {
  const calls: Array<{ url: string; body: any }> = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return new Response(status === 200 ? 'ok' : 'no', { status })
  }) as unknown as typeof fetch
  return { calls, impl }
}

test('postSlack: 整形して1回送り、同じ内容の連続は間引く', async () => {
  resetSlackDedupe()
  const { calls, impl } = mockFetch()
  const meta: SlackMeta = { app: 'ドヤAI', kind: 'error', severity: 'action' }
  const r1 = await postSlack('https://hooks.invalid/a', { text: '⚠️ 処理に失敗しました\n発生時刻：10:00:01' }, { meta, fetchImpl: impl })
  // 時刻だけ違う同じ内容は間引く
  const r2 = await postSlack('https://hooks.invalid/a', { text: '⚠️ 処理に失敗しました\n発生時刻：10:00:09' }, { meta, fetchImpl: impl })
  // 送り先が違えば別扱い
  const r3 = await postSlack('https://hooks.invalid/b', { text: '⚠️ 処理に失敗しました\n発生時刻：10:00:09' }, { meta, fetchImpl: impl })
  assert.deepEqual([r1, r2, r3], ['sent', 'deduped', 'sent'])
  assert.equal(calls.length, 2)
  assert.equal(calls[0]!.body.text.split('\n')[0], '*【要対応】ドヤAI｜エラー：処理に失敗しました*')
})

test('postSlack: 200以外は throw し、次の再送は間引かない', async () => {
  resetSlackDedupe()
  const bad = mockFetch(500)
  await assert.rejects(postSlack('https://hooks.invalid/a', { text: 'x' }, { fetchImpl: bad.impl }), /Slack webhook returned 500/)
  const good = mockFetch()
  assert.equal(await postSlack('https://hooks.invalid/a', { text: 'x' }, { fetchImpl: good.impl }), 'sent')
  await assert.rejects(postSlack('', { text: 'x' }, { fetchImpl: good.impl }), /not configured/)
})

test('postSlack: dedupeKey と時間を指定できる', async () => {
  resetSlackDedupe()
  const { calls, impl } = mockFetch()
  await postSlack('https://hooks.invalid/a', { text: '1件目' }, { dedupeKey: 'credit', dedupeWindowMs: 3_600_000, fetchImpl: impl })
  assert.equal(await postSlack('https://hooks.invalid/a', { text: '2件目' }, { dedupeKey: 'credit', dedupeWindowMs: 3_600_000, fetchImpl: impl }), 'deduped')
  assert.equal(await postSlack('https://hooks.invalid/a', { text: '1件目' }, { dedupeWindowMs: 0, fetchImpl: impl }), 'sent')
  assert.equal(calls.length, 2)
})

import { maskEmail, maskPhone, escapeSlackText, excerpt, ordinalLabel } from './notify'

test('個人情報の伏せ字と冒頭だけの表示', () => {
  assert.equal(maskEmail('taro.yamada@example.com'), 'ta***@example.com')
  assert.equal(maskEmail(''), '（非表示）')
  assert.equal(maskPhone('090-1234-5678'), '***-5678')
  assert.equal(escapeSlackText('<!channel> *a*'), '&lt;!channel&gt; ​*a​*')
  assert.equal(excerpt('あ'.repeat(100)), 'あ'.repeat(80) + '…（全100文字）')
  assert.equal(excerpt('  \n '), '（未記入）')
  assert.equal(ordinalLabel(1234), '1,234人目')
  assert.equal(ordinalLabel(null), '人数は未取得')
})

import { redactSecrets } from './notify'

test('エラーの通知では秘密と個人情報を伏せる（1.2.0）', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop'
  const raw = `失敗: user=taro.yamada@example.com url=https://api.example.com/v1/x?token=abc123&q=1 auth=Bearer ${jwt} key=sk_live_1234567890abcd password=hunter2 id=0f8fad5b-d9cb-469f-a165-70867728950e`
  const out = redactSecrets(raw)
  assert.doesNotMatch(out, /taro\.yamada@|abc123|hunter2|sk_live_1234567890abcd|eyJhbGci/)
  assert.match(out, /ta\*\*\*@example\.com/)
  assert.match(out, /https:\/\/api\.example\.com\/v1\/x\?\[非表示\]/)
  assert.match(out, /0f8fad5b-d9cb-469f-a165-70867728950e/)
  const styled = styleSlackPayload({
    text: `*処理に失敗しました*\n${raw}`,
    blocks: [{ type: 'header', text: { type: 'plain_text', text: '処理に失敗しました' } }, { type: 'section', text: { type: 'mrkdwn', text: '```' + raw + '```' } }],
  }, { app: 'ゆるせん', kind: 'error', severity: 'action' }) as P
  assert.doesNotMatch(JSON.stringify(styled), /taro\.yamada@|hunter2|sk_live_1234567890abcd|eyJhbGci|token=abc123/)
  const billing = styleSlackPayload({ text: '*Stripe webhook の処理に失敗*\nkey=sk_live_1234567890abcd' }, { app: 'ヒトリジメ', kind: 'billing', severity: 'urgent' }) as P
  assert.doesNotMatch(billing.text, /sk_live_1234567890abcd/)
  // エラーと課金以外の通知では本文を変えない（リンクのクエリなど）
  const report = styleSlackPayload({ text: '*日報*\n<https://doya-ai.surisuta.jp/admin?tab=users|開く>' }, { app: 'ドヤAI', kind: 'report', severity: 'info' }) as P
  assert.match(report.text, /\?tab=users/)
})
