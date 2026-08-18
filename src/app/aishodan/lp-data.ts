// ドヤAI商談 LPコンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#ea580c' // オレンジ（商談・対話）
export const CTA = '/auth/signin?callbackUrl=/aishodan'

export const STEPS: Step[] = [
  { icon: 'inventory_2', title: '商材を登録する', desc: 'サービスURLから商材ナレッジと商談シナリオを自動で作ります。資料を足せば回答の根拠が増えます。' },
  { icon: 'share', title: '商談URLを配る', desc: '見込み客に渡すURLを発行します。相手はログイン不要、スマートフォンでも参加できます。' },
  { icon: 'assignment_turned_in', title: '結果を受け取る', desc: '全文ログ・ヒアリング項目・理想顧客像との適合度が残ります。Slackにも届きます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'support_agent', title: '一次対応の取りこぼしを無くす', desc: '問い合わせが来た瞬間に商談を始められます。担当者の手が空くまで待たせません。' },
  { icon: 'menu_book', title: '資料にある事だけ答える', desc: '根拠が無い質問には推測で答えず、「確認してご連絡します」と返して記録します。誤った説明で信用を落としません。' },
  { icon: 'event_available', title: '日程調整までつなぐ', desc: '商談の流れの中で日程調整のリンクを出せます。実際の担当者との面談まで一続きです。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: '無料プランで商材1件・商談5件までお試しいただけます。プロプラン（月額9,980円）で商談が無制限になります。' },
  { q: '見込み客はログインが必要ですか？', a: '不要です。お渡しするURLを開くだけで参加できます。スマートフォンにも対応しています。' },
  { q: 'AIが答えられない質問はどうなりますか？', a: '推測では答えません。答えられなかった質問は記録として残るので、資料に足していくほど回答できる範囲が広がります。' },
  { q: '商談の内容は残りますか？', a: '全文ログと要約、ヒアリング項目、適合度の判定理由が残ります。判定は参考値で、最終的な判断は担当者が行う前提の作りです。' },
]
