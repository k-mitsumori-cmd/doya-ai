import type { Metadata } from 'next'
import { buildServiceMetadata, SERVICE_SEO } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { SeoAppLayout } from '@/components/SeoAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = buildServiceMetadata('seo', {
  keywords: SERVICE_SEO.seo.keywords,
})

const SVC = getServiceById('seo')!

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const isLoggedIn = !!user?.id
  const planRaw = String(user?.seoPlan || user?.plan || (isLoggedIn ? 'FREE' : 'GUEST')).toUpperCase()
  const currentPlan =
    planRaw === 'PRO'
      ? 'PRO'
      : planRaw === 'ENTERPRISE'
        ? 'ENTERPRISE'
        : planRaw === 'FREE'
          ? 'FREE'
          : planRaw === 'GUEST'
            ? 'GUEST'
            : 'UNKNOWN'
  const firstLoginAt = (user?.firstLoginAt as any) || null

  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <SeoAppLayout currentPlan={currentPlan as any} isLoggedIn={isLoggedIn} firstLoginAt={firstLoginAt}>
        {children}
      </SeoAppLayout>
    </>
  )
}