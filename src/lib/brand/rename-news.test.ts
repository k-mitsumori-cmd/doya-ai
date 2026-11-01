// 実行: npx tsx --test src/lib/brand/rename-news.test.ts
// 名前の変更のお知らせ（アプリ内の知らせとページ）が、旗が off の間は出ないことと、文面の決まりの回帰テスト。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RENAME_ANNOUNCEMENT, RENAME_ANNOUNCEMENT_ID, RENAME_NEWS, RENAME_NEWS_PATH_PREV, RENAME_NEWS_PATH, renameAnnouncements, renameDate, renameDateLabel } from './rename-news'
import { activeAnnouncements } from '../notice/announcements'

test('旗が off の間は、お知らせの一覧に入らない（今のお知らせのまま）', () => {
  assert.deepEqual(renameAnnouncements(false), [])
  // 一覧（ANNOUNCEMENTS）は読み込み時に環境変数で決まるので、旗を空にした別プロセスで読んで確かめる
  const code = `import('./src/lib/notice/announcements').then((m) => console.log(JSON.stringify((m.ANNOUNCEMENTS || m.default.ANNOUNCEMENTS).map((a) => a.id))))`
  const out = execFileSync('npx', ['tsx', '-e', code], { cwd: process.cwd(), env: { ...process.env, NEXT_PUBLIC_BRAND_RENAME_ROLLOUT: '' }, encoding: 'utf8' })
  const ids = JSON.parse(out.trim().split('\n').pop() as string) as string[]
  assert.ok(ids.length > 0 && ids.every((id) => id !== RENAME_ANNOUNCEMENT.id))
})

test('旗が on のときは、切り替える日から30日、お知らせに出る。1回だけ見せる id は固定', () => {
  // 実際の切替日が設定された本番ビルドでも、30日間の検査には固定の試験日を使う。
  const savedDate = process.env.NEXT_PUBLIC_BRAND_RENAME_DATE
  process.env.NEXT_PUBLIC_BRAND_RENAME_DATE = '2026-11-01'
  try {
    const list = renameAnnouncements(true)
    assert.equal(list.length, 1)
    assert.equal(list[0].date, renameDate('2026-11-01'))
    const a = activeAnnouncements(new Date('2026-11-05T09:00:00+09:00'), [{ ...list[0] }])
    assert.equal(a.length, 1)
    assert.equal(a[0].href, RENAME_NEWS_PATH)
    assert.equal(activeAnnouncements(new Date('2026-12-05T09:00:00+09:00'), [{ ...list[0] }]).length, 0, '30日をすぎたら出ない')
  } finally {
    if (savedDate === undefined) delete process.env.NEXT_PUBLIC_BRAND_RENAME_DATE
    else process.env.NEXT_PUBLIC_BRAND_RENAME_DATE = savedDate
  }
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
  const all = [RENAME_NEWS.title, RENAME_NEWS.description, RENAME_NEWS.lead('2026年11月1日'), RENAME_NEWS.prevNote, RENAME_ANNOUNCEMENT.body, ...RENAME_NEWS.changes, ...RENAME_NEWS.unchanged, ...RENAME_NEWS.faq.flatMap((f) => [f.q, f.a])].join('\n')
  assert.ok(!/！|!|\p{Extended_Pictographic}/u.test(all))
  assert.ok(RENAME_NEWS.unchanged.some((t) => t.includes('doya-ai.surisuta.jp')))
})

test('お知らせのページ: 旗が off のときは、メタデータに新しい名前を出さない（404 の画面にも出ない）', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/news/rename-doya-buddy/page.tsx'), 'utf8')
  assert.match(src, /export const metadata: Metadata = isBrandRenamed\(\)/)
  assert.match(src, /if \(!isBrandRenamed\(\)\) notFound\(\)/)
})

test('日付: ない日付（13月・2月30日）は受け取らず、既定の日にする', () => {
  assert.equal(renameDate('2026-13-01'), '2026-11-01')
  assert.equal(renameDate('2026-02-30'), '2026-11-01')
  assert.equal(renameDate('2026-12-20'), '2026-12-20')
})

test('前の名前（ドヤ部下）の案内: 旧URLを新しいURLへ恒久転送し、お知らせは id を新しくして、前の名前にふれる', () => {
  assert.equal(RENAME_NEWS_PATH, '/news/rename-doya-buddy')
  assert.equal(RENAME_NEWS_PATH_PREV, '/news/rename-doya-buka')
  assert.notEqual(RENAME_ANNOUNCEMENT_ID, 'announce:brand-rename-doya-buka', '前の id のままだと、昨日見た人に出ない')
  assert.ok(RENAME_NEWS.prevNote.includes('ドヤ部下'))
  assert.ok(!RENAME_NEWS.lead().includes('年'), '本文の最初の文に日付を入れない（旗の日付は前の名前に切り替えた日）')
  assert.ok(RENAME_NEWS.prevNote.includes('改めました'))
  const cfg = readFileSync(join(process.cwd(), 'next.config.js'), 'utf8')
  assert.ok(/source: '\/news\/rename-doya-buka', destination: '\/news\/rename-doya-buddy', permanent: true/.test(cfg), 'next.config.js に 308 の転送がある')
})
