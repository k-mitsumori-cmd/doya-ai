import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Metadata } from 'next'
import { buildServiceMetadata, SERVICE_SEO } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import PersonaShellFrame from '@/components/persona/PersonaShellFrame'

export const metadata: Metadata = buildServiceMetadata('persona', {
  keywords: SERVICE_SEO.persona.keywords,
})

const SVC = getServiceById('persona')!

export default async function PersonaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      {/* 未ログイン → 今のまま / 枠が有効 → ToolFrame だけ（枠は (shell)/layout.tsx） / それ以外 → 今のレイアウト */}
      {!session?.user ? children : <PersonaShellFrame>{children}</PersonaShellFrame>}
    </>
  )
}
