// ドヤペルソナAI LPコンテンツ
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#7c3aed' // バイオレット（発想・分析）
export const CTA = '/auth/signin?callbackUrl=/persona'

export const STEPS: Step[] = [
  { icon: 'inventory_2', title: '商材と業界を入れる', desc: '売っているものと届けたい相手のイメージを入力します。細かい設定は要りません。' },
  { icon: 'groups', title: 'ペルソナが出る', desc: '年齢・職種・課題・情報収集の仕方まで、施策に使える粒度で書き出します。' },
  { icon: 'description', title: 'そのまま指示書にする', desc: 'ペルソナシートとして出力し、LP構成や制作会社への指示、コピーの叩き台に使えます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'bolt', title: '叩き台がすぐ出る', desc: 'ゼロから考える時間を省けます。出てきたものを直す方が、白紙から書くより速く進みます。' },
  { icon: 'tune', title: '業界と商材に寄せる', desc: '汎用のテンプレートではなく、入力した商材に合わせた課題と行動を書き出します。' },
  { icon: 'handshake', title: '社内で共有できる', desc: '「誰に向けて作るか」を1枚にまとめられるので、制作会社やチーム内で認識を揃えられます。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: '無料プランで1日5件まで作成できます。プロプラン（月額9,980円）で上限が広がり、ドヤシリーズの他サービスもすべてお使いいただけます。' },
  { q: '出てきたペルソナはそのまま使えますか？', a: '叩き台としてお使いください。実際の顧客像とずれる部分は編集していただく前提です。ゼロから考えるより速く形になります。' },
  { q: 'どんな場面で使われていますか？', a: 'LPの構成案、制作会社への指示書、コピーの方向性決め、広告のターゲット設定などです。' },
]
