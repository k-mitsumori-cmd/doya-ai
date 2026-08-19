import type { Benefit, Faq, Step } from '@/components/lp'

export const ACCENT = '#009bff'
export const CTA = '/auth/signin?callbackUrl=/doyaslide/new'

export const STEPS: Step[] = [
  { icon: 'edit_note', title: 'テーマと用途を入れる', desc: '提案書、営業資料、SNSなど用途と伝えたい内容を入力します。' },
  { icon: 'view_carousel', title: '構成と全ページを作る', desc: '資料の流れを組み、選んだスタイルで各ページを画像として生成します。' },
  { icon: 'download', title: '直して書き出す', desc: 'ページごとに会話で修正し、PNG・PDF・ZIPで書き出せます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'auto_awesome', title: '全ページを一つの世界観に', desc: '構成だけでなく、各ページのビジュアルまで同じ方向性で作ります。' },
  { icon: 'chat', title: 'ページ単位で直せる', desc: '変更したいページを選び、会話で指示して再生成できます。' },
  { icon: 'picture_as_pdf', title: 'そのまま共有できる', desc: 'PNG、PDF、ZIPで書き出し、提案やSNS投稿に使えます。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: '無料プランで月3プロジェクト・20枚まで作成できます。' },
  { q: 'どの形式で書き出せますか？', a: 'PNG画像のZIPとPDFに対応しています。' },
  { q: '生成後に修正できますか？', a: 'はい。ページごとに会話で修正を指示し、以前の版へ戻すこともできます。' },
  { q: 'ロゴを入れられますか？', a: 'はい。アップロードしたロゴの位置と大きさを設定し、全ページに反映できます。' },
]
