import { getServiceById } from '@/lib/services'
import { UNIFIED_PRO_PRICE } from '@/lib/unified-plan'
// ドヤ記事作成 LPコンテンツ（Lp.tsx の表示と layout の JSON-LD で共有）
// ⚠️ 実績数値（導入社数・順位改善率など）は持っていないので書かない。
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#334155' // スレート（文章・信頼）
export const CTA = '/auth/signin?callbackUrl=/seo'

export const STEPS: Step[] = [
  { icon: 'travel_explore', title: 'キーワードと参考URLを入れる', desc: '検索意図を読み取り、記事の骨組み（アウトライン）を作ります。参考URLは要点化して使い、丸写しはしません。' },
  { icon: 'article', title: 'セクションごとに書き上げる', desc: '章ごとに分割して生成し、前後の整合性を確認しながら積み上げます。長文でも話が破綻しません。' },
  { icon: 'fact_check', title: '監査して直す', desc: '生成後に二重チェックを走らせ、事実の食い違いや薄い箇所を自動で修正します。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'content_copy_off', title: '参考記事を丸写ししない', desc: '参考URLは要点に落としてから使います。他社の文章をそのまま持ってくる作りにしていません。' },
  { icon: 'linked_services', title: '長文でも話が繋がる', desc: 'セクション分割生成に整合性チェックを挟むため、章ごとに主張がぶれる長文になりません。' },
  { icon: 'image', title: '図解とバナーも作れる', desc: '本文に合わせた図解画像とアイキャッチを生成し、リンク切れの確認まで行えます。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: `無料プランは${getServiceById('seo')!.pricing.free.limit}ご利用いただけます。プロプランは月額${UNIFIED_PRO_PRICE.toLocaleString('ja-JP')}円（税込）で、${getServiceById('seo')!.pricing.pro.limit}ご利用いただけます。1つの契約で全サービスのプロプランが使えます。` },
  { q: '参考URLの内容をそのまま使いますか？', a: 'いいえ。参考URLは要点に落としてから構成の材料にします。原文をそのまま持ってくる処理は入れていません。' },
  { q: 'LLMO（AI検索）にも効きますか？', a: '検索意図のクラスタからアウトラインを作り、結論を先に置く構成にしています。AIに引用されやすい形を意識した作りです。' },
  { q: '書いた記事はどこに出せますか？', a: '本文はエディタで編集でき、テキスト・Markdown・HTML・JSONで書き出せます。note向けの書き出しにも対応しています。' },
]
