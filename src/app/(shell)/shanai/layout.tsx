import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ShanaiFrame from '@/components/shanai/ShanaiFrame'
import ds from '@/components/ds/tokens.module.css'
import { isShellEnabled } from '@/lib/ui-shell'
import '@/components/shanai/tokens.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS）の間は noindex。公開するときに外す（reference/services/shanai.md）
export const metadata: Metadata = buildServiceMetadata('shanai', {
  tagline: '録音とアンケートから、会社の魅力が伝わる社員インタビュー記事を自動で作成',
  keywords: ['社員インタビュー 作成', '社員インタビュー AI', '採用広報 記事', '社内報 インタビュー', 'インタビュー 文字起こし 記事化'],
  noindex: true,
})

export default async function ShanaiLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ⚠️ 未ログインをアプリ枠で包まない（空のサイドバーが出る）。社員が開く回答画面もアプリ枠の外（guest-path.ts）
  // トークンは ds（段0）の .ds と、その補い（tokens.css の .shanai-ds）の中だけで効く。LP・アプリ・回答画面のすべてを包む
  // 共通シェルは ui.shell.shanai（環境変数 UI_SHELL_SERVICES）が ON のときだけ。回答画面には出さない（ShanaiFrame）
  return (
    <div className={`${ds.ds} shanai-ds`}>
      {session?.user ? (
        <ShanaiFrame shell={isShellEnabled('shanai')}>
          {children}
        </ShanaiFrame>
      ) : (
        children
      )}
    </div>
  )
}
