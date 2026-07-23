import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import CunningLayoutShell from '@/components/cunning/CunningLayoutShell'

export const metadata: Metadata = buildServiceMetadata('cunning', {
  keywords: ['Web会議 AI', 'AIカンペ', 'リアルタイム文字起こし', '商談支援', '面接対策', 'カスタマーサポート', 'AI回答', '質問検出'],
})

const SVC = getServiceById('cunning')!

export default function CunningLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <CunningLayoutShell>{children}</CunningLayoutShell>
    </>
  )
}
