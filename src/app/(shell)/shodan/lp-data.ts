import { getServiceById } from '@/lib/services'
import { UNIFIED_PRO_PRICE } from '@/lib/unified-plan'
// ドヤ商談準備 LP コンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#7c3aed' // 青×バイオレット
export const CTA = '/auth/signin?callbackUrl=/shodan'

export const STEPS: Step[] = [
  { icon: 'travel_explore', title: 'URLを入力', desc: '商談先企業のURLを貼り付けるだけ。ログインしてすぐに始められます。' },
  { icon: 'psychology', title: 'AIが深掘り調査', desc: '公開情報から従業員数・マーケ状況・オウンドメディアの所在・PR TIMESの動向を調べます。' },
  { icon: 'description', title: 'プロで提案資料を生成', desc: 'プロプランでは現状分析・課題仮説・解決策・提案書を作成。自社情報も反映できます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'schedule', title: 'アポ前の調べ物を短縮', desc: '公開情報の収集を補助し、商談そのものの準備に集中できます。' },
  { icon: 'verified', title: '提案の質が安定する', desc: '現状分析→課題仮説→解決策の型で作るから、担当者ごとの品質のばらつきを抑えられます。' },
  { icon: 'groups', title: 'チームに型が広がる', desc: 'メンバー招待と組織スコープで、勝ちパターンの商談準備をチーム全体に展開できます。' },
]

export const FAQ: Faq[] = [
  { q: '対応していない業種はありますか？', a: 'Webサイトが公開されていれば、業種を問わず調査できます。公開情報が少ない企業では、仮説の粒度が下がることがあります。' },
  { q: '提案資料はそのまま使えますか？', a: 'プロプランでMarkdown形式の提案資料を生成し、コピーして資料に流用できます。公開情報と仮説は商談前に確認してください。' },
  { q: '無料で試せますか？', a: `無料プランは${getServiceById('shodan')!.pricing.free.limit}ご利用いただけます。プロプランは月額${UNIFIED_PRO_PRICE.toLocaleString('ja-JP')}円（税込）で、${getServiceById('shodan')!.pricing.pro.limit}ご利用いただけます。1つの契約で全サービスのプロプランが使えます。` },
  { q: 'チームで使えますか？', a: 'メンバー招待と組織スコープに対応しています。商談準備の型をチームで共有し、情報は組織ごとに安全に分離されます。' },
  { q: '入力した情報は安全に扱われますか？', a: '各データは組織スコープで他組織から分離されます。ログインユーザーの権限の範囲内でのみアクセスできます。' },
]
