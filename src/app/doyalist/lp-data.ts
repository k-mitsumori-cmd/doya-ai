// ドヤリスト LPコンテンツ
// ⚠️ 外部の検索APIは使わない方針（gBizINFO が出所）。「ネット中から集める」等と書かないこと。
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#059669' // エメラルド（リスト・営業）
export const CTA = '/auth/signin?callbackUrl=/doyalist'

export const STEPS: Step[] = [
  { icon: 'search', title: '狙う条件を決める', desc: '業種・地域・規模などの条件から、AIが検索キーワードを広げます。' },
  { icon: 'list_alt', title: '企業リストが出る', desc: '法人情報をもとにリスト化します。CSV・Excelで書き出せます。' },
  { icon: 'mail', title: '営業文面まで作る', desc: 'フォーム営業文・新規開拓メール・電話スクリプトを、その企業に合わせて作れます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'verified', title: '出所のはっきりした情報', desc: '法人情報は gBizINFO（経済産業省の法人情報データベース）が出所です。素性の分からない収集はしていません。' },
  { icon: 'draw', title: 'リストで終わらない', desc: 'リストを作って終わりではなく、フォーム営業文・メール・電話スクリプトまで用意できます。' },
  { icon: 'table_view', title: '既存の運用に流せる', desc: 'CSV・Excelで書き出せるので、使っているスプレッドシートやSFAにそのまま取り込めます。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: '無料プランで月3プロジェクト・1プロジェクトあたり20社まで作成できます。プロプラン（月額9,980円）で広がります。' },
  { q: '企業情報の出所はどこですか？', a: 'gBizINFO（経済産業省の法人情報データベース）です。外部の検索サービスを使った収集は行っていません。' },
  { q: 'ウェブサイトが載っていない企業はどうなりますか？', a: '「登録URLなし」として表示します。推測でURLを埋めることはしません。' },
  { q: '作った文面はそのまま送れますか？', a: '叩き台としてお使いください。相手先に合わせて確認・調整いただく前提です。' },
]
