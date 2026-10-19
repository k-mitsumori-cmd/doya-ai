import type { Metadata } from 'next'
import { buildServiceMetadata, generateToolSchema } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isShellEnabled } from '@/lib/ui-shell'
import DoyaSlideLayout from '@/components/doyaslide/DoyaSlideLayout'
import DoyaSlideShellFrame from '@/components/doyaslide/DoyaSlideShellFrame'

// 正本は services.ts。OGP/Twitterカード/siteName も含めて buildServiceMetadata に統一する
export const metadata: Metadata = buildServiceMetadata('doyaslide', {
  tagline: 'AIプレゼン資料作成ツール',
  keywords: ['プレゼン資料作成', 'AIスライド', '提案書作成', '営業資料', 'パワポ 自動生成', '登壇資料'],
})

export default async function Layout({ children }: { children: React.ReactNode }) {
  // 未ログインは今のまま（紹介ページの判定は DoyaSlideLayout がクライアントで行う）。ログイン済みで枠が有効なときだけ共通の枠
  // ⚠️ 今まではセッションを見ずに描いていた。ログインが分からないときは未ログインとして今のレイアウトにする
  const session = await getServerSession(authOptions).catch(() => null)
  const shell = Boolean(session?.user) && isShellEnabled('doyaslide')
  const toolSchema = generateToolSchema({ path: '/doyaslide', name: 'ドヤスライド', description: 'テーマを入力するだけでAIが構成からデザインまでプレゼン資料を自動生成するツール。', category: 'BusinessApplication', serviceId: 'doyaslide' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      {shell ? <DoyaSlideShellFrame>{children}</DoyaSlideShellFrame> : <DoyaSlideLayout>{children}</DoyaSlideLayout>}
    </>
  )
}
