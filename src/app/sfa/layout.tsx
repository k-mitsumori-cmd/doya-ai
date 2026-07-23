import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('sfa', {
  keywords: ['SFA', '営業管理', '商談管理', 'パイプライン管理', '取引先管理', '中小企業 SFA', 'かんたんSFA', '営業DX'],
})

const SVC = getServiceById('sfa')!

export default function SfaLayout({ children }: { children: React.ReactNode }) {
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
      {children}
    </>
  )
}
