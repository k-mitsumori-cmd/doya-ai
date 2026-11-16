import { getServiceById } from '@/lib/services'
import { PUBLIC_PRICE_SENTENCE } from '@/lib/pricing-v2/public-copy'
// ドヤHR LP コンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#0284c7' // sky（ドヤHRのブランドカラー）
export const CTA = '/hr/dashboard'

export const STEPS: Step[] = [
  { icon: 'group_add', title: '従業員を登録', desc: '氏名・部署・役職・等級を入力するだけ。CSV一括インポートにも対応し、既存のExcel管理からすぐに移行できます。' },
  { icon: 'assignment', title: '評価をオンライン化', desc: 'MBOの目標設定からスコアリング、フィードバックまでを一つの画面で。組織図も従業員データから自動で生成されます。' },
  { icon: 'auto_awesome', title: 'AIが評価を支援', desc: '評価コメントをAIが下書き。担当者の負担を減らし、データにもとづいた人材マネジメントを後押しします。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'inventory_2', title: 'バラバラの管理を一元化', desc: 'Excelやメールに散らばった従業員情報・評価・1on1記録を、ひとつのデータベースにまとめて管理できます。' },
  { icon: 'edit_note', title: '評価の手間を軽くする', desc: 'AIが評価コメントを下書きするから、書き出しに悩む時間を短縮。評価の型が揃い、担当者ごとのばらつきも抑えられます。' },
  { icon: 'trending_up', title: '小さく始めて広げられる', desc: '従業員5名までは永久無料。人数が増えても、プロプランへアップグレードできます。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: `無料の枠は${getServiceById('hr')!.pricing.free.limit}ご利用いただけます。${PUBLIC_PRICE_SENTENCE}` },
  { q: '料金プランを教えてください。', a: `${PUBLIC_PRICE_SENTENCE}さらに拡張が必要な場合は個別にご相談を承ります。` },
  { q: 'Excelで管理しているデータを移行できますか？', a: 'CSVの一括インポート／エクスポートに対応しています。既存の従業員リストを取り込んで、そのまま使い始められます。' },
  { q: 'AIは何をしてくれますか？', a: '人事評価のコメントをAIが下書きします。ゼロから書く負担を減らし、評価の粒度を揃えるサポートをします。最終的な内容はご担当者が確認・調整いただけます。' },
  { q: '少人数の会社でも使えますか？', a: '中小企業のために設計しています。5名までの無料プランから始められるため、小さなチームでもタレントマネジメントを無理なく導入できます。' },
  { q: 'データは安全に扱われますか？', a: '各データは組織ごとに分離して管理され、ログインしたユーザーの権限の範囲内でのみアクセスできます。' },
]
