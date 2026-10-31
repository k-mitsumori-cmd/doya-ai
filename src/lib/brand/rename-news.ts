// ============================================
// 名前の変更のお知らせ（ドヤAI → ドヤバディ）の文面。アプリ内の知らせと、お知らせのページが使う
// ============================================
// ⚠️ このファイルには旧名「ドヤAI」を、わざと書いている。src/lib/brand/ は、ビルド時の置き換え（scripts/brand/rename-loader.cjs）の対象外。
// ⚠️ 文面は、本人と法務の確認前の案。yomiyasu の原則（短い文・主語と述語・比喩なし・絵文字なし）で書く。
// ⚠️ 旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときだけ出る。日付は NEXT_PUBLIC_BRAND_RENAME_DATE（YYYY-MM-DD。切り替える日）。
import { BRAND_EN_NEW, BRAND_NAME_NEW, BRAND_NAME_OLD } from './index'
import { isBrandRenamed } from './flag'

export const RENAME_NEWS_PATH = '/news/rename-doya-buddy'
/** 2026-10-30 に出した、前の名前（ドヤ部下）の案内のページ。いまのページへ恒久転送する（next.config.js） */
export const RENAME_NEWS_PATH_PREV = '/news/rename-doya-buka'
/** 前の名前の案内を見た人にも、もう一度出すため、id を新しくしてある（前は announce:brand-rename-doya-buka） */
export const RENAME_ANNOUNCEMENT_ID = 'announce:brand-rename-doya-buddy'

/** 切り替える日（YYYY-MM-DD、日本時間）。環境変数が無いときは、旗を on にしたビルドの既定日 */
export function renameDate(raw: string | undefined = process.env.NEXT_PUBLIC_BRAND_RENAME_DATE): string {
  const v = (raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '2026-11-01'
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  // 2026-13-01 や 2026-02-30 のような、ない日付は受け取らない
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? v : '2026-11-01'
}

/** 「2026年11月1日」の形 */
export function renameDateLabel(date: string = renameDate()): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export const RENAME_NEWS = {
  title: `${BRAND_NAME_OLD}は「${BRAND_NAME_NEW}」に名前が変わりました`,
  description: `サービス名「${BRAND_NAME_OLD}」を「${BRAND_NAME_NEW}」（英語表記 ${BRAND_EN_NEW}）に変えました。URL・料金・アカウントは、これまでと同じです。`,
  /** 日付は、前の名前（ドヤ部下）に切り替えた日（旗の日付）と同じになるため、この文には入れない。引数は互換のため残す */
  lead: (_dateLabel?: string) =>
    `サービス名を「${BRAND_NAME_OLD}」から「${BRAND_NAME_NEW}」（英語表記 ${BRAND_EN_NEW}）に変えました。サービスの中身は、これまでと同じです。`,
  /** 前の名前（ドヤ部下）を案内した人への一言 */
  prevNote: `2026年10月30日に、いったん「ドヤ部下」（英語表記 DOYA BUKA）とお知らせしました。その後、名前を「${BRAND_NAME_NEW}」に改めました。ご案内が変わったことをお詫びします。`,
  changes: [
    'サービス名とロゴが「ドヤバディ」になります。',
    '画面・メール・お知らせの表記が「ドヤバディ」になります。',
    '検索で「ドヤAI」と入れても、このサービスが見つかるようにしています。',
  ],
  unchanged: [
    'URL（doya-ai.surisuta.jp）',
    'アカウントとログインの方法',
    '料金とお支払い',
    '各ツールの名前（ドヤバナー、ドヤ記事作成 など）',
    '保存したデータ',
    '運営会社（株式会社スリスタ）',
  ],
  faq: [
    { q: '以前のブックマークや、メールのリンクは使えますか？', a: 'はい、そのまま使えます。URLは変えていません。' },
    { q: '料金や契約の内容は変わりますか？', a: '変わりません。' },
    { q: 'ログインし直す必要はありますか？', a: 'ありません。これまでのアカウントで、そのままお使いいただけます。' },
  ],
} as const

/** アプリ内のお知らせ（ログイン後に1回だけ）。announcements.ts が、旗が on のときだけ足す */
export const RENAME_ANNOUNCEMENT = {
  id: RENAME_ANNOUNCEMENT_ID,
  title: `${BRAND_NAME_OLD}は「${BRAND_NAME_NEW}」に名前が変わりました`,
  body: 'サービス名だけが変わります。10月30日にお知らせした「ドヤ部下」から、「ドヤバディ」に改めました。URL・料金・アカウントは、これまでと同じです。くわしくは、お知らせのページをご覧ください。',
  href: RENAME_NEWS_PATH,
  pose: 'hello',
} as const

/** 旗が on のときだけ、お知らせの一覧に足す（旗が off なら空） */
export function renameAnnouncements(renamed: boolean = isBrandRenamed()): Array<typeof RENAME_ANNOUNCEMENT & { date: string }> {
  return renamed ? [{ ...RENAME_ANNOUNCEMENT, date: renameDate() }] : []
}
