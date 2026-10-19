import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isShellEnabled } from '@/lib/ui-shell'
import { LpJsonLd } from '@/components/lp'
import SfaShellFrame from '@/components/sfa/SfaShellFrame'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('sfa', {
  tagline: '取引先・商談・タスクを一元管理するSFA',
  keywords: ['SFA', '営業管理', '商談管理', 'パイプライン管理', '取引先管理', '中小企業 SFA', 'かんたんSFA', '営業DX'],
})

const SVC = getServiceById('sfa')!

export default async function SfaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ui.shell.sfa が ON のときだけ ToolFrame で包む（未ログインのLPは今のまま。OFF の間は [orgSlug]/layout.tsx のサイドバー）。
  // ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは包まない
  const shell = Boolean(session?.user) && isShellEnabled('sfa')
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
      {shell ? <SfaShellFrame>{children}</SfaShellFrame> : children}
    </>
  )
}
