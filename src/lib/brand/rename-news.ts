// ============================================
// 名前の変更のお知らせ（ドヤAI → ドヤ部下）の文面。アプリ内の知らせと、お知らせのページが使う
// ============================================
// ⚠️ このファイルには旧名「ドヤAI」を、わざと書いている。src/lib/brand/ は、ビルド時の置き換え（scripts/brand/rename-loader.cjs）の対象外。
// ⚠️ 文面は、本人と法務の確認前の案。yomiyasu の原則（短い文・主語と述語・比喩なし・絵文字なし）で書く。
// ⚠️ 旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときだけ出る。日付は NEXT_PUBLIC_BRAND_RENAME_DATE（YYYY-MM-DD。切り替える日）。
import { BRAND_EN_NEW, BRAND_NAME_NEW, BRAND_NAME_OLD } from './index'
import { isBrandRenamed } from './flag'

export const RENAME_NEWS_PATH = '/news/rename-doya-buka'
export const RENAME_ANNOUNCEMENT_ID = 'announce:brand-rename-doya-buka'

/** 切り替える日（YYYY-MM-DD、日本時間）。環境変数が無いときは、旗を on にしたビルドの既定日 */
export function renameDate(raw: string | undefined = process.env.NEXT_PUBLIC_BRAND_RENAME_DATE): string {
  return /^\d{4}-\d{2}-\d{2}$/.test((raw ?? '').trim()) ? (raw as string).trim() : '2026-11-01'
}

/** 「2026年11月1日」の形 */
export function renameDateLabel(date: string = renameDate()): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export const RENAME_NEWS = {
  title: `${BRAND_NAME_OLD}は「${BRAND_NAME_NEW}」に名前が変わりました`,
  description: `サービス名「${BRAND_NAME_OLD}」を「${BRAND_NAME_NEW}」（英語表記 ${BRAND_EN_NEW}）に変えました。URL・料金・アカウントは、これまでと同じです。`,
  lead: (dateLabel: string) =>
    `${dateLabel}に、サービス名を「${BRAND_NAME_OLD}」から「${BRAND_NAME_NEW}」（英語表記 ${BRAND_EN_NEW}）に変えました。サービスの中身は、これまでと同じです。`,
  changes: [
    'サービス名とロゴが「ドヤ部下」になります。',
    '画面・メール・お知らせの表記が「ドヤ部下」になります。',
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
  body: 'サービス名だけが変わります。URL・料金・アカウントは、これまでと同じです。くわしくは、お知らせのページをご覧ください。',
  href: RENAME_NEWS_PATH,
  pose: 'hello',
} as const

/** 旗が on のときだけ、お知らせの一覧に足す（旗が off なら空） */
export function renameAnnouncements(renamed: boolean = isBrandRenamed()): Array<typeof RENAME_ANNOUNCEMENT & { date: string }> {
  return renamed ? [{ ...RENAME_ANNOUNCEMENT, date: renameDate() }] : []
}
