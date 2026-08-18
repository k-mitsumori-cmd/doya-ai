// ドヤ広告画像AI LPコンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#65a30d' // ライム（広告・クリエイティブ）
export const CTA = '/auth/signin?callbackUrl=/adimage'

export const STEPS: Step[] = [
  { icon: 'link', title: 'サービスURLを入れる', desc: 'ブランド情報を読み取り、広告コピーの案を作ります。ロゴを登録すれば合成もできます。' },
  { icon: 'grid_view', title: '出力する配置を選ぶ', desc: 'Meta・Google・X・LINE・Yahoo! の各配置から必要なものを選びます。' },
  { icon: 'download', title: '媒体別ZIPで受け取る', desc: 'そのまま入稿できる実寸で書き出し、媒体別に整理したZIPでまとめて落とせます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'text_fields', title: '文字を画像に描き込む', desc: '後から重ねるのではなく画像に直接描き込むため、デザインとして一体感があります。' },
  { icon: 'crop_free', title: '切り抜きで文字が切れない', desc: '目標サイズと同じ比率で生成してから縮小するだけなので、トリミングによる文字切れが起きません。' },
  { icon: 'spellcheck', title: '描かれた文字を自動で検査', desc: '指定した文字が正しく描かれたかを生成後に検査し、不合格なら作り直します。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: '無料プランで1日5コンセプトまで作成できます。プロプラン（月額9,980円）で1日40コンセプト・改善無制限・ZIP一括に広がります。' },
  { q: '1コンセプトとは何ですか？', a: 'コピーと画像の組み合わせ1案のことです。1つのコンセプトから何サイズ書き出しても1回と数えるので、配置を多く選んでも不利になりません。' },
  { q: '仕上がりが気に入らないときは？', a: 'ボタンを押すだけでAIが実際の画像を見て採点し、具体的な改善を反映した次の案を作ります。' },
  { q: '作ったものは後から見られますか？', a: '履歴画面から直近50件を配置ごとに見返せます。ZIPの再ダウンロードもできます。' },
]
