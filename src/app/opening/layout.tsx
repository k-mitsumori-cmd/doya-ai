import type { Metadata } from 'next'
import OpeningAppLayout from '@/components/opening/OpeningAppLayout'

export const metadata: Metadata = {
  title: 'ドヤオープニングAI | URLからReactオープニングアニメーションを自動生成',
  description: 'URLを入れるだけで、サイトに最適化されたReactオープニングアニメーションを6種類自動生成。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <OpeningAppLayout>{children}</OpeningAppLayout>
}
