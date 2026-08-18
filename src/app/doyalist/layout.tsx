import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import DoyalistLayout from '@/components/doyalist/DoyalistLayout'

export const metadata: Metadata = buildServiceMetadata('doyalist', {
  keywords: ['営業リスト', '営業リスト自動生成', '営業AI', 'フォーム営業文', '営業メール文面', '荷電スクリプト', '新規開拓', 'リスト作成'],
})

const SVC = getServiceById('doyalist')!

// ⚠️ 未ログインではアプリ枠（DoyalistLayout）を被せないこと。
//    DoyalistLayout はクライアントで useSession を待つあいだ「読み込み中...」だけを
//    描くため、被せるとLPの本文がHTMLに1文字も入らず、検索から来た方には
//    空のページに見える（実際に本番で可視118字になっていた）。
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return (
      <>
        <LpJsonLd
          name={SVC.name}
          path={SVC.href}
          description={SVC.longDescription || SVC.description}
          category="BusinessApplication"
          features={SVC.features}
        />
        {children}
      </>
    )
  }
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <DoyalistLayout>{children}</DoyalistLayout>
    </>
  )
}
