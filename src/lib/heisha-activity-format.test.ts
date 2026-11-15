// 弊社、限界につき。の通知の文面と入力の検証を確かめる。DB にも Slack にも触らない。
// 実行: npx tsx --test src/lib/heisha-activity-format.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyReportText, buildSavedText, parseHeishaActivity } from './heisha-activity-format'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const NOW = new Date('2026-11-16T00:00:00Z')

test('入力の検証: 今のアプリの形（event と eventId だけ）を通す', () => {
  const p = parseHeishaActivity({ event: 'session_saved', eventId: ID })
  assert.deepEqual(p, { event: 'session_saved', eventId: ID, kind: 'unspecified', length: null, excerpt: null })
})

test('入力の検証: 許可リスト・長さ・型を外れたものは断る', () => {
  const ok = { event: 'session_saved', eventId: ID }
  assert.equal(parseHeishaActivity({ ...ok, event: 'other' }), null)
  assert.equal(parseHeishaActivity({ ...ok, eventId: 'a b' }), null)
  assert.equal(parseHeishaActivity({ ...ok, eventId: 'a'.repeat(81) }), null)
  assert.equal(parseHeishaActivity({ ...ok, kind: 'secret' }), null)
  assert.equal(parseHeishaActivity({ ...ok, kind: 'overtime' })?.kind, 'overtime')
  assert.equal(parseHeishaActivity({ ...ok, length: -1 }), null)
  assert.equal(parseHeishaActivity({ ...ok, length: 1.5 }), null)
  assert.equal(parseHeishaActivity({ ...ok, length: 100001 }), null)
  assert.equal(parseHeishaActivity({ ...ok, excerpt: 'あ'.repeat(161) }), null)
  assert.equal(parseHeishaActivity({ ...ok, excerpt: 5 }), null)
  assert.equal(parseHeishaActivity([]), null)
  assert.equal(parseHeishaActivity(null), null)
})

test('1件保存の通知: 件数・種別・文字数・記録ID。既定では抜粋を載せない', () => {
  const input = parseHeishaActivity({ event: 'session_saved', eventId: ID, kind: 'overtime', length: 1234, excerpt: '山田さんの件 taro@example.com' })!
  const off = buildSavedText(input, 12, { includeExcerpt: false, now: NOW })
  assert.match(off, /本日の保存件数：12件目/)
  assert.match(off, /種別：残業/)
  assert.match(off, /文字数：1,234文字/)
  assert.match(off, /記録ID（通知用の識別子）：0f8fad5b$/m)
  assert.doesNotMatch(off, /山田|taro|抜粋の/)
  assert.match(off, /メモ・会社名・給与・記録の内容は送信していません。/)
})

test('1件保存の通知: 文字数を受け取らなければ行を出さない。件数が未集計なら、そう書く', () => {
  const input = parseHeishaActivity({ event: 'session_saved', eventId: ID })!
  const t = buildSavedText(input, null, { includeExcerpt: true, now: NOW })
  assert.doesNotMatch(t, /文字数：/)
  assert.match(t, /種別：未指定/)
  assert.match(t, /未集計/)
  assert.doesNotMatch(t, /本文の抜粋/)
})

test('抜粋を出す設定のときは、伏せ字つきで80文字までにする', () => {
  const input = parseHeishaActivity({ event: 'session_saved', eventId: ID, excerpt: '山田さんに090-1234-5678へ電話しろと言われた ' + 'あ'.repeat(120) })!
  const t = buildSavedText(input, 1, { includeExcerpt: true, now: NOW })
  assert.match(t, /本文の抜粋（伏せ字つき・最大80文字）：\[氏名\]に\[電話\]へ/)
  assert.doesNotMatch(t, /山田|1234-5678/)
  assert.match(t, /…（全\d+文字）/)
  assert.match(t, /抜粋以外のメモ/)
})

test('日次レポート: 件数・前日差・種別の割合・文字数の平均', () => {
  const today = { day: '2026-11-15', total: 10, byKind: { overtime: 6, work: 3, unspecified: 1 }, lengthCount: 4, lengthSum: 1000 }
  const prev = { day: '2026-11-14', total: 7, byKind: {}, lengthCount: 0, lengthSum: 0 }
  const t = buildDailyReportText(today, prev, NOW)
  assert.match(t, /記録の保存：10件/)
  assert.match(t, /前日（2026-11-14）：7件（\+3件）/)
  assert.match(t, /・残業：6件（60%）/)
  assert.match(t, /・通常の勤務：3件（30%）/)
  assert.match(t, /・未指定：1件（10%）/)
  assert.match(t, /文字数の平均：250文字（文字数を受け取った4件の平均）/)
  assert.ok(t.indexOf('残業') < t.indexOf('通常の勤務'))
})

test('日次レポート: 0件の日と比較なしの日', () => {
  const t = buildDailyReportText({ day: '2026-11-15', total: 0, byKind: {}, lengthCount: 0, lengthSum: 0 }, null, NOW)
  assert.match(t, /記録の保存：0件/)
  assert.match(t, /前日との比較：集計がない/)
  assert.match(t, /保存がなかったため出しません/)
  assert.match(t, /受け取った記録がありません/)
})
