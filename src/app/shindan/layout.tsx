import ShindanAppLayout from '@/components/ShindanAppLayout'

export const metadata = {
  title: 'ドヤ診断AI - ビジネス診断ダッシュボード',
  description: '業種・予算・課題からビジネスの強み・ボトルネック・最適解をAIが診断。レーダーチャートやグラフで可視化し、PDF書き出しにも対応。',
}

export default function ShindanLayout({ children }: { children: React.ReactNode }) {
  return <ShindanAppLayout>{children}</ShindanAppLayout>
}
