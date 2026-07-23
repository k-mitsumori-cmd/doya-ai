// ドヤ商談準備 LP コンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#7c3aed' // 青×バイオレット
export const CTA = '/auth/signin?callbackUrl=/shodan'

export const STEPS: Step[] = [
  { icon: 'travel_explore', title: 'URLを入力', desc: '商談先企業のURLを貼り付けるだけ。ログインしてすぐに始められます。' },
  { icon: 'psychology', title: 'AIが深掘り調査', desc: '従業員数・マーケ状況・オウンドメディア・PR TIMESの動向まで自動で収集し、現状分析と課題仮説を作成します。' },
  { icon: 'description', title: '提案資料が完成', desc: '解決策と提案書（Markdown）を一括生成。自社情報を登録すれば、自社の商材・強みに最適化されます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'schedule', title: 'アポ前の調べ物がゼロに', desc: '手作業だったリサーチを数分に短縮。商談そのものの準備に集中できます。' },
  { icon: 'verified', title: '提案の質が安定する', desc: '現状分析→課題仮説→解決策の型で作るから、担当者ごとの品質のばらつきを抑えられます。' },
  { icon: 'groups', title: 'チームに型が広がる', desc: 'メンバー招待と組織スコープで、勝ちパターンの商談準備をチーム全体に展開できます。' },
]

export const FAQ: Faq[] = [
  { q: '対応していない業種はありますか？', a: 'Webサイトが公開されていれば、業種を問わず調査できます。公開情報が少ない企業では、仮説の粒度が下がることがあります。' },
  { q: '提案資料はそのまま使えますか？', a: 'Markdown形式で出力され、コピーして資料に流用できます。自社情報を登録しておくと、自社の商材・強みに最適化された提案になります。' },
  { q: '無料で試せますか？', a: '無料プランで企業調査を月5件までお試しいただけます。提案資料・スライドの生成はプロプラン（月額9,980円）の機能です。' },
  { q: 'チームで使えますか？', a: 'メンバー招待と組織スコープに対応しています。商談準備の型をチームで共有し、情報は組織ごとに安全に分離されます。' },
  { q: '入力した情報は安全に扱われますか？', a: '各データは組織スコープで他組織から分離されます。ログインユーザーの権限の範囲内でのみアクセスできます。' },
]
