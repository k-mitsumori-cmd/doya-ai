// 実行: npx tsx --test src/lib/notice/notice.test.ts
// ドヤくんの知らせの決まり（順番・作業中・once・旗）の回帰テスト。DB・ネットワーク・画面には触れない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_QUEUE, allowedAtLevel, closeNotice, enqueueNotice, parseNoticeLevel, pauseNotice, showNextNotice, type Notice, type NoticeKind } from './queue'
import { addSeen, parseSeen, seenKey, SEEN_MAX } from './seen'
import { decideGuidePopups, guidePopupsRollout } from './flag'
import { activeAnnouncements, newToolIds, type Announcement } from './announcements'

const n = (id: string, kind: NoticeKind, once = false): Notice => ({ id, kind, once, eyebrow: id, title: id })
const none = new Set<string>()

test('同時に来たら エラー → 承認待ち → 新機能 → ヒント の順に1つずつ出す', () => {
  let s = EMPTY_QUEUE
  for (const x of [n('h', 'hint'), n('f', 'feature'), n('a', 'approval'), n('e', 'error')]) s = enqueueNotice(s, x, none)
  const order: string[] = []
  for (;;) {
    s = showNextNotice(s, false)
    if (!s.current) break
    order.push(s.current.id)
    s = closeNotice(s).state
  }
  assert.deepEqual(order, ['e', 'a', 'f', 'h'])
})

test('表示中は次を出さない（同時に1つだけ）', () => {
  let s = showNextNotice(enqueueNotice(EMPTY_QUEUE, n('f', 'feature'), none), false)
  s = enqueueNotice(s, n('h', 'hint'), none)
  assert.equal(showNextNotice(s, false).current?.id, 'f')
})

test('エラーは、表示中のヒントより先に出る（ヒントは列に戻る）', () => {
  let s = showNextNotice(enqueueNotice(EMPTY_QUEUE, n('h', 'hint'), none), false)
  s = enqueueNotice(s, n('e', 'error'), none)
  assert.equal(s.current, null)
  s = showNextNotice(s, false)
  assert.equal(s.current?.id, 'e')
  assert.deepEqual(s.queue.map((q) => q.id), ['h'])
})

test('作業中はエラーだけを出し、表示中のヒントは列に戻す', () => {
  let s = enqueueNotice(enqueueNotice(EMPTY_QUEUE, n('h', 'hint'), none), n('f', 'feature'), none)
  assert.equal(showNextNotice(s, true).current, null)
  s = enqueueNotice(s, n('e', 'error'), none)
  assert.equal(showNextNotice(s, true).current?.id, 'e')
  const shown = showNextNotice(enqueueNotice(EMPTY_QUEUE, n('h', 'hint'), none), false)
  assert.equal(pauseNotice(shown).current, null)
  assert.deepEqual(pauseNotice(shown).queue.map((q) => q.id), ['h'])
})

test('見たことがある once の知らせと、同じ id の知らせは足さない', () => {
  assert.equal(enqueueNotice(EMPTY_QUEUE, n('w', 'hint', true), new Set(['w'])).queue.length, 0)
  const s = enqueueNotice(EMPTY_QUEUE, n('w', 'hint', true), none)
  assert.equal(enqueueNotice(s, n('w', 'hint', true), none).queue.length, 1)
  assert.equal(enqueueNotice(EMPTY_QUEUE, n('e', 'error'), new Set(['e'])).queue.length, 1)
})

test('見た記録: ユーザーごとのキー・壊れた値は空・上限で古いものを捨てる', () => {
  assert.notEqual(seenKey('u1'), seenKey('u2'))
  assert.deepEqual(parseSeen('not json'), [])
  assert.deepEqual(parseSeen('{"a":1}'), [])
  assert.deepEqual(parseSeen('["a",1,"b"]'), ['a', 'b'])
  let list: string[] = []
  for (let i = 0; i < SEEN_MAX + 5; i++) list = addSeen(list, `id${i}`)
  assert.equal(list.length, SEEN_MAX)
  assert.equal(list[0], 'id5')
  assert.deepEqual(addSeen(['a', 'b'], 'a'), ['b', 'a'])
})

test('旗: 既定は off。preview は許可した人だけ、all は全員', () => {
  assert.equal(guidePopupsRollout(undefined), 'off')
  assert.equal(guidePopupsRollout(' ALL '), 'all')
  assert.equal(guidePopupsRollout('yes'), 'off')
  assert.equal(decideGuidePopups({ rollout: 'off', email: 'a@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideGuidePopups({ rollout: 'preview', email: 'a@x.jp', allow: ['a@x.jp'] }), true)
  assert.equal(decideGuidePopups({ rollout: 'preview', email: 'b@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideGuidePopups({ rollout: 'all', email: null, allow: [] }), true)
})

test('知らせの量: 少なめは承認待ちとエラーだけ、エラーだけはエラーだけ。知らない値はふつう', () => {
  assert.equal(parseNoticeLevel('x'), 'normal')
  assert.equal(parseNoticeLevel('less'), 'less')
  assert.deepEqual((['error', 'approval', 'feature', 'hint'] as NoticeKind[]).filter((k) => allowedAtLevel(k, 'less')), ['error', 'approval'])
  assert.deepEqual((['error', 'approval', 'feature', 'hint'] as NoticeKind[]).filter((k) => allowedAtLevel(k, 'errors')), ['error'])
  assert.equal(enqueueNotice(EMPTY_QUEUE, n('h', 'hint'), none, 'less').queue.length, 0)
  assert.equal(enqueueNotice(EMPTY_QUEUE, n('e', 'error'), none, 'errors').queue.length, 1)
})

test('新機能: お知らせは30日、メニューの札は7日で消える', () => {
  const list: Announcement[] = [{ id: 'a', date: '2026-10-01', title: 't', body: 'b', toolId: 'quote' }]
  const at = (d: string) => new Date(`${d}T12:00:00+09:00`)
  assert.equal(activeAnnouncements(at('2026-09-30'), list).length, 0)
  assert.equal(activeAnnouncements(at('2026-10-30'), list).length, 1)
  assert.equal(activeAnnouncements(at('2026-10-31'), list).length, 0)
  assert.ok(newToolIds(at('2026-10-07'), list).has('quote'))
  assert.equal(newToolIds(at('2026-10-08'), list).size, 0)
})
