import { UNIFIED_PRO_PRICE } from '@/lib/unified-plan'
// ドヤ収入管理 LPコンテンツ
import type { Step, Benefit, Faq } from '@/components/lp'

export { INCOME_ACCENT as ACCENT } from '@/lib/income/brand'
export const CTA = '/auth/signin?callbackUrl=/income'

export const STEPS: Step[] = [
  { icon: 'description', title: '契約を登録する', desc: '取引先・月額・期間・支払条件を入れるだけ。計上月ごとの売上予定が自動で作られます。' },
  { icon: 'receipt_long', title: '毎月、請求書をまとめて作る', desc: '月次売上の一覧で請求する月を選ぶと、取引先ごとに請求書（適格請求書）ができます。' },
  { icon: 'account_balance', title: '入金を登録して消込む', desc: '入金額と振込名義を入れると、どの請求書の入金かの候補が出ます。確定は1クリックです。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'notification_important', title: '請求漏れに気づける', desc: '請求予定日を過ぎても請求書が無い月を、ダッシュボードに赤く表示します。手入力の予定表に頼りません。' },
  { icon: 'schedule', title: '入金の遅れがすぐ分かる', desc: '支払期日を過ぎて残高がある請求書を「入金遅延」として一覧にします。一部入金・手数料差引にも対応します。' },
  { icon: 'insights', title: '粗利も月ごとに確認できる', desc: 'ドヤプロマネの経費・人件費と合わせて、月ごとの売上・入金・支出・粗利を並べて見られます。' },
]

export const FAQ: Faq[] = [
  { q: '会計ソフトの代わりになりますか？', a: 'なりません。仕訳・決算・確定申告は、freee やマネーフォワードなどの会計ソフトをお使いください。ドヤ収入管理は、売上・請求・入金の金額を確かめるためのツールです。' },
  { q: 'インボイス制度に対応していますか？', a: '請求書には登録番号、税率ごとの対価の合計と消費税額を記載します。消費税の端数は、請求書1枚につき税率ごとに1回だけ切り捨てています。' },
  { q: '料金はかかりますか？', a: `開発中のため、現在は無料でお使いいただけます。正式公開後はプロプラン（月額${UNIFIED_PRO_PRICE.toLocaleString('ja-JP')}円・税込）1つで、ドヤAIの全サービスのプロ機能が使えます。` },
  { q: '銀行口座と連携できますか？', a: '現在は入金を手で登録していただく形です。銀行明細のCSV取り込みは今後追加する予定です。' },
]
