import ShindanAppLayout from '@/components/ShindanAppLayout'

export const metadata = {
  title: 'ドヤWeb診断AI',
  description: 'WebサイトのSEO・コンテンツ・コンバージョンを7軸で分析し、競合と比較した改善点を洗い出します',
}

export default function ShindanLayout({ children }: { children: React.ReactNode }) {
  return <ShindanAppLayout>{children}</ShindanAppLayout>
}
