import type { Metadata } from 'next'
import { buildServiceMetadata, SERVICE_SEO } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import PersonaAppLayout from '@/components/PersonaAppLayout'

export const metadata: Metadata = buildServiceMetadata('persona', {
  keywords: SERVICE_SEO.persona.keywords,
})

const SVC = getServiceById('persona')!

export default function PersonaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <PersonaAppLayout>{children}</PersonaAppLayout>
    </>
  )
}
