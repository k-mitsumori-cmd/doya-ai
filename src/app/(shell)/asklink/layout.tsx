import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AskLinkShellFrame from '@/components/asklink/AskLinkShellFrame'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('asklink', {
  tagline: 'URLを入れるだけで、ChatGPTに質問が届く「AIに聞く」リンクとバナー',
  keywords: ['AIに聞く ボタン', 'ChatGPT リンク', 'ポップアップ バナー', 'HubSpot ポップアップ', 'チャットボット 代わり'],
})

const SVC = getServiceById('asklink')!

export default async function AsklinkLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
        faq={FAQ}
      />
      {/* ⚠️ 未ログインをアプリ枠で包まない（空のサイドバーが出る） */}
      {/* ログイン後は ToolFrame だけ（枠は (shell)/layout.tsx が出す） */}
      {session?.user
        ? <AskLinkShellFrame>{children}</AskLinkShellFrame>
        : children}
    </>
  )
}
