// 実行: npx tsx --test src/lib/brand/rename-news.test.ts
// 名前の変更のお知らせ（アプリ内の知らせとページ）が、旗が off の間は出ないことと、文面の決まりの回帰テスト。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RENAME_ANNOUNCEMENT, RENAME_NEWS, RENAME_NEWS_PATH, renameAnnouncements, renameDate, renameDateLabel } from './rename-news'
import { ANNOUNCEMENTS, activeAnnouncements } from '../notice/announcements'

test('旗が off の間は、お知らせの一覧に入らない（今のお知らせのまま）', () => {
  assert.deepEqual(renameAnnouncements(false), [])
  assert.ok(ANNOUNCEMENTS.every((a) => a.id !== RENAME_ANNOUNCEMENT.id))
})

test('旗が on のときは、切り替える日から30日、お知らせに出る。1回だけ見せる id は固定', () => {
  const list = renameAnnouncements(true)
  assert.equal(list.length, 1)
  assert.equal(list[0].date, renameDate('2026-11-01'))
  const a = activeAnnouncements(new Date('2026-11-05T09:00:00+09:00'), [{ ...list[0] }])
  assert.equal(a.length, 1)
  assert.equal(a[0].href, RENAME_NEWS_PATH)
  assert.equal(activeAnnouncements(new Date('2026-12-05T09:00:00+09:00'), [{ ...list[0] }]).length, 0, '30日をすぎたら出ない')
})

test('日付: 決まった形だけ受け取り、「2026年11月1日」の形にする', () => {
  assert.equal(renameDate('2026-11-01'), '2026-11-01')
  assert.equal(renameDate('2026/11/01'), '2026-11-01'.replace('2026-11-01', '2026-11-01'))
  assert.equal(renameDateLabel('2026-11-01'), '2026年11月1日')
  assert.equal(renameDateLabel('2026-12-20'), '2026年12月20日')
})

test('文面: 旧名と新名が入り、URL・料金・アカウントが変わらないと書き、絵文字・感嘆符を使わない', () => {
  assert.ok(RENAME_NEWS.title.includes('ドヤAI') && RENAME_NEWS.title.includes('ドヤバディ'))
  assert.ok(RENAME_ANNOUNCEMENT.body.includes('URL・料金・アカウント'))
  const all = [RENAME_NEWS.title, RENAME_NEWS.description, RENAME_NEWS.lead('2026年11月1日'), RENAME_ANNOUNCEMENT.body, ...RENAME_NEWS.changes, ...RENAME_NEWS.unchanged, ...RENAME_NEWS.faq.flatMap((f) => [f.q, f.a])].join('\n')
  assert.ok(!/！|!|\p{Extended_Pictographic}/u.test(all))
  assert.ok(RENAME_NEWS.unchanged.some((t) => t.includes('doya-ai.surisuta.jp')))
})

test('お知らせのページ: 旗が off のときは、メタデータに新しい名前を出さない（404 の画面にも出ない）', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/news/rename-doya-buddy/page.tsx'), 'utf8')
  assert.match(src, /export const metadata: Metadata = isBrandRenamed\(\)/)
  assert.match(src, /if \(!isBrandRenamed\(\)\) notFound\(\)/)
})
